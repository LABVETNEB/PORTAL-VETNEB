import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const CARD_PATH =
  "frontend/src/app/dashboard/admin/AdminUsersRolesReadOnlyCard.tsx";
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

test("PR-7A preserves the real admin-users-roles navigation surface", () => {
  const page = read(PAGE_PATH);
  const controller = read(CONTROLLER_PATH);
  const nav = read(NAV_PATH);

  assert.ok(page.includes('id="admin-users-roles"'));
  assert.ok(page.includes('"admin-users-roles": usersRolesWorkspaceSlot'));
  assert.ok(page.includes("<AdminUsersRolesReadOnlyCard />"));
  assert.ok(controller.includes('"admin-users-roles": {'));
  assert.ok(controller.includes('title: "Usuarios y roles"'));
  assert.ok(nav.includes("?module=admin-users-roles"));
});

test("PR-7A uses viewport-safe adaptive server pagination with a nine-row fallback", () => {
  const card = read(CARD_PATH);
  const api = read(API_PATH);

  assert.ok(card.includes("const USERS_ROLES_FALLBACK_ROWS = 9;"));
  assert.ok(card.includes("const USERS_ROLES_SUPERSET_CAP = 36;"));
  assert.ok(card.includes("limit: effectiveLimit"));
  assert.equal(card.includes("limit: PAGE_SIZE"), false);
  assert.ok(card.includes("useAdaptiveItemsPerPage"));
  assert.ok(card.includes("offset"));
  assert.ok(card.includes("getAdminUsersRoles(query)"));
  assert.ok(card.includes("offset + snapshot.users.length < snapshot.total"));
  assert.equal(card.includes("slice("), false);
  assert.equal(card.includes("PAGE_SIZE_OPTIONS"), false);
  assert.ok(api.includes('query.set("limit", String(params.limit))'));
  assert.ok(api.includes('query.set("offset", String(params.offset))'));
});

test("PR-7A renders a compact desktop table and prioritized mobile list", () => {
  const card = read(CARD_PATH);

  for (const marker of [
    "Total filtrado",
    "Tipo usuario",
    "Rol",
    'aria-label="Tabla de usuarios y roles administrativos"',
    "[&_td]:h-8",
    "[&_td]:py-0.5",
    "[&_th]:h-8",
    "text-[13px]",
    "md:flex",
    "md:hidden",
    'aria-label="Paginación de usuarios y roles"',
    'ariaLabel="Paginación de usuarios"',
    'data-admin-mobile-ops-module="users"',
    'data-admin-mobile-ops-item="true"',
  ]) {
    assert.ok(card.includes(marker), `missing compact marker: ${marker}`);
  }
});

test("PR-7A keeps role changes constrained, confirmed and auditable", () => {
  const card = read(CARD_PATH);
  const api = read(API_PATH);

  assert.ok(card.includes("window.confirm("));
  assert.ok(card.includes("El cambio quedará registrado en auditoría."));
  assert.ok(card.includes("changeAdminClinicUserRole(user.userId, nextRole)"));
  assert.ok(card.includes('user.userType === "clinic"'));
  assert.ok(card.includes("No se puede degradar el último Owner clínica."));
  assert.ok(api.includes('method: "PATCH"'));
  assert.ok(api.includes("body: JSON.stringify({ role })"));
});

test("PR-7A does not expose sensitive fields or expand network surface", () => {
  const card = read(CARD_PATH);

  for (const forbidden of [
    "dangerouslySetInnerHTML",
    "console.log",
    "console.info",
    "passwordHash",
    "authProId",
    "sessionId",
    "tokenHash",
    "fetch(",
    "/api/public",
    "Promise.all",
  ]) {
    assert.equal(card.includes(forbidden), false, `sensitive marker: ${forbidden}`);
  }
});

test("PR-7A respects density and global no-scroll contracts", () => {
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

  const globals = read(GLOBALS_PATH);
  assert.match(
    globals,
    /\.dashboard-main\s*\{[\s\S]*?@apply[^;]*overflow-hidden[^;]*;[\s\S]*?\}/,
  );
});
