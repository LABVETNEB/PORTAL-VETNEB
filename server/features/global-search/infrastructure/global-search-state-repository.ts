import { randomUUID } from "node:crypto";

import { and, asc, desc, eq, gt, lte, sql } from "drizzle-orm";

import { db } from "../../../db.ts";
import { activeSessions, adminSessions, globalSearchStates } from "../../../../drizzle/schema.ts";
import type { GlobalSearchStateRepository } from "../application/global-search-state-use-cases.ts";
import {
  GLOBAL_SEARCH_STATE_MAX_PER_SESSION,
  resolveGlobalSearchStateExpiry,
  type GlobalSearchStateOwner,
} from "../domain/index.ts";

/** Expired rows another save may clear opportunistically: bounded, never waits on a lock. */
const OPPORTUNISTIC_CLEANUP_BATCH = 50;

/**
 * Physically deletes every expired state (startup preflight). Sessions that ended
 * are already gone by cascade; this clears states that expired under a session
 * that is still alive. The `expires_at` index bounds the scan.
 */
export async function deleteExpiredGlobalSearchStates(
  database: typeof db = db,
  nowMs: number = Date.now(),
): Promise<number> {
  const removed = await database
    .delete(globalSearchStates)
    .where(lte(globalSearchStates.expiresAt, new Date(nowMs)))
    .returning({ id: globalSearchStates.id });
  return removed.length;
}

function ownerColumn(owner: GlobalSearchStateOwner) {
  return owner.surface === "clinic"
    ? globalSearchStates.clinicSessionTokenHash
    : globalSearchStates.adminSessionTokenHash;
}

/**
 * Rows are owned by a session row (FK ON DELETE CASCADE): logout, revocation
 * and session cleanup delete them. Expiry is also enforced at read time, so an
 * expired state is invisible before it is physically deleted.
 */
export function createGlobalSearchStateRepository(database: typeof db = db): GlobalSearchStateRepository {
  return {
    async save(owner, record, nowMs) {
      return database.transaction(async (tx) => {
        // One writer per session: the cap and the dedup are race-free.
        const lockKey = `gss:${owner.surface}:${owner.sessionTokenHash}`;
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${lockKey}))`);

        const [session] =
          owner.surface === "clinic"
            ? await tx
                .select({ expiresAt: activeSessions.expiresAt })
                .from(activeSessions)
                .where(eq(activeSessions.tokenHash, owner.sessionTokenHash))
                .limit(1)
            : await tx
                .select({ expiresAt: adminSessions.expiresAt })
                .from(adminSessions)
                .where(eq(adminSessions.tokenHash, owner.sessionTokenHash))
                .limit(1);
        if (!session) return null;
        const expiresAt = resolveGlobalSearchStateExpiry(nowMs, session.expiresAt);
        if (!expiresAt) return null;

        const column = ownerColumn(owner);
        const now = new Date(nowMs);
        // Retention without a scheduler: a save also clears a bounded batch of
        // anyone's expired rows. SKIP LOCKED: it never waits for another save.
        await tx.execute(sql`
          delete from global_search_states
          where id in (
            select id from global_search_states
            where expires_at <= ${now.toISOString()}::timestamp
            order by expires_at
            limit ${OPPORTUNISTIC_CLEANUP_BATCH}
            for update skip locked
          )
        `);
        await tx
          .delete(globalSearchStates)
          .where(and(eq(column, owner.sessionTokenHash), lte(globalSearchStates.expiresAt, now)));

        const live = await tx
          .select({ id: globalSearchStates.id, queryText: globalSearchStates.queryText, kinds: globalSearchStates.kinds })
          .from(globalSearchStates)
          .where(and(eq(column, owner.sessionTokenHash), gt(globalSearchStates.expiresAt, now)))
          .orderBy(desc(globalSearchStates.createdAt));

        const same = live.find((row) => row.queryText === record.queryText && (row.kinds ?? null) === record.kinds);
        if (same) return { id: same.id };

        const overflow = live.length - (GLOBAL_SEARCH_STATE_MAX_PER_SESSION - 1);
        if (overflow > 0) {
          const oldest = await tx
            .select({ id: globalSearchStates.id })
            .from(globalSearchStates)
            .where(eq(column, owner.sessionTokenHash))
            .orderBy(asc(globalSearchStates.createdAt))
            .limit(overflow);
          for (const row of oldest) {
            await tx.delete(globalSearchStates).where(eq(globalSearchStates.id, row.id));
          }
        }

        const id = randomUUID();
        await tx.insert(globalSearchStates).values({
          id,
          surface: owner.surface,
          clinicSessionTokenHash: owner.surface === "clinic" ? owner.sessionTokenHash : null,
          adminSessionTokenHash: owner.surface === "admin" ? owner.sessionTokenHash : null,
          queryText: record.queryText,
          kinds: record.kinds,
          createdAt: now,
          expiresAt,
        });
        return { id };
      });
    },

    async find(owner, id, nowMs) {
      const [row] = await database
        .select({ queryText: globalSearchStates.queryText, kinds: globalSearchStates.kinds })
        .from(globalSearchStates)
        .where(
          and(
            eq(globalSearchStates.id, id),
            eq(globalSearchStates.surface, owner.surface),
            eq(ownerColumn(owner), owner.sessionTokenHash),
            gt(globalSearchStates.expiresAt, new Date(nowMs)),
          ),
        )
        .limit(1);
      return row ?? null;
    },
  };
}
