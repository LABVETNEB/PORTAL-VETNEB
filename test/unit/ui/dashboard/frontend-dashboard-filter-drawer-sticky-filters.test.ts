import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { isClean7aAllowedDependencyChange } from "../../../helpers/clean7a-dependency-cleanup-scope.ts";
import { isReportForeignAccessBackendFile } from "../../../helpers/report-foreign-access-scope.ts";
import { dashboardScopeGuardApplies } from "../../../helpers/dashboard-scope-guard.ts";

const FILTER_BAR_PATH = "frontend/src/components/dashboard/FilterBar.tsx";
const INFORMES_PAGE_PATH = "frontend/src/app/dashboard/informes/page.tsx";
const DOC_PATH = "docs/audit/pr-vis-6-implementation.md";
const PUBLIC_SEO_SCOPE_EXCEPTION = "frontend/src/lib/seo.ts";

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

test("dashboard informes uses compact inline filters without drawer sticky overlap", () => {
  const source = read(INFORMES_PAGE_PATH);

  assert.equal(source.includes('import { FilterDrawer } from "@/components/dashboard/FilterDrawer";'), false);
  assert.equal(source.includes('} from "@/components/dashboard/StickyFilterBar";'), false);
  assert.equal(source.includes("<StickyFilterBar"), false);
  assert.equal(source.includes("<FilterDrawer"), false);
  assert.equal(source.includes('triggerLabel="Filtrar informes"'), false);
  assert.ok(source.includes("<FilterBar"));
  assert.ok(source.includes("<FilterField"));
  assert.ok(source.includes('density="module-card"'));
  assert.ok(source.includes('dashboardFilterControlClassName("module-card")'));
  assert.ok(source.includes('method="get"'));
  assert.ok(source.includes('name="query"'));
  assert.ok(source.includes("defaultValue={query}"));
  assert.ok(source.includes('name="status"'));
  assert.ok(source.includes("defaultValue={status}"));
  assert.ok(source.includes('dashboardFilterActionClassName("module-card")'));
  assert.ok(source.includes('title="Filtros de informes"'));
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
  assert.equal(source.includes("<StickyActionBar"), false);
  assert.equal(source.includes('from "next/link"'), false);
  assert.equal(source.includes("<Link"), false);
  assert.equal(source.includes("<a"), false);

  const listSource = read(
    "frontend/src/app/dashboard/informes/InformesReportsList.tsx",
  );
  assert.ok(listSource.includes("<StudyTimeline steps={selectedReportTimelineSteps} />"));
  assert.ok(listSource.includes("<ReportFileActions"));
});

test("PR-VIS-6 FilterBar exposes shared dashboard filter field contract", () => {
  const source = read(FILTER_BAR_PATH);

  assert.ok(source.includes('export type FilterBarDensity = "comfortable" | "compact" | "module-card";'));
  assert.ok(source.includes("export type FilterBarProps = FormHTMLAttributes<HTMLFormElement>"));
  assert.ok(source.includes("export type FilterFieldProps = LabelHTMLAttributes<HTMLLabelElement>"));
  assert.ok(source.includes('data-dashboard-filter-bar="true"'));
  assert.ok(source.includes("data-dashboard-filter-density={density}"));
  assert.ok(source.includes("dashboardFilterControlClassName("));
  assert.ok(source.includes('density === "module-card" ? "h-9" : "h-10"'));
  assert.ok(source.includes("dashboardFilterActionClassName("));
  assert.ok(source.includes("h-10 min-h-10"));
  assert.ok(source.includes("FilterField"));
  assert.ok(source.includes("labelHidden"));
  assert.ok(source.includes('from "@/components/ui/label";'));
  assertNoForbiddenSurfaceImports(source, "FilterBar");
});

test("PR-6 scope leaves backend auth API middleware SEO and dependencies untouched", () => {
  const changedFiles = execFileSync("git", ["diff", "--name-only"], {
    encoding: "utf8",
  })
    .split(/\r?\n/)
    .filter(Boolean);
  // PR-specific guard: only enforce when the diff touches dashboard scope.
  if (!dashboardScopeGuardApplies(changedFiles)) return;
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
    "frontend/src/lib/auth.ts",
    "frontend/src/lib/seo.ts",
  ];

  const pr4ServerFiles = [
    "server/db.ts",
    "server/routes/reports.fastify.ts",
    "server/routes/contact.fastify.ts",
  ];
  for (const file of changedFiles) {
    if (isClean7aAllowedDependencyChange(file)) continue;
    if (isReportForeignAccessBackendFile(file)) continue;
    if (pr4ServerFiles.includes(file)) continue;
    // Exact shared public SEO exception: this PR intentionally updates
    // OpenGraph/Twitter metadata without changing dashboard behavior.
    if (file === PUBLIC_SEO_SCOPE_EXCEPTION) continue;
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

test("PR-VIS-6 documentation records decisions validations and residual risk", () => {
  const source = read(DOC_PATH);

  assert.ok(source.includes("# PR-VIS-6 implementation report"));
  assert.ok(source.includes("## Scope exacto detectado"));
  assert.ok(source.includes("## Criterio de razonamiento usado"));
  assert.ok(source.includes("## Archivos modificados"));
  assert.ok(source.includes("## Tokens/contratos visuales usados"));
  assert.ok(source.includes("## Componentes/primitivas usadas"));
  assert.ok(source.includes("## Validaciones ejecutadas"));
  assert.ok(source.includes("## Riesgos residuales"));
  assert.ok(source.includes("FilterBar"));
  assert.ok(source.includes("FilterDrawer"));
  assert.ok(source.includes("StickyFilterBar"));
  assert.ok(source.includes("/dashboard/informes"));
});
