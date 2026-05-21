export type PublicPricingRuntimeCacheSnapshot = {
  success: true;
  categories: {
    category: string;
    items: {
      id: number;
      studyName: string;
      priceLabel: string | null;
      displayOrder: number;
    }[];
  }[];
};

const PUBLIC_PRICING_RUNTIME_CACHE_TTL_MS = 5 * 60 * 1000;

type PublicPricingRuntimeCacheEntry = {
  snapshot: PublicPricingRuntimeCacheSnapshot;
  expiresAt: number;
};

let cacheEntry: PublicPricingRuntimeCacheEntry | null = null;

export function getCachedPublicPricingSnapshot(
  now: number = Date.now(),
): PublicPricingRuntimeCacheSnapshot | null {
  if (!cacheEntry) {
    return null;
  }

  if (cacheEntry.expiresAt <= now) {
    cacheEntry = null;
    return null;
  }

  return cacheEntry.snapshot;
}

export function setCachedPublicPricingSnapshot(
  snapshot: PublicPricingRuntimeCacheSnapshot,
  now: number = Date.now(),
): void {
  if (!snapshot.success) {
    return;
  }

  cacheEntry = {
    snapshot,
    expiresAt: now + PUBLIC_PRICING_RUNTIME_CACHE_TTL_MS,
  };
}

export function clearPublicPricingRuntimeCache(): void {
  cacheEntry = null;
}
