import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const CARD_PATH =
  "frontend/src/app/dashboard/admin/AdminSessionsReadOnlyCard.tsx";
const PAGE_PATH = "frontend/src/app/dashboard/admin/page.tsx";
const CONTROLLER_PATH =
  "frontend/src/app/dashboard/admin/AdminDashboardWorkspaceController.tsx";
const NAV_PATH = "frontend/src/components/dashboard/DashboardHorizontalNav.tsx";
const API_PATH = "frontend/src/lib/api.ts";
const GLOBALS_PATH = "frontend/src/app/globals.css";

function read(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("PR-7B preserves the real admin-sessions navigation surface", () => {
  const page = read(PAGE_PATH);
  const controller = read(CONTROLLER_PATH);
  const nav = read(NAV_PATH);

  assert.ok(page.includes('id="admin-sessions"'));
  assert.ok(page.includes('"admin-sessions": sessionsWorkspaceSlot'));
  assert.ok(page.includes("<AdminSessionsReadOnlyCard />"));
  assert.ok(controller.includes('"admin-sessions": {'));
  assert.ok(controller.includes('title: "Sesiones"'));
  assert.ok(nav.includes("?module=admin-sessions"));
});

test("PR-7B uses viewport-safe server pagination with eight rows", () => {
  const card = read(CARD_PATH);
  const api = read(API_PATH);

  assert.ok(card.includes("const SESSIONS_FALLBACK_ROWS = 8;"));
  assert.ok(card.includes("const SESSIONS_SUPERSET_CAP = 32;"));
  assert.ok(card.includes("limit: effectiveLimit"));
  assert.equal(card.includes("limit: PAGE_SIZE"), false);
  assert.ok(card.includes("useAdaptiveItemsPerPage"));
  assert.ok(card.includes("offset"));
  assert.ok(card.includes("getAdminSessions(query)"));
  assert.ok(card.includes("offset + snapshot.sessions.length < snapshot.total"));
  assert.equal(card.includes("slice("), false);
  assert.equal(card.includes("PAGE_SIZE_OPTIONS"), false);
  assert.ok(api.includes('query.set("limit", String(params.limit))'));
  assert.ok(api.includes('query.set("offset", String(params.offset))'));
});

test("PR-7B renders a compact desktop table and prioritized mobile list", () => {
  const card = read(CARD_PATH);

  for (const marker of [
    "Total filtrado",
    "Activas",
    "Expiradas",
    "Tipo de sesión",
    "Estado",
    'aria-label="Tabla de sesiones administrativas"',
    "[&_td]:h-9",
    "[&_th]:h-8",
    "text-[13px]",
    "md:flex",
    "md:hidden",
    'aria-label="Paginación de sesiones"',
    "h-7 px-2 text-xs",
    "h-5 px-1.5 text-[11px]",
  ]) {
    assert.ok(card.includes(marker), `missing compact marker: ${marker}`);
  }

  assert.equal(card.includes("CardDescription"), false);
});

test("PR-7B keeps revocation constrained, confirmed and blocks current admin session", () => {
  const card = read(CARD_PATH);

  assert.ok(card.includes("window.confirm("));
  assert.ok(card.includes("Esta acción cerrará esa sesión y quedará auditada."));
  assert.ok(card.includes("await revokeAdminSession(session.sessionType, session.sessionId);"));
  assert.ok(card.includes("isCurrentAdminSession"));
  assert.ok(card.includes("snapshot?.currentAdminSessionId"));
  assert.ok(card.includes("disabled={isRevoking || isCurrentAdminSession}"));
  assert.ok(card.includes('"Sesión actual"'));
});

test("PR-7B surfaces load errors explicitly instead of empty success states", () => {
  const card = read(CARD_PATH);

  assert.ok(card.includes('role="alert"'));
  assert.ok(card.includes('"No se pudieron cargar las sesiones."'));
  assert.ok(card.includes("Error al cargar sesiones"));
  assert.ok(card.includes("clinical-alert-error"));
});

test("PR-7B does not expose sensitive fields or expand network surface", () => {
  const card = read(CARD_PATH);

  for (const forbidden of [
    "dangerouslySetInnerHTML",
    "console.log",
    "console.info",
    "sessionToken",
    "tokenHash",
    "passwordHash",
    "cookie",
    "fetch(",
    "/api/public",
    "Promise.all",
  ]) {
    assert.equal(card.includes(forbidden), false, `sensitive marker: ${forbidden}`);
  }
});

test("PR-7B respects density and global no-scroll contracts", () => {
  const card = read(CARD_PATH);

  for (const forbidden of [
    "text-2xl",
    "text-3xl",
    "p-6",
    "p-8",
    "gap-6",
    "gap-8",
    "h-14",
    "h-16",
    "overflow-y-auto",
    "overflow-y-scroll",
    "data-dashboard-scroll-region",
  ]) {
    assert.equal(card.includes(forbidden), false, `forbidden density token: ${forbidden}`);
  }

  assert.ok(card.includes("flex min-h-0 flex-1 flex-col"));

  const globals = read(GLOBALS_PATH);
  assert.match(
    globals,
    /\.dashboard-main\s*\{[\s\S]*?@apply[^;]*overflow-hidden[^;]*;[\s\S]*?\}/,
  );
});
