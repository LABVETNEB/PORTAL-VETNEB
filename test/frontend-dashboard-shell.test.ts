import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const DASHBOARD_LAYOUT_PATH = "frontend/src/app/dashboard/layout.tsx";
const PRIVATE_DASHBOARD_SHELL_PATH =
  "frontend/src/components/dashboard/PrivateDashboardShell.tsx";
const DASHBOARD_SHELL_ROUTER_PATH =
  "frontend/src/components/dashboard/DashboardShellRouter.tsx";
const DASHBOARD_SIDEBAR_FRAME_PATH =
  "frontend/src/components/dashboard/DashboardSidebarFrame.tsx";
const CLINIC_DASHBOARD_SIDEBAR_PATH =
  "frontend/src/components/dashboard/ClinicDashboardSidebar.tsx";
const ADMIN_DASHBOARD_SIDEBAR_PATH =
  "frontend/src/components/dashboard/AdminDashboardSidebar.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("dashboard layout delegates private shell composition to private dashboard shell", () => {
  const source = read(DASHBOARD_LAYOUT_PATH);

  assert.ok(source.includes('import { PrivateDashboardShell } from "@/components/dashboard/PrivateDashboardShell";'));
  assert.ok(source.includes("export default function DashboardLayout"));
  assert.ok(source.includes("children: React.ReactNode;"));
  assert.ok(source.includes("<PrivateDashboardShell>{children}</PrivateDashboardShell>"));
});

test("private dashboard shell keeps children and delegates role routing to dashboard shell router", () => {
  const source = read(PRIVATE_DASHBOARD_SHELL_PATH);

  assert.ok(source.includes('import type { ReactNode } from "react";'));
  assert.ok(source.includes('import { DashboardShellRouter } from "./DashboardShellRouter";'));
  assert.ok(source.includes("export type PrivateDashboardShellProps"));
  assert.ok(source.includes("children: ReactNode;"));
  assert.ok(source.includes("export function PrivateDashboardShell({"));
  assert.ok(source.includes("<DashboardShellRouter>{children}</DashboardShellRouter>"));
});

test("dashboard shell router renders a no-sidebar horizontal app shell column", () => {
  const source = read(DASHBOARD_SHELL_ROUTER_PATH);

  assert.ok(source.includes('"use client";'));
  assert.ok(source.includes('import { useSelectedLayoutSegment } from "next/navigation";'));
  assert.ok(source.includes("const selectedSegment = useSelectedLayoutSegment();"));
  assert.ok(source.includes('const isAdminDashboard = selectedSegment === "admin";'));
  assert.ok(source.includes("data-vetneb-app-shell-surface={surface}"));

  // PR-2: the vertical sidebar is no longer the primary navigation; the shell is
  // a full-width vertical column that reserves no lateral aside.
  assert.ok(source.includes("flex flex-col h-dvh overflow-hidden"));
  assert.equal(source.includes("<AdminDashboardSidebar />"), false);
  assert.equal(source.includes("<ClinicDashboardSidebar />"), false);
});

test("dashboard sidebar frame is the shared visual shell for both roles", () => {
  const source = read(DASHBOARD_SIDEBAR_FRAME_PATH);

  assert.ok(source.includes('"use client";'));
  assert.ok(source.includes('import { usePathname, useSearchParams } from "next/navigation";'));
  assert.ok(source.includes('import { ROUTES } from "@/lib/routes";'));
  assert.ok(source.includes("export type DashboardNavItem = {"));
  assert.ok(source.includes("dashboardLabel: string;"));
  assert.ok(source.includes("navItems: DashboardNavItem[];"));
  assert.ok(source.includes('role="navigation"'));
  assert.ok(source.includes('aria-label="Navegación principal"'));
  assert.ok(source.includes("sticky top-0 flex h-dvh"));
  assert.ok(source.includes("overflow-y-auto"));
  assert.ok(source.includes('aria-label="Menú principal"'));
  assert.ok(source.includes("focus-visible:ring-2 focus-visible:ring-ring/85"));
  assert.ok(source.includes("function isActive(href: string, exact = false)"));
  assert.ok(source.includes('const activeModule = searchParams.get("module");'));
  assert.ok(source.includes("if (exact) return pathname === hrefPath && !activeModule;"));
  assert.ok(source.includes("item.children && isActive(item.href)"));
  assert.ok(source.includes("item.children.map((child) =>"));
  assert.ok(source.includes("Portal VETNEB"));
  assert.ok(source.includes("Volver al sitio público"));
});

test("dashboard sidebar frame expands labels at 2xl while staying compact below it", () => {
  const source = read(DASHBOARD_SIDEBAR_FRAME_PATH);

  // Compact (default) behavior preserved below 2xl.
  assert.ok(source.includes("w-[4.5rem]"));
  assert.ok(source.includes("justify-center"));
  assert.ok(/<span className="sr-only 2xl:not-sr-only 2xl:truncate">/.test(source));

  // Expanded icon + label behavior at 2xl and above.
  assert.ok(source.includes("2xl:w-60"));
  assert.ok(source.includes("2xl:justify-start"));
  assert.ok(source.includes("2xl:not-sr-only"));
});

test("dashboard sidebar header shows brand identity only at 2xl and stays accessible when compact", () => {
  const source = read(DASHBOARD_SIDEBAR_FRAME_PATH);

  // Reuses the existing dashboardLabel prop — no hardcoded admin/clinic copy.
  assert.ok(source.includes("Portal VETNEB"));
  assert.ok(source.includes("{dashboardLabel}"));

  // Compact (<2xl): brand text stays screen-reader-only.
  assert.ok(/<span className="sr-only 2xl:hidden">/.test(source));

  // Expanded (2xl+): visible brand block, hidden below 2xl.
  assert.ok(source.includes('className="hidden min-w-0 2xl:block"'));
});

test("clinic dashboard sidebar keeps clinic operations and excludes admin navigation", () => {
  const source = read(CLINIC_DASHBOARD_SIDEBAR_PATH);

  assert.ok(source.includes("const clinicNavItems: DashboardNavItem[] = ["));
  assert.ok(source.includes('label: "Dashboard"'));
  assert.ok(source.includes('label: "Informes"'));
  assert.ok(source.includes('label: "Logística"'));
  assert.ok(source.includes('label: "Perfil público"'));
  assert.ok(source.includes('label: "Tokens particulares"'));
  assert.ok(source.includes("ROUTES.dashboardInformes"));
  assert.ok(source.includes("ROUTES.dashboardLogistica"));
  assert.ok(source.includes('`${ROUTES.dashboard}?module=perfil`'));
  assert.ok(source.includes('`${ROUTES.dashboard}?module=tokens`'));
  assert.equal(source.includes("ROUTES.dashboardAdmin"), false);
});

test("admin dashboard sidebar keeps admin operations and excludes clinic navigation", () => {
  const source = read(ADMIN_DASHBOARD_SIDEBAR_PATH);

  assert.ok(source.includes("const adminNavItems: DashboardNavItem[] = ["));
  assert.ok(source.includes('label: "Administración"'));
  assert.ok(source.includes('label: "Subir informe"'));
  assert.ok(source.includes('label: "Estado"'));
  assert.ok(source.includes('label: "Clínicas"'));
  assert.ok(source.includes('label: "Tokens particulares"'));
  assert.ok(source.includes('label: "Precios"'));
  assert.ok(source.includes('label: "Sesiones"'));
  assert.ok(source.includes('label: "Roles clínica"'));
  assert.ok(source.includes('label: "Auditoría"'));
  assert.ok(source.includes('label: "Mantenimiento"'));
  assert.ok(source.includes("ROUTES.dashboardAdmin"));
  assert.ok(source.includes('href: `${ROUTES.dashboardAdmin}?module=admin-clinics`'));
  assert.ok(source.includes('href: `${ROUTES.dashboardAdmin}?module=admin-pricing`'));
  assert.ok(source.includes('href: `${ROUTES.dashboardAdmin}?module=admin-users-roles`'));
  assert.equal(source.includes('href: `${ROUTES.dashboardAdmin}#audit-role-changes`'), false);
  assert.equal(source.includes("clinic-public-profile"), false);
  assert.equal(source.includes("clinic-particular-tokens"), false);
});
