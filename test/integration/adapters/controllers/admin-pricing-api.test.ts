import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const { ENV } = await import("../../../../server/lib/env.ts");
const { adminPricingNativeRoutes } = await import(
  "../../../../server/routes/admin-pricing.fastify.ts"
);
const {
  clearPublicPricingCache,
  getCachedPublicPricingSnapshot,
  setCachedPublicPricingSnapshot,
} = await import(
  "../../../../server/features/pricing/infrastructure/public-pricing-cache.ts"
);

type AdminPricingNativeRoutesOptions = import(
  "../../../../server/routes/admin-pricing.fastify.ts"
).AdminPricingNativeRoutesOptions;
type PricingItem = import(
  "../../../../server/features/pricing/infrastructure/db-pricing.ts"
).PricingItem;

function createPricingItem(overrides: Record<string, unknown> = {}): PricingItem {
  return {
    id: 1,
    category: "CITOLOGÍAS",
    studyName: "UNA LESIÓN (VARIOS VIDRIOS)",
    priceLabel: null,
    displayOrder: 1,
    isActive: true,
    updatedAt: "2026-05-15T12:00:00.000Z",
    ...overrides,
  } as PricingItem;
}

function buildDeps(
  overrides: Partial<AdminPricingNativeRoutesOptions> = {},
): AdminPricingNativeRoutesOptions {
  return {
    deleteAdminSession: async () => {},
    getAdminSessionByToken: async () => ({
      id: 90,
      adminUserId: 1,
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      lastAccess: new Date("2026-05-15T11:00:00.000Z"),
    }),
    getAdminUserById: async () => ({
      id: 1,
      username: "VETNEB",
    }),
    updateAdminSessionLastAccess: async () => {},
    hashSessionToken: (token: string) => `hash:${token}`,
    listAdminPricingItems: async () => [],
    updatePricingItem: async () => null,
    writeAuditLog: async () => {},
    now: () => Date.UTC(2026, 4, 15, 12, 0, 0),
    ...overrides,
  };
}

test("admin pricing requiere sesión admin para GET y PATCH", async () => {
  const app = Fastify();

  await app.register(
    adminPricingNativeRoutes,
    buildDeps({
      getAdminSessionByToken: async () => null,
    }),
  );

  try {
    const getResponse = await app.inject({
      method: "GET",
      url: "/",
      headers: {
        cookie: `${ENV.adminCookieName}=admin-session-token`,
      },
    });

    assert.equal(getResponse.statusCode, 401);
    assert.deepEqual(JSON.parse(getResponse.body), {
      success: false,
      error: "Sesión admin inválida",
    });

    const patchResponse = await app.inject({
      method: "PATCH",
      url: "/1",
      headers: {
        cookie: `${ENV.adminCookieName}=admin-session-token`,
      },
      payload: {
        isActive: false,
      },
    });

    assert.equal(patchResponse.statusCode, 401);
    assert.deepEqual(JSON.parse(patchResponse.body), {
      success: false,
      error: "Sesión admin inválida",
    });
  } finally {
    await app.close();
  }
});

test("admin pricing GET devuelve todos los items agrupados por categoría", async () => {
  const app = Fastify();

  await app.register(
    adminPricingNativeRoutes,
    buildDeps({
      listAdminPricingItems: async () => [
        createPricingItem({
          id: 1,
          category: "CITOLOGÍAS",
          studyName: "UNA LESIÓN (VARIOS VIDRIOS)",
          priceLabel: null,
          displayOrder: 1,
          isActive: true,
        }),
        createPricingItem({
          id: 2,
          category: "CITOLOGÍAS",
          studyName: "REPETICIÓN (DENTRO DE 15 DÍAS)",
          priceLabel: "A CONSULTAR",
          displayOrder: 2,
          isActive: false,
        }),
        createPricingItem({
          id: 8,
          category: "HISTOPATOLOGÍAS",
          studyName: "PIEZAS HASTA 10 CM",
          priceLabel: null,
          displayOrder: 1,
          isActive: true,
        }),
      ],
    }),
  );

  try {
    const response = await app.inject({
      method: "GET",
      url: "/",
      headers: {
        cookie: `${ENV.adminCookieName}=admin-session-token`,
      },
    });

    assert.equal(response.statusCode, 200);
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
              isActive: true,
              updatedAt: "2026-05-15T12:00:00.000Z",
            },
            {
              id: 2,
              studyName: "REPETICIÓN (DENTRO DE 15 DÍAS)",
              priceLabel: "A CONSULTAR",
              displayOrder: 2,
              isActive: false,
              updatedAt: "2026-05-15T12:00:00.000Z",
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
              isActive: true,
              updatedAt: "2026-05-15T12:00:00.000Z",
            },
          ],
        },
      ],
    });
  } finally {
    await app.close();
  }
});

test("admin pricing PATCH valida payload y bloquea edición de category/study_name", async () => {
  const app = Fastify();
  let updateCalls = 0;

  await app.register(
    adminPricingNativeRoutes,
    buildDeps({
      listAdminPricingItems: async () => [createPricingItem()],
      updatePricingItem: async () => {
        updateCalls += 1;
        return createPricingItem();
      },
    }),
  );

  try {
    const commonHeaders = {
      cookie: `${ENV.adminCookieName}=admin-session-token`,
    };

    const cases: Array<{ payload: Record<string, unknown>; label: string }> = [
      { payload: {}, label: "empty body" },
      { payload: { category: "X" }, label: "category forbidden" },
      { payload: { studyName: "X" }, label: "studyName forbidden" },
      { payload: { priceLabel: "x".repeat(81) }, label: "priceLabel too long" },
      { payload: { isActive: "true" }, label: "isActive invalid type" },
      { payload: { displayOrder: -1 }, label: "displayOrder negative" },
    ];

    for (const item of cases) {
      const response = await app.inject({
        method: "PATCH",
        url: "/1",
        headers: commonHeaders,
        payload: item.payload,
      });

      assert.equal(response.statusCode, 400, item.label);
      assert.equal(JSON.parse(response.body).success, false, item.label);
    }

    assert.equal(updateCalls, 0);
  } finally {
    await app.close();
  }
});

test("admin pricing PATCH devuelve 404 cuando el item no existe", async () => {
  const app = Fastify();

  await app.register(
    adminPricingNativeRoutes,
    buildDeps({
      listAdminPricingItems: async () => [],
      updatePricingItem: async () => {
        throw new Error("no debe intentar update cuando el item no existe");
      },
    }),
  );

  try {
    const response = await app.inject({
      method: "PATCH",
      url: "/999",
      headers: {
        cookie: `${ENV.adminCookieName}=admin-session-token`,
      },
      payload: {
        isActive: false,
      },
    });

    assert.equal(response.statusCode, 404);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: "Ítem de precio no encontrado",
    });
  } finally {
    await app.close();
  }
});

test("admin pricing PATCH actualiza campos permitidos y responde contrato", async () => {
  const app = Fastify();
  const updateCalls: Array<Record<string, unknown>> = [];
  const auditCalls: Array<Record<string, unknown>> = [];

  await app.register(
    adminPricingNativeRoutes,
    buildDeps({
      listAdminPricingItems: async () => [createPricingItem()],
      updatePricingItem: async (id, payload) => {
        updateCalls.push({
          id,
          payload,
        });

        return createPricingItem({
          id,
          priceLabel: payload.priceLabel ?? null,
          isActive: payload.isActive ?? true,
          displayOrder: payload.displayOrder ?? 1,
          updatedAt: "2026-05-15T13:00:00.000Z",
        });
      },
      writeAuditLog: async (_req, input) => {
        auditCalls.push(input as Record<string, unknown>);
      },
    }),
  );

  try {
    const response = await app.inject({
      method: "PATCH",
      url: "/1",
      headers: {
        cookie: `${ENV.adminCookieName}=admin-session-token`,
      },
      payload: {
        priceLabel: null,
        isActive: false,
        displayOrder: 7,
      },
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(JSON.parse(response.body), {
      success: true,
      pricingItem: {
        id: 1,
        category: "CITOLOGÍAS",
        studyName: "UNA LESIÓN (VARIOS VIDRIOS)",
        priceLabel: null,
        displayOrder: 7,
        isActive: false,
        updatedAt: "2026-05-15T13:00:00.000Z",
      },
    });

    assert.equal(updateCalls.length, 1);
    assert.equal(updateCalls[0].id, 1);
    assert.deepEqual(updateCalls[0].payload, {
      priceLabel: null,
      isActive: false,
      displayOrder: 7,
      now: new Date(Date.UTC(2026, 4, 15, 12, 0, 0)),
    });
    assert.equal(
      Object.prototype.hasOwnProperty.call(updateCalls[0].payload, "category"),
      false,
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(updateCalls[0].payload, "studyName"),
      false,
    );

    assert.equal(auditCalls.length, 1);
    assert.equal(auditCalls[0].event, "admin.pricing.update");
  } finally {
    await app.close();
  }
});

test("admin pricing PATCH exitoso invalida cache público de precios", async () => {
  clearPublicPricingCache();
  setCachedPublicPricingSnapshot({
    success: true,
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
  });

  const app = Fastify();

  await app.register(
    adminPricingNativeRoutes,
    buildDeps({
      listAdminPricingItems: async () => [createPricingItem()],
      updatePricingItem: async (id, payload) =>
        createPricingItem({
          id,
          priceLabel: payload.priceLabel ?? null,
          isActive: payload.isActive ?? true,
          displayOrder: payload.displayOrder ?? 1,
          updatedAt: "2026-05-15T13:00:00.000Z",
        }),
    }),
  );

  try {
    const response = await app.inject({
      method: "PATCH",
      url: "/1",
      headers: {
        cookie: `${ENV.adminCookieName}=admin-session-token`,
      },
      payload: {
        priceLabel: "$ 120",
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(getCachedPublicPricingSnapshot(), null);
  } finally {
    clearPublicPricingCache();
    await app.close();
  }
});

test("admin pricing mantiene error 500 seguro cuando falla persistencia", async () => {
  const app = Fastify();

  await app.register(
    adminPricingNativeRoutes,
    buildDeps({
      listAdminPricingItems: async () => [createPricingItem()],
      updatePricingItem: async () => {
        throw new Error("db unavailable");
      },
    }),
  );

  try {
    const response = await app.inject({
      method: "PATCH",
      url: "/1",
      headers: {
        cookie: `${ENV.adminCookieName}=admin-session-token`,
      },
      payload: {
        isActive: false,
      },
    });

    assert.equal(response.statusCode, 500);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: "No se pudieron guardar los cambios de precio.",
    });
  } finally {
    await app.close();
  }
});

test("admin pricing PATCH bloquea origin no permitido", async () => {
  const app = Fastify();

  await app.register(
    adminPricingNativeRoutes,
    buildDeps({
      listAdminPricingItems: async () => [createPricingItem()],
    }),
  );

  try {
    const response = await app.inject({
      method: "PATCH",
      url: "/1",
      headers: {
        origin: "https://evil.example",
        cookie: `${ENV.adminCookieName}=admin-session-token`,
      },
      payload: {
        isActive: false,
      },
    });

    assert.equal(response.statusCode, 403);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: "Origen no permitido",
    });
  } finally {
    await app.close();
  }
});
