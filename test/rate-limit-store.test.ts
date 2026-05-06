import test from "node:test";
import assert from "node:assert/strict";

import {
  createMemoryRateLimitStore,
  getOrCreateRateLimitEntry,
  incrementRateLimitEntry,
  type RateLimitStore,
} from "../server/lib/rate-limit-store.ts";

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