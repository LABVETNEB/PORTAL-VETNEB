import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const VISITAS_PAGE_PATH =
  "frontend/src/app/dashboard/logistica/visitas/page.tsx";
const RUTAS_PAGE_PATH =
  "frontend/src/app/dashboard/logistica/rutas/page.tsx";
const METRICAS_PAGE_PATH =
  "frontend/src/app/dashboard/logistica/metricas/page.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("logistics visits detail page shows an empty table state", () => {
  const source = read(VISITAS_PAGE_PATH);

  assert.ok(source.includes("visitsLoadError ?"));
  assert.ok(source.includes("visits.length ?"));
  assert.ok(source.includes("visits.map((visit)"));
  assert.ok(source.includes("No se pudieron cargar las visitas de campo. Intente nuevamente."));
  assert.ok(source.includes('role="alert"'));
  assert.ok(source.includes("No hay visitas de campo disponibles."));
  assert.ok(source.includes("colSpan={7}"));
});

test("logistics route plans detail page shows an empty table state", () => {
  const source = read(RUTAS_PAGE_PATH);

  assert.ok(source.includes("routePlans.length ?"));
  assert.ok(source.includes("routePlans.map((plan)"));
  assert.ok(source.includes("No hay planes de ruta disponibles."));
  assert.ok(source.includes("colSpan={6}"));
});

test("logistics metrics detail page shows an empty card state", () => {
  const source = read(METRICAS_PAGE_PATH);

  assert.ok(source.includes("routeMetrics.length ?"));
  assert.ok(source.includes("routeMetrics.map((metric)"));
  assert.ok(source.includes("No hay métricas de ruta disponibles."));
});
