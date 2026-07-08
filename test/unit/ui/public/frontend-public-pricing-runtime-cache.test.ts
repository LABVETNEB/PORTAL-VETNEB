import assert from "node:assert/strict";
import test from "node:test";

const {
  clearPublicPricingRuntimeCache,
  getCachedPublicPricingSnapshot,
  setCachedPublicPricingSnapshot,
} = await import("../../../../frontend/src/lib/public-pricing-cache.ts");

function createSnapshot() {
  return {
    success: true as const,
    categories: [
      {
        category: "CITOLOGÍAS",
        items: [
          {
            id: 1,
            studyName: "UNA LESIÓN (VARIOS VIDRIOS)",
            priceLabel: "$ 100",
            displayOrder: 1,
          },
        ],
      },
    ],
  };
}

test("frontend runtime cache devuelve snapshot mientras el TTL sigue vigente", () => {
  clearPublicPricingRuntimeCache();
  const now = Date.UTC(2026, 4, 21, 10, 0, 0);
  const snapshot = createSnapshot();

  setCachedPublicPricingSnapshot(snapshot, now);

  assert.deepEqual(getCachedPublicPricingSnapshot(now + 60_000), snapshot);
  clearPublicPricingRuntimeCache();
});

test("frontend runtime cache expira a los 5 minutos y evita reusar datos vencidos", () => {
  clearPublicPricingRuntimeCache();
  const now = Date.UTC(2026, 4, 21, 10, 0, 0);

  setCachedPublicPricingSnapshot(createSnapshot(), now);

  assert.equal(getCachedPublicPricingSnapshot(now + 5 * 60 * 1000), null);
  assert.equal(getCachedPublicPricingSnapshot(now + 5 * 60 * 1000 + 1), null);
  clearPublicPricingRuntimeCache();
});
