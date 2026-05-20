import test from "node:test";
import assert from "node:assert/strict";

import {
  createMemoryRateLimitStore,
  createPersistentRateLimitStore,
  getOrCreateRateLimitEntry,
  hashRateLimitKey,
  incrementRateLimitEntry,
  type PersistentRateLimitRecord,
  type RateLimitStore,
} from "../server/lib/rate-limit-store.ts";

type PersistentHarnessRow = PersistentRateLimitRecord & {
  createdAt: Date;
  updatedAt: Date;
};

function createPersistentHarness(input?: {
  rows?: Map<string, PersistentHarnessRow>;
  now?: () => number;
  failCleanup?: boolean;
}) {
  const rows = input?.rows ?? new Map<string, PersistentHarnessRow>();
  const cleanupCalls: Date[] = [];

  const store = createPersistentRateLimitStore(
    {
      get: async (keyHash) => rows.get(keyHash),
      set: async ({ keyHash, count, resetAt, now }) => {
        const existing = rows.get(keyHash);
        const row = {
          count,
          resetAt,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        };

        rows.set(keyHash, row);

        return row;
      },
      increment: async ({ keyHash, count, resetAt, now }) => {
        const existing = rows.get(keyHash);
        const row =
          !existing || existing.resetAt.getTime() <= now.getTime()
            ? {
                count,
                resetAt,
                createdAt: existing?.createdAt ?? now,
                updatedAt: now,
              }
            : {
                ...existing,
                count: existing.count + 1,
                updatedAt: now,
              };

        rows.set(keyHash, row);

        return row;
      },
      cleanupExpired: async (now) => {
        cleanupCalls.push(now);

        if (input?.failCleanup) {
          throw new Error("cleanup failed");
        }

        for (const [keyHash, row] of rows) {
          if (row.resetAt.getTime() < now.getTime()) {
            rows.delete(keyHash);
          }
        }
      },
    },
    {
      now: input?.now,
    },
  );

  return { rows, store, cleanupCalls };
}

test("rate limit memory store creates and reuses active entries", async () => {
  const store = createMemoryRateLimitStore();

  const first = await getOrCreateRateLimitEntry(store, "ip:1", 1000, 10);
  const second = await getOrCreateRateLimitEntry(store, "ip:1", 1000, 20);

  assert.deepEqual(first, {
    count: 0,
    resetAt: 1010,
  });
  assert.equal(second, first);
});

test("rate limit memory store resets expired entries", async () => {
  const store = createMemoryRateLimitStore();

  const first = await getOrCreateRateLimitEntry(store, "ip:1", 1000, 10);
  const updated = await incrementRateLimitEntry(store, "ip:1", first);

  assert.deepEqual(updated, {
    count: 1,
    resetAt: 1010,
  });

  const reset = await getOrCreateRateLimitEntry(store, "ip:1", 1000, 1011);

  assert.deepEqual(reset, {
    count: 0,
    resetAt: 2011,
  });
});

test("rate limit helpers support injected async stores", async () => {
  const entries = new Map<string, { count: number; resetAt: number }>();
  const calls: string[] = [];

  const store: RateLimitStore = {
    get: async (key) => {
      calls.push(`get:${key}`);
      return entries.get(key);
    },
    set: async (key, entry) => {
      calls.push(`set:${key}:${entry.count}:${entry.resetAt}`);
      entries.set(key, entry);
    },
  };

  const entry = await getOrCreateRateLimitEntry(store, "ip:async", 500, 100);
  const updated = await incrementRateLimitEntry(store, "ip:async", entry);
  const reused = await getOrCreateRateLimitEntry(store, "ip:async", 500, 101);

  assert.deepEqual(updated, {
    count: 1,
    resetAt: 600,
  });
  assert.deepEqual(reused, updated);
  assert.deepEqual(calls, [
    "get:ip:async",
    "set:ip:async:0:600",
    "set:ip:async:1:600",
    "get:ip:async",
  ]);
});

test("rate limit persistent store hashes keys and creates counters", async () => {
  const { rows, store } = createPersistentHarness({
    now: () => 10,
  });

  const entry = await getOrCreateRateLimitEntry(store, "ip:raw", 1000, 10);
  const updated = await incrementRateLimitEntry(store, "ip:raw", entry, 10);
  const keyHash = hashRateLimitKey("ip:raw");

  assert.deepEqual(entry, {
    count: 0,
    resetAt: 1010,
  });
  assert.deepEqual(updated, {
    count: 1,
    resetAt: 1010,
  });
  assert.equal(rows.has("ip:raw"), false);
  assert.equal(rows.has(keyHash), true);
});

test("rate limit persistent store increments active counters", async () => {
  const { store } = createPersistentHarness({
    now: () => 100,
  });

  const first = await getOrCreateRateLimitEntry(store, "ip:1", 500, 100);
  const firstUpdated = await incrementRateLimitEntry(store, "ip:1", first, 100);
  const second = await getOrCreateRateLimitEntry(store, "ip:1", 500, 101);
  const secondUpdated = await incrementRateLimitEntry(
    store,
    "ip:1",
    second,
    101,
  );

  assert.deepEqual(firstUpdated, {
    count: 1,
    resetAt: 600,
  });
  assert.deepEqual(secondUpdated, {
    count: 2,
    resetAt: 600,
  });
});

test("rate limit persistent store survives reconstruction with same adapter data", async () => {
  const rows = new Map<string, PersistentHarnessRow>();
  const firstHarness = createPersistentHarness({
    rows,
    now: () => 100,
  });

  const first = await getOrCreateRateLimitEntry(
    firstHarness.store,
    "ip:persist",
    1000,
    100,
  );
  await incrementRateLimitEntry(firstHarness.store, "ip:persist", first, 100);

  const secondHarness = createPersistentHarness({
    rows,
    now: () => 200,
  });
  const restored = await getOrCreateRateLimitEntry(
    secondHarness.store,
    "ip:persist",
    1000,
    200,
  );

  assert.deepEqual(restored, {
    count: 1,
    resetAt: 1100,
  });
});

test("rate limit persistent store exposes rate-limited state at the same threshold", async () => {
  const maxAttempts = 2;
  const { store } = createPersistentHarness({
    now: () => 100,
  });

  const first = await getOrCreateRateLimitEntry(store, "ip:limited", 1000, 100);
  await incrementRateLimitEntry(store, "ip:limited", first, 100);

  const second = await getOrCreateRateLimitEntry(store, "ip:limited", 1000, 101);
  const secondUpdated = await incrementRateLimitEntry(
    store,
    "ip:limited",
    second,
    101,
  );

  assert.equal(secondUpdated.count >= maxAttempts, true);
});

test("rate limit persistent store resets expired windows", async () => {
  const { store } = createPersistentHarness({
    now: () => 100,
  });

  const first = await getOrCreateRateLimitEntry(store, "ip:reset", 500, 100);
  await incrementRateLimitEntry(store, "ip:reset", first, 100);

  const reset = await getOrCreateRateLimitEntry(store, "ip:reset", 500, 601);

  assert.deepEqual(reset, {
    count: 0,
    resetAt: 1101,
  });
});

test("rate limit persistent store ignores expired cleanup failures", async () => {
  const { store } = createPersistentHarness({
    now: () => 100,
    failCleanup: true,
  });

  const entry = await getOrCreateRateLimitEntry(store, "ip:cleanup", 500, 100);
  const updated = await incrementRateLimitEntry(store, "ip:cleanup", entry, 100);

  assert.deepEqual(updated, {
    count: 1,
    resetAt: 600,
  });
});
