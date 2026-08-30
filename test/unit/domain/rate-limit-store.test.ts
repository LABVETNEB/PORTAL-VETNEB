import test from "node:test";
import assert from "node:assert/strict";

import {
  createMemoryRateLimitStore,
  createPersistentRateLimitStore,
  consumeRateLimitAttempt,
  getOrCreateRateLimitEntry,
  hashRateLimitKey,
  incrementRateLimitEntry,
  type PersistentRateLimitMetadata,
  type PersistentRateLimitRecord,
  type RateLimitStore,
} from "../../../server/lib/rate-limit-store.ts";

type PersistentHarnessRow = PersistentRateLimitRecord & {
  createdAt: Date;
  updatedAt: Date;
  metadata?: PersistentRateLimitMetadata;
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
      set: async ({ keyHash, count, resetAt, now, metadata }) => {
        const existing = rows.get(keyHash);
        const row = {
          count,
          resetAt,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
          metadata,
        };

        rows.set(keyHash, row);

        return row;
      },
      increment: async ({ keyHash, count, resetAt, now, metadata }) => {
        const existing = rows.get(keyHash);
        const row =
          !existing || existing.resetAt.getTime() <= now.getTime()
            ? {
                count,
                resetAt,
                createdAt: existing?.createdAt ?? now,
                updatedAt: now,
                metadata,
              }
            : {
                ...existing,
                metadata,
                count: existing.count + 1,
                updatedAt: now,
              };

        rows.set(keyHash, row);

        return row;
      },
      consume: async ({ keyHash, resetAt, now, metadata }) => {
        const existing = rows.get(keyHash);
        const row =
          !existing || existing.resetAt.getTime() <= now.getTime()
            ? {
                count: 1,
                resetAt,
                createdAt: existing?.createdAt ?? now,
                updatedAt: now,
                metadata,
              }
            : {
                ...existing,
                metadata,
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

test("rate limit memory store evicts expired keys and preserves active keys", async () => {
  const store = createMemoryRateLimitStore();
  await store.set("expired:a", { count: 1, resetAt: 100 });
  await store.set("expired:b", { count: 2, resetAt: 100 });
  await store.set("active", { count: 3, resetAt: 101 });

  await store.cleanupExpired?.(100);

  assert.equal(await store.get("expired:a"), undefined);
  assert.equal(await store.get("expired:b"), undefined);
  assert.deepEqual(await store.get("active"), { count: 3, resetAt: 101 });
});

test("rate limit memory store keeps every concurrent increment", async () => {
  const store = createMemoryRateLimitStore();
  const entry = await getOrCreateRateLimitEntry(store, "ip:concurrent", 1000, 100);
  const attempts = 100;

  await Promise.all(
    Array.from({ length: attempts }, () =>
      incrementRateLimitEntry(store, "ip:concurrent", entry, 100),
    ),
  );

  assert.deepEqual(await store.get("ip:concurrent"), {
    count: attempts,
    resetAt: 1100,
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

test("rate limit persistent store forwards metadata for hashed keys", async () => {
  const metadata: PersistentRateLimitMetadata = {
    surface: "clinic",
    identifierHash: "identifier-hash",
    ipHash: "ip-hash",
    keyVersion: "v2",
  };
  const { rows, store } = createPersistentHarness({
    now: () => 10,
  });

  const entry = await getOrCreateRateLimitEntry(store, "login:key", 1000, 10);
  await incrementRateLimitEntry(store, "login:key", entry, 10);

  assert.equal(rows.get(hashRateLimitKey("login:key"))?.metadata, undefined);

  const metadataHarness = createPersistentHarness({
    now: () => 20,
  });
  const metadataStore = createPersistentRateLimitStore(
    {
      get: async (keyHash) => metadataHarness.rows.get(keyHash),
      set: async ({ keyHash, count, resetAt, now, metadata }) => {
        const row = {
          count,
          resetAt,
          createdAt: now,
          updatedAt: now,
          metadata,
        };
        metadataHarness.rows.set(keyHash, row);
        return row;
      },
      increment: async ({ keyHash, count, resetAt, now, metadata }) => {
        const row = {
          count,
          resetAt,
          createdAt: now,
          updatedAt: now,
          metadata,
        };
        metadataHarness.rows.set(keyHash, row);
        return row;
      },
      consume: async ({ keyHash, resetAt, now, metadata }) => {
        const existing = metadataHarness.rows.get(keyHash);
        const row =
          !existing || existing.resetAt.getTime() <= now.getTime()
            ? {
                count: 1,
                resetAt,
                createdAt: existing?.createdAt ?? now,
                updatedAt: now,
                metadata,
              }
            : {
                ...existing,
                metadata,
                count: existing.count + 1,
                updatedAt: now,
              };
        metadataHarness.rows.set(keyHash, row);
        return row;
      },
    },
    {
      metadataForKey: () => metadata,
      now: () => 20,
    },
  );

  const metadataEntry = await getOrCreateRateLimitEntry(
    metadataStore,
    "login:key",
    1000,
    20,
  );
  await incrementRateLimitEntry(metadataStore, "login:key", metadataEntry, 20);

  assert.deepEqual(
    metadataHarness.rows.get(hashRateLimitKey("login:key"))?.metadata,
    metadata,
  );
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

test("legacy get set increment interleaving can lose an attempt during initialization", async () => {
  const entries = new Map<string, { count: number; resetAt: number }>();
  const legacyStore: RateLimitStore = {
    get: async () => undefined,
    set: async (key, entry) => {
      entries.set(key, entry);
    },
  };
  const key = "login:concurrent";
  const first = await getOrCreateRateLimitEntry(legacyStore, key, 1000, 100);
  const second = await getOrCreateRateLimitEntry(legacyStore, key, 1000, 100);

  await incrementRateLimitEntry(legacyStore, key, first, 100);
  await legacyStore.set(key, second);
  await incrementRateLimitEntry(legacyStore, key, second, 100);

  assert.equal(entries.get(key)?.count, 1);
});

test("persistent consume creates the first attempt atomically", async () => {
  const { store } = createPersistentHarness({ now: () => 100 });
  const entry = await consumeRateLimitAttempt(store, "login:first", {
    windowMs: 1000,
    now: 100,
  });

  assert.deepEqual(entry, { count: 1, resetAt: 1100 });
});

test("persistent consume preserves every concurrent attempt in the same window", async () => {
  const { rows, store } = createPersistentHarness({ now: () => 100 });
  const attempts = 20;
  const entries = await Promise.all(
    Array.from({ length: attempts }, () =>
      consumeRateLimitAttempt(store, "login:concurrent", {
        windowMs: 1000,
        now: 100,
      }),
    ),
  );

  assert.equal(entries.at(-1)?.count, attempts);
  assert.equal(rows.get(hashRateLimitKey("login:concurrent"))?.count, attempts);
});

test("persistent consume shares a counter across store instances", async () => {
  const rows = new Map<string, PersistentHarnessRow>();
  const first = createPersistentHarness({ rows, now: () => 100 });
  const second = createPersistentHarness({ rows, now: () => 100 });

  await consumeRateLimitAttempt(first.store, "login:shared", {
    windowMs: 1000,
    now: 100,
  });
  const entry = await consumeRateLimitAttempt(second.store, "login:shared", {
    windowMs: 1000,
    now: 100,
  });

  assert.deepEqual(entry, { count: 2, resetAt: 1100 });
});

test("persistent consume renews an expired window exactly once", async () => {
  const { rows, store } = createPersistentHarness({ now: () => 100 });
  await consumeRateLimitAttempt(store, "login:expired", {
    windowMs: 1000,
    now: 100,
  });
  const entries = await Promise.all(
    Array.from({ length: 5 }, () =>
      consumeRateLimitAttempt(store, "login:expired", {
        windowMs: 1000,
        now: 1100,
      }),
    ),
  );

  assert.equal(entries.at(-1)?.count, 5);
  assert.deepEqual(rows.get(hashRateLimitKey("login:expired")), {
    count: 5,
    resetAt: new Date(2100),
    createdAt: new Date(100),
    updatedAt: new Date(1100),
    metadata: undefined,
  });
});
