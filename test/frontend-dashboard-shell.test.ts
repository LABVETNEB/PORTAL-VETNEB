import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const DASHBOARD_LAYOUT_PATH = "frontend/src/app/dashboard/layout.tsx";
const DASHBOARD_SIDEBAR_PATH = "frontend/src/components/dashboard/DashboardSidebar.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("dashboard layout wraps children with protected dashboard shell", () => {
  const source = read(DASHBOARD_LAYOUT_PATH);

  assert.ok(source.includes('import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";'));
  assert.ok(source.includes("export default function DashboardLayout"));
  assert.ok(source.includes("children: React.ReactNode;"));
  assert.ok(source.includes('<div className="flex min-h-screen bg-gray-50">'));
  assert.ok(source.includes("<DashboardSidebar />"));
  assert.ok(source.includes('<div className="flex-1 flex flex-col min-w-0">'));
  assert.ok(source.includes("{children}"));
});

test("dashboard sidebar is client-side and uses route registry", () => {
  const source = read(DASHBOARD_SIDEBAR_PATH);

  assert.ok(source.includes('"use client";'));
  assert.ok(source.includes('import Link from "next/link";'));
  assert.ok(source.includes('import { usePathname } from "next/navigation";'));
  assert.ok(source.includes('import { cn } from "@/lib/utils";'));
  assert.ok(source.includes('import { ROUTES } from "@/lib/routes";'));
});

test("dashboard sidebar defines primary dashboard navigation items", () => {
  const source = read(DASHBOARD_SIDEBAR_PATH);

  assert.ok(source.includes("const navItems = ["));
  assert.ok(source.includes('label: "Dashboard"'));
  assert.ok(source.includes("href: ROUTES.dashboard"));
  assert.ok(source.includes("exact: true"));
  assert.ok(source.includes('label: "Informes"'));
  assert.ok(source.includes("href: ROUTES.dashboardInformes"));
  assert.ok(source.includes('label: "Logística"'));
  assert.ok(source.includes("href: ROUTES.dashboardLogistica"));
  assert.ok(source.includes('label: "Administración"'));
  assert.ok(source.includes("href: ROUTES.dashboardAdmin"));
});

test("dashboard sidebar defines logistics subnavigation", () => {
  const source = read(DASHBOARD_SIDEBAR_PATH);

  assert.ok(source.includes("children: ["));
  assert.ok(source.includes('{ label: "Visitas de campo", href: ROUTES.dashboardLogisticaVisitas }'));
  assert.ok(source.includes('{ label: "Planes de ruta", href: ROUTES.dashboardLogisticaRutas }'));
  assert.ok(source.includes('{ label: "Métricas", href: ROUTES.dashboardLogisticaMetricas }'));
  assert.ok(source.includes("item.children && isActive(item.href)"));
  assert.ok(source.includes("item.children.map((child) =>"));
});

test("dashboard sidebar keeps active state and accessibility markers", () => {
  const source = read(DASHBOARD_SIDEBAR_PATH);

  assert.ok(source.includes("function isActive(href: string, exact = false)"));
  assert.ok(source.includes("if (exact) return pathname === href;"));
  assert.ok(source.includes("return pathname.startsWith(href);"));
  assert.ok(source.includes('aria-label="Navegación del dashboard"'));
  assert.ok(source.includes('aria-label="Menú principal"'));
  assert.ok(source.includes('aria-current={isActive(item.href, item.exact) ? "page" : undefined}'));
  assert.ok(source.includes('aria-current={pathname === child.href ? "page" : undefined}'));
});

test("dashboard sidebar exposes brand and public-site escape link", () => {
  const source = read(DASHBOARD_SIDEBAR_PATH);

  assert.ok(source.includes("Portal VETNEB"));
  assert.ok(source.includes("Dashboard"));
  assert.ok(source.includes("href={ROUTES.home}"));
  assert.ok(source.includes("Volver al sitio público"));
});
