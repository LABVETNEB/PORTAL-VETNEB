import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { readSourceFile as read } from "../../../helpers/tracked-source-files.ts";
import {
  descendants,
  effectiveAttribute,
  parseTsx,
  staticAttribute,
  type JsxNode,
} from "../dashboard/dashboard-source-oracle.ts";

const CLINICS_CARD_PATH =
  "frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx";
const REPORTS_CARD_PATH = "frontend/src/app/dashboard/admin/AdminReportsCard.tsx";
const TOKENS_CARD_PATH =
  "frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx";

// The mobile pager is a plain <div data-admin-mobile-core-pager="true"> (same
// shape as the Tokens reference). Scoping to just that element's opening tag
// through endMarker keeps these assertions blind to the untouched desktop
// pager, which intentionally keeps its chevrons/justify-between.
function extractMobilePager(source: string, endMarker: string): string {
  const dataMarker = 'data-admin-mobile-core-pager="true"';
  const dataIdx = source.indexOf(dataMarker);
  assert.ok(dataIdx !== -1, `expected to find ${dataMarker}`);
  const startIdx = source.lastIndexOf("<div", dataIdx);
  assert.ok(startIdx !== -1, "expected an opening <div before the pager marker");
  const endIdx = source.indexOf(endMarker, dataIdx);
  assert.ok(endIdx !== -1, `expected to find ${endMarker} after ${dataMarker}`);
  return source.slice(startIdx, endIdx);
}

test("admin clinics mobile pager matches the canonical Tokens pager layout", () => {
  const source = read(CLINICS_CARD_PATH);
  const pager = extractMobilePager(source, "<ClinicEditDrawer");

  assert.ok(pager.includes("justify-center"), "clinics mobile pager must be centered");
  assert.equal(
    pager.includes("justify-between"),
    false,
    "clinics mobile pager must not use justify-between",
  );
  assert.ok(pager.includes("Anterior"), "clinics mobile pager must render Anterior text");
  assert.ok(pager.includes("Siguiente"), "clinics mobile pager must render Siguiente text");
  assert.ok(
    pager.includes("Pág. {page} / {pageCount}"),
    "clinics mobile pager must render Pág. X / Y using the real total",
  );
  assert.equal(
    pager.includes("ChevronLeft"),
    false,
    "clinics mobile pager must not use chevron icons",
  );
  assert.equal(
    pager.includes("ChevronRight"),
    false,
    "clinics mobile pager must not use chevron icons",
  );
  assert.equal(
    pager.includes("pageStart"),
    false,
    "clinics mobile pager must not render the lateral X–Y de Z range",
  );
});

test("admin clinics mobile pager uses >=36px text touch targets", () => {
  const source = read(CLINICS_CARD_PATH);
  const pager = extractMobilePager(source, "<ClinicEditDrawer");

  assert.ok(pager.includes("h-9"), "clinics mobile pager buttons must be h-9 (36px)");
  assert.equal(
    pager.includes("w-9 p-0"),
    false,
    "clinics mobile pager buttons must not be icon-only squares",
  );
});

test("admin reports mobile pager matches the canonical Tokens pager layout", () => {
  const source = read(REPORTS_CARD_PATH);
  // C17 uses CollectionPager for desktop; keep this source guard scoped to the
  // mobile footer, which still owns the touch-sized controls.
  const pager = extractMobilePager(source, "<CollectionPager");

  assert.ok(pager.includes("justify-center"), "reports mobile pager must be centered");
  assert.equal(
    pager.includes("justify-between"),
    false,
    "reports mobile pager must not use justify-between",
  );
  assert.ok(pager.includes("Anterior"), "reports mobile pager must render Anterior text");
  assert.ok(pager.includes("Siguiente"), "reports mobile pager must render Siguiente text");
  assert.ok(
    pager.includes("Pág. {page}"),
    "reports mobile pager must render Pág. X (no fabricated total; the report-workflow API has no count)",
  );
  assert.equal(
    pager.includes("ChevronLeft"),
    false,
    "reports mobile pager must not use chevron icons",
  );
  assert.equal(
    pager.includes("ChevronRight"),
    false,
    "reports mobile pager must not use chevron icons",
  );
  assert.equal(
    pager.includes("mobileRangeStart"),
    false,
    "reports mobile pager must not render the lateral X–Y range",
  );
});

test("admin reports mobile pager uses >=36px text touch targets", () => {
  const source = read(REPORTS_CARD_PATH);
  const pager = extractMobilePager(source, "<CollectionPager");

  assert.ok(pager.includes("h-9"), "reports mobile pager buttons must be h-9 (36px)");
  assert.equal(
    pager.includes("w-9 p-0"),
    false,
    "reports mobile pager buttons must not be icon-only squares",
  );
});

test("admin reports card drops the now-unused mobile range helpers", () => {
  const source = read(REPORTS_CARD_PATH);

  assert.equal(
    source.includes("mobileRangeStart"),
    false,
    "mobileRangeStart must be removed once the lateral range text is gone",
  );
  assert.equal(
    source.includes("mobileRangeEnd"),
    false,
    "mobileRangeEnd must be removed once the lateral range text is gone",
  );
});

test("admin core pagers preserve accessible labels, data hooks and the no-scroll contract", () => {
  for (const path of [CLINICS_CARD_PATH, REPORTS_CARD_PATH]) {
    const source = read(path);
    assert.ok(
      source.includes('data-admin-mobile-core-pager="true"'),
      `${path} must keep the core pager landmark`,
    );
    assert.ok(
      source.includes('aria-label="Página anterior"'),
      `${path} must keep the accessible previous-page label`,
    );
    assert.ok(
      source.includes('aria-label="Página siguiente"'),
      `${path} must keep the accessible next-page label`,
    );
    assert.equal(source.includes("overflow-auto"), false, `${path} must not add overflow-auto`);
    assert.equal(source.includes("overflow-scroll"), false, `${path} must not add overflow-scroll`);
  }
});

// R-02 (admin-clinics-management-server-adaptive-pagination): the mobile page
// size is no longer a fixed constant — it is derived from the measured list
// container (HY cap 36), same runtime that feeds the desktop table. The fetch
// call is untouched; only the cardinality source changed from matchMedia to
// measurement.
test("admin clinics mobile pager: page size is measured (HY cap 36), fetch untouched", () => {
  const clinicsSource = read(CLINICS_CARD_PATH);
  assert.ok(clinicsSource.includes("const CLINICS_FALLBACK_ROWS = 9;"));
  assert.ok(clinicsSource.includes("const CLINICS_SUPERSET_CAP = 36;"));
  assert.equal(clinicsSource.includes("const MOBILE_PAGE_SIZE"), false);
  assert.ok(clinicsSource.includes("getAdminClinics("));
});

// R-03 (admin-reports-workflow-server-adaptive-pagination): the mobile page
// size is no longer a fixed constant — it is derived from the measured list
// container (HY cap 36), the same collapsed runtime that feeds the desktop
// table. The old MOBILE_PAGE_SIZE=10 second fetch pipeline (gated by
// matchMedia) is gone; the fetch stays limit/offset only.
test("admin reports mobile page size is measured (HY cap 36), single fetch pipeline", () => {
  const reportsSource = read(REPORTS_CARD_PATH);
  assert.ok(reportsSource.includes("const REPORTS_FALLBACK_ROWS = 9;"));
  assert.ok(reportsSource.includes("const REPORTS_SUPERSET_CAP = 36;"));
  assert.equal(reportsSource.includes("const PAGE_SIZE = 9;"), false);
  assert.equal(reportsSource.includes("const MOBILE_PAGE_SIZE"), false);
  assert.equal(reportsSource.includes("window.matchMedia"), false);
  assert.equal(reportsSource.includes("loadMobileReports"), false);
  assert.ok(reportsSource.includes("useDashboardCanvasCapacity"));
  assert.ok(reportsSource.includes("getAdminReportWorkflow({"));
});

// RM-10 (P2-05) — S2 Tokens, S3 Informes and S4 Clínicas announce page changes
// through one polite live region per pager regime (<768 / >=768).

type Regime = "phone" | "desktop";

function announcementOf(source: string, path: string, name: string) {
  const file = parseTsx(source, path);
  const [declaration] = descendants(file, ts.isVariableDeclaration).filter(
    (node) => ts.isIdentifier(node.name) && node.name.text === name,
  );
  assert.ok(declaration?.initializer, `${path} declares ${name}`);
  const expression = declaration.initializer.getText();
  return (bindings: Record<string, unknown>) =>
    vm.runInNewContext(`(${expression})`, { ...bindings }) as string;
}

function regimeOf(node: ts.Node): Regime | undefined {
  for (let current = node.parent; current; current = current.parent) {
    if (!ts.isJsxElement(current)) continue;
    const classes = (staticAttribute(current, "className") ?? "").split(/\s+/);
    if (classes.includes("md:hidden")) return "phone";
    if (classes.includes("hidden") && classes.includes("md:flex")) return "desktop";
  }
  return undefined;
}

function isRegimeHidden(element: JsxNode, regime: Regime): boolean {
  const classes = (staticAttribute(element, "className") ?? "").split(/\s+/);
  return regime === "desktop" && classes.includes("hidden") && classes.includes("md:flex");
}

// Every announcement the owner mounts, with the regime that exposes it and the
// identifier it renders. CollectionPager mounts its own live region from
// `rangeLabel` (covered by dashboard-stable-geometry-reservation).
function liveRegions(source: string, path: string) {
  const file = parseTsx(source, path);
  const spans = descendants(file, ts.isJsxElement)
    .filter((element) => staticAttribute(element, "aria-live") !== undefined)
    .map((element) => {
      const children = element.children.filter(
        (child) => !(ts.isJsxText(child) && child.text.trim() === ""),
      );
      assert.equal(staticAttribute(element, "aria-live"), "polite", `${path}: polite only`);
      assert.equal(staticAttribute(element, "className"), "sr-only", `${path}: announced, not painted`);
      const [child, ...extra] = children;
      assert.deepEqual(extra, [], `${path}: a single child`);
      assert.ok(ts.isJsxExpression(child) && child.expression && ts.isIdentifier(child.expression));
      return { regime: regimeOf(element), read: child.expression };
    });
  const pagers = descendants(file, ts.isJsxSelfClosingElement)
    .filter((element) => element.tagName.getText() === "CollectionPager")
    .flatMap((element) => {
      const label = effectiveAttribute(element, "rangeLabel");
      if (label.kind !== "value") return [];
      assert.ok(ts.isIdentifier(label.expression), `${path}: rangeLabel is the shared announcement`);
      assert.ok(isRegimeHidden(element, "desktop"), `${path}: the CollectionPager is the >=768 pager`);
      return [{ regime: "desktop" as Regime, read: label.expression }];
    });
  return { file, regions: [...spans, ...pagers] };
}

function assertOwnerAnnounces(path: string, name: string): void {
  const { file, regions } = liveRegions(read(path), path);
  assert.deepEqual(
    regions.map((region) => region.regime).sort(),
    ["desktop", "phone"],
    `${path}: one region per regime, never two exposed at once`,
  );
  assert.ok(regions.every((region) => region.read.text === name), `${path}: both regimes announce ${name}`);

  // Declared once; every other read is one of the live regions, so the text is
  // never painted.
  const uses = descendants(file, ts.isIdentifier).filter((node) => node.text === name);
  const [declaration, ...declarations] = uses.filter(
    (node) => ts.isVariableDeclaration(node.parent) && node.parent.name === node,
  );
  assert.ok(declaration, `${path}: declares ${name}`);
  assert.deepEqual(declarations, [], `${path}: ${name} is declared once`);
  const reads = new Set<ts.Node>(regions.map((region) => region.read));
  assert.deepEqual(
    uses.filter((node) => node !== declaration && !reads.has(node)).map((node) => node.getText()),
    [],
    `${path}: ${name} is only read by the live regions`,
  );
}

test("RM-10 · exactly one polite announcement per pager regime in S2, S3 and S4", () => {
  assertOwnerAnnounces(TOKENS_CARD_PATH, "tokensPageAnnouncement");
  assertOwnerAnnounces(REPORTS_CARD_PATH, "reportsPageAnnouncement");
  assertOwnerAnnounces(CLINICS_CARD_PATH, "clinicsRangeAnnouncement");
});

test("RM-10 · S2 and S3 announce «Página N» without inferring a total", () => {
  const tokens = announcementOf(read(TOKENS_CARD_PATH), TOKENS_CARD_PATH, "tokensPageAnnouncement");
  const reports = announcementOf(read(REPORTS_CARD_PATH), REPORTS_CARD_PATH, "reportsPageAnnouncement");

  assert.equal(tokens({ pagedTokens: { page: 0 } }), "Página 1");
  assert.equal(tokens({ pagedTokens: { page: 1 } }), "Página 2");
  assert.equal(reports({ page: 1 }), "Página 1");
  assert.equal(reports({ page: 2 }), "Página 2");
  // Same page, same text: a re-render or «Cargar más» is not re-announced.
  assert.equal(tokens({ pagedTokens: { page: 1 } }), tokens({ pagedTokens: { page: 1 } }));
  assert.throws(() => tokens({}), /pagedTokens is not defined/, "the page is the only input");
  assert.throws(() => reports({}), /page is not defined/, "the page is the only input");
});

test("RM-10 · S4 announces «Mostrando A–B de N clínicas» from the loaded snapshot", () => {
  const clinics = announcementOf(read(CLINICS_CARD_PATH), CLINICS_CARD_PATH, "clinicsRangeAnnouncement");
  const page = (offset: number, rows: number, total: number) => ({
    snapshot: { offset, total, clinics: Array.from({ length: rows }, (_, id) => ({ id })) },
  });

  assert.equal(clinics(page(0, 13, 60)), "Mostrando 1–13 de 60 clínicas");
  assert.equal(clinics(page(13, 13, 60)), "Mostrando 14–26 de 60 clínicas");
  assert.equal(clinics(page(52, 8, 60)), "Mostrando 53–60 de 60 clínicas");
  // The requested offset moves before its rows arrive; only the snapshot counts.
  assert.equal(clinics({ ...page(0, 13, 60), offset: 13 }), "Mostrando 1–13 de 60 clínicas");
  // Nothing loaded or nothing to show: no fabricated range.
  assert.equal(clinics({ snapshot: null }), "");
  assert.equal(clinics(page(0, 0, 0)), "");
});

test("RM-10 · announcements leave limit, offset, navigation and fetches untouched", () => {
  const clinics = read(CLINICS_CARD_PATH);
  const reports = read(REPORTS_CARD_PATH);
  const tokens = read(TOKENS_CARD_PATH);

  for (const frozen of ["setOffset(Math.max(offset - effectiveLimit, 0));", "setOffset(offset + effectiveLimit);"]) {
    assert.ok(clinics.includes(frozen), `clinics navigation frozen: ${frozen}`);
  }
  for (const [source, call] of [[clinics, "getAdminClinics("], [reports, "getAdminReportWorkflow({"]]) {
    assert.ok(source.includes(call) && source.indexOf(call) === source.lastIndexOf(call), `single fetch site: ${call}`);
  }
  assert.ok(reports.includes("stateControl={<span />}"), "reports desktop pager still paints no page state");
  for (const frozen of ["pagedTokens.goPrev();", "pagedTokens.goNext();", "onClick={() => void loadMoreTokens()}"]) {
    assert.ok(tokens.includes(frozen), `tokens navigation frozen: ${frozen}`);
  }
});
