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
  assert.ok(source.includes("Inactivo"));
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

test("admin pricing card renders each pricing item as a manual form", () => {
  const source = read(ADMIN_PRICING_CARD_PATH);

  assert.ok(source.includes("data-admin-pricing-item-form"));
  assert.ok(source.includes("Estudio"));
  assert.ok(source.includes("Precio"));
  assert.ok(source.includes("Orden"));
  assert.ok(source.includes("Estado"));
  assert.ok(source.includes("Vista pública"));
  assert.ok(source.includes("Última actualización"));
  assert.ok(source.includes("lg:grid-cols-2"));
  assert.ok(source.includes("bg-vetneb-surface-raised"));
  assert.ok(source.includes("Guardar precio"));
});

test("admin pricing card supports display order and active state updates", () => {
  const source = read(ADMIN_PRICING_CARD_PATH);

  assert.ok(source.includes("function parseDisplayOrder(value: string): number | null"));
  assert.ok(source.includes("payload.isActive = formState.isActive;"));
  assert.ok(source.includes("payload.displayOrder = nextDisplayOrder;"));
  assert.ok(source.includes('type="number"'));
  assert.ok(source.includes('value={formState.isActive ? "active" : "inactive"}'));
  assert.ok(source.includes('isActive: event.target.value === "active"'));
});

test("admin pricing card contains Guardar todos button with save-all marker", () => {
  const source = read(ADMIN_PRICING_CARD_PATH);

  assert.ok(source.includes("data-save-all"));
  assert.ok(source.includes("Guardar todos"));
  assert.ok(source.includes("Guardando todos..."));
});

test("admin pricing card detects pending changes via pendingItemIds useMemo", () => {
  const source = read(ADMIN_PRICING_CARD_PATH);

  assert.ok(source.includes("pendingItemIds"));
  assert.ok(source.includes("hasPendingValidationErrors"));
  assert.ok(source.includes("normalizePriceLabelForPayload(original.priceLabel ?? \"\")"));
  assert.ok(source.includes("normalizePriceLabelForPayload(form.priceLabel)"));
  assert.ok(source.includes("form.isActive !== original.isActive"));
  assert.ok(source.includes("nextDisplayOrder !== original.displayOrder"));
});

test("admin pricing card does not send unchanged items in save-all", () => {
  const source = read(ADMIN_PRICING_CARD_PATH);

  assert.ok(source.includes("item.payload !== null && item.errorMessage === null"));
  assert.ok(source.includes("for (const { id, payload } of toSave)"));
});

test("admin pricing card disables Guardar todos when no changes or saving", () => {
  const source = read(ADMIN_PRICING_CARD_PATH);

  assert.ok(source.includes("pendingItemIds.length === 0"));
  assert.ok(source.includes("hasPendingValidationErrors"));
  assert.ok(source.includes("isSavingAll"));
  assert.ok(source.includes("savingItemId !== null || isSavingAll"));
});

test("admin pricing card handles per-item error in save-all without false success", () => {
  const source = read(ADMIN_PRICING_CARD_PATH);

  assert.ok(source.includes("for (const { id, payload } of toSave)"));
  assert.ok(source.includes("formatAdminPricingError(error, SAVE_ERROR_MESSAGE)"));
  assert.ok(source.includes("setIsSavingAll(false)"));
});

test("admin pricing card preserves individual Guardar precio intact", () => {
  const source = read(ADMIN_PRICING_CARD_PATH);

  assert.ok(source.includes('type="submit"'));
  assert.ok(source.includes("handleSaveItem"));
  assert.ok(source.includes("isSaving ? \"Guardando...\" : \"Guardar precio\""));
  assert.ok(source.includes("disabled={isSaving || isSavingAll}"));
});

test("admin pricing card does not contain passwords, hashes, tokens or cookies in source", () => {
  const source = read(ADMIN_PRICING_CARD_PATH);

  assert.ok(!source.toLowerCase().includes("password"));
  assert.ok(!source.toLowerCase().includes("hash"));
  assert.ok(!source.toLowerCase().includes("token"));
  assert.ok(!source.toLowerCase().includes("cookie"));
});

test("dashboard admin mounts pricing card in dedicated section", () => {
  const source = read(ADMIN_PAGE_PATH);

  assert.ok(source.includes('import { AdminPricingEditorCard } from "./AdminPricingEditorCard";'));
  assert.ok(source.includes('id="admin-pricing"'));
  assert.ok(source.includes("<AdminPricingEditorCard />"));
});