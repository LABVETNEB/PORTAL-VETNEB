import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";

const { publicPricingNativeRoutes } = await import(
  "../server/routes/public-pricing.fastify.ts"
);
const { clearPublicPricingCache } = await import(
  "../server/lib/public-pricing-cache.ts"
);

type PublicPricingNativeRoutesOptions = import(
  "../server/routes/public-pricing.fastify.ts"
).PublicPricingNativeRoutesOptions;

function createPricingItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    category: "CITOLOGÍAS",
    studyName: "UNA LESIÓN (VARIOS VIDRIOS)",
    priceLabel: null,
    displayOrder: 1,
    isActive: true,
    updatedAt: "2026-05-15T12:00:00.000Z",
    ...overrides,
  };
}

function buildDeps(
  overrides: Partial<PublicPricingNativeRoutesOptions> = {},
): PublicPricingNativeRoutesOptions {
  return {
    listPublicPricingItems: async () => [],
    ...overrides,
  };
}

test("public pricing expone GET /api/public/pricing con contrato agrupado", async () => {
  clearPublicPricingCache();
  const app = Fastify();

  await app.register(
    publicPricingNativeRoutes,
    buildDeps({
      listPublicPricingItems: async () => [
        createPricingItem({
          id: 1,
          category: "CITOLOGÍAS",
          studyName: "UNA LESIÓN (VARIOS VIDRIOS)",
          priceLabel: null,
          displayOrder: 1,
        }),
        createPricingItem({
          id: 2,
          category: "CITOLOGÍAS",
          studyName: "REPETICIÓN (DENTRO DE 15 DÍAS)",
          priceLabel: "$ 0",
          displayOrder: 2,
        }),
        createPricingItem({
          id: 8,
          category: "HISTOPATOLOGÍAS",
          studyName: "PIEZAS HASTA 10 CM",
          priceLabel: null,
          displayOrder: 1,
        }),
      ],
    }),
  );

  try {
    const response = await app.inject({
      method: "GET",
      url: "/",
    });

    assert.equal(response.statusCode, 200);
    assert.equal(
      response.headers["cache-control"],
      "public, max-age=60, stale-while-revalidate=300",
    );
    assert.equal(response.headers["x-pricing-cache"], "MISS");
    assert.deepEqual(JSON.parse(response.body), {
      success: true,
      categories: [
        {
          category: "CITOLOGÍAS",
          items: [
            {
              id: 1,
              studyName: "UNA LESIÓN (VARIOS VIDRIOS)",
              priceLabel: null,
              displayOrder: 1,
            },
            {
              id: 2,
              studyName: "REPETICIÓN (DENTRO DE 15 DÍAS)",
              priceLabel: "$ 0",
              displayOrder: 2,
            },
          ],
        },
        {
          category: "HISTOPATOLOGÍAS",
          items: [
            {
              id: 8,
              studyName: "PIEZAS HASTA 10 CM",
              priceLabel: null,
              displayOrder: 1,
            },
          ],
        },
      ],
    });
  } finally {
    clearPublicPricingCache();
    await app.close();
  }
});

test("public pricing devuelve categories vacías cuando no hay items activos", async () => {
  clearPublicPricingCache();
  const app = Fastify();

  await app.register(
    publicPricingNativeRoutes,
    buildDeps({
      listPublicPricingItems: async () => [],
    }),
  );

  try {
    const response = await app.inject({
      method: "GET",
      url: "/",
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.headers["x-pricing-cache"], "MISS");
    assert.deepEqual(JSON.parse(response.body), {
      success: true,
      categories: [],
    });
  } finally {
    clearPublicPricingCache();
    await app.close();
  }
});

test("public pricing usa cache backend y evita query repetida a DB", async () => {
  clearPublicPricingCache();
  const app = Fastify();
  let listCalls = 0;

  await app.register(
    publicPricingNativeRoutes,
    buildDeps({
      listPublicPricingItems: async () => {
        listCalls += 1;
        return [
          createPricingItem({
            id: 1,
            category: "CITOLOGÍAS",
            studyName: "UNA LESIÓN (VARIOS VIDRIOS)",
            priceLabel: null,
            displayOrder: 1,
          }),
        ];
      },
    }),
  );

  try {
    const firstResponse = await app.inject({
      method: "GET",
      url: "/",
    });

    const secondResponse = await app.inject({
      method: "GET",
      url: "/",
    });

    assert.equal(firstResponse.statusCode, 200);
    assert.equal(secondResponse.statusCode, 200);
    assert.equal(listCalls, 1);
    assert.equal(firstResponse.headers["x-pricing-cache"], "MISS");
    assert.equal(secondResponse.headers["x-pricing-cache"], "HIT");
    assert.equal(
      secondResponse.headers["cache-control"],
      "public, max-age=60, stale-while-revalidate=300",
    );
    assert.deepEqual(
      JSON.parse(secondResponse.body),
      JSON.parse(firstResponse.body),
    );
  } finally {
    clearPublicPricingCache();
    await app.close();
  }
});

test("public pricing no usa fallback mock silencioso y responde 500 seguro ante falla DB", async () => {
  clearPublicPricingCache();
  const app = Fastify();

  await app.register(
    publicPricingNativeRoutes,
    buildDeps({
      listPublicPricingItems: async () => {
        throw new Error("db down");
      },
    }),
  );

  try {
    const response = await app.inject({
      method: "GET",
      url: "/",
    });

    assert.equal(response.statusCode, 500);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: "Error interno del servidor",
    });
  } finally {
    clearPublicPricingCache();
    await app.close();
  }
});
