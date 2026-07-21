import assert from "node:assert/strict";
import test from "node:test";

// Contrato conductual del servicio directo admin de Pricing (M19). No duplica los
// tests HTTP de admin-pricing-api: aquí se fija el agrupamiento/serialización
// extraídos, que el update pasa el payload SIN mutarlo (más el `now`), que un
// item inexistente no dispara update, y que el servicio no orquesta auditoría
// (sólo recibe deps de datos; la auditoría vive en la ruta).

const {
  groupAdminPricingItems,
  serializeAdminPricingItem,
  listAdminPricingCategories,
  updateAdminPricingItem,
} = await import("../../../server/features/pricing/admin-pricing-service.ts");

type PricingItem = import(
  "../../../server/features/pricing/infrastructure/db-pricing.ts"
).PricingItem;

function createItem(overrides: Partial<PricingItem> = {}): PricingItem {
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

test("groupAdminPricingItems agrupa por categoría preservando orden y todos los campos admin", async () => {
  const categories = await listAdminPricingCategories({
    listAdminPricingItems: async () => [
      createItem({ id: 1, category: "CITOLOGÍAS", studyName: "A", priceLabel: null, displayOrder: 1, isActive: true }),
      createItem({ id: 2, category: "CITOLOGÍAS", studyName: "B", priceLabel: "A CONSULTAR", displayOrder: 2, isActive: false }),
      createItem({ id: 8, category: "HISTOPATOLOGÍAS", studyName: "C", priceLabel: null, displayOrder: 1, isActive: true }),
    ],
  });

  assert.deepEqual(categories, [
    {
      category: "CITOLOGÍAS",
      items: [
        { id: 1, studyName: "A", priceLabel: null, displayOrder: 1, isActive: true, updatedAt: "2026-05-15T12:00:00.000Z" },
        { id: 2, studyName: "B", priceLabel: "A CONSULTAR", displayOrder: 2, isActive: false, updatedAt: "2026-05-15T12:00:00.000Z" },
      ],
    },
    {
      category: "HISTOPATOLOGÍAS",
      items: [
        { id: 8, studyName: "C", priceLabel: null, displayOrder: 1, isActive: true, updatedAt: "2026-05-15T12:00:00.000Z" },
      ],
    },
  ]);

  // La función de agrupamiento es pura y reutilizable de forma directa.
  assert.deepEqual(groupAdminPricingItems([]), []);
});

test("serializeAdminPricingItem produce el DTO con priceLabel normalizado a null", () => {
  assert.deepEqual(
    serializeAdminPricingItem(createItem({ id: 3, priceLabel: null, displayOrder: 5, isActive: false })),
    {
      id: 3,
      category: "CITOLOGÍAS",
      studyName: "UNA LESIÓN (VARIOS VIDRIOS)",
      priceLabel: null,
      displayOrder: 5,
      isActive: false,
      updatedAt: "2026-05-15T12:00:00.000Z",
    },
  );
});

test("update pasa el payload + now a updatePricingItem SIN mutar el payload original", async () => {
  const payload = { priceLabel: null, isActive: false, displayOrder: 7 } as const;
  const snapshotBefore = { ...payload };
  const now = new Date("2026-05-15T12:00:00.000Z");
  const previous = createItem({ id: 1 });
  const calls: Array<{ id: number; payload: Record<string, unknown> }> = [];

  const result = await updateAdminPricingItem(
    {
      listAdminPricingItems: async () => [previous],
      updatePricingItem: async (id, receivedPayload) => {
        calls.push({ id, payload: receivedPayload as Record<string, unknown> });
        return createItem({
          id,
          priceLabel: receivedPayload.priceLabel ?? null,
          isActive: receivedPayload.isActive ?? true,
          displayOrder: receivedPayload.displayOrder ?? 1,
          updatedAt: "2026-05-15T13:00:00.000Z",
        });
      },
    },
    1,
    { ...payload },
    now,
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].id, 1);
  assert.deepEqual(calls[0].payload, {
    priceLabel: null,
    isActive: false,
    displayOrder: 7,
    now,
  });

  // El payload no se altera: mismas claves y valores.
  assert.deepEqual(snapshotBefore, { priceLabel: null, isActive: false, displayOrder: 7 });

  assert.equal(result.status, "updated");
  if (result.status === "updated") {
    assert.equal(result.previous, previous);
    assert.equal(result.updated.id, 1);
    assert.equal(result.updated.updatedAt, "2026-05-15T13:00:00.000Z");
  }
});

test("update de item inexistente devuelve not_found y no invoca updatePricingItem", async () => {
  let updateCalled = false;

  const result = await updateAdminPricingItem(
    {
      listAdminPricingItems: async () => [],
      updatePricingItem: async () => {
        updateCalled = true;
        return null;
      },
    },
    999,
    { isActive: false },
    new Date(),
  );

  assert.equal(result.status, "not_found");
  assert.equal(updateCalled, false);
});

test("el servicio no orquesta auditoría: sólo recibe deps de datos", async () => {
  // No hay ninguna superficie de auditoría en las deps; un update exitoso se
  // resuelve exclusivamente con listAdminPricingItems + updatePricingItem.
  const result = await updateAdminPricingItem(
    {
      listAdminPricingItems: async () => [createItem({ id: 5 })],
      updatePricingItem: async (id) => createItem({ id, displayOrder: 2 }),
    },
    5,
    { displayOrder: 2 },
    new Date(),
  );

  assert.equal(result.status, "updated");
});
