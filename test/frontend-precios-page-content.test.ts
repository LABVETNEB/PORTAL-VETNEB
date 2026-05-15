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

test("precios page renders responsive side-by-side category cards", () => {
  const source = read(PRECIOS_PAGE_PATH);

  assert.ok(source.includes("grid grid-cols-1 gap-6 lg:grid-cols-2"));
  assert.ok(source.includes("border-vetneb-line bg-vetneb-surface-raised/80"));
  assert.ok(source.includes("bg-primary py-4 text-center"));
  assert.ok(source.includes("text-center text-lg font-semibold text-primary-foreground"));
  assert.ok(source.includes("flex items-start justify-between gap-4"));
  assert.ok(source.includes("text-sm font-medium text-vetneb-ink"));
  assert.ok(source.includes("text-sm font-semibold text-vetneb-ink"));
});

test("precios page preserves fallback labels and error/empty states", () => {
  const source = read(PRECIOS_PAGE_PATH);

  assert.ok(source.includes("return normalizedPriceLabel ? normalizedPriceLabel : \"Consultar\";"));
  assert.ok(source.includes("No se pudieron cargar los precios. Intente nuevamente."));
  assert.ok(source.includes("No hay precios disponibles."));
  assert.ok(source.includes("hasPricingItems(pricingCategories)"));
  assert.ok(source.includes('role="alert"'));
});
