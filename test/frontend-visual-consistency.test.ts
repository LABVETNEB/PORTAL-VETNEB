import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const GLOBALS_CSS_PATH = "frontend/src/app/globals.css";
const HOME_PAGE_PATH = "frontend/src/app/page.tsx";
const SERVICIOS_PAGE_PATH = "frontend/src/app/servicios/page.tsx";
const LOGIN_CONTENT_PATH = "frontend/src/components/public/LoginContent.tsx";
const DASHBOARD_SIDEBAR_FRAME_PATH =
  "frontend/src/components/dashboard/DashboardSidebarFrame.tsx";
const CLINIC_DASHBOARD_SIDEBAR_PATH =
  "frontend/src/components/dashboard/ClinicDashboardSidebar.tsx";
const ADMIN_DASHBOARD_SIDEBAR_PATH =
  "frontend/src/components/dashboard/AdminDashboardSidebar.tsx";
const DASHBOARD_TOPBAR_PATH = "frontend/src/components/dashboard/DashboardTopbar.tsx";
const DASHBOARD_HOME_PATH = "frontend/src/app/dashboard/page.tsx";
const DASHBOARD_ADMIN_PATH = "frontend/src/app/dashboard/admin/page.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

function assertContainsAll(
  source: string,
  expected: readonly string[],
  context: string,
): void {
  for (const marker of expected) {
    assert.ok(source.includes(marker), `${context} must contain: ${marker}`);
  }
}

function assertMatchesAll(
  source: string,
  patterns: readonly RegExp[],
  context: string,
): void {
  for (const pattern of patterns) {
    assert.match(source, pattern, `${context} must match ${pattern}`);
  }
}

function assertInlineStylesAtMost(
  source: string,
  maxAllowed: number,
  context: string,
): void {
  const count = (source.match(/\bstyle=\{\{/g) ?? []).length;
  assert.ok(
    count <= maxAllowed,
    `${context} must keep inline styles <= ${maxAllowed}, received ${count}`,
  );
}

function assertNoClientFetchOrApiLiterals(source: string, context: string): void {
  assert.equal(source.includes("fetch("), false, `${context} must not use fetch()`);
  assert.equal(
    source.includes('"/api') || source.includes("'/api"),
    false,
    `${context} must not embed /api literals`,
  );
}

test("globals css keeps visual tokens and shared frontend surface utilities", () => {
  const source = read(GLOBALS_CSS_PATH);

  assertContainsAll(
    source,
    [
      '@import "tailwindcss";',
      '--primary: 210 80% 35%;',
      "--ring: 210 80% 35%;",
      "--sidebar-background: 222 47% 11%;",
      "--sidebar-foreground: 210 40% 96%;",
      "--sidebar-accent: 217 33% 17%;",
      "--sidebar-ring: 210 80% 55%;",
      ".dashboard-main",
      ".surface-note-info",
      ".surface-empty",
      ".surface-soft",
      ".field-label",
      ".field-select",
      ".field-textarea",
    ],
    "globals.css visual consistency",
  );

  assertMatchesAll(
    source,
    [
      /\.dashboard-main\s*\{[\s\S]*@apply[\s\S]*space-y-6[\s\S]*sm:px-6[\s\S]*lg:px-8[\s\S]*\}/,
      /\.surface-note-info\s*\{[\s\S]*@apply[\s\S]*rounded-xl[\s\S]*border-blue-200[\s\S]*bg-blue-50[\s\S]*\}/,
      /\.surface-empty\s*\{[\s\S]*@apply[\s\S]*border-dashed[\s\S]*bg-gray-50[\s\S]*\}/,
      /\.field-select\s*\{[\s\S]*@apply[\s\S]*h-11[\s\S]*rounded-lg[\s\S]*focus-visible:ring-2[\s\S]*\}/,
    ],
    "globals.css utility contracts",
  );
});

test("public home page keeps polished visual hierarchy and responsive sections", () => {
  const source = read(HOME_PAGE_PATH);

  assertContainsAll(
    source,
    [
      "<PublicLayout>",
      'aria-labelledby="hero-heading"',
      'aria-labelledby="services-heading"',
      'aria-labelledby="benefits-heading"',
      'aria-labelledby="cta-heading"',
      'src="/images/hero-microscope-vetneb.jpg"',
      'sizes="100vw"',
      "bg-black/55",
      "CONSULTÁ LOS RESULTADOS DE SUS INFORMES LAS 24 HS.",
      'href="https://wa.me/5493534138946"',
      "services.map((service) =>",
      "benefits.map((benefit) =>",
      "transition-shadow hover:shadow-md",
    ],
    "home page visual hierarchy",
  );

  assertMatchesAll(
    source,
    [
      /className="relative isolate overflow-hidden text-white"/,
      /className="relative container mx-auto flex min-h-\[calc\(100vh-4\.5rem\)\] items-center px-4 py-16 sm:px-6 lg:px-8"/,
      /className="text-4xl font-semibold leading-tight tracking-\[0\.08em\] text-white sm:text-5xl lg:text-6xl"/,
      /className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4"/,
      /className="public-soft-canvas"/,
      /className="py-16 md:py-20"/,
      /className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4"/,
      /className="py-16 md:py-20"/,
      /className="flex flex-col justify-center gap-3 sm:flex-row sm:gap-4"/,
    ],
    "home page class contracts",
  );

  assertInlineStylesAtMost(source, 0, "home page");
});

test("servicios page keeps professional section/card structure and responsive layout", () => {
  const source = read(SERVICIOS_PAGE_PATH);

  assertContainsAll(
    source,
    [
      "<PublicLayout>",
      "const serviceCategories = [",
      "serviceCategories.map((service) =>",
      "service.features.map((feature) =>",
      "transition-shadow hover:shadow-md",
    ],
    "servicios visual structure",
  );

  assertMatchesAll(
    source,
    [
      /className="bg-gradient-to-br from-blue-900 to-blue-700 py-16 text-white md:py-20"/,
      /className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8"/,
      /className="h-full border-gray-100 transition-shadow hover:shadow-md"/,
      /className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl text-center"/,
      /className="flex flex-col justify-center gap-3 sm:flex-row"/,
      /className="py-16"/,
    ],
    "servicios class contracts",
  );

  assertInlineStylesAtMost(source, 0, "servicios page");
  assert.equal(source.includes("fetch("), false, "servicios page must avoid fetch()");
});

test("login content keeps polished auth card layout and stable visual states", () => {
  const source = read(LOGIN_CONTENT_PATH);

  assertContainsAll(
    source,
    [
      '"use client";',
      'className="w-full max-w-md"',
      "className=\"field-label\"",
      'className="space-y-4"',
      'className="w-full"',
      'role="alert"',
    ],
    "login content layout contracts",
  );

  assertMatchesAll(
    source,
    [
      /className="min-h-screen public-page-canvas public-soft-canvas flex items-center justify-center p-4"/,
      /className="border border-white\/80 bg-white\/95 shadow-2xl backdrop-blur"/,
      /className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"/,
      /className="text-primary hover:underline font-medium"/,
      /className="hover:text-primary transition-colors"/,
    ],
    "login content visual details",
  );

  assertInlineStylesAtMost(source, 0, "login content");
  assertNoClientFetchOrApiLiterals(source, "login content");
});

test("dashboard sidebar keeps shell consistency and responsive navigation classes", () => {
  const source = read(DASHBOARD_SIDEBAR_FRAME_PATH);

  assertContainsAll(
    source,
    [
      '"use client";',
      "export type DashboardNavItem = {",
      'aria-label="Navegación del dashboard"',
      'aria-label="Menú principal"',
      "item.children && isActive(item.href)",
      "item.children.map((child) =>",
    ],
    "dashboard sidebar structure",
  );

  assertMatchesAll(
    source,
    [
      /className="sticky top-0 flex h-screen w-\[4\.5rem\] shrink-0 flex-col overflow-y-auto bg-sidebar text-sidebar-foreground sm:w-64"/,
      /className="flex items-center justify-center gap-3 border-b border-sidebar-border px-2 py-5 sm:justify-start sm:px-6"/,
      /className="flex-1 space-y-1 px-2 py-4 sm:px-3"/,
      /"flex items-center justify-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors sm:justify-start sm:px-3"/,
      /className="ml-6 mt-1 hidden space-y-1 sm:block"/,
      /"flex items-center gap-2 px-3 py-1\.5 rounded-md text-xs font-medium transition-colors"/,
      /className="border-t border-sidebar-border px-2 py-4 sm:px-3"/,
    ],
    "dashboard sidebar classes",
  );

  assertInlineStylesAtMost(source, 0, "dashboard sidebar");
  assertNoClientFetchOrApiLiterals(source, "dashboard sidebar");
});

test("clinic and admin sidebars keep visual parity with separated operational nav", () => {
  const clinicSource = read(CLINIC_DASHBOARD_SIDEBAR_PATH);
  const adminSource = read(ADMIN_DASHBOARD_SIDEBAR_PATH);

  assertContainsAll(
    clinicSource,
    [
      "DashboardSidebarFrame",
      'dashboardLabel="Dashboard clínica"',
      'label: "Dashboard"',
      'label: "Informes"',
      'label: "Logística"',
      'label: "Perfil público"',
      'label: "Tokens particulares"',
    ],
    "clinic dashboard sidebar contracts",
  );

  assertContainsAll(
    adminSource,
    [
      "DashboardSidebarFrame",
      'dashboardLabel="Administración"',
      'label: "Administración"',
      'label: "Subir informe"',
      'label: "Estado"',
      'label: "Sesiones"',
      'label: "Tokens particulares"',
      'label: "Roles clínica"',
      'label: "Auditoría"',
      'label: "Mantenimiento"',
    ],
    "admin dashboard sidebar contracts",
  );
});

test("dashboard topbar keeps sticky hierarchy and compact responsive shell", () => {
  const source = read(DASHBOARD_TOPBAR_PATH);

  assertContainsAll(
    source,
    [
      "interface DashboardTopbarProps",
      "title: string;",
      "subtitle?: string;",
      "{subtitle && (",
      "<Button asChild variant=\"outline\" size=\"sm\">",
    ],
    "dashboard topbar hierarchy",
  );

  assertMatchesAll(
    source,
    [
      /className="sticky top-0 z-40 flex min-h-16 items-center justify-between border-b bg-white\/95 px-4 py-2 shadow-sm backdrop-blur supports-\[backdrop-filter\]:bg-white\/80 sm:px-6"/,
      /className="truncate text-lg font-semibold text-gray-900 sm:text-xl"/,
      /className="truncate text-xs text-gray-500 sm:text-sm"/,
      /className="ml-3 flex shrink-0 items-center gap-2 sm:gap-3"/,
    ],
    "dashboard topbar class contracts",
  );

  assertInlineStylesAtMost(source, 0, "dashboard topbar");
  assertNoClientFetchOrApiLiterals(source, "dashboard topbar");
});

test("dashboard home keeps visual dashboard states and card spacing conventions", () => {
  const source = read(DASHBOARD_HOME_PATH);

  assertContainsAll(
    source,
    [
      '<main className="dashboard-main">',
      '<div className="surface-note-info">',
      "<StatsCards stats={stats} />",
      'className="surface-empty"',
      "recentReports.map((report) =>",
      "recentVisits.map((visit) =>",
      "Accesos rápidos",
    ],
    "dashboard home shell",
  );

  assertMatchesAll(
    source,
    [
      /className="grid grid-cols-1 gap-6 lg:grid-cols-2"/,
      /className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"/,
      /className="grid grid-cols-2 gap-3 md:grid-cols-4"/,
      /className="h-16 flex-col gap-1 rounded-xl"/,
      /className="text-sm font-medium text-gray-900 truncate"/,
      /className="text-xs text-gray-400"/,
    ],
    "dashboard home visual patterns",
  );

  assertInlineStylesAtMost(source, 0, "dashboard home");
  assert.equal(source.includes("fetch("), false, "dashboard home must avoid fetch()");
});

test("dashboard admin keeps dense professional layout and visual state surfaces", () => {
  const source = read(DASHBOARD_ADMIN_PATH);

  assertContainsAll(
    source,
    [
      '<main className="dashboard-main">',
      "<AdminMaintenanceDryRunCard />",
      "<AdminSessionsReadOnlyCard />",
      "<AdminFailedLoginAlertsReadOnlyCard />",
      "<AdminUsersRolesReadOnlyCard />",
      'id="audit-log"',
      'id="audit-role-changes"',
      "getSystemStatusIndicatorClass(",
    ],
    "dashboard admin structure",
  );

  assertMatchesAll(
    source,
    [
      /className="grid grid-cols-1 md:grid-cols-3 gap-4"/,
      /className="border-gray-100"/,
      /className="grid grid-cols-1 md:grid-cols-5 gap-3"/,
      /className="surface-soft"/,
      /className="grid grid-cols-1 gap-3 md:grid-cols-3"/,
      /className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"/,
      /className="mx-6 mt-4 flex flex-col gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700 md:flex-row md:items-center md:justify-between"/,
      /className="max-w-md whitespace-normal break-words text-xs text-gray-500"/,
    ],
    "dashboard admin visual contracts",
  );

  assertInlineStylesAtMost(source, 0, "dashboard admin");
  assert.equal(source.includes("fetch("), false, "dashboard admin must avoid fetch()");
});











test("public visual backgrounds do not render grid overlays", () => {
  const source = read(GLOBALS_CSS_PATH);

  assert.equal(source.includes("background-size: 46px 46px"), false);
  assert.equal(source.includes("linear-gradient(rgba(255, 255, 255, 0.08) 1px"), false);
  assert.equal(source.includes("linear-gradient(90deg, rgba(255, 255, 255, 0.07) 1px"), false);
});



test("public medical card system keeps clinical premium card surfaces", () => {
  const source = read(GLOBALS_CSS_PATH);

  assert.ok(source.includes("public-medical-card-system:start"));
  assert.ok(source.includes(".public-soft-canvas .premium-card"));
  assert.ok(source.includes(".public-soft-canvas .premium-card-muted"));
  assert.ok(source.includes('[data-auth-login-card="true"]'));
  assert.ok(source.includes('[data-services-polished="true"] > [id]'));
  assert.ok(source.includes("backdrop-filter: blur(16px) saturate(1.08);"));
  assert.ok(source.includes("linear-gradient(90deg"));
  assert.ok(source.includes("rgba(30, 64, 175, 0.78)"));
  assert.ok(source.includes("rgba(13, 148, 136, 0.70)"));
  assert.ok(source.includes("@media (hover: hover)"));
});









test("public pages use one single shared canvas background", () => {
  const globals = read(GLOBALS_CSS_PATH);
  const login = read(LOGIN_CONTENT_PATH);

  assert.ok(globals.includes(".public-page-canvas"));
  assert.ok(globals.includes(".public-page-canvas::before"));
  assert.ok(globals.includes("public-page-canvas-drift 14s ease-in-out infinite alternate"));
  assert.ok(globals.includes("background: transparent !important;"));
  assert.ok(globals.includes(".public-soft-canvas::before"));
  assert.ok(globals.includes(".public-hero-depth::before"));
  assert.ok(globals.includes("content: none !important;"));
  assert.equal(globals.includes("linear-gradient(135deg, #07365d 0%, #123f7a 42%, #0f766e 100%) !important;"), false);
  assert.equal(globals.includes("public-soft-canvas-drift 12s ease-in-out infinite alternate"), false);
  assert.ok(login.includes("min-h-screen public-page-canvas public-soft-canvas flex items-center justify-center p-4"));
});
