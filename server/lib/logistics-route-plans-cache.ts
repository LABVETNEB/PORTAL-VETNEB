const LOGISTICS_ROUTE_PLANS_CACHE_TTL_MS = 5 * 60 * 1000;

type CacheEntry<T> = {
  snapshot: T;
  expiresAt: number;
};

const routePlansListCache = new Map<string, CacheEntry<unknown>>();
const routePlanMetricsCache = new Map<string, CacheEntry<unknown>>();

function getCachedSnapshot<T>(
  cache: Map<string, CacheEntry<unknown>>,
  key: string,
  now: number,
): T | null {
  const entry = cache.get(key);

  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= now) {
    cache.delete(key);
    return null;
  }

  return entry.snapshot as T;
}

function setCachedSnapshot<T>(
  cache: Map<string, CacheEntry<unknown>>,
  key: string,
  snapshot: T,
  now: number,
): void {
  cache.set(key, {
    snapshot,
    expiresAt: now + LOGISTICS_ROUTE_PLANS_CACHE_TTL_MS,
  });
}

function clearCachedSnapshotByPrefix(
  cache: Map<string, CacheEntry<unknown>>,
  prefix: string,
): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
}

export function getCachedRoutePlansSnapshot<T>(
  key: string,
  now: number = Date.now(),
): T | null {
  return getCachedSnapshot<T>(routePlansListCache, key, now);
}

export function setCachedRoutePlansSnapshot<T>(
  key: string,
  snapshot: T,
  now: number = Date.now(),
): void {
  setCachedSnapshot(routePlansListCache, key, snapshot, now);
}

export function clearRoutePlansCache(): void {
  routePlansListCache.clear();
}

export function clearRoutePlansCacheByClinic(clinicId: number): void {
  clearCachedSnapshotByPrefix(routePlansListCache, `clinic:${clinicId}|`);
}

export function getCachedRoutePlanMetricsSnapshot<T>(
  key: string,
  now: number = Date.now(),
): T | null {
  return getCachedSnapshot<T>(routePlanMetricsCache, key, now);
}

export function setCachedRoutePlanMetricsSnapshot<T>(
  key: string,
  snapshot: T,
  now: number = Date.now(),
): void {
  setCachedSnapshot(routePlanMetricsCache, key, snapshot, now);
}

export function clearRoutePlanMetricsCache(): void {
  routePlanMetricsCache.clear();
}

export function clearRoutePlanMetricsCacheByClinic(clinicId: number): void {
  clearCachedSnapshotByPrefix(routePlanMetricsCache, `clinic:${clinicId}|`);
}

export function clearRoutePlanMetricsCacheByPlan(
  clinicId: number,
  routePlanId: number,
): void {
  clearCachedSnapshotByPrefix(
    routePlanMetricsCache,
    `clinic:${clinicId}|plan:${routePlanId}|`,
  );
}
