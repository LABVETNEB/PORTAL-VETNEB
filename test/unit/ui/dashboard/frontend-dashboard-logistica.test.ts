import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
import { readSourceFile as read } from "../../../helpers/tracked-source-files.ts";

const LOGISTICA_PAGE_PATH = "frontend/src/app/dashboard/logistica/page.tsx";
const ACTIVE = { activeVisits: ["scheduled", "in_progress"], activePlans: ["released", "in_progress"] };

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

const EVALUATION_GLOBALS = new Set(["undefined", "Array", "Boolean"]);

// Runs a side-effect-free source expression with exactly the given bindings; a
// free name the test did not bind fails instead of resolving to a global.
function evaluate(expression: ts.Expression, scope: Readonly<Record<string, unknown>>): unknown {
  const names = Object.keys(scope);
  const declared = new Set(
    descendants(expression, ts.isParameter).flatMap((parameter) =>
      descendants(parameter.name, ts.isIdentifier).map((identifier) => identifier.text),
    ),
  );
  const unbound = descendants(expression, ts.isIdentifier).filter((identifier) => {
    const parent = identifier.parent;

    if (
      (ts.isPropertyAccessExpression(parent) || ts.isPropertyAssignment(parent)) &&
      parent.name === identifier
    ) {
      return false;
    }

    for (let node: ts.Node = identifier; node !== expression; node = node.parent) {
      if (ts.isTypeNode(node)) return false;
    }

    const name = identifier.text;
    return !declared.has(name) && !EVALUATION_GLOBALS.has(name) && !names.includes(name);
  });

  if (unbound.length > 0) {
    throw new Error(`unbound in ${expression.getText()}: ${unbound.map((id) => id.text).join(", ")}`);
  }

  const { outputText } = ts.transpileModule(`(${expression.getText()});`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  });
  const run = new Function(...names, `return ${outputText}`) as (...values: unknown[]) => unknown;

  return run(...names.map((name) => scope[name]));
}

const TYPES_PATH = "frontend/src/types/index.ts";

function literalTuple(name: string): string[] {
  const [declaration] = descendants(
    parseTsx(read(TYPES_PATH), TYPES_PATH),
    ts.isVariableDeclaration,
  ).filter((candidate) => candidate.name.getText() === name);
  const tuple = declaration?.initializer ? unwrap(declaration.initializer) : undefined;

  if (!tuple || !ts.isArrayLiteralExpression(tuple)) {
    throw new Error(`${name}: not a literal tuple`);
  }

  return tuple.elements.map((element) => {
    if (!ts.isStringLiteral(element)) throw new Error(`${name}: non-literal status`);
    return element.text;
  });
}

// Runs the `filter` predicate that defines each "active" collection over every
// status its type admits.
function activeStatuses(source: string, fileName: string) {
  const declarations = descendants(parseTsx(source, fileName), ts.isVariableDeclaration);
  const filtered = (variable: string, collection: string, statuses: readonly string[]) => {
    const matches = declarations.filter((declaration) => declaration.name.getText() === variable);
    const call =
      matches.length === 1 && matches[0].initializer ? unwrap(matches[0].initializer) : undefined;

    if (
      !call ||
      !ts.isCallExpression(call) ||
      call.expression.getText() !== `${collection}.filter` ||
      call.arguments.length !== 1
    ) {
      return `${variable}: not a single ${collection}.filter(predicate)`;
    }

    const predicate = evaluate(call.arguments[0], {});

    return typeof predicate === "function"
      ? statuses.filter((status) => Boolean(predicate({ status })))
      : `${variable}: predicate is not callable`;
  };

  return {
    activeVisits: filtered("activeVisits", "fieldVisits", literalTuple("FIELD_VISIT_STATUSES")),
    activePlans: filtered("activePlans", "routePlans", literalTuple("ROUTE_PLAN_STATUSES")),
  };
}

// TEST-GLOBAL-07 (G06-D11): the predicates are executed, not read. The literal
// `v.status === "in_progress" || v.status === "scheduled"` survives a
// short-circuit prepended to the arrow (C.15.1 M-D09).

test("dashboard logistica defines non-indexable metadata and dependencies", () => {
  const source = read(LOGISTICA_PAGE_PATH);

  assert.ok(source.includes('import type { Metadata } from "next";'));
  assert.ok(source.includes('import { cookies } from "next/headers";'));
  assert.ok(source.includes('title: "Logística — Portal VETNEB"'));
  assert.ok(source.includes("robots: { index: false, follow: false },"));
  // B10: the shell chrome (topbar + navigation frame + main) has one owner for
  // all six clinic routes, so the route imports the shell, not the topbar.
  assert.ok(source.includes('import { ClinicDashboardShell } from "@/components/dashboard/ClinicDashboardShell";'));
  assert.equal(
    source.includes('import { DashboardTopbar } from "@/components/dashboard/DashboardTopbar";'),
    false,
  );
  assert.ok(source.includes('import { ClinicFullRouteModuleStage } from "@/components/dashboard/ClinicFullRouteModuleStage";'));
  assert.ok(source.includes('import { PublicRouteControl } from "@/components/public/PublicRouteControl";'));
  assert.ok(source.includes('import { ROUTES } from "@/lib/routes";'));
  assert.ok(source.includes('import { LogisticsCommandCenter } from "./LogisticsCommandCenter";'));
});

test("dashboard logistica forwards cookies and disables cache for live reads", () => {
  const source = read(LOGISTICA_PAGE_PATH);

  assert.ok(source.includes("async function getLogisticsRequestOptions(): Promise<RequestInit>"));
  assert.ok(source.includes("const cookieHeader = (await cookies()).toString();"));
  assert.ok(source.includes('cache: "no-store"'));
  assert.ok(source.includes("headers: cookieHeader ? { Cookie: cookieHeader } : {},"));
});

test("dashboard logistica reads field visits and route plans through API helpers", () => {
  const source = read(LOGISTICA_PAGE_PATH);

  assert.ok(source.includes("export default async function LogisticaPage()"));
  assert.ok(source.includes("const requestOptions = await getLogisticsRequestOptions();"));
  assert.ok(source.includes("let fieldVisits: Awaited<ReturnType<typeof getLogisticsFieldVisits>> = [];"));
  assert.ok(source.includes("let fieldVisitsLoadError = false;"));
  assert.ok(source.includes("let routePlans: Awaited<ReturnType<typeof getRoutePlans>> = [];"));
  assert.ok(source.includes("let routePlansLoadError = false;"));
  assert.ok(source.includes("await Promise.all(["));
  assert.ok(source.includes("getLogisticsFieldVisits(requestOptions, {"));
  assert.ok(source.includes("getRoutePlans(requestOptions, {"));
});

test("dashboard logistica computes active visits and active route plans explicitly", () => {
  const source = read(LOGISTICA_PAGE_PATH);

  assert.ok(source.includes('<ClinicDashboardShell'));
  // B10: the clinic notification role is declared once, by the shared shell.
  assert.equal(source.includes('notifications="clinic"'), false);
  assert.ok(source.includes("const activeVisits = fieldVisits.filter("));
  assert.ok(source.includes('v.status === "in_progress" || v.status === "scheduled"'));
  assert.ok(source.includes("const activePlans = routePlans.filter("));
  assert.ok(source.includes('p.status === "in_progress" || p.status === "released"'));
  assert.deepEqual(activeStatuses(source, LOGISTICA_PAGE_PATH), ACTIVE);

  const shortCircuited = source.replace(
    '(v) => v.status === "in_progress"',
    () => '(v) => false && v.status === "in_progress"',
  );
  assert.notEqual(shortCircuited, source);
  assert.deepEqual(activeStatuses(shortCircuited, LOGISTICA_PAGE_PATH), {
    ...ACTIVE,
    activeVisits: ["scheduled"],
  });
});

test("dashboard logistica composes command center in the full-route module stage", () => {
  const source = read(LOGISTICA_PAGE_PATH);
  // A05 (#1649) put the adaptive reservation root and the sticky-action ledger
  // var on this `<main>`; B10 (#B10) moved `<main>` itself into the shared
  // `ClinicDashboardShell`, which the route configures through props. The slice
  // therefore anchors on the shell mount — the element that opens the main
  // region for this route.
  const mainStart = source.indexOf('<ClinicDashboardShell');
  assert.ok(mainStart >= 0, "logistics hub must mount the shared clinic shell");
  assert.ok(
    source.includes("mainAdaptiveReservation"),
    "logistics hub keeps declaring main as the adaptive reservation root",
  );
  const mainSource = source.slice(mainStart);

  assert.ok(source.includes('<ClinicFullRouteModuleStage moduleId="logistica-full">'));
  assert.ok(source.includes("<LogisticsCommandCenter"));
  assert.ok(source.includes("headerActions={"));
  assert.ok(source.includes("<PublicRouteControl"));
  assert.ok(source.includes("href={ROUTES.dashboardLogisticaVisitas}"));
  assert.ok(source.includes("href={ROUTES.dashboardLogisticaRutas}"));
  assert.ok(source.includes("href={ROUTES.dashboardLogisticaMetricas}"));

  const order = [
    "<ClinicFullRouteModuleStage",
    "<LogisticsCommandCenter",
  ].map((marker) => mainSource.indexOf(marker));

  for (const index of order) {
    assert.ok(index >= 0, `main source must contain ordered marker at index ${index}`);
  }

  assert.deepEqual(
    order,
    [...order].sort((a, b) => a - b),
    "logistics hub order must be: stage, command center",
  );
});

test("dashboard logistica passes all data props to LogisticsCommandCenter", () => {
  const source = read(LOGISTICA_PAGE_PATH);

  assert.ok(source.includes("fieldVisits={fieldVisits}"));
  assert.ok(source.includes("routePlans={routePlans}"));
  assert.ok(source.includes("fieldVisitsLoadError={fieldVisitsLoadError}"));
  assert.ok(source.includes("routePlansLoadError={routePlansLoadError}"));
});

test("dashboard logistica avoids direct client-side fetch literals", () => {
  const source = read(LOGISTICA_PAGE_PATH);

  assert.equal(source.includes("fetch("), false);
  assert.equal(source.includes('"/api"'), false);
});

test("dashboard logistica does not use next/link or bare anchor tags for navigation", () => {
  const source = read(LOGISTICA_PAGE_PATH);

  assert.equal(source.includes('import Link from "next/link"'), false);
  assert.equal(source.includes('import Link from \'next/link\''), false);
  assert.equal(source.includes('<a href='), false);
});

test("dashboard logistica permits the dashboard route control but no public surface, middleware or auth", () => {
  const source = read(LOGISTICA_PAGE_PATH);

  assert.equal(
    source.includes('@/components/public/') &&
      !source.includes('"@/components/public/PublicRouteControl"'),
    false,
  );
  assert.ok(source.includes('PublicRouteControl'));
  assert.equal(source.includes('from "next-auth"'), false);
  assert.equal(source.includes('middleware'), false);
});

test("dashboard logistica scope stays inside frontend dashboard", () => {
  const source = read(LOGISTICA_PAGE_PATH);

  assert.equal(source.includes('from "@/app/api'), false);
  assert.equal(source.includes("process.env"), false);
  assert.equal(source.includes("revalidatePath"), false);
  assert.equal(source.includes("revalidateTag"), false);
  assert.equal(source.includes("border-gray-100"), false);
  assert.equal(source.includes("border-gray-50"), false);
  assert.equal(source.includes("🚐"), false);
  assert.equal(source.includes("🗺"), false);
  assert.equal(source.includes("📊"), false);
});
