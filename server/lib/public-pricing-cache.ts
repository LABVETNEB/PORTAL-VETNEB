const PUBLIC_PRICING_CACHE_TTL_MS = 5 * 60 * 1000;

export type PublicPricingSnapshotItem = {
  id: number;
  studyName: string;
  priceLabel: string | null;
  displayOrder: number;
};

export type PublicPricingSnapshotCategory = {
  category: string;
  items: PublicPricingSnapshotItem[];
};

export type PublicPricingSnapshot = {
  success: true;
  categories: PublicPricingSnapshotCategory[];
};

type PublicPricingCacheEntry = {
  snapshot: PublicPricingSnapshot;
  expiresAt: number;
};

let cacheEntry: PublicPricingCacheEntry | null = null;

export function getCachedPublicPricingSnapshot(
  now: number = Date.now(),
): PublicPricingSnapshot | null {
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
  snapshot: PublicPricingSnapshot,
  now: number = Date.now(),
): void {
  cacheEntry = {
    snapshot,
    expiresAt: now + PUBLIC_PRICING_CACHE_TTL_MS,
  };
}

export function clearPublicPricingCache(): void {
  cacheEntry = null;
}
