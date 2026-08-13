import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

// A03 · §20.3 — a next-page transition must emit ONE window.
//
// Reports rows and maintenance candidate rows are not uniform: a report with
// the "Tinción" marker is taller than a plain one, an unsupported purge group
// renders an extra reason line. While the adaptive pitch was probed from "the
// first rendered row", the measured pitch depended on which records were on
// screen — page 1 measured one height and page 2 another — so `effectiveLimit`
// changed mid-transition, the offset recompute re-anchored against the changed
// limit, and one click on "Siguiente" emitted several windows (admin-report-
// upload at 834x1194 emitted four and settled back on page 1).
//
// That rule used to be "probe the pitch once per measured-region size and reuse
// it across page changes". Option D removes its premise: the pitch is not probed
// at all. It is a CSS token (`--dash-row-pitch`) that the rows are themselves
// locked to, so no rendered record can reach the page size and there is nothing
// left to cache, hold across pages or re-probe on resize.
//
// These guards therefore keep the same SUBJECTS — one per card — but assert the
// stronger property: no card may retain a second source of truth for the pitch,
// probe its rows, or re-arm measurement from a mutation. A card that reintroduced
// any of those would reopen exactly the loop that made one "Siguiente" emit
// several windows.

const REPORTS_PATH = "frontend/src/app/dashboard/admin/AdminReportsCard.tsx";
const MAINTENANCE_PATH =
  "frontend/src/app/dashboard/admin/AdminMaintenanceDryRunCard.tsx";
const MOBILE_PRICING_PATH =
  "frontend/src/app/dashboard/admin/AdminMobilePricingModule.tsx";
const INFORMES_PATH =
  "frontend/src/app/dashboard/informes/InformesReportsList.tsx";
const CLINIC_TOKENS_PATH =
  "frontend/src/components/dashboard/ClinicParticularTokensCard.tsx";
const LOGISTICS_RECENT_PATH =
  "frontend/src/app/dashboard/logistica/LogisticsRecentListCanvas.tsx";

function read(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

/**
 * Source with comments removed, for guards that assert the ABSENCE of a
 * construct: a file that documents why it no longer probes rows would otherwise
 * fail on the very prose that records the fix.
 */
function readCode(relativePath: string) {
  return read(relativePath)
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/**
 * Shared contract for a migrated card: the capacity comes from the single owner
 * bound to a canvas that declares its density tier, and nothing in the file
 * measures, caches or re-probes a row.
 */
function assertPitchLocked(path: string, label: string) {
  const source = read(path);
  const code = readCode(path);

  assert.ok(
    source.includes('from "@/hooks/useDashboardCanvasCapacity"') &&
      source.includes("useDashboardCanvasCapacity({"),
    `${label}: la cardinalidad debe salir del owner único`,
  );
  assert.ok(
    source.includes('data-dashboard-row-pitch="'),
    `${label}: el canvas debe declarar su tier de densidad`,
  );
  assert.ok(
    !code.includes("rowPitchRef") &&
      !code.includes("onFirstPageRef") &&
      !code.includes("resolveRowPitch") &&
      !code.includes("measurementsEqual"),
    `${label}: no puede quedar una caché de pitch en la card`,
  );
  assert.ok(
    !code.includes("MutationObserver") && !code.includes("new ResizeObserver"),
    `${label}: el sondeo de filas y su re-armado por mutación deben haber desaparecido`,
  );
  assert.ok(
    !/ROW_HEIGHT_FALLBACK_PX/.test(code),
    `${label}: el alto de fila deja de ser una constante del runtime`,
  );
}

test("AdminReportsCard deriva su cardinalidad del owner pitch-locked", () => {
  assertPitchLocked(REPORTS_PATH, "AdminReportsCard");
});

test("AdminMaintenanceDryRunCard deriva su cardinalidad del owner pitch-locked", () => {
  assertPitchLocked(MAINTENANCE_PATH, "AdminMaintenanceDryRunCard");
});

test("InformesReportsList deriva su cardinalidad del owner pitch-locked", () => {
  assertPitchLocked(INFORMES_PATH, "InformesReportsList");
});

test("ClinicParticularTokensCard deriva su cardinalidad del owner pitch-locked", () => {
  assertPitchLocked(CLINIC_TOKENS_PATH, "ClinicParticularTokensCard");
});

// LogisticsRecentListCanvas es el piloto de la arquitectura pitch-locked
// (Opción D). La regla anterior — calibrar el pitch con evidencia de la página
// canónica y congelarlo por geometría en una LRU — existía para domar un pitch
// MEDIDO del contenido: era memoria contra la histéresis A -> B -> A. Ese pitch
// ya no se mide. Lo publica CSS (`--dash-row-pitch`), las filas quedan ancladas
// al mismo token y el owner único lo lee, así que no hay nada que calibrar ni
// que recordar. El guard se endurece en consecuencia: ya no exige una primitiva
// de calibración, exige que NINGUNA segunda fuente de verdad del pitch
// sobreviva en el canvas. Las invariantes del motor viven en
// test/unit/ui/dashboard/dashboard-capacity-engine.test.ts y su contrato
// estructural en test/architecture/dashboard-capacity-single-owner.test.ts.
test("LogisticsRecentListCanvas deriva su cardinalidad del owner pitch-locked", () => {
  const source = read(LOGISTICS_RECENT_PATH);

  assert.ok(
    source.includes('from "@/hooks/useDashboardCanvasCapacity"') &&
      source.includes("useDashboardCanvasCapacity({"),
    "la cardinalidad debe salir del owner único, no de una medición local",
  );
  assert.ok(
    source.includes('data-dashboard-adaptive-rows-canvas="true"') &&
      source.includes('data-dashboard-row-pitch="'),
    "el canvas debe declarar su tier para que el pitch sea un token y no una medida",
  );
  const code = readCode(LOGISTICS_RECENT_PATH);
  assert.ok(
    !code.includes("rowPitchRef") &&
      !code.includes("onFirstPageRef") &&
      !code.includes("adaptiveRowPitchCalibration") &&
      !code.includes("setRowHeightPx"),
    "no puede quedar una segunda fuente de verdad del pitch en el canvas",
  );
  assert.ok(
    !code.includes("MutationObserver") &&
      !code.includes("querySelectorAll") &&
      !code.includes("setPageRef"),
    "ni sondeo de filas, ni re-armado por mutación, ni escritura de la página desde la medición",
  );
});

test("AdminMobilePricingModule deriva la cardinalidad del canvas medido", () => {
  const source = read(MOBILE_PRICING_PATH);

  assert.ok(
    !source.includes("CATALOG_PAGE_SIZE"),
    "la constante fija de 4 filas no puede seguir decidiendo la paginación visible",
  );
  assert.ok(
    source.includes("const CATALOG_FALLBACK_ROWS = 4;"),
    "el 4 sobrevive únicamente como fallback pre-medición",
  );
  assert.ok(
    source.includes('import { useDashboardCanvasCapacity } from "@/hooks/useDashboardCanvasCapacity";'),
    "debe reutilizar el hook adaptativo del repo, no una segunda fuente de verdad",
  );
  assert.ok(
    source.includes("const { capacity: catalogPageSize } = useDashboardCanvasCapacity({") &&
      source.includes("canvasNode: catalogListNode,"),
    "la cardinalidad sale del canvas de catálogo realmente medido",
  );
  assert.ok(
    source.includes("ref={setCatalogListNode}") &&
      source.includes('data-dashboard-row-pitch="'),
    "hace falta el canvas acotado y su tier; la fila de referencia ya no se mide",
  );
  assert.ok(
    !source.includes("grid-rows-4") && !source.includes("row-span-4"),
    "una grilla de 4 filas estiradas haría la medición autorreferencial",
  );
});
