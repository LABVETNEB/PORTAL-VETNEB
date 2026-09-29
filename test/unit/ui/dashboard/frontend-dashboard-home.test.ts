import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
import { readSourceFile as read } from "../../../helpers/tracked-source-files.ts";

const DASHBOARD_PAGE_PATH = "frontend/src/app/dashboard/page.tsx";
const CLINIC_COMMAND_CENTER_PATH = "frontend/src/app/dashboard/ClinicCommandCenter.tsx";
const CLINIC_INFORMES_SUMMARY_PATH =
  "frontend/src/app/dashboard/ClinicInformesWorkspaceSummary.tsx";
const CLINIC_LOGISTICA_SUMMARY_PATH =
  "frontend/src/app/dashboard/ClinicLogisticaWorkspaceSummary.tsx";
const HOME_LOAD_FLAGS = [
  ["statsLoadError", "getDashboardStats"],
  ["reportsLoadError", "getReports"],
  ["visitsLoadError", "getLogisticsFieldVisits"],
] as const;
const HOME_FLAG_CONSUMERS = [
  ["ClinicCommandCenter", "statsLoadError"],
  ["ClinicCommandCenter", "reportsLoadError"],
  ["ClinicCommandCenter", "visitsLoadError"],
  ["ClinicInformesWorkspaceSummary", "reportsLoadError"],
  ["ClinicLogisticaWorkspaceSummary", "visitsLoadError"],
] as const;

function parseTsx(source: string, fileName: string): ts.SourceFile {
  const file = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const diagnostics: unknown = Reflect.get(file, "parseDiagnostics");

  if (!Array.isArray(diagnostics) || diagnostics.length > 0) {
    throw new Error(`${fileName} does not parse`);
  }

  return file;
}

function descendants<T extends ts.Node>(
  root: ts.Node,
  match: (node: ts.Node) => node is T,
): T[] {
  const found: T[] = [];
  const visit = (node: ts.Node): void => {
    if (match(node)) found.push(node);
    ts.forEachChild(node, visit);
  };

  visit(root);
  return found;
}

function unwrap(expression: ts.Expression): ts.Expression {
  let current = expression;

  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isNonNullExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isTypeAssertionExpression(current)
  ) {
    current = current.expression;
  }

  return current;
}

type SourceFunction = ts.FunctionDeclaration & { readonly body: ts.Block };

function exportedFunction(file: ts.SourceFile, name: string): SourceFunction {
  const matches = file.statements.filter(
    (statement): statement is SourceFunction =>
      ts.isFunctionDeclaration(statement) &&
      statement.name?.text === name &&
      statement.body !== undefined &&
      (ts.getCombinedModifierFlags(statement) & ts.ModifierFlags.Export) !== 0,
  );

  if (matches.length !== 1) {
    throw new Error(`${name}: expected one exported declaration, found ${matches.length}`);
  }

  return matches[0];
}

type JsxNode = ts.JsxElement | ts.JsxSelfClosingElement;

type AttributeValue =
  | { readonly kind: "absent" | "unknown" | "shorthand" }
  | { readonly kind: "value"; readonly expression: ts.Expression };

// JSX semantics: a later attribute or spread overrides an earlier one; a spread
// the oracle cannot read makes the value unknown instead of silently absent.
function effectiveAttribute(element: JsxNode, name: string): AttributeValue {
  const opening = ts.isJsxElement(element) ? element.openingElement : element;
  let value: AttributeValue = { kind: "absent" };

  for (const attribute of opening.attributes.properties) {
    if (ts.isJsxAttribute(attribute)) {
      if (attribute.name.getText() !== name) continue;

      const initializer = attribute.initializer;
      value = !initializer
        ? { kind: "shorthand" }
        : ts.isStringLiteral(initializer)
          ? { kind: "value", expression: initializer }
          : ts.isJsxExpression(initializer) && initializer.expression
            ? { kind: "value", expression: initializer.expression }
            : { kind: "unknown" };
      continue;
    }

    const spread = unwrap(attribute.expression);

    if (!ts.isObjectLiteralExpression(spread)) {
      value = { kind: "unknown" };
      continue;
    }

    for (const property of spread.properties) {
      const key =
        !ts.isSpreadAssignment(property) &&
        (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))
          ? property.name.text
          : undefined;

      if (key === undefined) {
        value = { kind: "unknown" };
      } else if (key === name) {
        value = ts.isPropertyAssignment(property)
          ? { kind: "value", expression: property.initializer }
          : ts.isShorthandPropertyAssignment(property)
            ? { kind: "value", expression: property.name }
            : { kind: "unknown" };
      }
    }
  }

  return value;
}

function writesTo(node: ts.Node, name: string): boolean {
  if (ts.isBinaryExpression(node)) {
    const left = unwrap(node.left);

    return (
      node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      node.operatorToken.kind <= ts.SyntaxKind.LastAssignment &&
      ts.isIdentifier(left) &&
      left.text === name
    );
  }

  return (
    (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
    (node.operator === ts.SyntaxKind.PlusPlusToken ||
      node.operator === ts.SyntaxKind.MinusMinusToken) &&
    ts.isIdentifier(node.operand) &&
    node.operand.text === name
  );
}

function callsTo(root: ts.Node, callee: string): ts.CallExpression[] {
  return descendants(root, ts.isCallExpression).filter(
    (call) => ts.isIdentifier(call.expression) && call.expression.text === callee,
  );
}

// Only blocks, the try block, `await Promise.all([...])` and immediately
// invoked async functions may sit between the page body and the guarded fetch.
function unconditionallyReached(node: ts.Node, body: ts.Block): boolean {
  let child = node;

  for (let parent = node.parent; child !== body; child = parent, parent = parent.parent) {
    if (!parent || ts.isSourceFile(parent)) return false;

    if (ts.isArrowFunction(parent) || ts.isFunctionExpression(parent)) {
      const call = ts.isParenthesizedExpression(parent.parent) ? parent.parent.parent : parent.parent;
      if (!ts.isCallExpression(call) || unwrap(call.expression) !== parent) return false;
    } else if (ts.isCallExpression(parent)) {
      const invoked = unwrap(parent.expression);
      const iife =
        (ts.isArrowFunction(invoked) || ts.isFunctionExpression(invoked)) &&
        child === parent.expression;
      const fanOut =
        parent.expression.getText() === "Promise.all" && parent.arguments.some((arg) => arg === child);
      if (!iife && !fanOut) return false;
    } else if (!(
      ts.isBlock(parent) ||
      (ts.isTryStatement(parent) && parent.tryBlock === child) ||
      ts.isParenthesizedExpression(parent) ||
      ts.isArrayLiteralExpression(parent) ||
      ts.isAwaitExpression(parent) ||
      ts.isExpressionStatement(parent)
    )) {
      return false;
    }
  }

  return true;
}

// The load-error flag starts false, has exactly one write, and that write is an
// unconditional `flag = true` of the catch guarding the page's only calls to
// its fetchers, which the page always executes.
function failureFlagViolations(
  source: string,
  fileName: string,
  page: string,
  fetchers: readonly string[],
  flag: string,
): string[] {
  const file = parseTsx(source, fileName);
  const body = exportedFunction(file, page).body;
  const violations: string[] = [];
  const declarations = descendants(file, ts.isVariableDeclaration).filter(
    (declaration) => ts.isIdentifier(declaration.name) && declaration.name.text === flag,
  );
  const [declaration] = declarations;

  if (
    declarations.length !== 1 ||
    declaration.initializer?.kind !== ts.SyntaxKind.FalseKeyword ||
    (declaration.parent.flags & ts.NodeFlags.Let) === 0 ||
    declaration.parent.parent.parent !== body
  ) {
    violations.push(`${flag}: expected a single \`let ${flag} = false\` in ${page}`);
  }

  const writes = descendants(file, (node): node is ts.Expression => writesTo(node, flag));
  const [write] = writes;

  if (writes.length !== 1 || !ts.isBinaryExpression(write)) {
    violations.push(`${flag}: expected exactly one write, found ${writes.length}`);
    return violations;
  }

  if (unwrap(write.right).kind !== ts.SyntaxKind.TrueKeyword) {
    violations.push(`${flag}: its write does not set true`);
  }

  const statement = write.parent;
  const block = statement.parent;

  if (!ts.isExpressionStatement(statement) || !ts.isBlock(block) || !ts.isCatchClause(block.parent)) {
    violations.push(`${flag} = true is not an unconditional statement of a catch block`);
    return violations;
  }

  const preceding = block.statements.slice(0, block.statements.indexOf(statement));
  if (preceding.some((earlier) => !ts.isExpressionStatement(earlier))) {
    violations.push(`${flag}: the catch block can leave before flagging`);
  }

  const guarded = block.parent.parent;
  for (const fetcher of fetchers) {
    if (callsTo(guarded.tryBlock, fetcher).length !== 1 || callsTo(body, fetcher).length !== 1) {
      violations.push(`${flag}: ${fetcher} is not called once, inside the try it guards`);
    }
  }

  if (!unconditionallyReached(guarded, body)) {
    violations.push(`${flag}: ${page} does not always run the guarded fetch`);
  }

  return violations;
}

function jsxElements(root: ts.Node): JsxNode[] {
  return descendants(
    root,
    (node): node is JsxNode => ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node),
  );
}

function tagName(element: JsxNode): string {
  return (ts.isJsxElement(element) ? element.openingElement : element).tagName.getText();
}

// TEST-GLOBAL-07 (G06-D05): each load flag is raised by the catch of its own
// fetch and reaches its consumer. The literal `statsLoadError = true;` stays
// present under `if (false)` (C.15.1 M-D04), so presence proves nothing.
function homeLoadFlags(source: string) {
  const elements = jsxElements(parseTsx(source, DASHBOARD_PAGE_PATH));

  return {
    violations: HOME_LOAD_FLAGS.flatMap(([flag, fetcher]) =>
      failureFlagViolations(source, DASHBOARD_PAGE_PATH, "DashboardPage", [fetcher], flag),
    ),
    wiring: HOME_FLAG_CONSUMERS.map(([tag, flag]) => {
      const consumers = elements.filter((element) => tagName(element) === tag);
      const value = consumers.length === 1 ? effectiveAttribute(consumers[0], flag) : undefined;

      return value?.kind === "value"
        ? `${tag}.${flag}=${unwrap(value.expression).getText()}`
        : `${tag}.${flag} unwired`;
    }),
  };
}

function sectionBetween(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `Missing start marker: ${start}`);

  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `Missing end marker: ${end}`);

  return source.slice(startIndex, endIndex);
}

test("dashboard home defines non-indexable clinic metadata and imports live dependencies", () => {
  const source = read(DASHBOARD_PAGE_PATH);

  assert.ok(source.includes('import type { Metadata } from "next";'));
  assert.ok(source.includes('import { cookies } from "next/headers";'));
  assert.ok(source.includes('title: "Dashboard Clínica — Portal VETNEB"'));
  assert.ok(source.includes("robots: { index: false, follow: false },"));
  // B10: the shell chrome (topbar + navigation frame + main) has one owner for
  // all six clinic routes, so the route imports the shell, not the topbar.
  assert.ok(source.includes('import { ClinicDashboardShell } from "@/components/dashboard/ClinicDashboardShell";'));
  assert.equal(
    source.includes('import { DashboardTopbar } from "@/components/dashboard/DashboardTopbar";'),
    false,
  );
  // No home/hub: the clinic dashboard no longer imports the landing
  // DashboardPageHeader band; it opens straight into the workspace controller.
  assert.equal(
    source.includes('import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";'),
    false,
  );
  assert.ok(
    source.includes('ClinicDashboardWorkspaceController') &&
      source.includes('@/components/dashboard/ClinicDashboardWorkspaceController'),
  );
  // The default operational module is resolved on the server render.
  assert.ok(source.includes('DEFAULT_CLINIC_MODULE'));
  assert.ok(source.includes('import { ClinicCommandCenter } from "./ClinicCommandCenter";'));
  assert.ok(source.includes('import { ClinicParticularTokensCard } from "@/components/dashboard/ClinicParticularTokensCard";'));
});

test("dashboard home forwards cookies and disables cache for backend reads", () => {
  const source = read(DASHBOARD_PAGE_PATH);

  assert.ok(source.includes("async function getDashboardRequestOptions(): Promise<RequestInit>"));
  assert.ok(source.includes("const cookieHeader = (await cookies()).toString();"));
  assert.ok(source.includes('cache: "no-store"'));
  assert.ok(source.includes("headers: cookieHeader ? { Cookie: cookieHeader } : {},"));
});

test("dashboard home reads stats reports and field visits through API helpers", () => {
  const source = read(DASHBOARD_PAGE_PATH);

  assert.ok(source.includes("export default async function DashboardPage("));
  assert.ok(source.includes("const requestOptions = await getDashboardRequestOptions();"));
  assert.ok(source.includes("let stats: Awaited<ReturnType<typeof getDashboardStats>> | null = null;"));
  assert.ok(source.includes("let statsLoadError = false;"));
  assert.ok(source.includes("stats = await getDashboardStats(requestOptions);"));
  assert.ok(source.includes("statsLoadError = true;"));
  assert.ok(source.includes("let reports: Awaited<ReturnType<typeof getReports>> = [];"));
  assert.ok(source.includes("let reportsLoadError = false;"));
  assert.ok(source.includes("let visits: Awaited<ReturnType<typeof getLogisticsFieldVisits>> = [];"));
  assert.ok(source.includes("let visitsLoadError = false;"));
  assert.ok(source.includes("await Promise.all(["));
  // Zero-scroll adaptive density (A03): the workspace summaries paginate a
  // hermetic superset client-side. The fetch window is a NAMED constant and is
  // never a page size; the previous window of 24 sat below the largest measured
  // canvas and truncated the second page on tall viewports (audit §20.4).
  assert.ok(
    source.includes("const CLINIC_DASHBOARD_ADAPTIVE_SUPERSET_LIMIT = 100;"),
    "the fetch window must be a named constant, not an inline literal",
  );
  assert.ok(
    source.includes("limit: CLINIC_DASHBOARD_ADAPTIVE_SUPERSET_LIMIT,"),
    "getReports must fetch through the named superset constant",
  );
  assert.ok(source.includes("getLogisticsFieldVisits(requestOptions, {"));
  assert.ok(source.includes("throwOnError: true,"));

  // The adaptive consumers receive their collections whole: any pre-pagination
  // cap here competes with `useAdaptiveRowsPerPage`, which owns the page size.
  assert.ok(source.includes("const recentReports = reports;"));
  assert.ok(source.includes("const recentVisits = visits;"));
  assert.ok(
    !/const recentReports = reports\.slice\(/.test(source),
    "recentReports must not be truncated before the adaptive summary pages it",
  );
  assert.ok(
    !/const recentVisits = visits\.slice\(/.test(source),
    "recentVisits must not be truncated before the adaptive summary pages it",
  );
  assert.ok(
    !/\.slice\(0,\s*24\)/.test(source),
    "the 24-item cap must not reappear anywhere in the clinic dashboard page",
  );
  assert.ok(
    !/limit:\s*24\b/.test(source),
    "the 24-item fetch window must not reappear",
  );

  // The compact operational summary of ClinicCommandCenter is a DIFFERENT,
  // non-normative surface for §20 rows 11 and 12: its 3-row slices stay.
  assert.ok(source.includes("recentReports={recentReports.slice(0, 3)}"));
  assert.ok(source.includes("recentVisits={recentVisits.slice(0, 3)}"));

  const wired = HOME_FLAG_CONSUMERS.map(([tag, flag]) => `${tag}.${flag}=${flag}`);
  assert.deepEqual(homeLoadFlags(source), { violations: [], wiring: wired });

  const neverRaised = source.replace("statsLoadError = true;", () => "if (false)\nstatsLoadError = true;");
  assert.notEqual(neverRaised, source);
  assert.deepEqual(homeLoadFlags(neverRaised), {
    violations: ["statsLoadError = true is not an unconditional statement of a catch block"],
    wiring: wired,
  });
});

test("dashboard home opens the unified module workspace (no hub header/cards)", () => {
  const source = read(DASHBOARD_PAGE_PATH);

  assert.ok(source.includes('<ClinicDashboardShell'));
  assert.ok(source.includes('title="Dashboard Clínica"'));
  assert.ok(source.includes('subtitle="Portal operativo clínica"'));
  // B10: the clinic notification role is declared once, by the shared shell.
  assert.equal(source.includes('notifications="clinic"'), false);
  // No home/hub: no landing page-header band and no "Módulos clínicos" grid.
  assert.equal(source.includes('<DashboardPageHeader'), false);
  assert.equal(source.includes('Módulos clínicos'), false);
  assert.equal(source.includes('Resumen operativo'), false);
  // The unified workspace controller mounts directly and receives every module
  // slot (operaciones/informes/logística/perfil/tokens) it can activate.
  assert.ok(source.includes('<ClinicDashboardWorkspaceController'));
  assert.ok(source.includes('initialModule={initialModule}'));
  assert.ok(source.includes('<ClinicCommandCenter'));
  assert.ok(source.includes('stats={stats}'));
  assert.ok(source.includes('statsLoadError={statsLoadError}'));
  assert.ok(source.includes('recentReports={recentReports}'));
  assert.ok(source.includes('recentVisits={recentVisits}'));
  assert.ok(source.includes('reportsLoadError={reportsLoadError}'));
  assert.ok(source.includes('visitsLoadError={visitsLoadError}'));
  assert.ok(source.includes('<ClinicInformesWorkspaceSummary'));
  assert.ok(source.includes('<ClinicLogisticaWorkspaceSummary'));
  assert.ok(source.includes('<ClinicPublicProfileCard />'));
  assert.ok(source.includes('<ClinicParticularTokensCard />'));
  assert.equal(
    source.includes("Lectura conectada a datos operativos clinic-" + "scoped"),
    false,
  );
});

test("dashboard home page layout order: main before workspace controller before module slots", () => {
  const source = read(DASHBOARD_PAGE_PATH);

  // B10: `main` is owned by ClinicDashboardShell, so the route's ordering
  // anchor is the shell mount — the element that now opens the main region.
  const mainIndex = source.indexOf('<ClinicDashboardShell');
  const workspaceControllerIndex = source.indexOf('<ClinicDashboardWorkspaceController');
  const commandCenterIndex = source.indexOf('<ClinicCommandCenter');
  const clinicPublicIndex = source.indexOf('<ClinicPublicProfileCard />');

  assert.ok(mainIndex >= 0);
  assert.ok(workspaceControllerIndex >= 0);
  assert.ok(commandCenterIndex >= 0);
  assert.ok(clinicPublicIndex >= 0);
  // No home/hub: the controller mounts right inside <main>, and the module
  // slots (operaciones command center, then profile) follow it. There is no
  // intermediate DashboardPageHeader band.
  assert.equal(source.includes('<DashboardPageHeader'), false);
  assert.ok(mainIndex < workspaceControllerIndex);
  assert.ok(workspaceControllerIndex < commandCenterIndex);
  assert.ok(commandCenterIndex < clinicPublicIndex);
});

test("dashboard home clinic command center receives all required data props", () => {
  const source = read(DASHBOARD_PAGE_PATH);

  assert.ok(source.includes('import { ClinicCommandCenter } from "./ClinicCommandCenter";'));
  assert.ok(source.includes('<ClinicCommandCenter'));
  assert.ok(source.includes('stats={stats}'));
  assert.ok(source.includes('statsLoadError={statsLoadError}'));
  assert.ok(source.includes('recentReports={recentReports}'));
  assert.ok(source.includes('recentVisits={recentVisits}'));
  assert.ok(source.includes('reportsLoadError={reportsLoadError}'));
  assert.ok(source.includes('visitsLoadError={visitsLoadError}'));
});

test("dashboard home clinic command center presentational props contain operational section strings", () => {
  const source = read(CLINIC_COMMAND_CENTER_PATH);

  assert.ok(source.includes("ModuleCardSections"));
  // B14 relocated the permanent operational-priority banner (pending reports
  // + active visits KPIs) out of a standing toolbar and into the existing
  // "Estado" tab's attention panel; the same stats-derived messaging survives
  // there instead of a static "Estado operativo clínica" heading.
  assert.ok(source.includes('data-clinic-command-attention="true"'));
  assert.ok(source.includes("Atención requerida"));
  assert.ok(source.includes("informe(s) pendiente(s) de entrega."));
  assert.ok(source.includes("visita(s) de campo activa(s) en curso."));
  assert.ok(source.includes("Sin pendientes operativos detectados."));
  assert.ok(source.includes("<ModuleMetricRun"));
  assert.ok(source.includes("Informes recientes"));
  assert.ok(source.includes("Visitas de campo"));
  assert.ok(source.includes("reportsLoadError ?"));
  assert.ok(source.includes("visitsLoadError ?"));
  assert.ok(source.includes("No se pudieron cargar los informes recientes. Intente nuevamente."));
  assert.ok(source.includes("No se pudieron cargar las visitas de campo recientes. Intente nuevamente."));
  assert.ok(source.includes('role="alert"'));
  assert.ok(source.includes("No hay informes recientes disponibles."));
  assert.ok(source.includes("No hay visitas de campo recientes disponibles."));
});

test("clinic informes summary uses table/list row actions with controlled detail dialog", () => {
  const source = read(CLINIC_INFORMES_SUMMARY_PATH);

  assert.ok(source.includes('"use client";'));
  assert.ok(source.includes("ModuleCard"));
  assert.ok(source.includes("useState"));
  assert.ok(source.includes('data-clinic-reports-table="true"'));
  assert.ok(source.includes('data-clinic-reports-mobile-list="true"'));
  assert.ok(source.includes('data-clinic-reports-detail-dialog="true"'));
  assert.ok(source.includes("ReportFileActions"));
  assert.ok(source.includes("Ver"));
  assert.ok(source.includes("Abrir módulo completo"));
  assert.equal(source.includes("dashboard-inline-list"), false);
  assert.equal(source.includes("dashboard-inline-scroll"), false);
  assert.equal(source.includes("dashboard-inline-detail"), false);
  assert.equal(source.includes("aria-expanded={isSelected}"), false);
  assert.equal(source.includes('data-detail-state="selected"'), false);
  assert.equal(source.includes("isMobileDetailOpen"), false);
  assert.equal(source.includes("Volver a la lista"), false);
  assert.equal(source.includes('xl:grid-cols-[0.85fr_1.15fr]'), false);
  assert.equal(source.includes("space-y-4"), false);
});

test("clinic informes summary exposes advanced filters over visible report fields", () => {
  const source = read(CLINIC_INFORMES_SUMMARY_PATH);
  const filterForm = sectionBetween(
    source,
    "data-clinic-report-filter-bar",
    "</FilterBar>",
  );

  assert.ok(source.includes("type ClinicReportsFilterState = {"));
  assert.ok(source.includes("report: string;"));
  assert.ok(source.includes("patient: string;"));
  assert.ok(source.includes('status: "" | Report["status"];'));
  assert.ok(source.includes("study: string;"));
  assert.ok(source.includes("file: string;"));
  assert.ok(source.includes("from: string;"));
  assert.ok(source.includes("to: string;"));
  assert.ok(source.includes("matchesClinicReportFilters(report, appliedFilters)"));
  assert.ok(source.includes("matchesUploadDateRange(report, filters.from, filters.to)"));
  assert.ok(source.includes("const filteredReports = recentReports.filter((report) =>"));
  assert.ok(source.includes('import { useDashboardCanvasCapacity } from "@/hooks/useDashboardCanvasCapacity";'));
  assert.ok(source.includes("const REPORTS_PAGE_SIZE = 3;"));
  assert.ok(source.includes("const { capacity: rowsPerPage } = useDashboardCanvasCapacity({"));
  assert.ok(source.includes("canvasNode: reportsListBodyNode,"));
  assert.ok(source.includes("fallbackItems: REPORTS_PAGE_SIZE,"));
  assert.equal(source.includes("rowHeightPx"), false);
  // FASE D: this canvas paints its <table>/<thead> only from `md` up, so it
  // reserves the head only there. Both halves are asserted — the collapsing
  // tier is present AND the unconditional one is gone. A substring check on
  // "table-head" alone would keep accepting the phantom-reserve regression
  // this migration retired, because it is a prefix of the new value.
  assert.ok(
    source.includes('data-dashboard-canvas-reserve="table-head-above-md"'),
  );
  assert.equal(
    source.includes('data-dashboard-canvas-reserve="table-head"'),
    false,
  );
  assert.ok(source.includes("usePagedRows(filteredReports, rowsPerPage)"));
  assert.equal(source.includes("usePagedRows(filteredReports, REPORTS_PAGE_SIZE)"), false);
  assert.equal(source.includes("matchMedia"), false);
  assert.ok(source.includes('data-clinic-report-filter-bar={mobile ? "advanced-mobile" : "advanced"}'));
  assert.ok(source.includes('data-clinic-reports-list-body="true"'));
  assert.ok(source.includes("FilterBar,"));
  assert.ok(source.includes("FilterField,"));
  assert.ok(source.includes("dashboardFilterControlClassName(density)"));
  assert.ok(source.includes("dashboardFilterActionClassName(density)"));
  assert.ok(source.includes('title="Filtrar informes"'));
  assert.ok(source.includes("Sin informes para los filtros aplicados"));

  for (const label of [
    "Informe",
    "Paciente",
    "Estado",
    "Estudio",
    "Archivo",
    "Desde",
    "Hasta",
    "Aplicar",
    "Limpiar",
  ]) {
    assert.ok(filterForm.includes(label), `missing ${label} filter control`);
  }
});

test("clinic logistica summary uses compact list with controlled detail dialog", () => {
  const source = read(CLINIC_LOGISTICA_SUMMARY_PATH);

  assert.ok(source.includes('"use client";'));
  assert.ok(source.includes("ModuleCard"));
  assert.ok(source.includes("ModuleDialog"));
  assert.ok(source.includes("useState"));
  assert.ok(source.includes('data-clinic-logistics-list-panel="true"'));
  assert.ok(source.includes('data-clinic-logistics-list-body="true"'));
  assert.ok(source.includes('data-clinic-logistics-row="true"'));
  assert.ok(source.includes('data-clinic-logistics-detail-dialog="true"'));
  assert.equal(source.includes("dashboard-inline-scroll"), false);
  assert.equal(source.includes("dashboard-inline-detail"), false);
  assert.equal(source.includes("aria-expanded={isSelected}"), false);
  assert.equal(source.includes('data-detail-state="selected"'), false);
});

test("dashboard home keeps status badge and date formatting in clinic command center", () => {
  const source = read(CLINIC_COMMAND_CENTER_PATH);

  assert.ok(source.includes('import { StatusBadge } from "@/components/dashboard/StatusBadge";'));
  assert.ok(source.includes("status={report.status}"));
  assert.ok(source.includes("status={visit.status}"));
  assert.ok(source.includes('import { formatDate } from "@/lib/utils";'));
  assert.ok(source.includes("formatDate(report.uploadDate)"));
  assert.ok(source.includes("formatDate(visit.scheduledAt)"));
});

test("dashboard home no longer contains quick action tiles or horizontal nav removed in prior PR", () => {
  const source = read(DASHBOARD_PAGE_PATH);
  const quickActionsTitle = ["Accesos", "rápidos"].join(" ");
  const removedSnippets = [
    quickActionsTitle,
    'label: "Informes", href: ROUTES.dashboardInformes',
    `xl:grid-cols-${5}`,
  ];

  for (const snippet of removedSnippets) {
    assert.equal(source.includes(snippet), false);
  }
});
