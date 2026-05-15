import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const HOME_PAGE_PATH = "frontend/src/app/page.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("home page requests public pricing from backend API", () => {
  const source = read(HOME_PAGE_PATH);

  assert.ok(source.includes('import { getPublicPricing, type PublicPricingCategory } from "@/lib/api";'));
  assert.ok(source.includes("export default async function HomePage()"));
  assert.ok(source.includes("await getPublicPricing("));
  assert.ok(source.includes('{ cache: "no-store" }'));
  assert.ok(source.includes("{ throwOnError: true },"));
});

test("home page shows public pricing section and normalized label fallback", () => {
  const source = read(HOME_PAGE_PATH);

  assert.ok(source.includes("Lista de precios"));
  assert.ok(source.includes("normalizePriceLabel(priceLabel: string | null | undefined): string"));
  assert.ok(source.includes('return normalizedPriceLabel ? normalizedPriceLabel : "Consultar";'));
  assert.ok(source.includes("{item.studyName}"));
  assert.ok(source.includes("{normalizePriceLabel(item.priceLabel)}"));
});

test("home page distinguishes pricing API error and empty states", () => {
  const source = read(HOME_PAGE_PATH);

  assert.ok(source.includes("pricingLoadError ?"));
  assert.ok(source.includes('role="alert"'));
  assert.ok(source.includes("No se pudieron cargar los precios. Intente nuevamente."));
  assert.ok(source.includes("No hay precios disponibles."));
  assert.ok(source.includes("hasPricingItems(pricingCategories)"));
});
