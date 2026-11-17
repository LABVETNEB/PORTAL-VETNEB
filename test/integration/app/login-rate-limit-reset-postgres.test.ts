import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

import "dotenv/config";
import { inArray } from "drizzle-orm";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";

const databaseUrl =
  process.env.SUPABASE_DB_URL?.trim() ?? process.env.DATABASE_URL?.trim();
const databaseTarget = databaseUrl ? new URL(databaseUrl) : undefined;

if (
  !databaseTarget ||
  !["localhost", "127.0.0.1"].includes(databaseTarget.hostname) ||
  databaseTarget.pathname !== "/portal_vetneb_ci"
) {
  throw new Error(
    "SEC-10 requiere DATABASE_URL o SUPABASE_DB_URL para la DB aislada portal_vetneb_ci",
  );
}

process.env.DATABASE_URL = databaseUrl;
process.env.SUPABASE_DB_URL = databaseUrl;

const dbModule = await import("../../../server/db.ts");
const { db, closeDbConnection } = dbModule;
const { loginRateLimits } = await import("../../../drizzle/schema.ts");
const {
  buildLoginIdentifierCeilingKey,
  buildLoginRateLimitKey,
  getLoginRateLimitKeyMetadata,
} = await import("../../../server/lib/login-rate-limit.ts");
const { consumeRateLimitAttempt, createPersistentRateLimitStore, hashRateLimitKey } =
  await import("../../../server/lib/rate-limit-store.ts");

// Same wiring as the auth routes: metadata derived from the key.
const store = createPersistentRateLimitStore(
  {
    get: dbModule.getLoginRateLimitEntry,
    set: dbModule.setLoginRateLimitEntry,
    increment: dbModule.incrementLoginRateLimitEntry,
    consume: dbModule.consumeLoginRateLimitAttempt,
    cleanupExpired: dbModule.deleteExpiredLoginRateLimitEntries,
    delete: dbModule.deleteLoginRateLimitEntry,
  },
  { metadataForKey: getLoginRateLimitKeyMetadata },
);

const WINDOW_MS = 15 * 60 * 1000;
const RUN = `${process.pid}-${Date.now()}`;
// Documentation ranges only: synthetic identifiers and origins.
const ID_A = `reset-a-${RUN}@example.test`;
const ID_B = `reset-b-${RUN}@example.test`;
const IP_1 = "198.51.100.11";
const IP_2 = "198.51.100.12";

const loginKey = (surface: "clinic" | "admin", identifier: string, ip: string) =>
  buildLoginRateLimitKey({ surface, identifier, ipAddress: ip });
const ceilingKey = (identifier: string) => buildLoginIdentifierCeilingKey(identifier);

const allKeys = [
  loginKey("clinic", ID_A, IP_1),
  loginKey("clinic", ID_A, IP_2),
  loginKey("admin", ID_A, IP_1),
  loginKey("clinic", ID_B, IP_1),
  ceilingKey(ID_A),
  ceilingKey(ID_B),
];

async function charge(key: string) {
  // Same path as the runtime: metadata is derived from the key by the store.
  await consumeRateLimitAttempt(store, key, { windowMs: WINDOW_MS, now: Date.now() });
}

async function seed() {
  await cleanup();
  for (const key of allKeys) {
    await charge(key);
  }
}

async function cleanup() {
  await db.delete(loginRateLimits).where(inArray(loginRateLimits.keyHash, allKeys.map(hashRateLimitKey)));
}

async function present() {
  const rows = await db
    .select({ keyHash: loginRateLimits.keyHash })
    .from(loginRateLimits)
    .where(inArray(loginRateLimits.keyHash, allKeys.map(hashRateLimitKey)));
  const hashes = new Set(rows.map((row) => row.keyHash));
  return allKeys.filter((key) => hashes.has(hashRateLimitKey(key)));
}

function runReset(args: string[], env: Record<string, string> = {}) {
  const result = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--experimental-specifier-resolution=node",
      "scripts/dev/reset-login-rate-limit.ts",
      ...args,
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, DATABASE_URL: databaseUrl, SUPABASE_DB_URL: databaseUrl, ...env },
      timeout: 60_000,
    },
  );
  return { status: result.status, out: `${result.stdout}\n${result.stderr}` };
}

test("SEC-10 reset: techo por identificador sobre PostgreSQL real", async (t) => {
  t.after(async () => {
    try {
      await cleanup();
    } finally {
      await closeDbConnection();
    }
  });

  await t.test("el techo se guarda sin metadata (motivo del defecto)", async () => {
    assert.equal(getLoginRateLimitKeyMetadata(ceilingKey(ID_A)), undefined);
  });

  await t.test("dry-run no modifica nada y no expone datos sensibles", async () => {
    await seed();
    const before = await present();
    const result = runReset(["--surface", "clinic", "--identifier", ID_A]);

    assert.equal(result.status, 0, result.out);
    assert.match(result.out, /DRY-RUN/);
    assert.match(result.out, /Dry-run only/);
    assert.match(result.out, /Identifier ceiling: INCLUDED/);
    assert.match(result.out, /identifier-ceiling/);
    assert.deepEqual(await present(), before);
    assert.equal(result.out.includes(ID_A), false);
    assert.equal(result.out.includes(databaseUrl as string), false);
  });

  await t.test("con --ip-address el reset queda limitado a esa IP y conserva el techo", async () => {
    await seed();
    const result = runReset(["--surface", "clinic", "--identifier", ID_A, "--ip-address", IP_1, "--force"]);

    assert.equal(result.status, 0, result.out);
    assert.match(result.out, /Identifier ceiling: EXCLUDED/);
    const left = await present();
    assert.equal(left.includes(loginKey("clinic", ID_A, IP_1)), false, "contador de la IP borrado");
    assert.ok(left.includes(ceilingKey(ID_A)), "techo conservado");
    assert.ok(left.includes(loginKey("clinic", ID_A, IP_2)), "otra IP intacta");
    assert.ok(left.includes(loginKey("admin", ID_A, IP_1)), "otra superficie intacta");
    assert.ok(left.includes(loginKey("clinic", ID_B, IP_1)), "otro identificador intacto");
  });

  await t.test("--ip-address con --include-identifier-ceiling borra IP y techo, no otros", async () => {
    await seed();
    const result = runReset([
      "--surface", "clinic", "--identifier", ID_A, "--ip-address", IP_2,
      "--include-identifier-ceiling", "--force",
    ]);

    assert.equal(result.status, 0, result.out);
    assert.match(result.out, /Identifier ceiling: INCLUDED/);
    const left = await present();
    assert.equal(left.includes(ceilingKey(ID_A)), false);
    assert.equal(left.includes(loginKey("clinic", ID_A, IP_2)), false);
    assert.ok(left.includes(loginKey("clinic", ID_A, IP_1)), "otra IP intacta");
    assert.ok(left.includes(ceilingKey(ID_B)), "techo de otro identificador intacto");
    assert.ok(left.includes(loginKey("clinic", ID_B, IP_1)));
  });

  await t.test("sin IP, el techo compartido se borra con identificador normalizado y sin tocar otros", async () => {
    await seed();
    const result = runReset(["--surface", "clinic", "--identifier", `  ${ID_A.toUpperCase()}  `, "--force"]);

    assert.equal(result.status, 0, result.out);
    assert.match(result.out, /Deleted rows\s+: 3/);
    const left = await present();
    assert.equal(left.includes(ceilingKey(ID_A)), false, "techo borrado (normalización canónica)");
    assert.equal(left.includes(loginKey("clinic", ID_A, IP_1)), false);
    assert.equal(left.includes(loginKey("clinic", ID_A, IP_2)), false);
    assert.ok(left.includes(loginKey("admin", ID_A, IP_1)), "contador de otra superficie intacto");
    assert.ok(left.includes(ceilingKey(ID_B)));
    assert.ok(left.includes(loginKey("clinic", ID_B, IP_1)));
  });

  await t.test("una falla de PostgreSQL termina con error y sin éxito aparente", async () => {
    const dead = "postgresql://postgres:postgres@127.0.0.1:1/portal_vetneb_ci";
    const result = runReset(
      ["--surface", "clinic", "--identifier", ID_A, "--force"],
      { DATABASE_URL: dead, SUPABASE_DB_URL: dead },
    );

    assert.notEqual(result.status, 0);
    assert.match(result.out, /reset-login-rate-limit failed/);
    assert.equal(/Deleted rows/.test(result.out), false);
    assert.equal(result.out.includes("postgres:postgres"), false);
  });
});
