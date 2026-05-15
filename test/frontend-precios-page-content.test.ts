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
  assert.ok(source.includes("overflow-hidden border-vetneb-line/90 bg-card"));
  assert.ok(source.includes("shadow-[0_18px_48px_rgba(15,45,62,0.09)]"));
  assert.ok(source.includes("ring-1 ring-slate-200/70"));
  assert.ok(source.includes("bg-[hsl(var(--vetneb-navy))]"));
  assert.ok(source.includes("text-center text-base font-semibold uppercase"));
  assert.ok(source.includes("bg-vetneb-surface-raised/60"));
  assert.ok(source.includes("rounded-xl border border-vetneb-line bg-card shadow-sm"));
  assert.equal(source.includes("estudios disponibles"), false);
});

test("precios page renders price rows with bordered pills and clear hierarchy", () => {
  const source = read(PRECIOS_PAGE_PATH);

  assert.ok(source.includes("flex items-start justify-between gap-5 px-5 py-4"));
  assert.ok(source.includes("hover:bg-vetneb-surface-raised"));
  assert.ok(source.includes("text-sm font-semibold uppercase tracking-[0.04em] text-vetneb-ink"));
  assert.ok(source.includes("rounded-full border border-vetneb-line bg-vetneb-surface-raised"));
  assert.ok(source.includes("text-sm font-bold text-primary shadow-sm"));
});

test("precios page preserves fallback labels and error/empty states", () => {
  const source = read(PRECIOS_PAGE_PATH);

  assert.ok(source.includes('return normalizedPriceLabel ? normalizedPriceLabel : "Consultar";'));
  assert.ok(source.includes("No se pudieron cargar los precios. Intente nuevamente."));
  assert.ok(source.includes("No hay precios disponibles."));
  assert.ok(source.includes("hasPricingItems(pricingCategories)"));
  assert.ok(source.includes('role="alert"'));
});