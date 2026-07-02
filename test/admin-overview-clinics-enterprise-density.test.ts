import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const COMMAND_CENTER_PATH =
  "frontend/src/app/dashboard/admin/AdminCommandCenter.tsx";
const QUICK_LINKS_PATH =
  "frontend/src/app/dashboard/admin/AdminOverviewQuickLinks.tsx";
const CLINICS_CARD_PATH =
  "frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx";
const GLOBALS_PATH = "frontend/src/app/globals.css";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

const FORBIDDEN_OVERSIZED = [
  "text-2xl",
  "text-3xl",
  "p-6",
  "p-8",
  "gap-6",
  "gap-8",
  "h-14",
  "h-16",
];

for (const path of [COMMAND_CENTER_PATH, QUICK_LINKS_PATH, CLINICS_CARD_PATH]) {
  test(`enterprise density: ${path} avoids oversized landing-style classes`, () => {
    const source = read(path);
    for (const forbidden of FORBIDDEN_OVERSIZED) {
      assert.equal(
        source.includes(forbidden),
        false,
        `${path} must not use oversized class ${forbidden}`,
      );
    }
  });
}

test("admin overview module exposes a compact KPI strip without a gradient hero", () => {
  const source = read(COMMAND_CENTER_PATH);

  assert.ok(source.includes("Métricas operativas"));
  assert.ok(source.includes("text-xl"));
  assert.equal(source.includes("DashboardHubHero"), false);
  assert.equal(source.includes("bg-gradient-to-br"), false);
});

test("admin overview keeps the four compact operational panels", () => {
  const overviewSource = read(COMMAND_CENTER_PATH);
  const linksSource = read(QUICK_LINKS_PATH);

  for (const panel of [
    "Atención requerida",
    "Actividad reciente",
    "Alertas y estados",
  ]) {
    assert.ok(overviewSource.includes(panel), `missing compact panel ${panel}`);
  }
  assert.ok(linksSource.includes("Módulos operativos"));
  assert.ok(linksSource.includes('module: "admin-clinics"'));
});

test("admin clinics console derives the server page size from measurement while respecting no-scroll", () => {
  const source = read(CLINICS_CARD_PATH);

  // R-02: cardinality is measured (Zero-Scroll adaptive contract), not a
  // matchMedia-driven fixed constant. CLINICS_FALLBACK_ROWS is only the
  // pre-measurement fallback; CLINICS_SUPERSET_CAP is the HY ceiling.
  assert.ok(source.includes("const CLINICS_FALLBACK_ROWS = 9;"));
  assert.ok(source.includes("const CLINICS_SUPERSET_CAP = 36;"));
  assert.equal(source.includes("const MOBILE_PAGE_SIZE"), false);
  assert.equal(source.includes("effectivePageSize"), false);
  assert.ok(source.includes("limit: effectiveLimit"));
  assert.ok(source.includes("snapshot?.total"));

  // No-scroll contract: the table body must NOT become an internal scroll region
  // (true 25/50/100 needs the contract relaxation, deferred).
  assert.equal(source.includes("overflow-y-auto"), false);
  assert.equal(source.includes("overflow-y-scroll"), false);

  // Server-side pagination drives results (no client-side slicing).
  assert.equal(source.includes("filteredRows"), false);
  assert.equal(source.includes("PAGE_SIZE_OPTIONS"), false);
  assert.equal(source.includes("<Select"), false);
});

test("PR-3 leaves the global dashboard main no-scroll contract intact", () => {
  const source = read(GLOBALS_PATH);
  const mainStart = source.indexOf("  .dashboard-main {");
  const mainEnd = source.indexOf("  }", mainStart);
  const mainBlock = source.slice(mainStart, mainEnd);

  assert.ok(mainStart >= 0, "dashboard-main contract must exist");
  assert.ok(mainBlock.includes("overflow-hidden"));
  assert.equal(mainBlock.includes("overflow-y-auto"), false);
  assert.equal(mainBlock.includes("overflow-y-scroll"), false);
});

test("admin clinics console keeps a dense table header and rows", () => {
  const source = read(CLINICS_CARD_PATH);

  assert.ok(source.includes("[&_th]:h-9"));
  assert.ok(source.includes("text-[0.8125rem]"));
  assert.ok(source.includes('className="py-1 text-right"'));
  // Edit action is a compact control, not a 44px+ row driver.
  assert.equal(source.includes("min-h-[2.75rem]"), false);
  assert.equal(source.includes("py-1.5"), false);
});
