import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const PRECIOS_PAGE_PATH = "frontend/src/app/precios/page.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("precios page defines public metadata and layout", () => {
  const source = read(PRECIOS_PAGE_PATH);

  assert.ok(source.includes('import type { Metadata } from "next";'));
  assert.ok(source.includes('import { PublicLayout } from "@/components/layout/PublicLayout";'));
  assert.ok(source.includes('import { createPageMetadata } from "@/lib/seo";'));
  assert.ok(source.includes("export const metadata: Metadata = createPageMetadata("));
  assert.ok(source.includes('"Lista de precios"'));
  assert.ok(source.includes('"/precios"'));
  assert.ok(source.includes("<PublicLayout>"));
});

test("precios page keeps category priority with citologías then histopatologías", () => {
  const source = read(PRECIOS_PAGE_PATH);
  const citologiasIndex = source.indexOf('"CITOLOGÍAS"');
  const histopatologiasIndex = source.indexOf('"HISTOPATOLOGÍAS"');

  assert.ok(source.includes("const CATEGORY_PRIORITY = new Map<string, number>(["));
  assert.ok(citologiasIndex !== -1);
  assert.ok(histopatologiasIndex !== -1);
  assert.ok(citologiasIndex < histopatologiasIndex);
  assert.ok(source.includes("function sortPricingCategories("));
});

test("precios page renders responsive side-by-side category cards with formal medical visual style", () => {
  const source = read(PRECIOS_PAGE_PATH);

  assert.ok(source.includes("mx-auto grid max-w-7xl grid-cols-1 gap-7 lg:grid-cols-2"));
  assert.ok(source.includes("clinical-card overflow-hidden"));
  assert.ok(source.includes("clinical-card-header"));
  assert.ok(source.includes("border-b border-vetneb-line px-6 py-5 text-center"));
  assert.equal(source.includes("bg-[hsl(var(--vetneb-navy))]"), false);
  assert.ok(source.includes("text-center text-base font-semibold uppercase"));
  assert.ok(source.includes("bg-vetneb-surface-raised/60"));
  assert.ok(source.includes("rounded-lg border border-vetneb-line bg-card shadow-sm"));
  assert.equal(source.includes("estudios disponibles"), false);
});

test("precios page renders price rows with bordered pills and clear hierarchy", () => {
  const source = read(PRECIOS_PAGE_PATH);

  assert.ok(
    source.includes(
      "clinical-hover-row flex flex-col items-start gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-5",
    ),
  );
  assert.equal(
    source.includes("clinical-hover-row flex items-start justify-between gap-5 px-5 py-4"),
    false,
  );
  assert.ok(
    source.includes(
      "w-full min-w-0 break-words text-sm font-semibold uppercase tracking-[0.04em] text-vetneb-ink sm:flex-1",
    ),
  );
  assert.ok(
    source.includes(
      "clinical-pill max-w-full self-start break-words px-3 py-1 text-sm font-bold tracking-normal shadow-sm sm:ml-auto sm:shrink-0",
    ),
  );
  assert.ok(source.includes("normalizePriceLabel(item.priceLabel)"));
});

test("precios page preserves fallback labels and error/empty states", () => {
  const source = read(PRECIOS_PAGE_PATH);

  assert.ok(source.includes('return normalizedPriceLabel ? normalizedPriceLabel : "Consultar";'));
  assert.ok(source.includes("No se pudieron cargar los precios. Intente nuevamente."));
  assert.ok(source.includes("No hay precios disponibles."));
  assert.ok(source.includes("hasPricingItems(pricingCategories)"));
  assert.ok(source.includes('role="alert"'));
});

test("precios page only shows load error when getPublicPricing fails", () => {
  const source = read(PRECIOS_PAGE_PATH);

  assert.ok(source.includes("let pricingLoadError = false;"));
  assert.ok(source.includes("try {"));
  assert.ok(source.includes("pricingCategories = sortPricingCategories(pricingSnapshot.categories);"));
  assert.ok(source.includes("} catch {"));
  assert.ok(source.includes("pricingLoadError = true;"));
  assert.ok(source.includes("pricingLoadError ? ("));
  assert.ok(source.includes(": hasPricingItems(pricingCategories) ? ("));
});

test("precios page renders grouped categories and study items when categories exist", () => {
  const source = read(PRECIOS_PAGE_PATH);

  assert.ok(source.includes("{pricingCategories.map((category) => {"));
  assert.ok(source.includes("key={category.category}"));
  assert.ok(source.includes("{category.items.map((item, index) => ("));
  assert.ok(source.includes("index < category.items.length - 1"));
  assert.ok(source.includes("{item.studyName}"));
  assert.ok(source.includes("{normalizePriceLabel(item.priceLabel)}"));
});
