import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const FILTER_DRAWER_PATH = "frontend/src/components/dashboard/FilterDrawer.tsx";
const STICKY_FILTER_BAR_PATH =
  "frontend/src/components/dashboard/StickyFilterBar.tsx";
const INFORMES_PAGE_PATH = "frontend/src/app/dashboard/informes/page.tsx";
const DOC_PATH = "docs/pr-6-dashboard-filter-drawer-sticky-filters.md";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

function assertNoForbiddenSurfaceImports(source: string, context: string): void {
  const importLines = source
    .split("\n")
    .filter((line) => line.trim().startsWith("import "));
  const forbiddenPatterns = [
    /@\/app\/api/,
    /@\/middleware/,
    /@\/lib\/auth/,
    /@\/components\/public/,
    /\.\.\/.*\/auth/,
    /\.\.\/.*\/middleware/,
    /\.\.\/.*\/public/,
  ];

  for (const line of importLines) {
    for (const pattern of forbiddenPatterns) {
      assert.equal(
        pattern.test(line),
        false,
        `${context} must not import forbidden surface via: ${line}`,
      );
    }
  }
}

test("FilterDrawer exposes reusable client drawer contract without forbidden surfaces", () => {
  const source = read(FILTER_DRAWER_PATH);

  assert.ok(source.includes('"use client";'));
  assert.ok(source.includes("export type FilterDrawerProps = {"));
  assert.ok(source.includes("title: string;"));
  assert.ok(source.includes("description?: string;"));
  assert.ok(source.includes("triggerLabel?: string;"));
  assert.ok(source.includes("activeCount?: number;"));
  assert.ok(source.includes("children: ReactNode;"));
  assert.ok(source.includes("footer?: ReactNode;"));
  assert.ok(source.includes("className?: string;"));
  assert.ok(source.includes("const panelRef = useRef<HTMLDivElement>(null);"));
  assert.ok(source.includes("const activeCountLabel ="));
  assert.ok(source.includes('activeCount === 0'));
  assert.ok(source.includes('"Sin filtros activos"'));
  assert.ok(source.includes('event.key === "Escape"'));
  assert.ok(source.includes('aria-haspopup="dialog"'));
  assert.ok(source.includes("aria-expanded={open}"));
  assert.ok(source.includes("aria-label={`${triggerLabel}. ${activeCountLabel}`}"));
  assert.ok(source.includes('role="dialog"'));
  assert.ok(source.includes('aria-modal="true"'));
  assert.ok(source.includes("aria-labelledby={titleId}"));
  assert.ok(source.includes("ref={panelRef}"));
  assert.ok(source.includes("tabIndex={-1}"));
  assert.ok(source.includes('aria-label="Cerrar panel de filtros"'));
  assert.ok(source.includes("activeCount > 0"));
  assert.ok(source.includes("<span>{triggerLabel}</span>"));
  assert.ok(source.includes('<span className="sr-only">{activeCountLabel}</span>'));
  assert.ok(source.includes("<span>Cerrar</span>"));
  assert.ok(source.includes("footer ?"));
  assert.ok(source.includes("focus-visible:ring-2"));
  assert.ok(source.includes("h-dvh w-full max-w-md"));
  assertNoForbiddenSurfaceImports(source, "FilterDrawer");
  assert.equal(source.includes('from "next/link"'), false);
  assert.equal(source.includes("<Link"), false);
  assert.equal(source.includes("<a"), false);
  assert.equal(source.includes("fetch("), false);
  assert.equal(source.includes("shadow-xl"), false);
});

test("StickyFilterBar renders sticky active-filter summary and action slots", () => {
  const source = read(STICKY_FILTER_BAR_PATH);

  assert.ok(source.includes("export type ActiveFilter = {"));
  assert.ok(source.includes("label: string;"));
  assert.ok(source.includes("value: string;"));
  assert.ok(source.includes("export type StickyFilterBarProps = {"));
  assert.ok(source.includes("ariaLabel?: string;"));
  assert.ok(source.includes("activeFilters?: ActiveFilter[];"));
  assert.ok(source.includes("actions?: ReactNode;"));
  assert.ok(source.includes("drawer?: ReactNode;"));
  assert.ok(source.includes("activeFilters = [],"));
  assert.ok(source.includes('aria-label={ariaLabel ?? "Filtros del dashboard"}'));
  assert.ok(source.includes('aria-label="Filtros activos"'));
  assert.ok(source.includes('aria-live="polite"'));
  assert.ok(source.includes('role="group"'));
  assert.ok(source.includes('aria-label="Acciones de filtros"'));
  assert.ok(source.includes('data-sticky-filter-bar="true"'));
  assert.ok(source.includes("sticky top-3"));
  assert.ok(source.includes("md:top-[8.75rem]"));
  assert.ok(source.includes("activeFilters.length ?"));
  assert.ok(source.includes("activeFilters.map((filter) =>"));
  assert.ok(source.includes("<ul"));
  assert.ok(source.includes("<li"));
  assert.ok(source.includes("Sin filtros activos"));
  assert.ok(source.includes("{drawer}"));
  assert.ok(source.includes("{actions}"));
  assert.ok(source.includes("focus-visible:ring-2"));
  assertNoForbiddenSurfaceImports(source, "StickyFilterBar");
  assert.equal(source.includes('"use client"'), false);
  assert.equal(source.includes('from "next/link"'), false);
  assert.equal(source.includes("<Link"), false);
  assert.equal(source.includes("<a"), false);
  assert.equal(source.includes("fetch("), false);
  assert.equal(source.includes("shadow-xl"), false);
});

test("dashboard informes integrates drawer and sticky filter bar without changing reports behavior", () => {
  const source = read(INFORMES_PAGE_PATH);
  const mainSource = source.slice(source.indexOf('<main className="dashboard-main">'));

  assert.ok(source.includes('import { FilterDrawer } from "@/components/dashboard/FilterDrawer";'));
  assert.ok(source.includes('} from "@/components/dashboard/StickyFilterBar";'));
  assert.ok(source.includes("type ActiveFilter,"));
  assert.ok(source.includes("function buildActiveFilters(input: {"));
  assert.ok(source.includes("query: string;"));
  assert.ok(source.includes("status: string;"));
  assert.ok(source.includes("studyType: string;"));
  assert.ok(source.includes('activeFilters.push({ label: "Búsqueda", value: input.query });'));
  assert.ok(source.includes('label: "Estado"'));
  assert.ok(source.includes('label: "Tipo de estudio"'));
  assert.ok(source.includes("const activeFilters = buildActiveFilters({ query, status, studyType });"));
  assert.ok(source.includes("<StickyFilterBar"));
  assert.ok(source.includes("activeFilters={activeFilters}"));
  assert.ok(source.includes("<FilterDrawer"));
  assert.ok(source.includes('triggerLabel="Filtrar informes"'));
  assert.ok(source.includes("activeCount={activeFilters.length}"));
  assert.ok(source.includes('<form method="get"'));
  assert.ok(source.includes('name="query"'));
  assert.ok(source.includes("defaultValue={query}"));
  assert.ok(source.includes('name="status"'));
  assert.ok(source.includes("defaultValue={status}"));
  assert.ok(source.includes("<Button type=\"submit\" size=\"sm\">"));
  assert.ok(source.includes("Filtrar"));
  assert.ok(source.includes('href="/dashboard/informes"'));
  assert.ok(source.includes("Limpiar"));
  assert.ok(source.includes("pagedResult = query"));
  assert.ok(source.includes("? await searchReportsPaginated("));
  assert.ok(source.includes("query,"));
  assert.ok(source.includes("status: status || undefined,"));
  assert.ok(source.includes("studyType: studyType || undefined,"));
  assert.ok(source.includes(": await getReportsPaginated("));
  assert.ok(source.includes("requestOptions,"));
  assert.ok(source.includes("<MasterDetailWorkspace"));
  assert.ok(source.includes("<StudyTimeline steps={selectedReportTimelineSteps} />"));
  assert.ok(source.includes("<StickyActionBar"));
  assert.ok(source.includes("<ReportFileActions"));
  assert.equal(source.includes('from "next/link"'), false);
  assert.equal(source.includes("<Link"), false);
  assert.equal(source.includes("<a"), false);

  const stickyActionIndex = mainSource.indexOf("<StickyActionBar");
  const stickyFilterIndex = mainSource.indexOf("<StickyFilterBar");
  const workspaceIndex = mainSource.indexOf("<MasterDetailWorkspace");

  assert.ok(stickyActionIndex >= 0);
  assert.ok(stickyFilterIndex > stickyActionIndex);
  assert.ok(workspaceIndex > stickyFilterIndex);
});

test("PR-6 scope leaves backend auth API middleware SEO and dependencies untouched", () => {
  const changedFiles = execFileSync("git", ["diff", "--name-only"], {
    encoding: "utf8",
  })
    .split(/\r?\n/)
    .filter(Boolean);
  const blockedPrefixes = [
    "server/",
    "drizzle/",
    "frontend/src/app/api/",
    "frontend/src/middleware",
    "frontend/middleware",
  ];
  const blockedFiles = [
    "package.json",
    "pnpm-lock.yaml",
    "frontend/next-env.d.ts",
    "frontend/src/app/layout.tsx",
    "frontend/src/app/page.tsx",
    "frontend/src/lib/auth.ts",
    "frontend/src/lib/seo.ts",
  ];

  const pr4ServerFiles = ["server/db.ts", "server/routes/reports.fastify.ts"];
  for (const file of changedFiles) {
    if (pr4ServerFiles.includes(file)) continue;
    assert.equal(
      blockedPrefixes.some((prefix) => file.startsWith(prefix)),
      false,
      `${file} is outside PR-6 frontend dashboard scope`,
    );
    assert.equal(
      blockedFiles.includes(file),
      false,
      `${file} must not be modified by PR-6`,
    );
  }
});

test("PR-6 documentation records decisions validations and residual risk", () => {
  const source = read(DOC_PATH);

  assert.ok(source.includes("# PR-6"));
  assert.ok(source.includes("## Resumen"));
  assert.ok(source.includes("## Archivos modificados"));
  assert.ok(source.includes("## Componentes creados"));
  assert.ok(source.includes("## Decisiones tecnicas"));
  assert.ok(source.includes("## Filtros y query params"));
  assert.ok(source.includes("## Validaciones"));
  assert.ok(source.includes("## Riesgos residuales"));
  assert.ok(source.includes("## Confirmacion de scope"));
  assert.ok(source.includes("FilterDrawer"));
  assert.ok(source.includes("StickyFilterBar"));
  assert.ok(source.includes("/dashboard/informes"));
});
