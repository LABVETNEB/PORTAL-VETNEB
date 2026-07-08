import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const DASHBOARD_PAGE_PATH = "frontend/src/app/dashboard/page.tsx";
const CLINIC_COMMAND_CENTER_PATH = "frontend/src/app/dashboard/ClinicCommandCenter.tsx";
const INFORMES_PAGE_PATH = "frontend/src/app/dashboard/informes/page.tsx";
const INFORMES_LIST_PATH =
  "frontend/src/app/dashboard/informes/InformesReportsList.tsx";
const LOGISTICA_PAGE_PATH = "frontend/src/app/dashboard/logistica/page.tsx";
const LOGISTICS_COMMAND_CENTER_PATH =
  "frontend/src/app/dashboard/logistica/LogisticsCommandCenter.tsx";

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
  const pageSource = read(INFORMES_PAGE_PATH);
  const listSource = read(INFORMES_LIST_PATH);

  assert.ok(pageSource.includes("reportsLoadError = true;"));
  assert.ok(listSource.includes("loadError ?"));
  assert.ok(listSource.includes("reports.length > 0 ?"));
  assert.ok(listSource.includes("No se pudieron cargar los informes. Intente nuevamente."));
  assert.ok(listSource.includes('role="alert"'));
  assert.ok(listSource.includes("No hay informes disponibles."));
  assert.ok(listSource.includes("<EmptyState"));
  assert.ok(listSource.includes("reports.map((report"));
});

test("dashboard logistics page distinguishes overview load failures from empty states", () => {
  const pageSource = read(LOGISTICA_PAGE_PATH);
  const commandCenterSource = read(LOGISTICS_COMMAND_CENTER_PATH);

  // Page tracks load errors and passes them to LogisticsCommandCenter
  assert.ok(pageSource.includes("let fieldVisitsLoadError = false;"));
  assert.ok(pageSource.includes("let routePlansLoadError = false;"));
  assert.ok(pageSource.includes("fieldVisitsLoadError={fieldVisitsLoadError}"));
  assert.ok(pageSource.includes("routePlansLoadError={routePlansLoadError}"));

  // LogisticsCommandCenter handles rendering with error and empty states
  assert.ok(commandCenterSource.includes("fieldVisitsLoadError ?"));
  assert.ok(commandCenterSource.includes("routePlansLoadError ?"));
  assert.ok(commandCenterSource.includes("recentVisits.length ?"));
  assert.ok(commandCenterSource.includes("recentPlans.length ?"));
  assert.ok(commandCenterSource.includes("No se pudieron cargar las visitas de campo. Intente nuevamente."));
  assert.ok(commandCenterSource.includes("No se pudieron cargar los planes de ruta. Intente nuevamente."));
  assert.ok(commandCenterSource.includes('role="alert"'));
  assert.ok(commandCenterSource.includes("No hay visitas de campo disponibles."));
  assert.ok(commandCenterSource.includes("No hay planes de ruta disponibles."));
  assert.ok(commandCenterSource.includes("recentVisits.map((visit)"));
  assert.ok(commandCenterSource.includes("recentPlans.map((plan)"));
});
