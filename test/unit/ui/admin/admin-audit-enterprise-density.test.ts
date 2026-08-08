import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const ADMIN_PAGE = "frontend/src/app/dashboard/admin/page.tsx";
const AUDIT_SHARED = "frontend/src/app/dashboard/admin/admin-audit-shared.ts";
const AUDIT_ACTIONS = "frontend/src/app/dashboard/admin/admin-audit.actions.ts";
const AUDIT_CARD = "frontend/src/app/dashboard/admin/AdminAuditCard.tsx";
const AUDIT_MOBILE = "frontend/src/app/dashboard/admin/AdminMobileAuditModule.tsx";
const AUDIT_TABLE = "frontend/src/app/dashboard/admin/AdminAuditDenseTable.tsx";
const AUDIT_FILTER = "frontend/src/app/dashboard/admin/AdminAuditFilterBar.tsx";
const AUDIT_DETAIL = "frontend/src/app/dashboard/admin/AdminAuditDetailDialog.tsx";
const GLOBALS_CSS = "frontend/src/app/globals.css";

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8").replace(/\r\n/g, "\n");
}

test("R-06 preserves the real audit-log navigation surface", () => {
  const page = read(ADMIN_PAGE);
  const card = read(AUDIT_CARD);

  assert.ok(page.includes('"audit-log": auditLogWorkspaceSlot'));
  assert.ok(page.includes("<AdminAuditCard"));
  assert.ok(card.includes('id="audit-log"'));
  assert.ok(card.includes('id="admin-event-summary"'));
  assert.ok(card.includes('id="audit-role-changes"'));
  assert.ok(card.includes('id="admin-notifications"'));
  assert.ok(card.includes("dashboard-surface"));
});

test("R-06 uses RF debounced viewport-adaptive pagination and existing filters", () => {
  const card = read(AUDIT_CARD);
  const filter = read(AUDIT_FILTER);

  assert.ok(card.includes('"use client"'));
  assert.ok(card.includes("export const ADMIN_AUDIT_FALLBACK_ROWS = 9;"));
  assert.ok(card.includes("export const ADMIN_AUDIT_LIMIT_CAP = 32;"));
  assert.ok(card.includes("useAdaptiveItemsPerPage"));
  assert.ok(card.includes("effectiveLimit = rowsPerPage"));
  // The nine-row desktop page of the App Shell contract is a CEILING derived
  // from the measured region, never a floor: a floor kept nine rows at
  // 1280x720, where they spill over the pager and steal its hit-test.
  assert.ok(card.includes("minItems: 1,"));
  assert.ok(card.includes("maxItems: isDesktopMeasurement"));
  assert.ok(card.includes("? ADMIN_AUDIT_FALLBACK_ROWS"));
  assert.ok(card.includes(": ADMIN_AUDIT_LIMIT_CAP,"));
  assert.ok(card.includes("getAdminAuditPage(query)"));
  assert.ok(card.includes("latestRequestRef"));
  assert.ok(card.includes("previousLimitRef"));
  assert.equal(card.includes("window.matchMedia"), false);
  assert.equal(card.includes("MOBILE_PAGE_SIZE"), false);
  assert.equal(card.includes("PublicRouteControl"), false);
  assert.equal(card.includes("buildAuditPageHref"), false);
  for (const name of ["event", "actorType", "from", "to", "clinicId", "reportId"]) {
    assert.ok(filter.includes(`name="${name}"`), `missing ${name} filter`);
  }
  assert.equal(card.includes("PAGE_SIZE_OPTIONS"), false);
});

test("R-06 collapses AdminMobileAuditModule into a single shared-data pipeline", () => {
  const mobile = read(AUDIT_MOBILE);
  const card = read(AUDIT_CARD);

  assert.equal(mobile.includes("getAdminMobileAuditPage"), false);
  assert.equal(mobile.includes("useState<AdminMobileAuditPage>"), false);
  assert.equal(mobile.includes("useTransition"), false);
  assert.ok(mobile.includes("rows: AdminAuditRow[]"));
  assert.ok(mobile.includes("onPrevious"));
  assert.ok(mobile.includes("onNext"));
  assert.ok(card.includes("<AdminMobileAuditModule"));
  assert.ok(card.includes("bodyRef={setMobileBodyNode}"));
  // The desktop container measured for `effectiveLimit` is the flex-allocated
  // rows region owned by the card, not the content-sized table wrapper.
  assert.ok(
    card.includes('<div ref={setDesktopBodyNode} className="min-h-0 flex-1 py-2">'),
  );
  assert.ok(card.includes("desktopRowRef={setDesktopRowNode}"));
});

test("R-06 audit surfaces keep enterprise density tokens", () => {
  const sources = [AUDIT_CARD, AUDIT_TABLE, AUDIT_FILTER, AUDIT_DETAIL].map(read);
  const combined = sources.join("\n");

  for (const forbidden of [
    "text-2xl",
    "text-3xl",
    "p-6",
    "p-8",
    "gap-6",
    "gap-8",
    "h-14",
    "h-16",
  ]) {
    assert.equal(combined.includes(forbidden), false, `audit surfaces include ${forbidden}`);
  }

  assert.ok(combined.includes("text-[13px]"));
  assert.ok(combined.includes("text-xs"));
  assert.ok(combined.includes("h-8"));
  assert.ok(combined.includes("h-7"));
  assert.ok(combined.includes("[&_td]:h-9"));
  assert.ok(combined.includes("[&_th]:h-8"));
});

test("R-06 uses controlled detail without raw sensitive audit fields", () => {
  const auditShared = read(AUDIT_SHARED);
  const actions = read(AUDIT_ACTIONS);
  const detail = read(AUDIT_DETAIL);
  const table = read(AUDIT_TABLE);
  const rowStart = actions.indexOf("function buildAuditRow(");
  const rowEnd = actions.indexOf("\n}", rowStart);
  const rowProjection = actions.slice(rowStart, rowEnd);

  assert.ok(table.includes("<AdminAuditDetailDialog row={row} />"));
  assert.ok(detail.includes("<ModuleDialog"));
  assert.ok(detail.includes("Detalle seguro"));
  assert.ok(detail.includes("La vista omite datos de red, sesión, credenciales"));
  assert.equal(detail.includes("dangerouslySetInnerHTML"), false);
  assert.equal(rowProjection.includes("ipAddress"), false);
  assert.equal(rowProjection.includes("userAgent"), false);
  assert.equal(rowProjection.includes("requestId"), false);
  assert.equal(rowProjection.includes("metadata:"), false);
  assert.ok(actions.includes('"use server"'));
  assert.ok(auditShared.includes('return "Dato estructurado omitido";'));
  assert.ok(auditShared.includes('"password"'));
  assert.ok(auditShared.includes('"token"'));
  assert.ok(auditShared.includes('"hash"'));
  assert.ok(auditShared.includes('"email"'));
  assert.ok(auditShared.includes('"session"'));
});

test("R-06 does not introduce logging, public fetches, or regional scroll", () => {
  const sources = [AUDIT_CARD, AUDIT_MOBILE, AUDIT_TABLE, AUDIT_FILTER, AUDIT_DETAIL];
  const combined = sources.map(read).join("\n");
  const css = read(GLOBALS_CSS);
  const mainStart = css.indexOf("  .dashboard-main {");
  const mainEnd = css.indexOf("  }", mainStart);
  const mainRule = css.slice(mainStart, mainEnd);

  assert.equal(combined.includes("console.log"), false);
  assert.equal(combined.includes("console.info"), false);
  assert.equal(combined.includes("fetch("), false);
  assert.equal(combined.includes("/api/public"), false);
  assert.equal(combined.includes("overflow-y-auto"), false);
  assert.equal(combined.includes("overflow-y-scroll"), false);
  assert.equal(combined.includes("data-dashboard-scroll-region"), false);
  assert.ok(mainRule.includes("overflow-hidden"));
});
