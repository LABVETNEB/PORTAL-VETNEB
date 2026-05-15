import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const ADMIN_PRICING_CARD_PATH =
  "frontend/src/app/dashboard/admin/AdminPricingEditorCard.tsx";
const ADMIN_PAGE_PATH = "frontend/src/app/dashboard/admin/page.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("admin pricing card uses admin pricing API helpers", () => {
  const source = read(ADMIN_PRICING_CARD_PATH);

  assert.ok(source.includes('"use client";'));
  assert.ok(source.includes("getAdminPricing"));
  assert.ok(source.includes("updateAdminPricingItem"));
  assert.ok(source.includes("type AdminPricingCategory"));
  assert.ok(source.includes("type AdminPricingItem"));
  assert.ok(source.includes("type AdminPricingUpdatePayload"));
});

test("admin pricing card renders explicit title and state messages", () => {
  const source = read(ADMIN_PRICING_CARD_PATH);

  assert.ok(source.includes("Lista de precios"));
  assert.ok(source.includes("No se pudieron cargar los precios. Intente nuevamente."));
  assert.ok(source.includes("No hay precios configurados."));
  assert.ok(source.includes("No se pudo actualizar el precio. Intente nuevamente."));
  assert.ok(source.includes("Precio actualizado."));
  assert.ok(source.includes("Activo"));
  assert.ok(source.includes("Consultar"));
});

test("admin pricing card normalizes priceLabel and supports explicit clearing", () => {
  const source = read(ADMIN_PRICING_CARD_PATH);

  assert.ok(source.includes("function normalizePriceLabelForPayload(value: string): string | null"));
  assert.ok(source.includes("const trimmed = value.trim();"));
  assert.ok(source.includes("return trimmed ? trimmed : null;"));
  assert.ok(source.includes("const nextPriceLabel = normalizePriceLabelForPayload(formState.priceLabel);"));
  assert.ok(source.includes("payload.priceLabel = nextPriceLabel;"));
});

test("admin pricing card supports display order and active toggle updates", () => {
  const source = read(ADMIN_PRICING_CARD_PATH);

  assert.ok(source.includes("function parseDisplayOrder(value: string): number | null"));
  assert.ok(source.includes("payload.isActive = formState.isActive;"));
  assert.ok(source.includes("payload.displayOrder = nextDisplayOrder;"));
  assert.ok(source.includes('type="number"'));
  assert.ok(source.includes('type="checkbox"'));
});

test("dashboard admin mounts pricing card in dedicated section", () => {
  const source = read(ADMIN_PAGE_PATH);

  assert.ok(source.includes('import { AdminPricingEditorCard } from "./AdminPricingEditorCard";'));
  assert.ok(source.includes('id="admin-pricing"'));
  assert.ok(source.includes("<AdminPricingEditorCard />"));
});
