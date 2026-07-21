import assert from "node:assert/strict";
import test from "node:test";

// Contrato conductual del servicio directo de lectura pública de Pricing (M19).
// No duplica los tests HTTP de public-pricing-api: aquí se fija el read-through
// (HIT/MISS), la construcción exacta del snapshot agrupado, el conteo de queries
// y que un error no escribe el cache. Todas las deps se inyectan, así que el
// canónico DB nunca se carga (sólo el cache canónico in-memory puro).

const { readThroughPublicPricing } = await import(
  "../../../server/features/pricing/public-pricing-service.ts"
);
const { clearPublicPricingCache, getCachedPublicPricingSnapshot } = await import(
  "../../../server/features/pricing/infrastructure/public-pricing-cache.ts"
);

type PublicItem = import(
  "../../../server/features/pricing/public-pricing-service.ts"
).PublicPricingServiceItem;

function createItem(overrides: Partial<PublicItem> = {}): PublicItem {
  return {
    id: 1,
    category: "CITOLOGÍAS",
    studyName: "UNA LESIÓN (VARIOS VIDRIOS)",
    priceLabel: null,
    displayOrder: 1,
    ...overrides,
  };
}

test("MISS ejecuta una query, agrupa el snapshot exacto y lo persiste en cache", async () => {
  clearPublicPricingCache();
  let listCalls = 0;

  const result = await readThroughPublicPricing({
    listPublicPricingItems: async () => {
      listCalls += 1;
      return [
        createItem({ id: 1, category: "CITOLOGÍAS", studyName: "A", priceLabel: null, displayOrder: 1 }),
        createItem({ id: 2, category: "CITOLOGÍAS", studyName: "B", priceLabel: "$ 0", displayOrder: 2 }),
        createItem({ id: 8, category: "HISTOPATOLOGÍAS", studyName: "C", priceLabel: null, displayOrder: 1 }),
      ];
    },
  });

  assert.equal(listCalls, 1);
  assert.equal(result.cacheStatus, "MISS");
  assert.deepEqual(result.snapshot, {
    success: true,
    categories: [
      {
        category: "CITOLOGÍAS",
        items: [
          { id: 1, studyName: "A", priceLabel: null, displayOrder: 1 },
          { id: 2, studyName: "B", priceLabel: "$ 0", displayOrder: 2 },
        ],
      },
      {
        category: "HISTOPATOLOGÍAS",
        items: [{ id: 8, studyName: "C", priceLabel: null, displayOrder: 1 }],
      },
    ],
  });

  // El snapshot devuelto es la misma referencia que quedó en el cache.
  assert.equal(getCachedPublicPricingSnapshot(), result.snapshot);

  clearPublicPricingCache();
});

test("HIT no ejecuta query y devuelve el snapshot cacheado por referencia", async () => {
  clearPublicPricingCache();
  let listCalls = 0;

  const first = await readThroughPublicPricing({
    listPublicPricingItems: async () => {
      listCalls += 1;
      return [createItem()];
    },
  });

  const second = await readThroughPublicPricing({
    listPublicPricingItems: async () => {
      listCalls += 1;
      return [createItem()];
    },
  });

  assert.equal(listCalls, 1);
  assert.equal(first.cacheStatus, "MISS");
  assert.equal(second.cacheStatus, "HIT");
  assert.equal(second.snapshot, first.snapshot);

  clearPublicPricingCache();
});

test("un error de la query se propaga sin escribir el cache (sin fallback mock)", async () => {
  clearPublicPricingCache();

  await assert.rejects(
    () =>
      readThroughPublicPricing({
        listPublicPricingItems: async () => {
          throw new Error("db down");
        },
      }),
    /db down/,
  );

  assert.equal(getCachedPublicPricingSnapshot(), null);

  clearPublicPricingCache();
});
