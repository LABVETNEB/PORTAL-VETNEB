import assert from "node:assert/strict";
import test from "node:test";
import { readSourceFile as read } from "../../../helpers/tracked-source-files.ts";
import { parseTsx } from "../dashboard/dashboard-source-oracle.ts";
import { functionNamed, runSource } from "./source-function-runner.ts";

const ADMIN_PRICING_CARD_PATH =
  "frontend/src/app/dashboard/admin/AdminPricingEditorCard.tsx";
const ADMIN_PAGE_PATH = "frontend/src/app/dashboard/admin/page.tsx";

// Ids "Guardar todos" sends when item 1 changed, item 2 is unchanged and item
// 3 carries a validation error.
async function savedItemIds(source: string): Promise<number[]> {
  const sent: number[] = [];
  const payloads: Record<number, { payload: unknown; errorMessage: string | null }> = {
    1: { payload: { priceLabel: "$ 10" }, errorMessage: null },
    2: { payload: null, errorMessage: null },
    3: { payload: null, errorMessage: "Precio inválido" },
  };
  const handleSaveAll = runSource<() => Promise<void>>(
    functionNamed(parseTsx(source, ADMIN_PRICING_CARD_PATH), "handleSaveAll"),
    {
      savingItemId: null,
      isSavingAll: false,
      pendingItemIds: [1, 2, 3],
      hasPendingValidationErrors: false,
      getUpdatePayload: (id: number) => payloads[id],
      updateAdminPricingItem: async (id: number, payload: unknown) => {
        sent.push(id);
        return { pricingItem: { id, ...(payload as object) } };
      },
      setIsSavingAll: () => {},
      setCategories: () => {},
      setOriginalItemsById: () => {},
      setFormStateById: () => {},
      applyUpdatedItem: () => [],
      toFormState: () => ({}),
      SAVE_SUCCESS_MESSAGE: "ok",
      SAVE_ERROR_MESSAGE: "error",
      updateItemFormState: () => {},
      formatAdminPricingError: String,
    },
  );

  await handleSaveAll();
  return sent;
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

test("admin pricing card renders state messages without the retired title", () => {
  const source = read(ADMIN_PRICING_CARD_PATH);

  // Desktop/tablet space pass: the "Lista de precios" header is retired; its
  // actions ride the category tab bar (or a bare row when there are no tabs).
  assert.equal(source.includes("<CardTitle"), false);
  assert.equal(source.includes("<CardHeader"), false);
  assert.ok(source.includes("actions={pricingActions}"));
  assert.ok(source.includes("{showCategoryTabs ? null : ("));
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

test("admin pricing card renders each pricing item as a compact manual form row", () => {
  const source = read(ADMIN_PRICING_CARD_PATH);

  assert.ok(source.includes("data-admin-pricing-item-form"));
  for (const label of ["Estudio", "Precio", "Orden", "Estado", "Vista pública", "Última actualización"]) {
    assert.ok(source.includes(`<span>${label}</span>`) || source.includes(`lg:block">${label}</span>`), `column label ${label}`);
  }
  for (const field of ["Precio de", "Orden de", "Estado de"]) {
    assert.ok(source.includes(`aria-label={\`${field} ${"$"}{item.studyName}\`}`), `${field}: each field keeps an accessible name`);
  }
  assert.ok(source.includes("const PRICING_ROW_GRID_CLASS_NAME ="), "header and rows share one column grid");
  assert.ok(source.includes('data-dashboard-row-pitch="regular"'), "rows lock to a row pitch, not to the form block");
  assert.equal(source.includes('data-dashboard-row-pitch="form"'), false);
  assert.ok(source.includes("Guardar precio"));
});

test("admin pricing card shows every study of a category in one view, paging only on overflow", () => {
  const source = read(ADMIN_PRICING_CARD_PATH);

  assert.ok(source.includes("const fitsInOneView = !measured || items.length <= capacity;"));
  assert.ok(source.includes("usePagedRows(items, fitsInOneView ? Math.max(1, items.length) : capacity)"));
  assert.ok(source.includes("{fitsInOneView ? null : (\n        <CompactPager"), "the pager only mounts when the category overflows");
  assert.equal((source.match(/<CompactPager\b/g) ?? []).length, 1);
  // Data source unchanged: one GET of the whole catalog, no limit/offset.
  assert.ok(source.includes("const snapshot = await getAdminPricing();"));
  assert.equal(/\blimit\b|\boffset\b/.test(source), false, "pricing never sizes or offsets a request");
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

test("admin pricing card does not send unchanged items in save-all", async () => {
  const source = read(ADMIN_PRICING_CARD_PATH);

  assert.ok(source.includes("item.payload !== null && item.errorMessage === null"));
  assert.ok(source.includes("for (const { id, payload } of toSave)"));

  assert.deepEqual(await savedItemIds(source), [1]);

  const unfiltered = source.replace(
    "item.payload !== null && item.errorMessage === null,",
    () => "true ||\nitem.payload !== null && item.errorMessage === null,",
  );
  assert.notEqual(unfiltered, source);
  assert.notDeepEqual(await savedItemIds(unfiltered), [1]);
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