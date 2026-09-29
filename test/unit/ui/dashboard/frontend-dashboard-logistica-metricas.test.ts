import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
import { readSourceFile as read } from "../../../helpers/tracked-source-files.ts";

const METRICAS_PAGE_PATH = "frontend/src/app/dashboard/logistica/metricas/page.tsx";
const PLANS_ALERT = "No se pudieron cargar los planes de ruta para métricas. Intente nuevamente.";
const METRICS_EMPTY = "No hay métricas de ruta disponibles.";

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

function staticAttribute(element: JsxNode, name: string): string | undefined {
  const value = effectiveAttribute(element, name);

  if (value.kind !== "value") return undefined;

  const expression = unwrap(value.expression);

  return ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)
    ? expression.text
    : undefined;
}

// Text shown whenever the element renders: JSX text reached through nested
// elements only, never through an expression container (a conditional child).
function elementText(element: JsxNode): string {
  const parts: string[] = [];
  const visit = (node: ts.Node): void => {
    for (const child of ts.isJsxElement(node) || ts.isJsxFragment(node) ? node.children : []) {
      if (ts.isJsxText(child)) parts.push(child.text.replace(/\s+/g, " ").trim());
      else if (ts.isJsxElement(child) || ts.isJsxFragment(child)) visit(child);
    }
  };

  visit(element);
  return parts.filter(Boolean).join(" ");
}

type Env = ReadonlyMap<string, boolean>;
type Rendered = { readonly element: JsxNode; readonly must: boolean };
type Reached = { readonly expression: ts.Expression; readonly must: boolean };

// Three-valued truth of a condition: true, false or undefined (not decidable
// from the env). A condition over the env that it cannot read fails closed.
function truth(node: ts.Expression, env: Env): boolean | undefined {
  const expression = unwrap(node);

  if (expression.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (
    expression.kind === ts.SyntaxKind.FalseKeyword ||
    expression.kind === ts.SyntaxKind.NullKeyword
  ) {
    return false;
  }
  if (ts.isIdentifier(expression) && env.has(expression.text)) return env.get(expression.text);

  if (
    ts.isPrefixUnaryExpression(expression) &&
    expression.operator === ts.SyntaxKind.ExclamationToken
  ) {
    const operand = truth(expression.operand, env);
    return operand === undefined ? undefined : !operand;
  }

  if (
    ts.isBinaryExpression(expression) &&
    (expression.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
      expression.operatorToken.kind === ts.SyntaxKind.BarBarToken)
  ) {
    const shortCircuit = expression.operatorToken.kind === ts.SyntaxKind.BarBarToken;
    const left = truth(expression.left, env);

    if (left === shortCircuit) return shortCircuit;

    const right = truth(expression.right, env);

    if (left === !shortCircuit) return right;
    return right === shortCircuit ? shortCircuit : undefined;
  }

  const readsEnv = descendants(expression, ts.isIdentifier).some(
    (identifier) =>
      env.has(identifier.text) &&
      !(ts.isPropertyAccessExpression(identifier.parent) && identifier.parent.name === identifier),
  );

  if (readsEnv) throw new Error(`unsupported condition: ${expression.getText()}`);
  return undefined;
}

function exitsOutsideFunctions(node: ts.Node): boolean {
  if (ts.isFunctionLike(node)) return false;
  if (
    ts.isReturnStatement(node) ||
    ts.isThrowStatement(node) ||
    ts.isBreakStatement(node) ||
    ts.isContinueStatement(node)
  ) {
    return true;
  }

  return ts.forEachChild(node, (child) => exitsOutsideFunctions(child) || undefined) ?? false;
}

// Collects the returns reached under the env; true when the list always exits.
function collectReturns(
  statements: readonly ts.Statement[],
  env: Env,
  reached: boolean,
  out: Reached[],
): boolean {
  const list = (statement: ts.Statement) =>
    ts.isBlock(statement) ? statement.statements : [statement];
  let certain = reached;

  for (const statement of statements) {
    if (ts.isReturnStatement(statement)) {
      if (statement.expression) out.push({ expression: statement.expression, must: certain });
      return true;
    }

    if (ts.isThrowStatement(statement)) return true;

    if (ts.isBlock(statement)) {
      if (collectReturns(statement.statements, env, certain, out)) return true;
      continue;
    }

    if (ts.isIfStatement(statement)) {
      const condition = truth(statement.expression, env);
      const thenExits =
        condition !== false &&
        collectReturns(list(statement.thenStatement), env, certain && condition === true, out);
      const elseExits =
        condition !== true &&
        statement.elseStatement !== undefined &&
        collectReturns(list(statement.elseStatement), env, certain && condition === false, out);

      if (condition === true ? thenExits : condition === false ? elseExits : thenExits && elseExits) {
        return true;
      }
      if (thenExits || elseExits) certain = false;
      continue;
    }

    if (exitsOutsideFunctions(statement)) {
      throw new Error(`unsupported control flow: ${statement.getText().slice(0, 60)}`);
    }
  }

  return false;
}

// Follows the JSX actually rendered under the env. `must` marks what renders on
// every path; undecidable conditions are explored both ways as `may`.
function render(node: ts.Node, env: Env, must: boolean, out: Rendered[]): void {
  const target = ts.isExpression(node) ? unwrap(node) : node;

  if (ts.isJsxElement(target) || ts.isJsxSelfClosingElement(target)) {
    out.push({ element: target, must });

    const opening = ts.isJsxElement(target) ? target.openingElement : target;

    for (const attribute of opening.attributes.properties) {
      const value = ts.isJsxAttribute(attribute) ? attribute.initializer : attribute.expression;
      if (value) render(value, env, must, out);
    }

    if (ts.isJsxElement(target)) {
      for (const child of target.children) render(child, env, must, out);
    }
  } else if (ts.isJsxFragment(target)) {
    for (const child of target.children) render(child, env, must, out);
  } else if (ts.isJsxExpression(target)) {
    if (target.expression) render(target.expression, env, must, out);
  } else if (ts.isConditionalExpression(target)) {
    const condition = truth(target.condition, env);
    if (condition !== false) render(target.whenTrue, env, must && condition === true, out);
    if (condition !== true) render(target.whenFalse, env, must && condition === false, out);
  } else if (ts.isBinaryExpression(target)) {
    const operator = target.operatorToken.kind;

    if (
      operator === ts.SyntaxKind.AmpersandAmpersandToken ||
      operator === ts.SyntaxKind.BarBarToken ||
      operator === ts.SyntaxKind.QuestionQuestionToken
    ) {
      const left = operator === ts.SyntaxKind.QuestionQuestionToken ? undefined : truth(target.left, env);
      const right =
        left === undefined ? undefined : operator === ts.SyntaxKind.AmpersandAmpersandToken ? left : !left;
      if (right !== false) render(target.right, env, must && right === true, out);
    }
  } else if (ts.isArrayLiteralExpression(target)) {
    for (const element of target.elements) render(element, env, must, out);
  } else if (ts.isObjectLiteralExpression(target)) {
    for (const property of target.properties) {
      if (ts.isPropertyAssignment(property)) render(property.initializer, env, must, out);
    }
  } else if (ts.isCallExpression(target)) {
    for (const argument of target.arguments) {
      if (!ts.isArrowFunction(argument) && !ts.isFunctionExpression(argument)) {
        render(argument, env, false, out);
      } else if (!ts.isBlock(argument.body)) {
        render(argument.body, env, false, out);
      } else {
        const returns: Reached[] = [];
        collectReturns(argument.body.statements, env, false, returns);
        for (const reached of returns) render(reached.expression, env, false, out);
      }
    }
  }
}

function renderedUnder(component: SourceFunction, env: Env): Rendered[] {
  const returns: Reached[] = [];
  const out: Rendered[] = [];

  collectReturns(component.body.statements, env, true, returns);
  for (const reached of returns) render(reached.expression, env, reached.must, out);
  return out;
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

// TEST-GLOBAL-07 (G06-D08): the catch of the route-plan fetch raises
// `routePlansLoadError`, which then renders the alert instead of the empty
// metrics and disables both pager directions. The literal
// `routePlansLoadError = true;` stays present under `if (false)` (C.15.1 M-D06).
function routePlansFailure(source: string) {
  const file = parseTsx(source, METRICAS_PAGE_PATH);
  const page = exportedFunction(file, "MetricasPage");
  const failed = new Map([["routePlansLoadError", true]]);
  const set = renderedUnder(page, failed);
  const isAlert = (element: JsxNode) =>
    staticAttribute(element, "role") === "alert" && elementText(element).includes(PLANS_ALERT);
  const pager = ["canGoPrevious", "canGoNext"].map((name) => {
    const [declaration] = descendants(page.body, ts.isVariableDeclaration).filter(
      (candidate) => candidate.name.getText() === name,
    );
    return declaration?.initializer ? truth(declaration.initializer, failed) : "undeclared";
  });

  return {
    violations: failureFlagViolations(
      source,
      METRICAS_PAGE_PATH,
      "MetricasPage",
      ["getRoutePlans"],
      "routePlansLoadError",
    ),
    alertWhenSet: set.some((rendered) => rendered.must && isAlert(rendered.element)),
    emptyWhenSet: set.some((rendered) => elementText(rendered.element).includes(METRICS_EMPTY)),
    pagerWhenSet: pager,
    alertWhenClear: renderedUnder(page, new Map([["routePlansLoadError", false]])).some(
      (rendered) => isAlert(rendered.element),
    ),
  };
}

test("dashboard logistica metricas defines non-indexable metadata and dependencies", () => {
  const source = read(METRICAS_PAGE_PATH);

  assert.ok(source.includes('import type { Metadata } from "next";'));
  assert.ok(source.includes('import { cookies } from "next/headers";'));
  assert.ok(source.includes('title: "Métricas de logística — Portal VETNEB"'));
  assert.ok(source.includes("robots: { index: false, follow: false },"));
  // B10: the shell chrome (topbar + navigation frame + main) has one owner for
  // all six clinic routes, so the route imports the shell, not the topbar.
  assert.ok(source.includes('import { ClinicDashboardShell } from "@/components/dashboard/ClinicDashboardShell";'));
  assert.equal(
    source.includes('import { DashboardTopbar } from "@/components/dashboard/DashboardTopbar";'),
    false,
  );
  assert.ok(source.includes('import { PublicRouteControl } from "@/components/public/PublicRouteControl";'));
  assert.ok(source.includes('import { Badge } from "@/components/ui/badge";'));
  assert.ok(source.includes('import { getRoutePlanMetrics, getRoutePlans } from "@/lib/api";'));
});

test("dashboard logistica metricas forwards cookies and disables cache for live reads", () => {
  const source = read(METRICAS_PAGE_PATH);

  assert.ok(source.includes("async function getLogisticsRequestOptions(): Promise<RequestInit>"));
  assert.ok(source.includes("const cookieHeader = (await cookies()).toString();"));
  assert.ok(source.includes('cache: "no-store"'));
  assert.ok(source.includes("headers: cookieHeader ? { Cookie: cookieHeader } : {},"));
  assert.ok(source.includes("const requestOptions = await getLogisticsRequestOptions();"));
});

test("dashboard logistica metricas sends explicit limit/offset with a metrics-specific fan-out cap (R-14)", () => {
  const source = read(METRICAS_PAGE_PATH);

  assert.ok(source.includes("const METRICAS_DEFAULT_LIMIT = 12;"));
  assert.ok(source.includes("const METRICAS_MAX_LIMIT = 24;"));
  assert.ok(source.includes("function normalizeOffset(value: string | string[] | undefined): number {"));
  assert.ok(source.includes("function normalizeLimit(value: string | string[] | undefined): number {"));
  assert.ok(source.includes("searchParams?: Promise<MetricasPageSearchParams>;"));
  assert.ok(
    source.includes(
      "getRoutePlans(requestOptions, { throwOnError: true }, {\n      limit,\n      offset,\n    });",
    ),
  );
  // Metrics fan-out must never inherit the rutas/visitas backend default (50).
  assert.equal(source.includes("RUTAS_DEFAULT_LIMIT"), false);
  assert.equal(source.includes("= 50;"), false);
});

test("dashboard logistica metricas reads route plans and plan metrics scoped to the visible page", () => {
  const source = read(METRICAS_PAGE_PATH);

  assert.ok(source.includes("let routePlans: Awaited<ReturnType<typeof getRoutePlans>> = [];"));
  assert.ok(source.includes("let routePlansLoadError = false;"));
  assert.ok(source.includes("routePlans = await getRoutePlans("));
  assert.ok(source.includes("throwOnError: true,"));
  assert.ok(source.includes("let routeMetrics: Awaited<ReturnType<typeof getRoutePlanMetrics>> = [];"));
  assert.ok(source.includes("await Promise.all("));
  assert.ok(source.includes("let routeMetricsLoadError = false;"));
  assert.ok(source.includes("routePlans.map((plan) =>"));
  assert.ok(source.includes("getRoutePlanMetrics(plan.id, requestOptions, {"));
  assert.ok(source.includes(").flat();"));
});

test("dashboard logistica metricas computes canGoNext/canGoPrevious without a backend total (R-14)", () => {
  const source = read(METRICAS_PAGE_PATH);

  assert.ok(source.includes("const canGoPrevious = !routePlansLoadError && offset > 0;"));
  assert.ok(source.includes("const canGoNext = !routePlansLoadError && routePlans.length === limit;"));
  assert.equal(source.includes("pageCount"), false);
  assert.equal(source.includes("matchMedia"), false);
  assert.equal(source.includes("ResizeObserver"), false);
});

test("dashboard logistica metricas renders a pager and page-scope disclosure (R-14)", () => {
  const source = read(METRICAS_PAGE_PATH);

  assert.ok(source.includes('aria-label="Paginación de métricas de ruta"'));
  assert.ok(source.includes('aria-label="Página anterior"'));
  assert.ok(source.includes('aria-label="Página siguiente"'));
  assert.ok(source.includes("disabled={!canGoPrevious}"));
  assert.ok(source.includes("disabled={!canGoNext}"));
  assert.ok(source.includes("Mostrando {routeMetrics.length} métricas de ruta · página {currentPage}"));
  assert.ok(
    source.includes(
      "Métricas calculadas sobre la página visible (máximo {limit} planes),",
    ),
  );
  assert.ok(source.includes("no sobre el total general de rutas."));
});

test("dashboard logistica metricas computes aggregate operational metrics", () => {
  const source = read(METRICAS_PAGE_PATH);

  assert.ok(source.includes("const totalStops = routeMetrics.reduce("));
  assert.ok(source.includes("const completedStops = routeMetrics.reduce("));
  assert.ok(source.includes("const avgCompliance ="));
  assert.ok(source.includes("metric.complianceRate"));
  assert.ok(source.includes("const metricsWithDuration = routeMetrics.filter("));
  assert.ok(source.includes("metric.averageDurationMinutes !== null"));
  assert.ok(source.includes("const avgDuration ="));
});

test("dashboard logistica metricas renders summary cards without technical source copy", () => {
  const source = read(METRICAS_PAGE_PATH);
  const removedMetricsEndpoint = "GET " + "/api/logistics/route-plans/:id/metrics";

  assert.ok(source.includes('title="Métricas de logística"'));
  assert.ok(source.includes('subtitle="Cumplimiento, SLA y reportes operativos"'));
  assert.ok(source.includes('<ClinicDashboardShell'));
  // B10: the clinic notification role is declared once, by the shared shell.
  assert.equal(source.includes('notifications="clinic"'), false);
  assert.ok(source.includes("<ModuleMetricRun"));
  assert.ok(source.includes('surfaceId="clinic-logistica-metricas"'));
  assert.ok(source.includes('label: "Cumplimiento"'));
  assert.ok(source.includes("Paradas completadas"));
  assert.ok(source.includes("Duración promedio"));
  assert.ok(source.includes('label: "Planes"'));
  assert.equal(source.includes('className="dashboard-metric-card p-0"'), false);
  assert.equal(source.includes(removedMetricsEndpoint), false);
});

test("dashboard logistica metricas renders per-route metric detail", () => {
  const source = read(METRICAS_PAGE_PATH);

  assert.ok(source.includes("Métricas por plan de ruta"));
  assert.ok(source.includes("Detalle de cumplimiento por cada plan ejecutado"));
  assert.ok(source.includes("routeMetrics.map((metric) =>"));
  assert.ok(source.includes("routePlans.find("));
  assert.ok(source.includes("plan?.name ?? `Plan #${metric.routePlanId}`"));
  assert.ok(source.includes("Total paradas"));
  assert.ok(source.includes("Completadas"));
  assert.ok(source.includes("Omitidas"));
  assert.ok(source.includes("Sin presencia"));
  assert.ok(source.includes('className="surface-soft space-y-3"'));
  assert.ok(source.includes("<ModuleCard"));
});

test("dashboard logistica metricas keeps compliance badge thresholds and progress accessibility", () => {
  const source = read(METRICAS_PAGE_PATH);

  assert.ok(source.includes("metric.complianceRate >= 90"));
  assert.ok(source.includes("? \"default\""));
  assert.ok(source.includes("metric.complianceRate >= 60"));
  assert.ok(source.includes("? \"secondary\""));
  assert.ok(source.includes(": \"destructive\""));
  assert.ok(source.includes("style={{ width: `${metric.complianceRate}%` }}"));
  assert.ok(source.includes('role="progressbar"'));
  assert.ok(source.includes("aria-valuenow={metric.complianceRate}"));
  assert.ok(source.includes("aria-valuemin={0}"));
  assert.ok(source.includes("aria-valuemax={100}"));
  assert.ok(source.includes("aria-label={`Cumplimiento: ${metric.complianceRate}%`}"));
  assert.ok(source.includes('className="clinical-progress h-2 w-full"'));
  assert.equal(source.includes("bg-gray-100"), false);
  assert.equal(source.includes("border-gray-100"), false);
});

test("dashboard logistica metricas separates fetch failures from empty metrics", () => {
  const source = read(METRICAS_PAGE_PATH);

  assert.ok(source.includes("routePlansLoadError ?"));
  assert.ok(source.includes("routeMetricsLoadError ?"));
  assert.ok(source.includes('role="alert"'));
  assert.ok(source.includes("No se pudieron cargar los planes de ruta para métricas. Intente nuevamente."));
  assert.ok(source.includes("No se pudieron cargar las métricas de ruta. Intente nuevamente."));
  assert.ok(source.includes("No hay métricas de ruta disponibles."));
  assert.equal(source.includes("fetch("), false);

  const separated = {
    violations: [],
    alertWhenSet: true,
    emptyWhenSet: false,
    pagerWhenSet: [false, false],
    alertWhenClear: false,
  };
  assert.deepEqual(routePlansFailure(source), separated);

  const neverRaised = source.replace("routePlansLoadError = true;", () => "if (false)\nroutePlansLoadError = true;");
  assert.notEqual(neverRaised, source);
  assert.deepEqual(routePlansFailure(neverRaised), {
    ...separated,
    violations: ["routePlansLoadError = true is not an unconditional statement of a catch block"],
  });
});
