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
  consume?: (
    key: string,
    input: { windowMs: number; now: number },
  ) => RateLimitEntry | Promise<RateLimitEntry>;
  cleanupExpired?: (now: number) => void | Promise<void>;
  delete?: (key: string) => void | Promise<void>;
};

export type PersistentRateLimitRecord = {
  count: number;
  resetAt: Date;
};

export type PersistentRateLimitMetadata = {
  surface: string;
  identifierHash: string;
  ipHash: string;
  keyVersion: string;
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
    metadata?: PersistentRateLimitMetadata;
  }) => PersistentRateLimitRecord | undefined | Promise<PersistentRateLimitRecord | undefined>;
  increment: (input: {
    keyHash: string;
    count: number;
    resetAt: Date;
    now: Date;
    metadata?: PersistentRateLimitMetadata;
  }) => PersistentRateLimitRecord | Promise<PersistentRateLimitRecord>;
  consume: (input: {
    keyHash: string;
    resetAt: Date;
    now: Date;
    metadata?: PersistentRateLimitMetadata;
  }) => PersistentRateLimitRecord | Promise<PersistentRateLimitRecord>;
  cleanupExpired?: (now: Date) => void | Promise<void>;
  delete?: (keyHash: string) => void | Promise<void>;
};

export type PersistentRateLimitStoreOptions = {
  now?: () => number;
  metadataForKey?: (
    key: string,
  ) => PersistentRateLimitMetadata | undefined | null;
};

export function createMemoryRateLimitStore(): RateLimitStore {
  const entries = new Map<string, RateLimitEntry>();

  const cleanupExpired = (now: number) => {
    for (const [key, entry] of entries) {
      if (entry.resetAt <= now) {
        entries.delete(key);
      }
    }
  };

  return {
    get: (key) => entries.get(key),
    set: (key, entry) => {
      entries.set(key, entry);
    },
    delete: (key) => {
      entries.delete(key);
    },
    increment: (key, entry) => {
      const current = entries.get(key);
      const updated = {
        count: (current?.count ?? entry.count) + 1,
        resetAt: current?.resetAt ?? entry.resetAt,
      };

      entries.set(key, updated);

      return updated;
    },
    cleanupExpired,
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
  const getMetadata = (key: string) =>
    options.metadataForKey?.(key) ?? undefined;

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
        metadata: getMetadata(key),
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
          metadata: getMetadata(key),
        }),
      );
    },
    consume: async (key, input) => {
      const now = input.now;

      await cleanupExpiredBestEffort(adapter, now);

      return toRateLimitEntry(
        await adapter.consume({
          keyHash: hashRateLimitKey(key),
          resetAt: toPersistentDate(now + input.windowMs),
          now: toPersistentDate(now),
          metadata: getMetadata(key),
        }),
      );
    },
    delete: async (key) => {
      const now = getNow();

      if (adapter.delete) {
        await adapter.delete(hashRateLimitKey(key));
      } else {
        // Fallback: sobreescribir con entrada expirada para que el próximo get cree fresh
        await adapter.set({
          keyHash: hashRateLimitKey(key),
          count: 0,
          resetAt: toPersistentDate(now - 1),
          now: toPersistentDate(now),
          metadata: getMetadata(key),
        });
      }
    },
  };
}

export async function getOrCreateRateLimitEntry(
  store: RateLimitStore,
  key: string,
  windowMs: number,
  now: number,
): Promise<RateLimitEntry> {
  if (store.cleanupExpired) {
    await store.cleanupExpired(now);
  }

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

export async function consumeRateLimitAttempt(
  store: RateLimitStore,
  key: string,
  input: { windowMs: number; now: number },
): Promise<RateLimitEntry> {
  if (store.consume) {
    return store.consume(key, input);
  }

  const entry = await getOrCreateRateLimitEntry(
    store,
    key,
    input.windowMs,
    input.now,
  );

  return incrementRateLimitEntry(store, key, entry, input.now);
}
