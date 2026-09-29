import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import ts from "typescript";
import {
  assertClean7aDependencyCleanupInvariants,
} from "../../../helpers/clean7a-dependency-cleanup-scope.ts";
import { isReportForeignAccessBackendFile } from "../../../helpers/report-foreign-access-scope.ts";
import { dashboardScopeGuardApplies } from "../../../helpers/dashboard-scope-guard.ts";
import { readSourceFile as read } from "../../../helpers/tracked-source-files.ts";

const LOGISTICS_PAGE_PATH = "frontend/src/app/dashboard/logistica/page.tsx";
const COMMAND_CENTER_PATH =
  "frontend/src/app/dashboard/logistica/LogisticsCommandCenter.tsx";
const STICKY_ACTION_BAR_PATH =
  "frontend/src/components/dashboard/StickyActionBar.tsx";
const DASHBOARD_PAGE_HEADER_PATH =
  "frontend/src/components/dashboard/DashboardPageHeader.tsx";
const VISITS_ALERT = [
  "fieldVisitsLoadError",
  "No se pudieron cargar las visitas de campo. Intente nuevamente.",
  "No hay visitas de campo disponibles.",
] as const;
const PLANS_ALERT = [
  "routePlansLoadError",
  "No se pudieron cargar los planes de ruta. Intente nuevamente.",
  "No hay planes de ruta disponibles.",
] as const;
const DISTINGUISHED = { whenSet: true, emptyWhenSet: false, whenClear: false };
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

// A prop drives the render only as a plain destructured binding that the
// function never rebinds nor reassigns; an alias or a shadow is unsupported.
function assertPlainProps(component: SourceFunction, names: readonly string[]): void {
  const [props] = component.parameters;

  if (!props || !ts.isObjectBindingPattern(props.name)) {
    throw new Error(`${component.name?.text}: props are not destructured`);
  }

  for (const name of names) {
    const binding = props.name.elements.find(
      (element) => ts.isIdentifier(element.name) && element.name.text === name,
    );

    if (!binding || binding.propertyName || binding.initializer || binding.dotDotDotToken) {
      throw new Error(`${name}: not a plain destructured prop`);
    }
  }

  for (const identifier of descendants(component.body, ts.isIdentifier)) {
    const parent = identifier.parent;

    if (!names.includes(identifier.text)) continue;

    const declares =
      (ts.isVariableDeclaration(parent) ||
        ts.isParameter(parent) ||
        ts.isBindingElement(parent) ||
        ts.isFunctionDeclaration(parent)) &&
      parent.name === identifier;
    const assigns =
      (ts.isBinaryExpression(parent) &&
        parent.left === identifier &&
        parent.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
        parent.operatorToken.kind <= ts.SyntaxKind.LastAssignment) ||
      ((ts.isPrefixUnaryExpression(parent) || ts.isPostfixUnaryExpression(parent)) &&
        (parent.operator === ts.SyntaxKind.PlusPlusToken ||
          parent.operator === ts.SyntaxKind.MinusMinusToken));

    if (declares || assigns) {
      throw new Error(`${identifier.text}: rebound inside ${component.name?.text}`);
    }
  }
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

function tagName(element: JsxNode): string {
  return (ts.isJsxElement(element) ? element.openingElement : element).tagName.getText();
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

// TEST-GLOBAL-07 (G06-D12): with its flag set the alert renders on every path
// and the empty state on none; with the flag clear the alert renders on no
// path. `.includes("fieldVisitsLoadError ?")` also matches the inverted
// `!fieldVisitsLoadError ?` (C.15.1 M-D10).
function alertRendering(source: string, flag: string, message: string, empty: string) {
  const component = exportedFunction(
    parseTsx(source, COMMAND_CENTER_PATH),
    "LogisticsCommandCenter",
  );
  const isAlert = (element: JsxNode) =>
    staticAttribute(element, "role") === "alert" && elementText(element).includes(message);
  const isEmpty = (element: JsxNode) =>
    tagName(element) === "EmptyState" && staticAttribute(element, "description") === empty;

  assertPlainProps(component, [flag]);

  const set = renderedUnder(component, new Map([[flag, true]]));
  return {
    whenSet: set.some((rendered) => rendered.must && isAlert(rendered.element)),
    emptyWhenSet: set.some((rendered) => isEmpty(rendered.element)),
    whenClear: renderedUnder(component, new Map([[flag, false]])).some((rendered) =>
      isAlert(rendered.element),
    ),
  };
}

// The hub is where "active" is derived for display (the route page's copy is
// not rendered): each metric must show the length of its executed filter.
function displayedActiveCounts(source: string): string[][] {
  return descendants(parseTsx(source, COMMAND_CENTER_PATH), ts.isObjectLiteralExpression)
    .map((metric) => {
      const field = (name: string) => {
        const property = metric.properties.find(
          (candidate) => ts.isPropertyAssignment(candidate) && candidate.name.getText() === name,
        );
        return property && ts.isPropertyAssignment(property) ? property.initializer : undefined;
      };
      const key = field("key");
      const value = field("value");

      return key && ts.isStringLiteral(key) && value ? [key.text, value.getText()] : [];
    })
    .filter(([key]) => key === "visitas-activas" || key === "planes-activos");
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

// ── Existence and scope boundaries ──────────────────────────────────────────

test("LogisticsCommandCenter file exists at app/dashboard/logistica location", () => {
  const source = read(COMMAND_CENTER_PATH);
  assert.ok(source.length > 0);
});

test("LogisticsCommandCenter does not import from API, auth, public, or middleware modules", () => {
  const source = read(COMMAND_CENTER_PATH);

  assert.equal(source.includes('from "@/lib/api"'), false);
  assert.equal(source.includes('from "@/app/api'), false);
  assert.equal(source.includes("middleware"), false);
  assert.equal(source.includes('from "next/headers"'), false);
  assert.equal(source.includes('from "next-auth"'), false);
  assert.equal(source.includes('import { cookies }'), false);
  assert.equal(source.includes('@/components/public/'), false);
  assert.equal(source.includes('PublicRouteControl'), false);
});

test("LogisticsCommandCenter does not perform data fetching", () => {
  const source = read(COMMAND_CENTER_PATH);

  assert.equal(source.includes("fetch("), false);
  assert.equal(source.includes("await "), false);
  assert.equal(source.includes("getLogisticsFieldVisits"), false);
  assert.equal(source.includes("getRoutePlans"), false);
});

test("LogisticsCommandCenter is not a client component", () => {
  const source = read(COMMAND_CENTER_PATH);

  assert.equal(source.includes('"use client"'), false);
  assert.equal(source.includes("'use client'"), false);
});

test("LogisticsCommandCenter does not reference app/api routes or server-only functions", () => {
  const source = read(COMMAND_CENTER_PATH);

  assert.equal(source.includes("/api/"), false);
  assert.equal(source.includes("process.env"), false);
  assert.equal(source.includes("revalidatePath"), false);
  assert.equal(source.includes("revalidateTag"), false);
});

// ── Props contract ───────────────────────────────────────────────────────────

test("LogisticsCommandCenter exports typed props and component", () => {
  const source = read(COMMAND_CENTER_PATH);

  assert.ok(source.includes("export type LogisticsCommandCenterProps = {"));
  assert.ok(source.includes("export function LogisticsCommandCenter("));
  assert.ok(source.includes("fieldVisits: FieldVisit[];"));
  assert.ok(source.includes("routePlans: RoutePlan[];"));
  assert.ok(source.includes("fieldVisitsLoadError: boolean;"));
  assert.ok(source.includes("routePlansLoadError: boolean;"));
});

test("LogisticsCommandCenter imports types from @/types only (no server-only imports)", () => {
  const source = read(COMMAND_CENTER_PATH);

  assert.ok(source.includes('import type { FieldVisit, RoutePlan } from "@/types";'));
});

// ── Operational priority section ─────────────────────────────────────────────

test("LogisticsCommandCenter renders operational priority section with the shared metric run", () => {
  const source = read(COMMAND_CENTER_PATH);

  assert.ok(source.includes("Estado operativo logística"));
  assert.ok(source.includes("Priorice visitas activas y planes en curso"));
  assert.ok(source.includes("logistics-operational-priority"));
  assert.ok(source.includes("Visitas activas"));
  assert.ok(source.includes("Planes activos"));
  assert.ok(source.includes("Total visitas"));
  assert.ok(source.includes("<ModuleMetricRun"));
  assert.ok(source.includes('surfaceId="clinic-logistica-full"'));
  assert.ok(source.includes('value: activeVisits.length'));
  assert.ok(source.includes('value: activePlans.length'));
  assert.ok(source.includes('value: fieldVisits.length'));
});

test("LogisticsCommandCenter computes active visits and plans from props without fetch", () => {
  const source = read(COMMAND_CENTER_PATH);

  assert.ok(source.includes("const activeVisits = fieldVisits.filter("));
  assert.ok(source.includes('v.status === "in_progress" || v.status === "scheduled"'));
  assert.ok(source.includes("const activePlans = routePlans.filter("));
  assert.ok(source.includes('p.status === "in_progress" || p.status === "released"'));
  assert.deepEqual(activeStatuses(source, COMMAND_CENTER_PATH), ACTIVE);
  assert.deepEqual(displayedActiveCounts(source), [
    ["visitas-activas", "activeVisits.length"],
    ["planes-activos", "activePlans.length"],
  ]);
});

// ── Section heading ──────────────────────────────────────────────────────────

test("LogisticsCommandCenter renders section heading with aria labelling", () => {
  const source = read(COMMAND_CENTER_PATH);

  assert.ok(source.includes("<section"));
  assert.ok(source.includes('aria-labelledby="logistics-command-center-heading"'));
  assert.ok(source.includes("logistics-command-center-heading"));
  assert.ok(source.includes("Centro de logística"));
  assert.ok(source.includes("<ModuleCard"));
  assert.ok(source.includes('ariaLabel="Centro de logística"'));
});

// ── Visits list ──────────────────────────────────────────────────────────────

test("LogisticsCommandCenter hands the full ordered visit collection to the bounded canvas with StatusBadge", () => {
  const source = read(COMMAND_CENTER_PATH);

  assert.ok(source.includes("Visitas de campo"));
  // A03: cardinality belongs to LogisticsRecentListCanvas, which measures its
  // own height. A pre-pagination cap here capped the list below the measured
  // page size and made a complete second page unreachable on tall viewports.
  assert.ok(source.includes("const recentVisits = fieldVisits;"));
  assert.ok(
    !/const recentVisits = fieldVisits\.slice\(/.test(source),
    "recentVisits must not be truncated before the adaptive canvas pages it",
  );
  assert.ok(source.includes("recentVisits.map((visit) =>"));
  assert.ok(source.includes("{visit.clinicName ?? `Clínica #${visit.clinicId}`}"));
  assert.ok(source.includes('visit.address ?? "Sin dirección"'));
  assert.ok(source.includes("formatDate(visit.scheduledAt)"));
  assert.ok(source.includes("status={visit.status}"));
  assert.ok(source.includes('import { StatusBadge } from "@/components/dashboard/StatusBadge";'));
  // CMP-08: the visit row converged on the shared CanonicalOperationalRow
  // primitive (canonical "regular" pitch); the bespoke `.dashboard-list-row`
  // class was retired with it, identified now by its own data attribute.
  assert.ok(source.includes('dataAttributes={{ "data-logistics-recent-row": "visita" }}'));
});

test("LogisticsCommandCenter shows visits error alert with role=alert", () => {
  const source = read(COMMAND_CENTER_PATH);

  assert.ok(source.includes("fieldVisitsLoadError ?"));
  assert.ok(source.includes("No se pudieron cargar las visitas de campo. Intente nuevamente."));
  assert.ok(source.includes('role="alert"'));
  assert.deepEqual(alertRendering(source, ...VISITS_ALERT), DISTINGUISHED);

  const inverted = source.replace("{fieldVisitsLoadError ? (", () => "{!fieldVisitsLoadError ? (");
  assert.notEqual(inverted, source);
  assert.deepEqual(alertRendering(inverted, ...VISITS_ALERT), {
    whenSet: false,
    emptyWhenSet: true,
    whenClear: true,
  });
});

test("LogisticsCommandCenter renders EmptyState for missing visits", () => {
  const source = read(COMMAND_CENTER_PATH);

  assert.ok(source.includes('import { EmptyState } from "@/components/dashboard/EmptyState";'));
  assert.ok(source.includes("Sin visitas activas"));
  assert.ok(source.includes("No hay visitas de campo disponibles."));
});

// ── Route plans list ─────────────────────────────────────────────────────────

test("LogisticsCommandCenter hands the full ordered route plan collection to the bounded canvas with status badge", () => {
  const source = read(COMMAND_CENTER_PATH);

  assert.ok(source.includes("Planes de ruta"));
  assert.ok(source.includes("const recentPlans = routePlans;"));
  assert.ok(
    !/const recentPlans = routePlans\.slice\(/.test(source),
    "recentPlans must not be truncated before the adaptive canvas pages it",
  );
  assert.ok(source.includes("recentPlans.map((plan) =>"));
  assert.ok(source.includes("identity={plan.name}"));
  assert.ok(source.includes("${plan.completedStops}/${plan.totalStops} paradas"));
  assert.ok(source.includes("formatDate(plan.plannedDate)"));
  assert.ok(source.includes("getRoutePlanStatusVariant(plan.status)"));
  assert.ok(source.includes("getRoutePlanStatusLabel(plan.status)"));
  // CMP-08: same CanonicalOperationalRow convergence as the visits list.
  assert.ok(source.includes('dataAttributes={{ "data-logistics-recent-row": "ruta" }}'));
});

test("LogisticsCommandCenter shows route plans error alert with role=alert", () => {
  const source = read(COMMAND_CENTER_PATH);

  assert.ok(source.includes("routePlansLoadError ?"));
  assert.ok(source.includes("No se pudieron cargar los planes de ruta. Intente nuevamente."));
  assert.deepEqual(alertRendering(source, ...PLANS_ALERT), DISTINGUISHED);
});

test("LogisticsCommandCenter renders EmptyState for missing route plans", () => {
  const source = read(COMMAND_CENTER_PATH);

  assert.ok(source.includes("Sin planes de ruta"));
  assert.ok(source.includes("No hay planes de ruta disponibles."));
});

// ── Layout contract ──────────────────────────────────────────────────────────

test("LogisticsCommandCenter uses two-column responsive grid for visits and plans", () => {
  const source = read(COMMAND_CENTER_PATH);

  assert.ok(source.includes("grid grid-cols-1 gap-6 lg:grid-cols-2"));
  assert.ok(source.includes("<ModuleCard"));
  assert.ok(source.includes("<CanonicalOperationalRow"));
});

test("LogisticsCommandCenter does not use next/link or bare anchor tags", () => {
  const source = read(COMMAND_CENTER_PATH);

  assert.equal(source.includes('from "next/link"'), false);
  assert.equal(source.includes('<a href='), false);
  assert.equal(source.includes("<Link"), false);
});

// ── page.tsx integration contract ───────────────────────────────────────────

test("logistics page imports and uses LogisticsCommandCenter with full data prop set", () => {
  const source = read(LOGISTICS_PAGE_PATH);

  assert.ok(source.includes('import { LogisticsCommandCenter } from "./LogisticsCommandCenter";'));
  assert.ok(source.includes("<LogisticsCommandCenter"));
  assert.ok(source.includes("fieldVisits={fieldVisits}"));
  assert.ok(source.includes("routePlans={routePlans}"));
  assert.ok(source.includes("fieldVisitsLoadError={fieldVisitsLoadError}"));
  assert.ok(source.includes("routePlansLoadError={routePlansLoadError}"));
});

test("logistics page mounts the hub in the full-route module stage and passes its header actions", () => {
  const source = read(LOGISTICS_PAGE_PATH);

  assert.ok(source.includes("<ClinicFullRouteModuleStage moduleId=\"logistica-full\""));
  assert.ok(source.includes("headerActions={"));
  assert.ok(source.includes("href={ROUTES.dashboardLogisticaVisitas}"));
  assert.ok(source.includes("href={ROUTES.dashboardLogisticaRutas}"));
  assert.ok(source.includes("href={ROUTES.dashboardLogisticaMetricas}"));
  assert.equal(source.includes('import Link from "next/link"'), false);
  assert.equal(source.includes('<a href='), false);
});

test("logistics page does not use next/link or bare anchor tags for navigation", () => {
  const source = read(LOGISTICS_PAGE_PATH);

  assert.equal(source.includes('import Link from "next/link"'), false);
  assert.equal(source.includes('import Link from \'next/link\''), false);
  assert.equal(source.includes('<a href='), false);
});

// ── DashboardPageHeader contract passthrough ─────────────────────────────────

test("DashboardPageHeader exports typed props and component", () => {
  const source = read(DASHBOARD_PAGE_HEADER_PATH);

  assert.ok(source.includes("export type DashboardPageHeaderProps = {"));
  assert.ok(source.includes("export function DashboardPageHeader("));
  assert.ok(source.includes("title: string;"));
  assert.ok(source.includes("description?: string;"));
  assert.ok(source.includes("badge?: ReactNode;"));
  assert.ok(source.includes("actions?: ReactNode;"));
});

// ── Scope invariants ─────────────────────────────────────────────────────────

test("logistics hub preserves frontend boundaries and CLEAN7A dependency invariants", () => {
  const commandCenterSource = read(COMMAND_CENTER_PATH);
  const stickyActionBarSource = read(STICKY_ACTION_BAR_PATH);

  assertNoForbiddenSurfaceImports(commandCenterSource, "LogisticsCommandCenter");
  assertNoForbiddenSurfaceImports(stickyActionBarSource, "StickyActionBar");
  assertClean7aDependencyCleanupInvariants();
});

test("logistics hub changes do not touch backend, API routes, auth, middleware or SEO files", () => {
  const changedFiles = execFileSync(
    "git",
    ["diff", "--name-only"],
    { encoding: "utf8" },
  ).trim();

  // PR-specific guard: only enforce when the diff touches dashboard scope. A
  // backend logistics feature shell (server/features/logistics/**) is not a
  // frontend dashboard/logistics-hub change, so this guard is not-applicable.
  if (!dashboardScopeGuardApplies(changedFiles.split(/\r?\n/).filter(Boolean))) {
    return;
  }

  const forbiddenPaths = [
    "server/",
    "middleware.ts",
    "next.config",
    "app/api/",
    "app/login",
    "app/profesionales",
    "app/particulares",
    "app/contacto",
    "pnpm-lock.yaml",
    "next-env.d.ts",
  ];

  const pr4ServerFiles = [
    "server/db.ts",
    "server/routes/reports.fastify.ts",
    "server/routes/contact.fastify.ts",
  ];
  const filteredChangedFiles = changedFiles
    .split("\n")
    .filter(
      (f) =>
        !pr4ServerFiles.includes(f.trim()) &&
        !isReportForeignAccessBackendFile(f.trim()),
    )
    .join("\n");
  for (const path of forbiddenPaths) {
    const matching = filteredChangedFiles
      .split("\n")
      .filter((f) => f.includes(path));
    assert.equal(
      matching.length,
      0,
      `logistics hub must not modify ${path}: found ${matching.join(", ")}`,
    );
  }
});
