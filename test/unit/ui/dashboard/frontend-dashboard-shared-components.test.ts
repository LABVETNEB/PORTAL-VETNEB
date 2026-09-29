import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
import { readSourceFile as read } from "../../../helpers/tracked-source-files.ts";

const DASHBOARD_TOPBAR_PATH = "frontend/src/components/dashboard/DashboardTopbar.tsx";
const STATS_CARDS_PATH = "frontend/src/components/dashboard/StatsCards.tsx";

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

// TEST-GLOBAL-07 (G06-D15): while `loading` the component returns the skeleton
// grid — every rendered Skeleton comes from a loop over an executed length-4
// array — and once loaded no Skeleton renders. The literal `if (loading) {`
// stays present under `if (false)` (C.15.1 M-D14).
function statsCardsLoading(source: string) {
  const component = exportedFunction(parseTsx(source, STATS_CARDS_PATH), "StatsCards");
  const skeletons = (loading: boolean) =>
    renderedUnder(component, new Map([["loading", loading]])).filter(
      (rendered) => tagName(rendered.element) === "Skeleton",
    );

  assertPlainProps(component, ["loading"]);

  const loops = new Set<ts.CallExpression>();
  for (const { element } of skeletons(true)) {
    let node: ts.Node = element;

    while (
      node !== component &&
      !(
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === "map"
      )
    ) {
      node = node.parent;
    }

    if (ts.isCallExpression(node)) loops.add(node);
  }

  return {
    loadingSkeletonCards: [...loops].map((loop) => {
      const receiver = ts.isPropertyAccessExpression(loop.expression)
        ? evaluate(loop.expression.expression, {})
        : undefined;
      return Array.isArray(receiver) ? receiver.length : "not an array";
    }),
    loadedSkeletons: skeletons(false).length,
  };
}

test("dashboard topbar keeps route-registry logout action and UI dependencies", () => {
  const source = read(DASHBOARD_TOPBAR_PATH);

  assert.ok(source.includes('import { PublicRouteControl } from "@/components/public/PublicRouteControl";'));
  assert.ok(source.includes('import { ROUTES } from "@/lib/routes";'));
  assert.ok(source.includes("<PublicRouteControl"));
  assert.ok(source.includes("href={ROUTES.login}"));
  assert.ok(source.includes("Cerrar sesión"));
  assert.equal(source.includes('import Link from "next/link";'), false);
  assert.equal(source.includes('href="/login"'), false);
});

test("dashboard topbar keeps typed title and optional subtitle props", () => {
  const source = read(DASHBOARD_TOPBAR_PATH);

  assert.ok(source.includes("interface DashboardTopbarProps"));
  assert.ok(source.includes("title: string;"));
  assert.ok(source.includes("subtitle?: string;"));
  assert.ok(
    source.includes('notifications?: "admin" | "clinic" | "particular" | false;'),
  );
  assert.ok(source.includes("notifications = false,"));
  assert.ok(source.includes("export function DashboardTopbar({"));
  assert.ok(source.includes("<h1"));
  assert.ok(source.includes("{title}"));
  assert.ok(source.includes("{subtitle && ("));
  assert.ok(source.includes("{subtitle}"));
});

test("dashboard topbar renders notifications bell for configured dashboard surface", () => {
  const source = read(DASHBOARD_TOPBAR_PATH);

  assert.ok(
    source.includes(
      'import { DashboardNotificationsBell } from "./DashboardNotificationsBell";',
    ),
  );
  assert.ok(
    source.includes(
      "{notifications ? <DashboardNotificationsBell surface={notifications} /> : null}",
    ),
  );
});

test("dashboard topbar keeps protected dashboard header shell without mock session chip", () => {
  const source = read(DASHBOARD_TOPBAR_PATH);

  assert.ok(source.includes('<header'));
  assert.ok(source.includes("sticky top-0 z-40"));
  assert.ok(source.includes('variant="bare"'));
  assert.ok(source.includes("border border-input bg-card/95"));
  assert.equal(source.includes("Usuario mock"), false);
  assert.equal(source.includes("Clínica Demo"), false);
  assert.equal(source.includes(">CL<"), false);
});

test("stats cards keep DashboardStats typing and UI dependencies", () => {
  const source = read(STATS_CARDS_PATH);

  assert.ok(source.includes('import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";'));
  assert.ok(source.includes('import { Skeleton } from "@/components/ui/skeleton";'));
  assert.ok(source.includes('import type { DashboardStats } from "@/types";'));
  assert.ok(source.includes("interface StatsCardsProps"));
  assert.ok(source.includes("stats: DashboardStats | null;"));
  assert.ok(source.includes("loading?: boolean;"));
});

test("stats cards keep dashboard metric configuration", () => {
  const source = read(STATS_CARDS_PATH);

  assert.ok(source.includes("const statConfig = ["));
  assert.ok(source.includes('key: "totalReports" as keyof DashboardStats'));
  assert.ok(source.includes('label: "Informes totales"'));
  assert.ok(source.includes('description: "Informes registrados"'));
  assert.ok(source.includes('key: "pendingReports" as keyof DashboardStats'));
  assert.ok(source.includes('label: "Informes pendientes"'));
  assert.ok(source.includes('description: "En proceso o subidos"'));
  assert.ok(source.includes('key: "activeVisits" as keyof DashboardStats'));
  assert.ok(source.includes('label: "Visitas activas"'));
  assert.ok(source.includes('description: "Programadas o en curso"'));
  assert.ok(source.includes('key: "activePlans" as keyof DashboardStats'));
  assert.ok(source.includes('label: "Planes de ruta"'));
  assert.ok(source.includes('description: "Liberados o en curso"'));
});

test("stats cards keep four-card loading skeleton", () => {
  const source = read(STATS_CARDS_PATH);

  assert.ok(source.includes("if (loading) {"));
  assert.ok(source.includes("Array.from({ length: 4 }).map((_, i) => ("));
  assert.ok(source.includes('className="dashboard-metric-card overflow-hidden p-0"'));
  assert.ok(source.includes("<Skeleton"));
  assert.ok(source.includes("h-4 w-24"));
  assert.ok(source.includes("h-8 w-16 mb-1"));
  assert.ok(source.includes("h-3 w-32"));
  assert.deepEqual(statsCardsLoading(source), { loadingSkeletonCards: [4], loadedSkeletons: 0 });

  const neverLoading = source.replace("if (loading) {", () => "if (false)\nif (loading) {");
  assert.notEqual(neverLoading, source);
  assert.deepEqual(statsCardsLoading(neverLoading), { loadingSkeletonCards: [], loadedSkeletons: 0 });
});

test("stats cards render configured metrics with fallback and hidden icons", () => {
  const source = read(STATS_CARDS_PATH);

  assert.ok(source.includes("statConfig.map((config) => ("));
  assert.ok(source.includes("key={config.key}"));
  assert.ok(source.includes("<config.icon className=\"h-4 w-4\" />"));
  assert.ok(source.includes("dashboard-metric-card overflow-hidden p-0"));
  assert.ok(source.includes("clinical-pill"));
  assert.ok(source.includes("{config.label}"));
  assert.ok(source.includes("{stats ? stats[config.key] : \"—\"}"));
  assert.ok(source.includes("{config.description}"));
});
