import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
import { readSourceFile as read } from "../../../helpers/tracked-source-files.ts";

const STATUS_BADGE_PATH = "frontend/src/components/dashboard/StatusBadge.tsx";
const EMPTY_STATE_PATH = "frontend/src/components/dashboard/EmptyState.tsx";
const LOADING_STATE_PATH = "frontend/src/components/dashboard/LoadingState.tsx";
const ERROR_STATE_PATH = "frontend/src/components/dashboard/ErrorState.tsx";
const PAGE_HEADER_PATH =
  "frontend/src/components/dashboard/DashboardPageHeader.tsx";
const PRIVATE_SHELL_PATH =
  "frontend/src/components/dashboard/PrivateDashboardShell.tsx";

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

// TEST-GLOBAL-07 (G06-D13): the root announces role="alert" on every render and
// "Reintentar", wired to `onRetry`, renders exactly when a callback is given.
// `.includes("onRetry ? (")` also matches the inverted `!onRetry ? (`
// (C.15.1 M-D11).
function retryRendering(source: string) {
  const component = exportedFunction(parseTsx(source, ERROR_STATE_PATH), "ErrorState");
  const wiresRetry = (element: JsxNode) => {
    const onClick = effectiveAttribute(element, "onClick");
    return onClick.kind === "value" && unwrap(onClick.expression).getText() === "onRetry";
  };

  assertPlainProps(component, ["onRetry"]);

  const withCallback = renderedUnder(component, new Map([["onRetry", true]]));
  const withoutCallback = renderedUnder(component, new Map([["onRetry", false]]));
  return {
    alertRoot: [withCallback, withoutCallback].every((rendered) =>
      rendered.some((r) => r.must && staticAttribute(r.element, "role") === "alert"),
    ),
    retryWithCallback: withCallback.some(
      (r) => r.must && wiresRetry(r.element) && elementText(r.element) === "Reintentar",
    ),
    retryWithoutCallback: withoutCallback.some(
      (r) => wiresRetry(r.element) || elementText(r.element).includes("Reintentar"),
    ),
  };
}

test("status badge maps required report and logistics statuses to icon text and semantic class", () => {
  const source = read(STATUS_BADGE_PATH);
  const statuses = [
    "uploaded",
    "processing",
    "ready",
    "delivered",
    "pending",
    "in_progress",
    "done",
    "canceled",
    "error",
    "failed",
    "active",
    "inactive",
    "unknown",
  ];

  assert.ok(source.includes('import { Badge } from "@/components/ui/badge";'));
  assert.ok(source.includes("type LucideIcon"));
  assert.ok(source.includes("icon: LucideIcon;"));
  assert.ok(source.includes("semanticClass: string;"));
  assert.ok(source.includes("toneClassName: string;"));

  for (const status of statuses) {
    assert.ok(source.includes(`${status}: {`));
  }

  assert.ok(source.includes('semanticClass: "status-badge-uploaded"'));
  assert.ok(source.includes('semanticClass: "status-badge-processing"'));
  assert.ok(source.includes('semanticClass: "status-badge-ready"'));
  assert.ok(source.includes('semanticClass: "status-badge-delivered"'));
  assert.ok(source.includes('semanticClass: "status-badge-pending"'));
  assert.ok(source.includes('semanticClass: "status-badge-in-progress"'));
  assert.ok(source.includes('semanticClass: "status-badge-done"'));
  assert.ok(source.includes('semanticClass: "status-badge-canceled"'));
  assert.ok(source.includes('label: "Desconocido"'));
  assert.ok(source.includes("function isKnownStatus(status: string): status is KnownStatus"));
  assert.ok(source.includes('return isKnownStatus(status) ? status : "unknown";'));
  assert.ok(source.includes("data-status={normalizedStatus}"));
  assert.ok(source.includes('aria-hidden="true"'));
  assert.ok(source.includes("<span>{label ?? config.label}</span>"));
});

test("status badge exposes stable props and size variants", () => {
  const source = read(STATUS_BADGE_PATH);

  assert.ok(source.includes("export type StatusBadgeProps = {"));
  assert.ok(source.includes("status: string;"));
  assert.ok(source.includes("label?: string;"));
  assert.ok(source.includes('size?: StatusBadgeSize;'));
  assert.ok(source.includes('type StatusBadgeSize = "sm" | "md";'));
  assert.ok(source.includes('size = "md"'));
  assert.ok(source.includes('size === "sm"'));
  assert.ok(source.includes("className?: string;"));
});

test("empty state renders title description action and optional lucide icon", () => {
  const source = read(EMPTY_STATE_PATH);

  assert.ok(source.includes('import { Inbox, type LucideIcon } from "lucide-react";'));
  assert.ok(source.includes("title: string;"));
  assert.ok(source.includes("description?: string;"));
  assert.ok(source.includes("action?: ReactNode;"));
  assert.ok(source.includes("icon?: LucideIcon;"));
  assert.ok(source.includes("icon: Icon = Inbox"));
  assert.ok(source.includes("{title}"));
  assert.ok(source.includes("{description}"));
  assert.ok(source.includes("{action}"));
  assert.ok(source.includes('aria-hidden="true"'));
});

test("loading state renders table cards detail timeline and list variants with skeletons", () => {
  const source = read(LOADING_STATE_PATH);

  assert.ok(source.includes('import { Skeleton } from "@/components/ui/skeleton";'));
  assert.ok(source.includes('variant?: "table" | "cards" | "detail" | "timeline" | "list";'));
  assert.ok(source.includes("rows?: number;"));
  assert.ok(source.includes('variant = "cards"'));
  assert.ok(source.includes('if (variant === "table")'));
  assert.ok(source.includes('if (variant === "detail")'));
  assert.ok(source.includes('if (variant === "timeline")'));
  assert.ok(source.includes('if (variant === "list")'));
  assert.ok(source.includes('aria-busy="true"'));
  assert.ok(source.includes("getRows(rows)"));
});

test("error state announces alert and wires retry callback", () => {
  const source = read(ERROR_STATE_PATH);

  assert.ok(source.includes('"use client";'));
  assert.ok(source.includes("message: string;"));
  assert.ok(source.includes("onRetry?: () => void;"));
  assert.ok(source.includes('role="alert"'));
  assert.ok(source.includes("{message}"));
  assert.ok(source.includes("onRetry ? ("));
  assert.ok(source.includes("onClick={onRetry}"));
  assert.ok(source.includes("Reintentar"));
  assert.equal(source.includes("Error desconocido"), false);
  assert.deepEqual(retryRendering(source), {
    alertRoot: true,
    retryWithCallback: true,
    retryWithoutCallback: false,
  });

  const inverted = source.replace("{onRetry ? (", () => "{!onRetry ? (");
  assert.notEqual(inverted, source);
  assert.deepEqual(retryRendering(inverted), {
    alertRoot: true,
    retryWithCallback: false,
    retryWithoutCallback: true,
  });
});

test("dashboard page header keeps required title and optional description badge actions", () => {
  const source = read(PAGE_HEADER_PATH);

  assert.ok(source.includes("title: string;"));
  assert.ok(source.includes("description?: string;"));
  assert.ok(source.includes("badge?: ReactNode;"));
  assert.ok(source.includes("actions?: ReactNode;"));
  assert.ok(source.includes("text-xl font-semibold"));
  assert.ok(source.includes("text-sm text-muted-foreground"));
  assert.ok(source.includes("{title}"));
  assert.ok(source.includes("{description}"));
  assert.ok(source.includes("{badge}"));
  assert.ok(source.includes("{actions}"));
  assert.ok(source.includes("sm:flex-row sm:items-start sm:justify-between"));
});

test("private dashboard shell renders children through dashboard shell router", () => {
  const source = read(PRIVATE_SHELL_PATH);

  assert.ok(source.includes('import { DashboardShellRouter } from "./DashboardShellRouter";'));
  assert.ok(source.includes("children: ReactNode;"));
  assert.ok(source.includes("export function PrivateDashboardShell({"));
  assert.ok(source.includes("<DashboardShellRouter>{children}</DashboardShellRouter>"));
});
