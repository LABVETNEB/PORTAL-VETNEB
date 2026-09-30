import ts from "typescript";

// TEST-GLOBAL-07 — semantic oracle over dashboard source. Substring presence
// cannot tell `flag ? <alert/> : null` from `!flag ? …` (Anexo C.15.1), so the
// specs parse the source with the TypeScript AST and evaluate what it does:
// JSX rendered under each value of a flag, the effective value of an attribute
// after later overrides, the catch that raises a load-error flag, and
// side-effect-free expressions executed with explicit bindings. Anything the
// oracle cannot decide over the flag it evaluates fails instead of passing.
// Each spec keeps its own in-memory mutation proof of the registered mutation.

export const TYPES_PATH = "frontend/src/types/index.ts";

export function parseTsx(source: string, fileName: string): ts.SourceFile {
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

export function descendants<T extends ts.Node>(
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

export function unwrap(expression: ts.Expression): ts.Expression {
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

export type SourceFunction = ts.FunctionDeclaration & { readonly body: ts.Block };

export function exportedFunction(file: ts.SourceFile, name: string): SourceFunction {
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

export type JsxNode = ts.JsxElement | ts.JsxSelfClosingElement;

export type AttributeValue =
  | { readonly kind: "absent" | "unknown" | "shorthand" }
  | { readonly kind: "value"; readonly expression: ts.Expression };

// JSX semantics: a later attribute or spread overrides an earlier one; a spread
// the oracle cannot read makes the value unknown instead of silently absent.
export function effectiveAttribute(element: JsxNode, name: string): AttributeValue {
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

export function staticAttribute(element: JsxNode, name: string): string | undefined {
  const value = effectiveAttribute(element, name);

  if (value.kind !== "value") return undefined;

  const expression = unwrap(value.expression);

  return ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)
    ? expression.text
    : undefined;
}

// Text shown whenever the element renders: JSX text reached through nested
// elements only, never through an expression container (a conditional child).
export function elementText(element: JsxNode): string {
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
export function assertPlainProps(component: SourceFunction, names: readonly string[]): void {
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

export type Env = ReadonlyMap<string, boolean>;
export type Rendered = { readonly element: JsxNode; readonly must: boolean };
export type Reached = { readonly expression: ts.Expression; readonly must: boolean };

// Three-valued truth of a condition: true, false or undefined (not decidable
// from the env). A condition over the env that it cannot read fails closed.
export function truth(node: ts.Expression, env: Env): boolean | undefined {
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
export function collectReturns(
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
export function render(node: ts.Node, env: Env, must: boolean, out: Rendered[]): void {
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

export function renderedUnder(component: SourceFunction, env: Env): Rendered[] {
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
export function failureFlagViolations(
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

const EVALUATION_GLOBALS = new Set(["undefined", "Array", "Boolean"]);

// Runs a side-effect-free source expression with exactly the given bindings; a
// free name the test did not bind fails instead of resolving to a global.
export function evaluate(expression: ts.Expression, scope: Readonly<Record<string, unknown>>): unknown {
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

export function jsxElements(root: ts.Node): JsxNode[] {
  return descendants(
    root,
    (node): node is JsxNode => ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node),
  );
}

export function tagName(element: JsxNode): string {
  return (ts.isJsxElement(element) ? element.openingElement : element).tagName.getText();
}

function literalTuple(types: string, name: string): string[] {
  const [declaration] = descendants(
    parseTsx(types, TYPES_PATH),
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
export function activeStatuses(source: string, fileName: string, types: string) {
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
    activeVisits: filtered("activeVisits", "fieldVisits", literalTuple(types, "FIELD_VISIT_STATUSES")),
    activePlans: filtered("activePlans", "routePlans", literalTuple(types, "ROUTE_PLAN_STATUSES")),
  };
}
