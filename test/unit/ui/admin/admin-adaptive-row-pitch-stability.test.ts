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
// The pitch is a property of the layout, not of the current page: it is probed
// once per measured-region size and reused across page changes, and re-probed
// when that region resizes. These guards pin that rule at the source, per card,
// without freezing any measured value.

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

test("AdminReportsCard reutiliza el pitch medido entre páginas y lo revalida por tamaño de región", () => {
  const source = read(REPORTS_PATH);

  assert.ok(
    source.includes("const rowPitchRef = useRef<{"),
    "el pitch debe vivir en un ref por layout, no recalcularse en cada swap de datos",
  );
  assert.ok(
    source.includes("function resolveRowPitch("),
    "la resolución del pitch debe estar centralizada para ambas presentaciones",
  );
  assert.ok(
    source.includes(
      "cached.node !== container || cached.containerHeight !== containerHeight",
    ),
    "el pitch sólo se vuelve a medir cuando cambia la región medida",
  );
  assert.ok(
    source.includes("if (!layoutChanged && cached.rowHeightPx > 0 && !onFirstPageRef.current)") &&
      source.includes("onFirstPageRef.current = isOnFirstPage;"),
    "el pitch se sondea en la primera página y se sostiene mientras se pagina",
  );

  // Ambas presentaciones pasan por la misma resolución: una sola semántica.
  assert.ok(
    source.includes(
      "rowHeightPx: resolveRowPitch(mobileBodyNode, mobileHeight, rowHeight),",
    ),
  );
  assert.ok(
    source.includes(
      "rowHeightPx: resolveRowPitch(desktopBodyNode, desktopHeight, rowHeight),",
    ),
  );

  // El fallback sigue siendo sólo pre-medición: no se fija ningún limit.
  assert.ok(source.includes("const REPORTS_ROW_HEIGHT_FALLBACK_PX = 36;"));
  assert.ok(
    !source.includes("itemsPerPage: 9") && !source.includes("limit: 9,"),
    "no se congela ningún limit; la cardinalidad sigue siendo medida",
  );
});

test("AdminMaintenanceDryRunCard no re-mide el pitch al cambiar de página", () => {
  const source = read(MAINTENANCE_PATH);

  assert.ok(source.includes("const rowPitchRef = useRef<{"));
  assert.ok(
    source.includes("cached.node !== candidatesListNode ||") &&
      source.includes("cached.containerHeight !== containerHeight;") &&
      source.includes("onFirstPageRef.current = isOnFirstCandidatePage;"),
    "el pitch se sondea en la primera página y se sostiene mientras se pagina",
  );
  assert.ok(
    source.includes("}, [firstCandidateRowNode, candidatesListNode]);"),
    "la medición debe observar también el contenedor para revalidar por resize",
  );
});

test("InformesReportsList conserva el pitch entre páginas y lo revalida por tamaño de región", () => {
  const source = read(INFORMES_PATH);

  assert.ok(source.includes("const rowPitchRef = useRef<{"));
  assert.ok(source.includes("function resolveRowPitch("));
  assert.ok(
    source.includes(
      "cached.node !== container || cached.containerHeight !== containerHeight",
    ),
  );
  assert.ok(
    source.includes(
      "rowHeightPx: resolveRowPitch(bodyNode, containerHeight, rowHeight),",
    ),
    "la medición debe pasar por la resolución cacheada, no por la fila cruda",
  );
  assert.ok(source.includes("const INFORMES_ROW_HEIGHT_FALLBACK_PX = 88;"));
});

test("ClinicParticularTokensCard no re-mide el pitch al cambiar de página", () => {
  const source = read(CLINIC_TOKENS_PATH);

  assert.ok(source.includes("const rowPitchRef = useRef<{"));
  assert.ok(
    source.includes("cached.node !== panelBodyNode || cached.containerHeight !== containerHeight;") &&
      source.includes("!onFirstPageRef.current") &&
      source.includes("onFirstPageRef.current = isOnFirstTokensPage;"),
  );
  assert.ok(
    source.includes(
      "}, [firstDesktopRowNode, firstMobileRowNode, panelBodyNode]);",
    ),
    "la región medida debe observarse para revalidar el pitch por resize",
  );
});

// LogisticsRecentListCanvas endureció la regla: sostener el pitch entre páginas
// no bastaba. La clave de layout era sólo la altura, así que un cambio de
// geometría estando en la página N promovía a canónico el pitch de esa página y
// la misma geometría quedaba con un limit distinto según cómo se hubiera
// llegado (histéresis A -> B -> A). La regla vive ahora en la primitiva
// `adaptiveRowPitchCalibration`, con invariantes cubiertas por
// test/unit/ui/dashboard/dashboard-adaptive-row-pitch-calibration.test.ts.
test("LogisticsRecentListCanvas calibra el pitch sólo con evidencia canónica", () => {
  const source = read(LOGISTICS_RECENT_PATH);

  assert.ok(
    source.includes(
      'from "@/components/dashboard/adaptiveRowPitchCalibration"',
    ) && source.includes("createAdaptiveRowPitchCalibrator()"),
    "la calibración debe delegar en la primitiva, no reimplementarse aquí",
  );
  assert.ok(
    source.includes("const outcome = calibrator.reconcile({") &&
      source.includes("inlineSize: canvas.width,") &&
      source.includes("blockSize: canvas.height,") &&
      source.includes("page: pageRef.current,"),
    "la geometría material (ancho y alto) y la página medida entran en la clave",
  );
  assert.ok(
    source.includes("if (outcome.requestedPage !== null) {") &&
      source.includes("setPageRef.current(outcome.requestedPage);"),
    "la transición a la página canónica y su restitución deben aplicarse",
  );
  assert.ok(
    !source.includes("rowPitchRef") && !source.includes("onFirstPageRef"),
    "no puede quedar una segunda fuente de verdad del pitch en el canvas",
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
    source.includes('import { useAdaptiveRowsPerPage } from "@/hooks/useAdaptiveRowsPerPage";'),
    "debe reutilizar el hook adaptativo del repo, no una segunda fuente de verdad",
  );
  assert.ok(
    source.includes("const { rowsPerPage: catalogPageSize } = useAdaptiveRowsPerPage({") &&
      source.includes("containerNode: catalogListNode,"),
    "la cardinalidad sale del canvas de catálogo realmente medido",
  );
  assert.ok(
    source.includes("ref={setCatalogListNode}") &&
      source.includes("ref={rowIndex === 0 ? setFirstCatalogRowNode : undefined}"),
    "hacen falta el contenedor medido y la fila de referencia",
  );
  assert.ok(
    !source.includes("grid-rows-4") && !source.includes("row-span-4"),
    "una grilla de 4 filas estiradas haría la medición autorreferencial",
  );
});
