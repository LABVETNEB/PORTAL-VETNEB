import assert from "node:assert/strict";
import test from "node:test";
import { readSourceFile as read } from "../../../helpers/tracked-source-files.ts";
import { parseTsx } from "../dashboard/dashboard-source-oracle.ts";
import { callsUnderConfirm, functionNamed, runSource } from "./source-function-runner.ts";

const CARD_PATH =
  "frontend/src/app/dashboard/admin/AdminUsersRolesReadOnlyCard.tsx";
const PAGE_PATH = "frontend/src/app/dashboard/admin/page.tsx";
const CONTROLLER_PATH =
  "frontend/src/app/dashboard/admin/AdminDashboardWorkspaceController.tsx";
// B08 retired DashboardHorizontalNav. Reachability of an admin module is now
// a property of the canonical catalog the lateral navigation derives from,
// rather than of one component's private item list — a strictly stronger
// anchor: it also fails if the module loses its glyph.
const MODULE_CATALOG_PATH = "frontend/src/features/dashboard/config/dashboardModules.ts";
const MODULE_ICONS_PATH = "frontend/src/components/dashboard/dashboardModuleIcons.ts";
const API_PATH = "frontend/src/lib/api.ts";
const GLOBALS_PATH = "frontend/src/app/globals.css";

const ROLE_CHANGE_EFFECTS = [
  "changeAdminClinicUserRole",
  "setError",
  "setRoleChangeMessage",
  "setChangedUserKey",
  "setChangingUserKey",
  "setSnapshot",
] as const;

// Names of every request and state write handleChangeClinicRole performs when
// the confirmation dialog answers `confirmed`.
async function roleChangeEffects(card: string, confirmed: boolean): Promise<unknown[]> {
  const file = parseTsx(card, CARD_PATH);
  const helper = (name: string) => runSource(functionNamed(file, name), {});
  const calls = await callsUnderConfirm(
    functionNamed(file, "handleChangeClinicRole"),
    confirmed,
    ROLE_CHANGE_EFFECTS,
    {
      disableUserActions: false,
      getNextClinicRole: helper("getNextClinicRole"),
      getUserKey: helper("getUserKey"),
      formatRole: String,
      formatRoleChangeError: String,
      changeAdminClinicUserRole: async (userId: number, role: string) => ({
        user: { userType: "clinic", userId, username: "ana", role },
      }),
    },
    [{ userType: "clinic", userId: 3, username: "ana", role: "clinic_owner" }],
  );

  return calls.map(([name]) => name);
}

test("PR-7A preserves the real admin-users-roles navigation surface", () => {
  const page = read(PAGE_PATH);
  const controller = read(CONTROLLER_PATH);
  const catalog = read(MODULE_CATALOG_PATH);

  assert.ok(page.includes('id="admin-users-roles"'));
  assert.ok(page.includes('"admin-users-roles": usersRolesWorkspaceSlot'));
  assert.ok(page.includes("<AdminUsersRolesReadOnlyCard />"));
  assert.ok(controller.includes('"admin-users-roles": {'));
  assert.ok(controller.includes('title: "Usuarios y roles"'));
  assert.ok(catalog.includes('moduleId: "admin-users-roles"') &&
      read(MODULE_ICONS_PATH).includes('"admin-users-roles":'));
});

test("PR-7A uses viewport-safe adaptive server pagination with a nine-row fallback", () => {
  const card = read(CARD_PATH);
  const api = read(API_PATH);

  assert.ok(card.includes("const USERS_ROLES_FALLBACK_ROWS = 9;"));
  assert.ok(card.includes("const USERS_ROLES_SUPERSET_CAP = 36;"));
  assert.ok(card.includes("limit: effectiveLimit"));
  assert.equal(card.includes("limit: PAGE_SIZE"), false);
  assert.ok(card.includes("useDashboardCanvasCapacity"));
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

  assert.equal(card.includes("Total filtrado"), false, "the desktop metric run is retired");
  for (const marker of [
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

test("PR-7A keeps role changes constrained, confirmed and auditable", async () => {
  const card = read(CARD_PATH);
  const api = read(API_PATH);

  assert.ok(card.includes("window.confirm("));
  assert.ok(card.includes("El cambio quedará registrado en auditoría."));
  assert.ok(card.includes("changeAdminClinicUserRole(user.userId, nextRole)"));
  assert.ok(card.includes('user.userType === "clinic"'));
  assert.ok(card.includes("No se puede degradar el último Owner clínica."));
  assert.ok(api.includes('method: "PATCH"'));
  assert.ok(api.includes("body: JSON.stringify({ role })"));

  const confirmedOnly = {
    declined: [],
    confirmed: [
      "setError",
      "setRoleChangeMessage",
      "setChangedUserKey",
      "setChangingUserKey",
      "changeAdminClinicUserRole",
      "setSnapshot",
      "setChangedUserKey",
      "setRoleChangeMessage",
      "setChangingUserKey",
    ],
  };
  const observe = async (candidate: string) => ({
    declined: await roleChangeEffects(candidate, false),
    confirmed: await roleChangeEffects(candidate, true),
  });
  assert.deepEqual(await observe(card), confirmedOnly);

  const source = card;
  const ungated = source.replace("if (!confirmed) {", () => "if (false)\nif (!confirmed) {");
  assert.notEqual(ungated, source);
  assert.notDeepEqual(await observe(ungated), confirmedOnly);
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
