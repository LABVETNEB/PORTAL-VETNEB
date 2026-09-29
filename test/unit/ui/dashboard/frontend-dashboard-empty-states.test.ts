import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
import { readSourceFile as read } from "../../../helpers/tracked-source-files.ts";

const DASHBOARD_PAGE_PATH = "frontend/src/app/dashboard/page.tsx";
const CLINIC_COMMAND_CENTER_PATH = "frontend/src/app/dashboard/ClinicCommandCenter.tsx";
const INFORMES_PAGE_PATH = "frontend/src/app/dashboard/informes/page.tsx";
const INFORMES_LIST_PATH =
  "frontend/src/app/dashboard/informes/InformesReportsList.tsx";
const LOGISTICA_PAGE_PATH = "frontend/src/app/dashboard/logistica/page.tsx";
const LOGISTICS_COMMAND_CENTER_PATH =
  "frontend/src/app/dashboard/logistica/LogisticsCommandCenter.tsx";
const COMMAND_CENTER_ALERTS: readonly (readonly [flag: string, message: string, empty?: string])[] = [
  ["statsLoadError", "No se pudieron cargar las métricas operativas. Intente nuevamente."],
  [
    "reportsLoadError",
    "No se pudieron cargar los informes recientes. Intente nuevamente.",
    "No hay informes recientes disponibles.",
  ],
  [
    "visitsLoadError",
    "No se pudieron cargar las visitas de campo recientes. Intente nuevamente.",
    "No hay visitas de campo recientes disponibles.",
  ],
];

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

function tagName(element: JsxNode): string {
  return (ts.isJsxElement(element) ? element.openingElement : element).tagName.getText();
}

// TEST-GLOBAL-07 (G06-D04): with its flag set the alert renders on every path
// and the empty state on none; with the flag clear the alert renders on no
// path. `.includes("statsLoadError ?")` also matches the inverted
// `!statsLoadError ?` (C.15.1 M-D01).
function alertRendering(source: string, flag: string, message: string, empty?: string) {
  const component = exportedFunction(
    parseTsx(source, CLINIC_COMMAND_CENTER_PATH),
    "ClinicCommandCenter",
  );
  const isAlert = (element: JsxNode) =>
    staticAttribute(element, "role") === "alert" && elementText(element).includes(message);
  const isEmpty = (element: JsxNode) =>
    empty !== undefined &&
    tagName(element) === "EmptyState" &&
    staticAttribute(element, "description") === empty;

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

test("dashboard overview page retains load-error variables and propagates them to command center", () => {
  const source = read(DASHBOARD_PAGE_PATH);

  assert.ok(source.includes("let statsLoadError = false;"));
  assert.ok(source.includes("let reportsLoadError = false;"));
  assert.ok(source.includes("let visitsLoadError = false;"));
  assert.ok(source.includes("statsLoadError = true;"));
  assert.ok(source.includes("reportsLoadError = true;"));
  assert.ok(source.includes("visitsLoadError = true;"));
  assert.ok(source.includes("statsLoadError={statsLoadError}"));
  assert.ok(source.includes("reportsLoadError={reportsLoadError}"));
  assert.ok(source.includes("visitsLoadError={visitsLoadError}"));
});

test("dashboard overview clinic command center distinguishes recent list load failures from empty states", () => {
  const source = read(CLINIC_COMMAND_CENTER_PATH);

  assert.ok(source.includes("statsLoadError ?"));
  assert.ok(source.includes("reportsLoadError ?"));
  assert.ok(source.includes("visitsLoadError ?"));
  assert.ok(source.includes("No se pudieron cargar las métricas operativas. Intente nuevamente."));
  assert.ok(source.includes("recentReports.length ?"));
  assert.ok(source.includes("recentVisits.length ?"));
  assert.ok(source.includes("No se pudieron cargar los informes recientes. Intente nuevamente."));
  assert.ok(source.includes("No se pudieron cargar las visitas de campo recientes. Intente nuevamente."));
  assert.ok(source.includes('role="alert"'));
  assert.ok(source.includes("No hay informes recientes disponibles."));
  assert.ok(source.includes("No hay visitas de campo recientes disponibles."));

  for (const alert of COMMAND_CENTER_ALERTS) {
    assert.deepEqual(
      alertRendering(source, ...alert),
      { whenSet: true, emptyWhenSet: false, whenClear: false },
      alert[0],
    );
  }

  const inverted = source.replace("{statsLoadError ? (", () => "{!statsLoadError ? (");
  assert.notEqual(inverted, source);
  assert.deepEqual(alertRendering(inverted, ...COMMAND_CENTER_ALERTS[0]), {
    whenSet: false,
    emptyWhenSet: false,
    whenClear: true,
  });
});

test("dashboard informes page shows empty state when reports are unavailable", () => {
  const pageSource = read(INFORMES_PAGE_PATH);
  const listSource = read(INFORMES_LIST_PATH);

  assert.ok(pageSource.includes("reportsLoadError = true;"));
  assert.ok(listSource.includes("loadError ?"));
  assert.ok(listSource.includes("reports.length > 0 ?"));
  assert.ok(listSource.includes("No se pudieron cargar los informes. Intente nuevamente."));
  assert.ok(listSource.includes('role="alert"'));
  assert.ok(listSource.includes("No hay informes disponibles."));
  assert.ok(listSource.includes("<EmptyState"));
  assert.ok(listSource.includes("visibleReports.map((report"));
});

test("dashboard logistics page distinguishes overview load failures from empty states", () => {
  const pageSource = read(LOGISTICA_PAGE_PATH);
  const commandCenterSource = read(LOGISTICS_COMMAND_CENTER_PATH);

  // Page tracks load errors and passes them to LogisticsCommandCenter
  assert.ok(pageSource.includes("let fieldVisitsLoadError = false;"));
  assert.ok(pageSource.includes("let routePlansLoadError = false;"));
  assert.ok(pageSource.includes("fieldVisitsLoadError={fieldVisitsLoadError}"));
  assert.ok(pageSource.includes("routePlansLoadError={routePlansLoadError}"));

  // LogisticsCommandCenter handles rendering with error and empty states
  assert.ok(commandCenterSource.includes("fieldVisitsLoadError ?"));
  assert.ok(commandCenterSource.includes("routePlansLoadError ?"));
  assert.ok(commandCenterSource.includes("recentVisits.length ?"));
  assert.ok(commandCenterSource.includes("recentPlans.length ?"));
  assert.ok(commandCenterSource.includes("No se pudieron cargar las visitas de campo. Intente nuevamente."));
  assert.ok(commandCenterSource.includes("No se pudieron cargar los planes de ruta. Intente nuevamente."));
  assert.ok(commandCenterSource.includes('role="alert"'));
  assert.ok(commandCenterSource.includes("No hay visitas de campo disponibles."));
  assert.ok(commandCenterSource.includes("No hay planes de ruta disponibles."));
  assert.ok(commandCenterSource.includes("recentVisits.map((visit)"));
  assert.ok(commandCenterSource.includes("recentPlans.map((plan)"));
});
