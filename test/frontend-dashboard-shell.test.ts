import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const DASHBOARD_LAYOUT_PATH = "frontend/src/app/dashboard/layout.tsx";
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

test("dashboard layout delegates shell selection to dashboard shell router", () => {
  const source = read(DASHBOARD_LAYOUT_PATH);

  assert.ok(source.includes('import { DashboardShellRouter } from "@/components/dashboard/DashboardShellRouter";'));
  assert.ok(source.includes("export default function DashboardLayout"));
  assert.ok(source.includes("children: React.ReactNode;"));
  assert.ok(source.includes("<DashboardShellRouter>{children}</DashboardShellRouter>"));
});

test("dashboard shell router selects clinic/admin sidebar by route segment", () => {
  const source = read(DASHBOARD_SHELL_ROUTER_PATH);

  assert.ok(source.includes('"use client";'));
  assert.ok(source.includes('import { useSelectedLayoutSegment } from "next/navigation";'));
  assert.ok(source.includes('import { AdminDashboardSidebar } from "./AdminDashboardSidebar";'));
  assert.ok(source.includes('import { ClinicDashboardSidebar } from "./ClinicDashboardSidebar";'));
  assert.ok(source.includes("const selectedSegment = useSelectedLayoutSegment();"));
  assert.ok(source.includes('const isAdminDashboard = selectedSegment === "admin";'));
  assert.ok(source.includes("isAdminDashboard ? ("));
  assert.ok(source.includes("<AdminDashboardSidebar />"));
  assert.ok(source.includes("<ClinicDashboardSidebar />"));
});

test("dashboard sidebar frame is the shared visual shell for both roles", () => {
  const source = read(DASHBOARD_SIDEBAR_FRAME_PATH);

  assert.ok(source.includes('"use client";'));
  assert.ok(source.includes('import { usePathname } from "next/navigation";'));
  assert.ok(source.includes('import { ROUTES } from "@/lib/routes";'));
  assert.ok(source.includes("export type DashboardNavItem = {"));
  assert.ok(source.includes("dashboardLabel: string;"));
  assert.ok(source.includes("navItems: DashboardNavItem[];"));
  assert.ok(source.includes('aria-label="Navegación del dashboard"'));
  assert.ok(source.includes("sticky top-0 flex h-dvh"));
  assert.ok(source.includes("overflow-y-auto"));
  assert.ok(source.includes('aria-label="Menú principal"'));
  assert.ok(source.includes("function isActive(href: string, exact = false)"));
  assert.ok(source.includes("if (exact) return pathname === hrefPath;"));
  assert.ok(source.includes("item.children && isActive(item.href)"));
  assert.ok(source.includes("item.children.map((child) =>"));
  assert.ok(source.includes("Portal VETNEB"));
  assert.ok(source.includes("Volver al sitio público"));
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
  assert.ok(source.includes('`${ROUTES.dashboard}#clinic-public-profile`'));
  assert.ok(source.includes('`${ROUTES.dashboard}#clinic-particular-tokens`'));
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
  assert.ok(source.includes('href: `${ROUTES.dashboardAdmin}#admin-clinics`'));
  assert.ok(source.includes('href: `${ROUTES.dashboardAdmin}#admin-pricing`'));
  assert.ok(source.includes('href: `${ROUTES.dashboardAdmin}#admin-users-roles`'));
  assert.equal(source.includes('href: `${ROUTES.dashboardAdmin}#audit-role-changes`'), false);
  assert.equal(source.includes("clinic-public-profile"), false);
  assert.equal(source.includes("clinic-particular-tokens"), false);
});
