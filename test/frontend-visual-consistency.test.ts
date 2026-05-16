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
      "--primary: 207 72% 30%;",
      "--ring: 182 72% 34%;",
      "--vetneb-navy: 207 72% 22%;",
      "--vetneb-teal: 177 64% 31%;",
      "--vetneb-surface-raised: 190 33% 98%;",
      "--sidebar-background: 207 62% 15%;",
      "--sidebar-foreground: 195 45% 93%;",
      "--sidebar-accent: 205 48% 22%;",
      "--sidebar-ring: 181 65% 43%;",
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
      /\.surface-note-info\s*\{[\s\S]*@apply[\s\S]*rounded-lg[\s\S]*border-vetneb-cyan\/30[\s\S]*bg-vetneb-cyan\/10[\s\S]*\}/,
      /\.surface-empty\s*\{[\s\S]*@apply[\s\S]*border-dashed[\s\S]*bg-vetneb-surface-muted\/70[\s\S]*\}/,
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
      "bg-[linear-gradient(110deg,hsl(var(--vetneb-navy)/0.84),hsl(var(--vetneb-navy)/0.66)_45%,hsl(var(--vetneb-teal)/0.42)_100%)]",
      "Consultá los resultados de sus informes las 24 hs.",
      'href="https://wa.me/5493534138946"',
      "services.map((service) =>",
      "benefits.map((benefit) =>",
      "premium-card h-full",
    ],
    "home page visual hierarchy",
  );

  assertMatchesAll(
    source,
    [
      /className="relative isolate overflow-hidden text-white"/,
      /className="relative container mx-auto flex min-h-\[calc\(100vh-4\.5rem\)\] items-center px-4 py-16 sm:px-6 lg:px-8"/,
      /className="mt-5 text-4xl font-semibold leading-tight text-white sm:text-5xl lg:text-6xl"/,
      /className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center"/,
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
      "data-services-polished=\"true\"",
    ],
    "servicios visual structure",
  );

  assertMatchesAll(
    source,
    [
      /className="clinical-primary-gradient py-16 text-white md:py-20"/,
      /className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8"/,
      /className="premium-card h-full"/,
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
      'className="w-full clinical-primary-gradient clinical-primary-gradient-hover text-primary-foreground',
      'role="alert"',
    ],
    "login content layout contracts",
  );

  assertMatchesAll(
    source,
    [
      /className="min-h-screen public-page-canvas flex items-center justify-center p-4"/,
      /className="border border-vetneb-line\/80 bg-card\/95 shadow-\[0_18px_52px_rgba\(15,45,62,0\.12\)\]"/,
      /className="clinical-alert-error px-3 py-2"/,
      /className="font-medium text-primary hover:underline"/,
      /className="transition-colors hover:text-primary"/,
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
      /"flex items-center justify-center gap-3 rounded-md px-2 py-2 text-sm font-semibold transition-colors sm:justify-start sm:px-3"/,
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
      /className="sticky top-0 z-40 flex min-h-\[4\.5rem\] items-center justify-between border-b border-vetneb-line\/80 bg-card\/90 px-4 py-2\.5 shadow-sm backdrop-blur supports-\[backdrop-filter\]:bg-card\/78 sm:px-6"/,
      /className="truncate text-xl font-semibold leading-tight text-vetneb-ink sm:text-2xl"/,
      /className="mt-0\.5 truncate text-xs text-muted-foreground sm:text-sm"/,
      /className="ml-3 flex shrink-0 items-center gap-2 sm:gap-3"/,
    ],
    "dashboard topbar class contracts",
  );

  assertInlineStylesAtMost(source, 0, "dashboard topbar");
  assertNoClientFetchOrApiLiterals(source, "dashboard topbar");
});

test("dashboard home keeps visual dashboard states and card spacing conventions", () => {
  const source = read(DASHBOARD_HOME_PATH);
  const removedQuickActionsTitle = "Accesos " + "rápidos";
  const removedQuickActionsGrid = "xl:grid-cols-" + "5";
  const removedQuickActionsButton = "h-16 flex-col gap-1 rounded-" + "lg";

  assertContainsAll(
    source,
    [
      '<main className="dashboard-main">',
      '<section className="surface-note-info" aria-labelledby="dashboard-operational-priority">',
      "<StatsCards stats={stats} />",
      'className="surface-empty"',
      "recentReports.map((report) =>",
      "recentVisits.map((visit) =>",
    ],
    "dashboard home shell",
  );

  assertMatchesAll(
    source,
    [
      /className="grid grid-cols-1 gap-6 lg:grid-cols-2"/,
      /className="dashboard-list-row"/,
      /className="truncate text-sm font-semibold text-vetneb-ink"/,
      /className="text-xs text-muted-foreground"/,
    ],
    "dashboard home visual patterns",
  );

  assert.equal(source.includes(removedQuickActionsTitle), false);
  assert.equal(source.includes(removedQuickActionsGrid), false);
  assert.equal(source.includes(removedQuickActionsButton), false);
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
      /className="grid grid-cols-1 gap-4 md:grid-cols-3"/,
      /className="dashboard-surface h-full"/,
      /className="grid grid-cols-1 md:grid-cols-5 gap-3"/,
      /className="surface-soft"/,
      /className="grid grid-cols-1 gap-3 md:grid-cols-3"/,
      /className="clinical-muted-band flex items-center gap-2 rounded-lg px-3 py-2"/,
      /className="clinical-muted-band mx-6 mt-4 flex flex-col gap-2 rounded-lg px-4 py-3 text-sm text-vetneb-navy md:flex-row md:items-center md:justify-between"/,
      /className="max-w-md whitespace-normal break-words text-xs text-muted-foreground"/,
    ],
    "dashboard admin visual contracts",
  );

  assertInlineStylesAtMost(source, 0, "dashboard admin");
  assert.equal(source.includes("fetch("), false, "dashboard admin must avoid fetch()");
});











test("public visual backgrounds use a single clinical diagnostic texture", () => {
  const source = read(GLOBALS_CSS_PATH);

  assert.ok(source.includes(".public-page-canvas::before"));
  assert.ok(source.includes("background-size: 86px 86px, 86px 86px, 100% 100%;"));
  assert.ok(source.includes(".diagnostic-field"));
  assert.equal(source.includes("render-orb"), false);
  assert.equal(source.includes("blur(80px)"), false);
});



test("public medical card system keeps clinical premium card surfaces", () => {
  const source = read(GLOBALS_CSS_PATH);

  assert.ok(source.includes("public-medical-card-system:start"));
  assert.ok(source.includes(".public-soft-canvas .premium-card"));
  assert.ok(source.includes(".public-soft-canvas .premium-card-muted"));
  assert.ok(source.includes('[data-auth-login-card="true"]'));
  assert.ok(source.includes('[data-services-polished="true"] > [id]'));
  assert.ok(source.includes("border-radius: var(--radius) !important;"));
  assert.ok(source.includes("linear-gradient(90deg"));
  assert.ok(source.includes("hsl(var(--vetneb-navy) / 0.78)"));
  assert.ok(source.includes("hsl(var(--vetneb-teal) / 0.70)"));
  assert.ok(source.includes("@media (hover: hover)"));
});









test("public pages use one single shared canvas background", () => {
  const globals = read(GLOBALS_CSS_PATH);
  const login = read(LOGIN_CONTENT_PATH);

  assert.ok(globals.includes(".public-page-canvas"));
  assert.ok(globals.includes(".public-page-canvas::before"));
  assert.ok(globals.includes("mask-image: linear-gradient(180deg"));
  assert.ok(globals.includes("background: transparent !important;"));
  assert.ok(globals.includes(".public-soft-canvas::before"));
  assert.ok(globals.includes(".public-hero-depth::before"));
  assert.ok(globals.includes("content: none !important;"));
  assert.equal(globals.includes("linear-gradient(135deg, #07365d 0%, #123f7a 42%, #0f766e 100%) !important;"), false);
  assert.equal(globals.includes("public-page-canvas-drift"), false);
  assert.ok(login.includes("min-h-screen public-page-canvas flex items-center justify-center p-4"));
});
