import assert from "node:assert/strict";
import test from "node:test";

import { readSourceFile } from "../../helpers/tracked-source-files.ts";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const { deleteExpiredGlobalSearchStates } = await import(
  "../../../server/features/global-search/infrastructure/global-search-state-repository.ts"
);
const { isUndefinedTableError } = await import("../../../server/preflight.ts");

// GLOBAL-SEARCH-DRIVE-A4 retention: the migration and the repository are read as
// source because no PostgreSQL is available here; the real plan is in the
// certification matrix of docs/implementation/global-search-drive-a-canonical-query.md.

const read = (path: string) => readSourceFile(path);
const migration = read("drizzle/migrations/0031_global_search_states.sql");
const repository = read("server/features/global-search/infrastructure/global-search-state-repository.ts");
const preflight = read("server/preflight.ts");

test("0031 ties every state to a live session with cascading foreign keys, one owner and no free text beyond 200", () => {
  assert.match(migration, /"clinic_session_token_hash" varchar\(64\)\s+REFERENCES "active_sessions" \("token_hash"\) ON DELETE CASCADE/);
  assert.match(migration, /"admin_session_token_hash" varchar\(64\)\s+REFERENCES "admin_sessions" \("token_hash"\) ON DELETE CASCADE/);
  assert.match(migration, /CONSTRAINT "global_search_states_surface_owner_check" CHECK/);
  assert.match(migration, /"query_text" varchar\(200\) NOT NULL/);
  assert.match(migration, /"expires_at" timestamp NOT NULL/);
  assert.ok(!/\bresult|cursor|hits\b/i.test(migration.replace(/--.*$/gm, "")), "no result or cursor column");
});

test("0031 indexes serve every query: per session ordering, and the expiry sweep", () => {
  assert.match(migration, /global_search_states_clinic_session_idx"\s+ON "global_search_states" \("clinic_session_token_hash", "created_at"\)/);
  assert.match(migration, /global_search_states_admin_session_idx"\s+ON "global_search_states" \("admin_session_token_hash", "created_at"\)/);
  assert.match(migration, /global_search_states_expires_at_idx"\s+ON "global_search_states" \("expires_at"\)/);
  assert.match(migration, /DROP TABLE IF EXISTS "global_search_states"/, "the rollback is written next to the migration");
});

test("a save is one transaction under a per-session lock; its cleanup is bounded and never waits", () => {
  assert.match(repository, /database\.transaction\(/);
  assert.match(repository, /pg_advisory_xact_lock\(hashtext\(/);
  assert.match(repository, /for update skip locked/);
  assert.match(repository, /limit \$\{OPPORTUNISTIC_CLEANUP_BATCH\}/);
  assert.match(repository, /OPPORTUNISTIC_CLEANUP_BATCH = 50/);
  // Own rows are cleaned by owner, expired ones by the indexed expiry only.
  assert.match(repository, /lte\(globalSearchStates\.expiresAt, now\)/);
  assert.match(repository, /GLOBAL_SEARCH_STATE_MAX_PER_SESSION - 1/);
  assert.ok(!/\.delete\(globalSearchStates\)\s*;/.test(repository), "no unconditional delete");
});

test("a read is filtered by id, surface, owning session and the expiry, so an expired row is invisible", () => {
  const find = repository.slice(repository.indexOf("async find("));
  for (const predicate of [
    "eq(globalSearchStates.id, id)",
    "eq(globalSearchStates.surface, owner.surface)",
    "eq(ownerColumn(owner), owner.sessionTokenHash)",
    "gt(globalSearchStates.expiresAt, new Date(nowMs))",
  ]) {
    assert.ok(find.includes(predicate), predicate);
  }
});

test("deleteExpiredGlobalSearchStates deletes only rows expired at `now` and reports how many", async () => {
  const seen: unknown[] = [];
  const fake = {
    delete() {
      return {
        where(condition: unknown) {
          seen.push(condition);
          return { returning: async () => [{ id: "a" }, { id: "b" }, { id: "c" }] };
        },
      };
    },
  };
  const removed = await deleteExpiredGlobalSearchStates(fake as never, Date.parse("2026-11-11T00:00:00.000Z"));
  assert.equal(removed, 3);
  assert.ok(seen.every((condition) => condition !== undefined), "never an unconditional delete");
});

test("startup sweeps expired states next to expired sessions, and a missing table never blocks startup", () => {
  assert.ok(preflight.includes("searchModule.deleteExpiredGlobalSearchStates()"));
  assert.ok(preflight.includes('"global_search_states"'));
  assert.equal(isUndefinedTableError({ code: "42P01" }), true);
  assert.equal(isUndefinedTableError({ cause: { code: "42P01" } }), true);
  assert.equal(isUndefinedTableError({ code: "23505" }), false);
  assert.equal(isUndefinedTableError(new Error("boom")), false);
  assert.equal(isUndefinedTableError(null), false);
});

test("revocation and expiry of a session are physical deletes, which the cascade follows", () => {
  const db = read("server/db.ts");
  for (const name of ["deleteActiveSession", "deleteExpiredSessions", "deleteAdminSession", "deleteExpiredAdminSessions"]) {
    const body = db.slice(db.indexOf(`export async function ${name}`));
    assert.match(body.slice(0, 400), /\.delete\((activeSessions|adminSessions)\)/, name);
  }
});
