import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const ADMIN_PAGE = "frontend/src/app/dashboard/admin/page.tsx";
const AUDIT_CARD = "frontend/src/app/dashboard/admin/AdminAuditCard.tsx";
const AUDIT_TABLE = "frontend/src/app/dashboard/admin/AdminAuditDenseTable.tsx";
const AUDIT_FILTER = "frontend/src/app/dashboard/admin/AdminAuditFilterBar.tsx";
const AUDIT_DETAIL = "frontend/src/app/dashboard/admin/AdminAuditDetailDialog.tsx";
const API_CLIENT = "frontend/src/lib/api.ts";
const GLOBALS_CSS = "frontend/src/app/globals.css";

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8").replace(/\r\n/g, "\n");
}

test("PR-6 preserves the real audit-log navigation surface", () => {
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

test("PR-6 uses viewport-safe server pagination and existing filters", () => {
  const page = read(ADMIN_PAGE);
  const card = read(AUDIT_CARD);
  const filter = read(AUDIT_FILTER);
  const api = read(API_CLIENT);

  assert.ok(card.includes("export const ADMIN_AUDIT_PAGE_SIZE = 9;"));
  assert.ok(page.includes("limit: ADMIN_AUDIT_PAGE_SIZE"));
  assert.ok(page.includes("offset: (auditPage - 1) * ADMIN_AUDIT_PAGE_SIZE"));
  assert.ok(page.includes("snapshot: await getAuditEntries(query, options, { throwOnError: true })"));
  assert.ok(api.includes("function buildAdminAuditQueryString"));
  assert.ok(api.includes('["clinicId", "reportId", "limit", "offset"]'));
  assert.ok(api.includes('query.set(key, String(value))'));
  for (const name of ["event", "actorType", "from", "to", "clinicId", "reportId"]) {
    assert.ok(filter.includes(`name="${name}"`), `missing ${name} filter`);
  }
  assert.equal(card.includes("PAGE_SIZE_OPTIONS"), false);
});

test("PR-6 audit surfaces keep enterprise density tokens", () => {
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

test("PR-6 uses controlled detail without raw sensitive audit fields", () => {
  const page = read(ADMIN_PAGE);
  const detail = read(AUDIT_DETAIL);
  const table = read(AUDIT_TABLE);
  const rowStart = page.indexOf("const auditRows: AdminAuditRow[]");
  const rowEnd = page.indexOf("const latestAuditEntry", rowStart);
  const rowProjection = page.slice(rowStart, rowEnd);

  assert.ok(table.includes("<AdminAuditDetailDialog row={row} />"));
  assert.ok(detail.includes("<ModuleDialog"));
  assert.ok(detail.includes("Detalle seguro"));
  assert.ok(detail.includes("La vista omite datos de red, sesión, credenciales"));
  assert.equal(detail.includes("dangerouslySetInnerHTML"), false);
  assert.equal(rowProjection.includes("ipAddress"), false);
  assert.equal(rowProjection.includes("userAgent"), false);
  assert.equal(rowProjection.includes("requestId"), false);
  assert.equal(rowProjection.includes("metadata:"), false);
  assert.ok(page.includes('return "Dato estructurado omitido";'));
  assert.ok(page.includes('"password"'));
  assert.ok(page.includes('"token"'));
  assert.ok(page.includes('"hash"'));
  assert.ok(page.includes('"email"'));
  assert.ok(page.includes('"session"'));
});

test("PR-6 does not introduce logging, public fetches, or regional scroll", () => {
  const sources = [AUDIT_CARD, AUDIT_TABLE, AUDIT_FILTER, AUDIT_DETAIL];
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
