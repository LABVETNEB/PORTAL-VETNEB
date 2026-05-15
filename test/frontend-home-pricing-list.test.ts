import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const HOME_PAGE_PATH = "frontend/src/app/page.tsx";
const PRECIOS_PAGE_PATH = "frontend/src/app/precios/page.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

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

test("precios page requests public pricing from backend API", () => {
  const source = read(PRECIOS_PAGE_PATH);

  assert.ok(source.includes("export default async function PreciosPage()"));
  assert.ok(source.includes("await getPublicPricing("));
  assert.ok(source.includes('{ cache: "no-store" }'));
  assert.ok(source.includes("{ throwOnError: true },"));
});

test("precios page keeps public pricing states and fallback label", () => {
  const source = read(PRECIOS_PAGE_PATH);

  assert.ok(source.includes("function normalizePriceLabel(priceLabel: string | null | undefined): string"));
  assert.ok(source.includes('return normalizedPriceLabel ? normalizedPriceLabel : "Consultar";'));
  assert.ok(source.includes("Lista de precios"));
  assert.ok(source.includes("{normalizePriceLabel(item.priceLabel)}"));
  assert.ok(source.includes("{item.studyName}"));
  assert.ok(source.includes("No se pudieron cargar los precios. Intente nuevamente."));
  assert.ok(source.includes("No hay precios disponibles."));
  assert.ok(source.includes('role="alert"'));
});
