import assert from "node:assert/strict";
import test from "node:test";
import { readSourceFile as read } from "../../../helpers/tracked-source-files.ts";
import { parseTsx } from "../dashboard/dashboard-source-oracle.ts";
import { functionNamed, runSource } from "../admin/source-function-runner.ts";

const HOME_PAGE_PATH = "frontend/src/app/page.tsx";
const PRECIOS_PAGE_PATH = "frontend/src/app/precios/page.tsx";
const PRECIOS_CONTENT_PATH =
  "frontend/src/components/public/PreciosContent.tsx";

test("home page no longer renders public pricing section", () => {
  const source = read(HOME_PAGE_PATH);

  assert.equal(source.includes("Lista de precios"), false);
  assert.equal(source.includes("getPublicPricing("), false);
  assert.equal(
    source.includes("No se pudieron cargar los precios. Intente nuevamente."),
    false,
  );
  assert.equal(source.includes("No hay precios disponibles."), false);
  assert.equal(source.includes("normalizePriceLabel("), false);
});

test("precios page uses runtime pricing cache and backend API on cache miss", () => {
  const pageSource = read(PRECIOS_PAGE_PATH);
  const source = read(PRECIOS_CONTENT_PATH);

  assert.ok(pageSource.includes("export default function PreciosPage()"));
  assert.ok(pageSource.includes("<PreciosContent />"));
  assert.ok(source.includes("getCachedPublicPricingSnapshot"));
  assert.ok(source.includes("setCachedPublicPricingSnapshot"));
  assert.ok(source.includes("const cachedSnapshot = getCachedPublicPricingSnapshot();"));
  assert.ok(source.includes("cachedSnapshot ??"));
  assert.ok(source.includes("await getPublicPricing("));
  assert.ok(source.includes("{ throwOnError: true }"));
  assert.ok(source.includes("if (!cachedSnapshot && pricingSnapshot.success) {"));
  assert.ok(source.includes("setCachedPublicPricingSnapshot(pricingSnapshot);"));
});

test("TEST-GLOBAL-08 G06-P05 kills M-P01 when a successful fetch must populate the cache", async () => {
  const source = read(PRECIOS_CONTENT_PATH);
  const cached = async (candidate: string) => {
    const snapshots: unknown[] = [];
    const loadPricing = runSource<() => Promise<void>>(
      functionNamed(parseTsx(candidate, PRECIOS_CONTENT_PATH), "loadPricing"),
      {
        isCurrent: true,
        getCachedPublicPricingSnapshot: () => null,
        getPublicPricing: async () => ({ success: true, categories: [] }),
        setCachedPublicPricingSnapshot: (snapshot: unknown) => snapshots.push(snapshot),
        setState: () => undefined,
        sortPricingCategories: (categories: unknown) => categories,
      },
    );
    await loadPricing();
    return snapshots;
  };

  assert.deepEqual(await cached(source), [{ success: true, categories: [] }]);
  const mutant = source.replace(
    "if (!cachedSnapshot && pricingSnapshot.success) {",
    "if (false) if (!cachedSnapshot && pricingSnapshot.success) {",
  );
  assert.notEqual(mutant, source, "M-P01 must be applicable");
  assert.deepEqual(await cached(mutant), [], "M-P01 leaves the successful snapshot uncached");
});

test("precios page keeps public pricing states and fallback label", () => {
  const source = read(PRECIOS_CONTENT_PATH);

  assert.ok(source.includes("function normalizePriceLabel(priceLabel: string | null | undefined): string"));
  assert.ok(source.includes('return normalizedPriceLabel ? normalizedPriceLabel : "Consultar";'));
  assert.ok(source.includes("Lista de precios"));
  assert.ok(source.includes("{normalizePriceLabel(item.priceLabel)}"));
  assert.ok(source.includes("{item.studyName}"));
  assert.ok(source.includes("No se pudieron cargar los precios. Intente nuevamente."));
  assert.ok(source.includes("No hay precios disponibles."));
  assert.ok(source.includes('role="alert"'));
});
