import { createHash } from "node:crypto";

export type RateLimitEntry = {
  count: number;
  resetAt: number;
};

export type RateLimitStore = {
  get: (key: string) => RateLimitEntry | undefined | Promise<RateLimitEntry | undefined>;
  set: (key: string, entry: RateLimitEntry) => void | Promise<void>;
  increment?: (
    key: string,
    entry: RateLimitEntry,
    now?: number,
  ) => RateLimitEntry | Promise<RateLimitEntry>;
};

export type PersistentRateLimitRecord = {
  count: number;
  resetAt: Date;
};

export type PersistentRateLimitStoreAdapter = {
  get: (
    keyHash: string,
  ) => PersistentRateLimitRecord | undefined | Promise<PersistentRateLimitRecord | undefined>;
  set: (input: {
    keyHash: string;
    count: number;
    resetAt: Date;
    now: Date;
  }) => PersistentRateLimitRecord | undefined | Promise<PersistentRateLimitRecord | undefined>;
  increment: (input: {
    keyHash: string;
    count: number;
    resetAt: Date;
    now: Date;
  }) => PersistentRateLimitRecord | Promise<PersistentRateLimitRecord>;
  cleanupExpired?: (now: Date) => void | Promise<void>;
};

export type PersistentRateLimitStoreOptions = {
  now?: () => number;
};

export function createMemoryRateLimitStore(): RateLimitStore {
  const entries = new Map<string, RateLimitEntry>();

  return {
    get: (key) => entries.get(key),
    set: (key, entry) => {
      entries.set(key, entry);
    },
  };
}

export function hashRateLimitKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

function toPersistentDate(ms: number): Date {
  return new Date(ms);
}

function toRateLimitEntry(record: PersistentRateLimitRecord): RateLimitEntry {
  return {
    count: record.count,
    resetAt: record.resetAt.getTime(),
  };
}

async function cleanupExpiredBestEffort(
  adapter: PersistentRateLimitStoreAdapter,
  now: number,
) {
  if (!adapter.cleanupExpired) {
    return;
  }

  try {
    await adapter.cleanupExpired(toPersistentDate(now));
  } catch {
    return;
  }
}

export function createPersistentRateLimitStore(
  adapter: PersistentRateLimitStoreAdapter,
  options: PersistentRateLimitStoreOptions = {},
): RateLimitStore {
  const getNow = options.now ?? (() => Date.now());

  return {
    get: async (key) => {
      const now = getNow();

      await cleanupExpiredBestEffort(adapter, now);

      const record = await adapter.get(hashRateLimitKey(key));

      return record ? toRateLimitEntry(record) : undefined;
    },
    set: async (key, entry) => {
      const now = getNow();

      await cleanupExpiredBestEffort(adapter, now);

      await adapter.set({
        keyHash: hashRateLimitKey(key),
        count: entry.count,
        resetAt: toPersistentDate(entry.resetAt),
        now: toPersistentDate(now),
      });
    },
    increment: async (key, entry, now = getNow()) => {
      await cleanupExpiredBestEffort(adapter, now);

      return toRateLimitEntry(
        await adapter.increment({
          keyHash: hashRateLimitKey(key),
          count: entry.count + 1,
          resetAt: toPersistentDate(entry.resetAt),
          now: toPersistentDate(now),
        }),
      );
    },
  };
}

export async function getOrCreateRateLimitEntry(
  store: RateLimitStore,
  key: string,
  windowMs: number,
  now: number,
): Promise<RateLimitEntry> {
  const current = await store.get(key);

  if (!current || current.resetAt <= now) {
    const fresh = {
      count: 0,
      resetAt: now + windowMs,
    };

    await store.set(key, fresh);

    return fresh;
  }

  return current;
}

export async function incrementRateLimitEntry(
  store: RateLimitStore,
  key: string,
  entry: RateLimitEntry,
  now?: number,
): Promise<RateLimitEntry> {
  if (store.increment) {
    return store.increment(key, entry, now);
  }

  const updated = {
    count: entry.count + 1,
    resetAt: entry.resetAt,
  };

  await store.set(key, updated);

  return updated;
}
