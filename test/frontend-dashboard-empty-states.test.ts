import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const DASHBOARD_PAGE_PATH = "frontend/src/app/dashboard/page.tsx";
const CLINIC_COMMAND_CENTER_PATH = "frontend/src/app/dashboard/ClinicCommandCenter.tsx";
const INFORMES_PAGE_PATH = "frontend/src/app/dashboard/informes/page.tsx";
const LOGISTICA_PAGE_PATH = "frontend/src/app/dashboard/logistica/page.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("dashboard overview page retains load-error variables and propagates them to command center", () => {
  const source = read(DASHBOARD_PAGE_PATH);

  assert.ok(source.includes("let statsLoadError = false;"));
  assert.ok(source.includes("let reportsLoadError = false;"));
  assert.ok(source.includes("let visitsLoadError = false;"));
  assert.ok(source.includes("statsLoadError = true;"));
  assert.ok(source.includes("reportsLoadError = true;"));
  assert.ok(source.includes("visitsLoadError = true;"));
  assert.ok(source.includes("statsLoadError={statsLoadError}"));
  assert.ok(source.includes("reportsLoadError={reportsLoadError}"));
  assert.ok(source.includes("visitsLoadError={visitsLoadError}"));
});

test("dashboard overview clinic command center distinguishes recent list load failures from empty states", () => {
  const source = read(CLINIC_COMMAND_CENTER_PATH);

  assert.ok(source.includes("statsLoadError ?"));
  assert.ok(source.includes("reportsLoadError ?"));
  assert.ok(source.includes("visitsLoadError ?"));
  assert.ok(source.includes("No se pudieron cargar las métricas operativas. Intente nuevamente."));
  assert.ok(source.includes("recentReports.length ?"));
  assert.ok(source.includes("recentVisits.length ?"));
  assert.ok(source.includes("No se pudieron cargar los informes recientes. Intente nuevamente."));
  assert.ok(source.includes("No se pudieron cargar las visitas de campo recientes. Intente nuevamente."));
  assert.ok(source.includes('role="alert"'));
  assert.ok(source.includes("No hay informes recientes disponibles."));
  assert.ok(source.includes("No hay visitas de campo recientes disponibles."));
});

test("dashboard informes page shows empty state when reports are unavailable", () => {
  const source = read(INFORMES_PAGE_PATH);

  assert.ok(source.includes("reportsLoadError ?"));
  assert.ok(source.includes("reports.length ?"));
  assert.ok(source.includes("No se pudieron cargar los informes. Intente nuevamente."));
  assert.ok(source.includes('role="alert"'));
  assert.ok(source.includes("No hay informes disponibles."));
  assert.ok(source.includes("colSpan={7}"));
  assert.ok(source.includes("reports.map((report)"));
});

test("dashboard logistics page distinguishes overview load failures from empty states", () => {
  const source = read(LOGISTICA_PAGE_PATH);

  assert.ok(source.includes("fieldVisitsLoadError ?"));
  assert.ok(source.includes("routePlansLoadError ?"));
  assert.ok(source.includes("fieldVisits.length ?"));
  assert.ok(source.includes("routePlans.length ?"));
  assert.ok(source.includes("No se pudieron cargar las visitas recientes. Intente nuevamente."));
  assert.ok(source.includes("No se pudieron cargar los planes de ruta recientes. Intente nuevamente."));
  assert.ok(source.includes('role="alert"'));
  assert.ok(source.includes("No hay visitas recientes disponibles."));
  assert.ok(source.includes("No hay planes de ruta disponibles."));
  assert.ok(source.includes("fieldVisits.slice(0, 4).map((visit)"));
  assert.ok(source.includes("routePlans.map((plan)"));
});
