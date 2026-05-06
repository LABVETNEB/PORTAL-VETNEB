export type RateLimitEntry = {
  count: number;
  resetAt: number;
};

export type RateLimitStore = {
  get: (key: string) => RateLimitEntry | undefined | Promise<RateLimitEntry | undefined>;
  set: (key: string, entry: RateLimitEntry) => void | Promise<void>;
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
): Promise<RateLimitEntry> {
  const updated = {
    count: entry.count + 1,
    resetAt: entry.resetAt,
  };

  await store.set(key, updated);

  return updated;
}