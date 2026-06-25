import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const HORIZONTAL_NAV_PATH =
  "frontend/src/components/dashboard/DashboardHorizontalNav.tsx";
const TOPBAR_PATH = "frontend/src/components/dashboard/DashboardTopbar.tsx";
const SHELL_ROUTER_PATH =
  "frontend/src/components/dashboard/DashboardShellRouter.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("horizontal nav is an accessible navigation landmark", () => {
  const source = read(HORIZONTAL_NAV_PATH);

  assert.ok(source.includes('"use client";'));
  assert.ok(source.includes('role="navigation"'));
  assert.ok(source.includes('aria-label="Navegación principal"'));
  assert.ok(source.includes('aria-current={active ? "page" : undefined}'));
  assert.ok(source.includes("aria-label={item.label}"));
});

test("horizontal nav navigates via PublicRouteControl (no next/link or anchors)", () => {
  const source = read(HORIZONTAL_NAV_PATH);

  assert.ok(
    source.includes(
      'import { PublicRouteControl } from "@/components/public/PublicRouteControl";',
    ),
  );
  assert.equal(/from "next\/link"/.test(source), false);
  assert.equal(/<a\s/.test(source), false);
});

test("admin horizontal nav exposes the expected modules and preserves ?module=", () => {
  const source = read(HORIZONTAL_NAV_PATH);

  const adminModules: Array<{ label: string; moduleId: string }> = [
    { label: "Resumen", moduleId: "admin" },
    { label: "Clínicas", moduleId: "admin-clinics" },
    { label: "Informes", moduleId: "admin-report-upload" },
    { label: "Tokens", moduleId: "admin-particular-tokens" },
    { label: "Auditoría", moduleId: "audit-log" },
    { label: "Usuarios", moduleId: "admin-users-roles" },
    { label: "Sesiones", moduleId: "admin-sessions" },
    // PR-GD1: critical system/configuration modules must be reachable from the
    // canonical horizontal nav (no longer hidden behind the hub).
    { label: "Estado", moduleId: "admin-health" },
    { label: "Precios", moduleId: "admin-pricing" },
    { label: "Mantenimiento", moduleId: "admin-maintenance" },
  ];

  for (const { label, moduleId } of adminModules) {
    assert.ok(
      source.includes(`label: "${label}"`),
      `admin nav must include ${label}`,
    );
    assert.ok(
      source.includes(`\`\${ROUTES.dashboardAdmin}?module=${moduleId}\``),
      `admin nav must navigate to ${moduleId} via ?module=`,
    );
  }
});

test("clinic horizontal nav resolves all 5 modules via ?module= (PR-CL4)", () => {
  const source = read(HORIZONTAL_NAV_PATH);

  assert.ok(source.includes('label: "Resumen"'));
  assert.ok(source.includes('label: "Informes"'));
  assert.ok(source.includes('label: "Tokens"'));
  assert.ok(source.includes('label: "Logística"'));
  assert.ok(source.includes('label: "Perfil"'));

  assert.ok(source.includes('`${ROUTES.dashboard}?module=operaciones`'));
  assert.ok(source.includes('`${ROUTES.dashboard}?module=informes`'));
  assert.ok(source.includes('`${ROUTES.dashboard}?module=logistica`'));
  assert.ok(source.includes('`${ROUTES.dashboard}?module=tokens`'));
  assert.ok(source.includes('`${ROUTES.dashboard}?module=perfil`'));
});

test("clinic horizontal nav notifies the controller before route navigation", () => {
  const source = read(HORIZONTAL_NAV_PATH);

  assert.ok(source.includes('import { requestClinicModuleActivate } from "@/lib/clinic-hub-reset";'));
  assert.ok(source.includes("const itemModule = getModuleFromHref(item.href);"));
  assert.ok(source.includes('if (surface !== "clinic" || !itemModule) return;'));
  assert.ok(source.includes("requestClinicModuleActivate(itemModule);"));
});

test("horizontal nav resolves admin/clinic surface from the route", () => {
  const source = read(HORIZONTAL_NAV_PATH);

  assert.ok(
    source.includes("function resolveSurface(pathname: string): DashboardNavSurface"),
  );
  assert.ok(source.includes("pathname.startsWith(ROUTES.dashboardAdmin)"));
  assert.ok(source.includes("const activeModule = searchParams.get(\"module\");"));
});

test("horizontal nav is scrollable on narrow viewports without a vertical rail", () => {
  const source = read(HORIZONTAL_NAV_PATH);

  assert.ok(source.includes("overflow-x-auto"));
  assert.equal(source.includes("w-[4.5rem]"), false);
  assert.equal(source.includes("2xl:w-60"), false);
  assert.equal(source.includes("h-dvh"), false);
});

test("topbar embeds the horizontal nav and drops the decorative eyebrow", () => {
  const source = read(TOPBAR_PATH);

  assert.ok(
    source.includes(
      'import { DashboardHorizontalNav } from "./DashboardHorizontalNav";',
    ),
  );
  assert.ok(source.includes("<DashboardHorizontalNav />"));
  assert.ok(source.includes("flex shrink-0 flex-col"));
  assert.equal(source.includes("Portal operativo"), false);
  assert.equal(source.includes("Sesión clínica segura"), false);
});

test("shell router no longer renders a vertical sidebar as primary navigation", () => {
  const source = read(SHELL_ROUTER_PATH);

  assert.ok(source.includes('import { AdminMobileBottomNav } from "./AdminMobileBottomNav";'));
  assert.ok(source.includes('import { ClinicMobileBottomNav } from "./ClinicMobileBottomNav";'));
  assert.equal(source.includes("AdminDashboardSidebar"), false);
  assert.equal(source.includes("ClinicDashboardSidebar"), false);
  assert.equal(source.includes("<aside"), false);
  assert.ok(source.includes("flex flex-col h-dvh overflow-hidden"));
  assert.ok(source.includes("data-vetneb-app-shell-surface={surface}"));
  assert.ok(source.includes("isAdminDashboard ? ("));
  assert.ok(source.includes("<AdminMobileBottomNav />"));
  assert.ok(source.includes("<ClinicMobileBottomNav />"));
});
