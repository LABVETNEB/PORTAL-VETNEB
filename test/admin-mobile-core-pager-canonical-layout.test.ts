import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const CLINICS_CARD_PATH =
  "frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx";
const REPORTS_CARD_PATH = "frontend/src/app/dashboard/admin/AdminReportsCard.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

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
  // Cut at the desktop <nav opening tag itself (not its aria-label), since the
  // tag's own className (with the untouched justify-between) precedes the
  // aria-label attribute and would otherwise leak into this mobile-only scope.
  const pager = extractMobilePager(source, "<nav");

  assert.ok(pager.includes("justify-center"), "reports mobile pager must be centered");
  assert.equal(
    pager.includes("justify-between"),
    false,
    "reports mobile pager must not use justify-between",
  );
  assert.ok(pager.includes("Anterior"), "reports mobile pager must render Anterior text");
  assert.ok(pager.includes("Siguiente"), "reports mobile pager must render Siguiente text");
  assert.ok(
    pager.includes("Pág. {mobilePage + 1}"),
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
  const pager = extractMobilePager(source, "<nav");

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

// Clinics intentionally raised its mobile page size from 3 to 10 (PR2,
// admin-mobile-clinics-density): 10 clinics per mobile page, compacted to a
// borderless name+email row so the list stays viewport-safe/no-scroll. The
// fetch call and desktop PAGE_SIZE are untouched — only the mobile page-size
// constant and row density changed.
test("admin clinics mobile pager: page size intentionally raised to 10, fetch/desktop untouched", () => {
  const clinicsSource = read(CLINICS_CARD_PATH);
  assert.ok(clinicsSource.includes("const PAGE_SIZE = 9;"));
  assert.ok(
    clinicsSource.includes("const MOBILE_PAGE_SIZE = 10;"),
    "clinics mobile page size must be 10 (intentional density change, PR2)",
  );
  assert.ok(clinicsSource.includes("getAdminClinics("));
});

// Reports intentionally raised its mobile page size from 3 to 10 (PR5,
 // admin-mobile-reports-density): 10 reports per mobile page, compacted and
 // anchored to the bottom pager while desktop PAGE_SIZE and fetch semantics
 // stay untouched.
test("admin reports mobile pager: page size intentionally raised to 10, fetch/desktop untouched", () => {
  const reportsSource = read(REPORTS_CARD_PATH);
  assert.ok(reportsSource.includes("const PAGE_SIZE = 9;"));
  assert.ok(
    reportsSource.includes("const MOBILE_PAGE_SIZE = 10;"),
    "reports mobile page size must be 10 (intentional density change, PR5)",
  );
  assert.ok(reportsSource.includes("getAdminReportWorkflow({"));
});
