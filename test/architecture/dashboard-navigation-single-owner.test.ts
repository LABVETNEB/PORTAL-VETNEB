import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";

import {
  listTrackedFiles,
  listTrackedSourceFiles,
  readSourceFile,
} from "../helpers/tracked-source-files.ts";

// PR-NAV-07 — one owner of module navigation
// (docs/audit/AUDITORIA_ARQUITECTURA_NAVEGACION_FSM_HOJA_DE_RUTA.md §11.1, S7, S9).
//
//   A. `router.push|replace` towards a `?module=` selection exists in one
//      place: the interpreter the provider hands to the coordinator.
//   B. Nothing in `frontend/src` writes the session history natively
//      (`history.pushState|replaceState|back|forward|go`), the provider included.
//   C. The machine has one interpreter and the adapters one registrant.
//
// The scan is structural (TypeScript AST over every tracked source of
// `frontend/src`), so a comment that names a forbidden call is not a call and
// an alias of the router or of `history` is still the router or `history`.
//
// Exceptions are the ones the roadmap states, each tied to one construct:
//   - DT-10 (§11.3): the machine ignores a selection in BOOTING / FAILED, the
//     adapter declines and the chrome keeps its own navigation. A route control
//     may carry a module href when its click honours the claim, and the module
//     search may push when the request was NOT claimed.
//   - "Limpiar" of the audit filters (§11.2, PR-NAV-03 exclusions): an external
//     `router.replace`, a commit the machine classifies (#22 / #23).
//   - The notifications bell (§5.2): a deep link with no claim, the same
//     external commit. Listed here as it stands, not endorsed: see the fiche.

const FRONTEND_SRC = "frontend/src";
const PROVIDER = "frontend/src/components/dashboard/DashboardNavigationProvider.tsx";
const MODULE_SEARCH = "frontend/src/components/dashboard/WorkspaceAppBar.tsx";
const DASHBOARD_SCOPES = ["frontend/src/app/dashboard/", "frontend/src/components/dashboard/"];

const ROUTER_METHODS = new Set(["push", "replace", "back", "forward"]);
const HISTORY_METHODS = new Set(["pushState", "replaceState", "back", "forward", "go"]);
const MODULE_GRAMMAR = /[?&]module=|MODULE_QUERY_PARAM|ModuleHref\b/;
// What asks the owner: the two adapters, and the props and methods that relay
// one of them to a control (`card.claim`, the mobile bar's handlers, OPEN_ROUTE).
const CLAIMS = new Set([
  "requestAdminModuleActivate",
  "requestClinicModuleActivate",
  "claim",
  "onActivate",
  "onNavigate",
  "openRoute",
]);

type Destination = "module" | "plain" | "opaque" | "none";

type NavigationCall = {
  readonly file: string;
  readonly family: "router" | "history";
  readonly method: string;
  /** `false`: the method is referenced without being called (bound, passed on). */
  readonly called: boolean;
  readonly argument: string;
  readonly destination: Destination;
  /** Inside `navigate` of the host given to `createNavigationCoordinator`. */
  readonly interpreter: boolean;
  /** Condition of the nearest `if` whose consequent holds the call. */
  readonly guard: string | null;
};

type RouteControl = {
  readonly file: string;
  readonly href: string;
  readonly destination: Destination;
  readonly replace: boolean;
  readonly honoursClaim: boolean;
};

type Scan = {
  readonly calls: readonly NavigationCall[];
  readonly controls: readonly RouteControl[];
  readonly coordinators: number;
  readonly identifiers: ReadonlySet<string>;
  readonly source: ts.SourceFile;
};

function compact(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function unwrap(node: ts.Expression): ts.Expression {
  let current = node;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isNonNullExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isSatisfiesExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function combine(destinations: readonly Destination[]): Destination {
  if (destinations.includes("module")) return "module";
  return destinations.length > 0 && destinations.every((destination) => destination === "plain") ? "plain" : "opaque";
}

/** `const` initializers and returned expressions of a file's own declarations, by name. */
function declarationsOf(source: ts.SourceFile): ReadonlyMap<string, readonly ts.Expression[] | null> {
  const declarations = new Map<string, readonly ts.Expression[] | null>();
  // A name declared twice is no one's: the reading stays opaque.
  const declare = (name: string, values: readonly ts.Expression[]) =>
    declarations.set(name, declarations.has(name) ? null : values);
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer !== undefined) {
      declare(node.name.text, [node.initializer]);
    }
    if (ts.isFunctionDeclaration(node) && node.name !== undefined && node.body !== undefined) {
      const returned: ts.Expression[] = [];
      const collect = (inner: ts.Node) => {
        if (ts.isReturnStatement(inner) && inner.expression !== undefined) returned.push(inner.expression);
        if (!ts.isFunctionLike(inner)) inner.forEachChild(collect);
      };
      node.body.forEachChild(collect);
      declare(node.name.text, returned);
    }
    node.forEachChild(visit);
  };
  visit(source);
  return declarations;
}

/**
 * Where an href expression points, read from the expression and from the
 * declarations of its own file. What comes from elsewhere (a prop, a field)
 * stays `opaque`.
 */
function destinationOf(
  node: ts.Expression | undefined,
  declarations: ReadonlyMap<string, readonly ts.Expression[] | null>,
  depth = 0,
): Destination {
  if (node === undefined) return "none";
  const expression = unwrap(node);
  const text = expression.getText();
  if (MODULE_GRAMMAR.test(text)) return "module";
  if (depth < 4) {
    const follow = (next: ts.Expression) => destinationOf(next, declarations, depth + 1);
    if (ts.isConditionalExpression(expression)) return combine([follow(expression.whenTrue), follow(expression.whenFalse)]);
    if (ts.isBinaryExpression(expression) && expression.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) {
      return combine([follow(expression.left), follow(expression.right)]);
    }
    const named = ts.isCallExpression(expression) ? unwrap(expression.expression) : expression;
    const declared = ts.isIdentifier(named) ? declarations.get(named.text) : undefined;
    if (declared != null) return combine(declared.map(follow));
  }
  if (ts.isStringLiteralLike(expression)) return "plain";
  // The retry targets this document's current URL, including query and hash.
  // Pin the entire expression: omitting or replacing any part is opaque again.
  if (text === "`${window.location.pathname}${window.location.search}${window.location.hash}`") return "plain";
  // `ROUTES.x`: a path of the route table, which holds no query.
  if (ts.isPropertyAccessExpression(expression) && expression.expression.getText() === "ROUTES") return "plain";
  // A template that spells its own query in place, and it is not `module`.
  if (ts.isTemplateExpression(expression)) {
    const spelled = [expression.head, ...expression.templateSpans.map((span) => span.literal)]
      .map((part) => part.text)
      .join("");
    if (/\?[A-Za-z]+=/.test(spelled)) return "plain";
  }
  return "opaque";
}

function isClaimCall(node: ts.Expression): boolean {
  const call = unwrap(node);
  if (!ts.isCallExpression(call)) return false;
  const callee = unwrap(call.expression);
  const name = ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.text : null;
  return name !== null && CLAIMS.has(name);
}

/** A claim, or a choice between claims: every outcome asked the owner. */
function isClaim(node: ts.Expression): boolean {
  const expression = unwrap(node);
  if (ts.isConditionalExpression(expression)) return isClaim(expression.whenTrue) && isClaim(expression.whenFalse);
  return isClaimCall(expression);
}

function preventsDefault(statement: ts.Statement): boolean {
  if (!ts.isExpressionStatement(statement)) return false;
  const call = unwrap(statement.expression);
  return (
    ts.isCallExpression(call) &&
    call.arguments.length === 0 &&
    ts.isPropertyAccessExpression(call.expression) &&
    call.expression.name.text === "preventDefault"
  );
}

/**
 * The click handler stops the control's own navigation exactly when the owner
 * took the selection: a statement of the handler itself of the form
 * `if (<claim>) event.preventDefault()`, where the condition is the claim or a
 * `const` of the handler that holds it, with no way out of the handler before.
 */
function honoursClaim(handler: ts.Expression | undefined): boolean {
  const inline = handler === undefined ? undefined : unwrap(handler);
  if (inline === undefined || !(ts.isArrowFunction(inline) || ts.isFunctionExpression(inline))) return false;
  if (!ts.isBlock(inline.body)) return false;

  const held = new Set<string>();
  for (const statement of inline.body.statements) {
    if (ts.isVariableStatement(statement)) {
      const constant = (statement.declarationList.flags & ts.NodeFlags.Const) !== 0;
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) continue;
        if (constant && declaration.initializer !== undefined && isClaim(declaration.initializer)) {
          held.add(declaration.name.text);
        } else {
          held.delete(declaration.name.text);
        }
      }
      continue;
    }
    if (ts.isIfStatement(statement)) {
      const condition = unwrap(statement.expression);
      const claimed = isClaimCall(condition) || (ts.isIdentifier(condition) && held.has(condition.text));
      const consequent = ts.isBlock(statement.thenStatement)
        ? [...statement.thenStatement.statements]
        : [statement.thenStatement];
      if (claimed && consequent.some(preventsDefault)) return true;
    }
    // Anything that can leave the handler first means the claim may never run.
    let leaves = false;
    const visit = (node: ts.Node) => {
      if (ts.isReturnStatement(node) || ts.isThrowStatement(node)) leaves = true;
      if (!ts.isFunctionLike(node)) node.forEachChild(visit);
    };
    visit(statement);
    if (leaves) return false;
  }
  return false;
}

function memberName(node: ts.Node): string | null {
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  if (ts.isElementAccessExpression(node)) {
    const key = unwrap(node.argumentExpression);
    return ts.isStringLiteralLike(key) ? key.text : "<computed>";
  }
  return null;
}

const scanned = new Map<string, Scan>();

/** One parse per distinct text: a mutation re-reads the file it changed only. */
function scan(file: string, text: string): Scan {
  const key = `${file}\0${text}`;
  const known = scanned.get(key);
  if (known !== undefined) return known;
  const fresh = parse(file, text);
  scanned.set(key, fresh);
  return fresh;
}

function parse(file: string, text: string): Scan {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const routerHooks = new Set(["useRouter"]);
  const routerTypes = new Set(["AppRouterInstance"]);
  const routers = new Set<string>();
  const histories = new Set<string>();
  const declarations = declarationsOf(source);
  const routerMethods = new Map<string, string>();
  const historyMethods = new Map<string, string>();
  const identifiers = new Set<string>();

  const walk = (node: ts.Node, visitor: (current: ts.Node) => void) => {
    visitor(node);
    node.forEachChild((child) => walk(child, visitor));
  };

  const isRouterHookCall = (node: ts.Expression) => {
    const call = unwrap(node);
    if (!ts.isCallExpression(call)) return false;
    const callee = unwrap(call.expression);
    return (
      (ts.isIdentifier(callee) && routerHooks.has(callee.text)) ||
      (ts.isPropertyAccessExpression(callee) && routerHooks.has(callee.name.text))
    );
  };
  const isRouter = (node: ts.Expression): boolean => {
    const expression = unwrap(node);
    if (ts.isIdentifier(expression)) return routers.has(expression.text) || /router$/i.test(expression.text);
    if (ts.isPropertyAccessExpression(expression)) return /router$/i.test(expression.name.text);
    return isRouterHookCall(expression);
  };
  const isHistory = (node: ts.Expression): boolean => {
    const expression = unwrap(node);
    if (ts.isIdentifier(expression)) return expression.text === "history" || histories.has(expression.text);
    return (
      (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) &&
      memberName(expression) === "history"
    );
  };
  const mentionsRouterType = (type: ts.TypeNode | undefined) =>
    type !== undefined &&
    ([...routerTypes].some((name) => new RegExp(`\\b${name}\\b`).test(type.getText())) ||
      [...routerHooks].some((name) => type.getText().includes(`typeof ${name}`)));

  // Bindings first, to a fixpoint: an alias can be declared before its source.
  for (let size = -1, pass = 0; size !== pass; ) {
    size = pass;
    walk(source, (node) => {
      if (ts.isImportSpecifier(node) && (node.propertyName ?? node.name).text === "useRouter") {
        routerHooks.add(node.name.text);
      }
      if (ts.isTypeAliasDeclaration(node) && mentionsRouterType(node.type)) routerTypes.add(node.name.text);
      if ((ts.isParameter(node) || ts.isVariableDeclaration(node)) && ts.isIdentifier(node.name)) {
        if (mentionsRouterType(node.type)) routers.add(node.name.text);
      }
      if (!ts.isVariableDeclaration(node) || node.initializer === undefined) return;
      const initializer = unwrap(node.initializer);
      const fromRouter = isRouterHookCall(initializer) || (ts.isIdentifier(initializer) && isRouter(initializer));
      const fromHistory = isHistory(initializer);

      if (ts.isIdentifier(node.name)) {
        if (fromRouter) routers.add(node.name.text);
        if (fromHistory) histories.add(node.name.text);
        // `const go = router.push`, `const back = history.back.bind(history)`.
        const bound =
          ts.isCallExpression(initializer) && ts.isPropertyAccessExpression(initializer.expression)
            ? unwrap(initializer.expression.expression)
            : initializer;
        const method = memberName(bound);
        if (method !== null && (ts.isPropertyAccessExpression(bound) || ts.isElementAccessExpression(bound))) {
          if (ROUTER_METHODS.has(method) && isRouter(bound.expression)) routerMethods.set(node.name.text, method);
          if (HISTORY_METHODS.has(method) && isHistory(bound.expression)) historyMethods.set(node.name.text, method);
        }
        // `const push = router.push; const go = push;`: an alias of an alias.
        if (ts.isIdentifier(bound)) {
          const routerMethod = routerMethods.get(bound.text);
          const historyMethod = historyMethods.get(bound.text);
          if (routerMethod !== undefined) routerMethods.set(node.name.text, routerMethod);
          if (historyMethod !== undefined) historyMethods.set(node.name.text, historyMethod);
        }
        return;
      }
      if (!ts.isObjectBindingPattern(node.name)) return;
      for (const element of node.name.elements) {
        if (!ts.isIdentifier(element.name)) continue;
        const property = (element.propertyName ?? element.name).getText();
        if (fromRouter && ROUTER_METHODS.has(property)) routerMethods.set(element.name.text, property);
        if (fromHistory && HISTORY_METHODS.has(property)) historyMethods.set(element.name.text, property);
        // `const { history } = window`.
        if (property === "history") histories.add(element.name.text);
      }
    });
    pass = routerHooks.size + routerTypes.size + routers.size + histories.size + routerMethods.size + historyMethods.size;
  }

  const calls: NavigationCall[] = [];
  const controls: RouteControl[] = [];
  let coordinators = 0;

  const context = (node: ts.Node) => {
    let interpreter = false;
    let insideNavigate = false;
    let guard: string | null = null;
    for (let child: ts.Node = node, parent = node.parent; parent !== undefined; child = parent, parent = parent.parent) {
      if (guard === null && ts.isIfStatement(parent) && parent.thenStatement === child) {
        guard = compact(parent.expression.getText());
      }
      if (
        (ts.isMethodDeclaration(parent) || ts.isPropertyAssignment(parent)) &&
        parent.name.getText() === "navigate"
      ) {
        insideNavigate = true;
      }
      if (
        insideNavigate &&
        ts.isCallExpression(parent) &&
        unwrap(parent.expression).getText() === "createNavigationCoordinator"
      ) {
        interpreter = true;
      }
    }
    return { interpreter, guard };
  };

  const record = (
    node: ts.Node,
    family: NavigationCall["family"],
    method: string,
    call: ts.CallExpression | null,
  ) => {
    const first = call?.arguments[0];
    calls.push({
      file,
      family,
      method,
      called: call !== null,
      argument: call === null ? "" : compact(call.arguments.map((argument) => argument.getText()).join(", ")),
      destination: destinationOf(first, declarations),
      ...context(node),
    });
  };

  const callOf = (node: ts.Expression): ts.CallExpression | null => {
    let current: ts.Node = node;
    while (ts.isParenthesizedExpression(current.parent) || ts.isNonNullExpression(current.parent)) {
      current = current.parent;
    }
    return ts.isCallExpression(current.parent) && current.parent.expression === current ? current.parent : null;
  };

  /** The identifier reads a binding: not a declared name, a member name or an attribute. */
  const isValueUse = (node: ts.Identifier) => {
    const parent = node.parent;
    if ((ts.isVariableDeclaration(parent) || ts.isBindingElement(parent) || ts.isParameter(parent)) && parent.name === node) {
      return false;
    }
    if (ts.isBindingElement(parent) && parent.propertyName === node) return false;
    if (ts.isPropertyAccessExpression(parent) && parent.name === node) return false;
    if ((ts.isPropertyAssignment(parent) || ts.isJsxAttribute(parent)) && parent.name === node) return false;
    return !ts.isTypeNode(parent) && !ts.isImportSpecifier(parent);
  };

  walk(source, (node) => {
    if (ts.isIdentifier(node)) identifiers.add(node.text);

    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      const method = memberName(node) as string;
      if (isHistory(node.expression) && (HISTORY_METHODS.has(method) || method === "<computed>")) {
        record(node, "history", method, callOf(node));
      } else if (ROUTER_METHODS.has(method) && isRouter(node.expression)) {
        record(node, "router", method, callOf(node));
      }
    }

    if (ts.isCallExpression(node)) {
      const callee = unwrap(node.expression);
      if (ts.isIdentifier(callee) && callee.text === "createNavigationCoordinator") coordinators += 1;
    }

    // A method taken off the router or off `history`: every use of the name
    // counts, called or handed on (`go(href)`, `go.call(router, href)`, `{ go }`).
    if (ts.isIdentifier(node) && isValueUse(node)) {
      const routerMethod = routerMethods.get(node.text);
      const historyMethod = historyMethods.get(node.text);
      if (routerMethod !== undefined) record(node, "router", routerMethod, callOf(node));
      if (historyMethod !== undefined) record(node, "history", historyMethod, callOf(node));
    }

    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      node.tagName.getText() === "PublicRouteControl"
    ) {
      const attribute = (name: string) =>
        node.attributes.properties.find(
          (property): property is ts.JsxAttribute => ts.isJsxAttribute(property) && property.name.getText() === name,
        );
      const value = (found: ts.JsxAttribute | undefined) => {
        const initializer = found?.initializer;
        if (initializer === undefined) return undefined;
        return ts.isJsxExpression(initializer) ? initializer.expression : (initializer as ts.Expression);
      };
      const href = value(attribute("href"));

      controls.push({
        file,
        href: href === undefined ? "" : compact(href.getText()),
        destination: destinationOf(href, declarations),
        replace: attribute("replace") !== undefined,
        honoursClaim: honoursClaim(value(attribute("onClick"))),
      });
    }
  });

  return { calls, controls, coordinators, identifiers, source };
}

function inDashboard(file: string): boolean {
  return DASHBOARD_SCOPES.some((scope) => file.startsWith(scope));
}

/** The roadmap's external commits: one call each, spelled as it stands. */
const EXTERNAL_ROUTER_COMMITS: readonly Pick<NavigationCall, "file" | "method" | "argument">[] = [
  // §5.2: a notification's deep link. No claim; the machine reads it as #22 / #23.
  { file: "frontend/src/components/dashboard/DashboardNotificationsBell.tsx", method: "push", argument: "destination" },
];

const EXTERNAL_ROUTE_CONTROLS: readonly Pick<RouteControl, "file" | "href" | "replace">[] = [
  // §11.2: "Limpiar" of the audit filters, an external `router.replace`.
  { file: "frontend/src/app/dashboard/admin/AdminAuditFilterBar.tsx", href: '"/dashboard/admin?module=audit-log"', replace: true },
];

const RETIRED = [
  "useNavigationFlight",
  "createNavigationFlight",
  "recordClinicNavigationIntent",
  "applyClinicUrlCommit",
  "relinquishClinicNavigationIntent",
  "confirmClinicHubEntry",
] as const;

const OWNER_REGISTRATION: Readonly<Record<string, string>> = {
  registerAdminNavigationOwner: "frontend/src/lib/admin-hub-reset.ts",
  registerClinicNavigationOwner: "frontend/src/lib/clinic-hub-reset.ts",
};

/** Every breach of the single-owner contract in a set of sources. */
function ownershipViolations(sources: ReadonlyMap<string, string>): string[] {
  const violations: string[] = [];
  const scans = new Map([...sources].map(([file, text]) => [file, scan(file, text)] as const));
  const externalsSeen = new Set<string>();
  let coordinators = 0;
  let interpreterCalls = 0;

  for (const [file, { calls, controls, coordinators: created, identifiers, source }] of scans) {
    coordinators += created;
    if (created > 0 && file !== PROVIDER) violations.push(`${file}: a second interpreter of the navigation machine`);

    for (const call of calls) {
      const where = `${file}: ${call.family}.${call.method}(${call.argument})`;

      // B — no native history, anywhere, the provider included (S9).
      if (call.family === "history") {
        violations.push(`${where}: native history is no one's to write`);
        continue;
      }
      if (!call.called) {
        violations.push(`${where}: the router method leaves the call site`);
        continue;
      }
      if (call.interpreter) {
        interpreterCalls += 1;
        if (file !== PROVIDER) violations.push(`${where}: the interpreter lives in the provider`);
        if (call.method !== "push" && call.method !== "replace") violations.push(`${where}: not an effect of the machine`);
        continue;
      }
      // A — outside the interpreter.
      if (file === PROVIDER) {
        violations.push(`${where}: the provider navigates through its interpreter only`);
        continue;
      }
      if (call.method === "back" || call.method === "forward") {
        if (inDashboard(file)) violations.push(`${where}: a traversal the machine did not issue`);
        continue;
      }
      if (call.destination === "module") {
        // DT-10: the module search pushes only what the owner declined.
        const declined =
          file === MODULE_SEARCH &&
          call.method === "push" &&
          call.guard === "!claimed" &&
          /const claimed = [^;]*requestAdminModuleActivate\([^;]*requestClinicModuleActivate\(/.test(
            compact(source.getText()),
          );
        if (!declined) violations.push(`${where}: a module selection navigated outside the owner`);
        continue;
      }
      if (call.destination === "opaque" && inDashboard(file)) {
        const external = EXTERNAL_ROUTER_COMMITS.find(
          (entry) => entry.file === file && entry.method === call.method && entry.argument === call.argument,
        );
        if (external === undefined) {
          violations.push(`${where}: a dashboard navigation whose destination cannot be read`);
        } else if (externalsSeen.has(where)) {
          violations.push(`${where}: an exception covers one call`);
        }
        externalsSeen.add(where);
      }
    }

    for (const control of controls) {
      const where = `${file}: <PublicRouteControl href=${control.href}>`;
      const external = EXTERNAL_ROUTE_CONTROLS.some(
        (entry) => entry.file === file && entry.href === control.href && entry.replace === control.replace,
      );
      if (external) {
        if (externalsSeen.has(where)) violations.push(`${where}: an exception covers one control`);
        externalsSeen.add(where);
        continue;
      }
      const selectsModule =
        control.destination === "module" || (control.destination === "opaque" && inDashboard(file));
      // DT-10: the control falls back to its href only when the owner declines.
      if (selectsModule && !control.honoursClaim) {
        violations.push(`${where}: a module href that does not ask the owner first`);
      }
    }

    // C — nothing of the retired owners, and one registrant of the adapters.
    for (const retired of RETIRED) {
      if (identifiers.has(retired)) violations.push(`${file}: retired navigation authority ${retired}`);
    }
    for (const [register, adapter] of Object.entries(OWNER_REGISTRATION)) {
      if (identifiers.has(register) && file !== PROVIDER && file !== adapter) {
        violations.push(`${file}: ${register} has one caller, the provider`);
      }
    }
  }

  if (scans.has(PROVIDER)) {
    if (coordinators !== 1) violations.push(`${PROVIDER}: expected one interpreter, found ${coordinators}`);
    if (interpreterCalls !== 2) {
      violations.push(`${PROVIDER}: the interpreter is one push and one replace, found ${interpreterCalls} calls`);
    }
  }
  for (const entry of [...EXTERNAL_ROUTER_COMMITS, ...EXTERNAL_ROUTE_CONTROLS]) {
    if (scans.has(entry.file) && ![...externalsSeen].some((seen) => seen.startsWith(`${entry.file}: `))) {
      violations.push(`${entry.file}: a stale exception, the call it names is gone`);
    }
  }

  return violations;
}

// `.ts` through the inventory that skips a file deleted from the working tree.
const TREE: ReadonlyMap<string, string> = new Map(
  [
    ...listTrackedSourceFiles(FRONTEND_SRC).filter((file) => file.endsWith(".ts")),
    ...listTrackedFiles().filter((file) => file.startsWith(`${FRONTEND_SRC}/`) && file.endsWith(".tsx")),
  ].map((file) => [file, readSourceFile(file)] as const),
);

/** The tree with one file replaced or added. */
function withSource(file: string, text: string): ReadonlyMap<string, string> {
  return new Map([...TREE, [file, text]]);
}

/** A tracked source with one exact fragment replaced; the fragment must exist. */
function mutated(file: string, from: string, to: string): ReadonlyMap<string, string> {
  const text = TREE.get(file);
  assert.ok(text !== undefined && text.includes(from), `${file} no longer holds the mutated fragment: ${from}`);
  return withSource(file, text.replace(from, to));
}

const SECOND_OWNER = "frontend/src/components/dashboard/SecondOwner.tsx";
const CLINIC_VIEW = "frontend/src/components/dashboard/ClinicDashboardWorkspaceController.tsx";

function secondOwner(body: string): ReadonlyMap<string, string> {
  return withSource(
    SECOND_OWNER,
    [
      'import { useRouter } from "next/navigation";',
      'import { ROUTES } from "@/lib/routes";',
      'import { buildDashboardModuleHref } from "@/features/dashboard/application";',
      'import { PublicRouteControl } from "@/components/public/PublicRouteControl";',
      "export function SecondOwner({ moduleId, href }: { moduleId: string; href: string }) {",
      body,
      "  return null;",
      "}",
    ].join("\n"),
  );
}

function assertBreach(sources: ReadonlyMap<string, string>, expected: RegExp, message: string) {
  const violations = ownershipViolations(sources);
  assert.ok(
    violations.some((violation) => expected.test(violation)),
    `${message}\nfound: ${JSON.stringify(violations)}`,
  );
}

test("the tree has one owner of module navigation", () => {
  assert.ok(TREE.has(PROVIDER) && TREE.has(MODULE_SEARCH), "the scan reaches the provider and the chrome");
  assert.ok(TREE.size > 100, "the scan covers frontend/src, not a sample of it");
  assert.deepEqual(ownershipViolations(TREE), []);
});

test("the scan sees the calls it rules on, where they are", () => {
  const all = [...TREE].flatMap(([file, text]) => scan(file, text).calls);
  const router = all.filter((call) => call.family === "router");

  assert.deepEqual(
    router.filter((call) => call.interpreter).map((call) => `${call.file} ${call.method}(${call.argument})`),
    [`${PROVIDER} push(href, { scroll: false })`, `${PROVIDER} replace(href, { scroll: false })`],
    "A: the interpreter is the provider's `navigate`, one push and one replace",
  );
  assert.deepEqual(
    router.filter((call) => call.destination === "module").map((call) => `${call.file} ${call.guard}`),
    [`${MODULE_SEARCH} !claimed`],
    "DT-10: the only module href pushed by hand is the one the owner declined",
  );
  assert.deepEqual(
    all.filter((call) => call.family === "history"),
    [],
    "B / S9: no native history call in frontend/src",
  );
  assert.equal(
    listTrackedSourceFiles(FRONTEND_SRC).includes("frontend/src/components/dashboard/useNavigationFlight.ts"),
    false,
    "the flight hook is retired",
  );
});

test("fail-closed: a second owner that pushes or replaces a module selection is rejected", () => {
  for (const [body, why] of [
    ["  const router = useRouter();\n  router.push(buildDashboardModuleHref(ROUTES.dashboard, moduleId));", "push of the module grammar"],
    ['  const router = useRouter();\n  router.replace("/dashboard?module=informes", { scroll: false });', "replace of a literal module url"],
    ["  const router = useRouter();\n  router.replace(`${ROUTES.dashboardAdmin}?module=${moduleId}`);", "replace of a module template"],
    ["  const router = useRouter();\n  router.push(href);", "push of a destination that cannot be read"],
    ["  const navigation = useRouter();\n  const go = navigation;\n  go.push(buildDashboardModuleHref(ROUTES.dashboard, moduleId));", "an alias of the router"],
    ["  const { replace } = useRouter();\n  replace(buildDashboardModuleHref(ROUTES.dashboard, moduleId));", "a destructured method"],
    ["  const router = useRouter();\n  const go = router.push;\n  go(buildDashboardModuleHref(ROUTES.dashboard, moduleId));", "a method taken off the router"],
    ['  useRouter()["push"](buildDashboardModuleHref(ROUTES.dashboard, moduleId));', "the hook called in place"],
    ["  const router = useRouter();\n  const push = router.push;\n  const go = push;\n  go(buildDashboardModuleHref(ROUTES.dashboard, moduleId));", "an alias of a method alias"],
    ["  const { replace } = useRouter();\n  const first = replace;\n  const second = first;\n  second(buildDashboardModuleHref(ROUTES.dashboard, moduleId));", "a chain of aliases of a destructured method"],
    ["  const router = useRouter();\n  const push = router.push;\n  push.call(router, buildDashboardModuleHref(ROUTES.dashboard, moduleId));", "a method alias invoked through call"],
    ["  const router = useRouter();\n  const push = router.push;\n  const go = push.bind(router);\n  go(buildDashboardModuleHref(ROUTES.dashboard, moduleId));", "a bound alias of a method alias"],
    ["  const router = useRouter();\n  router.back();", "a traversal the machine did not issue"],
  ] as const) {
    assertBreach(secondOwner(body), new RegExp(`^${SECOND_OWNER}: router\\.`), why);
  }

  // A view that takes the router back is a second owner, whatever it names it.
  assertBreach(
    mutated(
      CLINIC_VIEW,
      "const navigation = useClinicDashboardNavigation();",
      'const navigation = useClinicDashboardNavigation();\n  const next = useRouter();\n  next.replace("/dashboard?module=perfil");',
    ),
    new RegExp(`^${CLINIC_VIEW}: router\\.replace`),
    "the clinic view navigating a module",
  );
});

test("fail-closed: native history is rejected everywhere, the provider included", () => {
  for (const [body, method] of [
    ['  window.history.pushState(null, "", "/dashboard?module=informes");', "pushState"],
    ['  history.replaceState(null, "", "/dashboard?module=informes");', "replaceState"],
    ["  window.history.back();", "back"],
    ["  const stack = window.history;\n  stack.back();", "back"],
    ["  const { history: stack } = window;\n  stack.go(-1);", "go"],
    ['  globalThis.history["pushState"](null, "", href);', "pushState"],
    ["  const { replaceState } = window.history;\n  replaceState(null, \"\", href);", "replaceState"],
    ["  const back = history.back.bind(history);\n  back();", "back"],
    ["  const back = window.history.back;\n  const leave = back;\n  leave();", "back"],
    ["  window.history[moduleId as \"back\"]();", "<computed>"],
  ] as const) {
    assertBreach(secondOwner(body), new RegExp(`^${SECOND_OWNER}: history\\.${method}\\(`), `history.${method}: ${body}`);
  }

  for (const call of [
    'window.history.pushState(null, "", href);',
    'window.history.replaceState(null, "", href);',
    "window.history.back();",
  ]) {
    assertBreach(
      mutated(PROVIDER, "const href = surface.href(effect.to);", `const href = surface.href(effect.to);\n        ${call}`),
      new RegExp(`^${PROVIDER}: history\\.`),
      `S9 binds the provider too: ${call}`,
    );
  }
});

test("fail-closed: the provider navigates through its interpreter and nowhere else", () => {
  assertBreach(
    mutated(PROVIDER, "    store.mount();", '    store.mount();\n    useRouter().push("/dashboard?module=informes");'),
    /the provider navigates through its interpreter only/,
    "a push from the owner's lifecycle",
  );
  assertBreach(
    mutated(PROVIDER, "else window.location.replace(href);", "else router.replace(href);"),
    /the interpreter is one push and one replace, found 3 calls/,
    "a third router call inside the interpreter",
  );
  assertBreach(
    withSource(
      SECOND_OWNER,
      "createNavigationCoordinator(MACHINE, config, hydrated, { navigate(effect) { router.push(href); } });",
    ),
    /a second interpreter of the navigation machine/,
    "a second coordinator",
  );
  assertBreach(
    secondOwner("  registerClinicNavigationOwner({ selectModule: () => true, selectHub() {} });"),
    /registerClinicNavigationOwner has one caller, the provider/,
    "a second registrant of the clinic adapter",
  );
  assertBreach(
    secondOwner("  const flight = useNavigationFlight(() => null);"),
    /retired navigation authority useNavigationFlight/,
    "the retired flight coming back",
  );
});

test("fail-closed: the DT-10 fallback is the declined request, not a navigation of its own", () => {
  const fallback = "if (!claimed) router.push(buildDashboardModuleHref(basePath, entry.moduleId));";

  assertBreach(
    mutated(MODULE_SEARCH, fallback, "router.push(buildDashboardModuleHref(basePath, entry.moduleId));"),
    new RegExp(`^${MODULE_SEARCH}: router\\.push.*outside the owner`),
    "the module search pushing a claimed request",
  );
  assertBreach(
    mutated(MODULE_SEARCH, fallback, "if (claimed) router.push(buildDashboardModuleHref(basePath, entry.moduleId));"),
    /outside the owner/,
    "the guard inverted",
  );
  assertBreach(
    mutated(MODULE_SEARCH, "? requestAdminModuleActivate(entry.moduleId)", "? false"),
    /outside the owner/,
    "a claim that never asks the owner",
  );

  // A route control: the module href is its pre-hydration fallback, and its
  // click asks the owner before the control navigates.
  assertBreach(
    secondOwner("  return <PublicRouteControl href={buildDashboardModuleHref(ROUTES.dashboard, moduleId)}>x</PublicRouteControl>;"),
    /a module href that does not ask the owner first/,
    "a module control with no claim",
  );
  assertBreach(
    secondOwner('  return <PublicRouteControl href="/dashboard/admin?module=audit-log" replace>x</PublicRouteControl>;'),
    /a module href that does not ask the owner first/,
    "the Limpiar exception is one control of one file",
  );
  assertBreach(
    secondOwner("  return <PublicRouteControl href={href} onClick={() => console.log(moduleId)}>x</PublicRouteControl>;"),
    /a module href that does not ask the owner first/,
    "an unreadable href whose click claims nothing",
  );
  assertBreach(
    secondOwner(
      "  return <PublicRouteControl href={href} onClick={() => { requestClinicModuleActivate(moduleId); }}>x</PublicRouteControl>;",
    ),
    /a module href that does not ask the owner first/,
    "a claim that does not stop the control's own navigation",
  );

  // The prevention has to follow from the claim, not sit beside it.
  const control = (handler: string) =>
    secondOwner(
      `  return <PublicRouteControl href={buildDashboardModuleHref(ROUTES.dashboard, moduleId)} onClick={${handler}}>x</PublicRouteControl>;`,
    );
  for (const [handler, why] of [
    ["(event) => { requestClinicModuleActivate(moduleId); if (href) event.preventDefault(); }", "prevention on an unrelated condition"],
    ["(event) => { if (!requestClinicModuleActivate(moduleId)) event.preventDefault(); }", "prevention when the owner declined"],
    ["(event) => { if (requestClinicModuleActivate(moduleId)) { if (href) event.preventDefault(); } }", "prevention nested under another condition"],
    ["(event) => { if (requestClinicModuleActivate(moduleId)) return; event.preventDefault(); }", "prevention on the declined path"],
    ["(event) => { if (href) return; if (requestClinicModuleActivate(moduleId)) event.preventDefault(); }", "a way out before the claim"],
    ["(event) => { const claimed = href !== \"\"; if (claimed) event.preventDefault(); }", "a constant that holds no claim"],
    ["(event) => { let claimed = requestClinicModuleActivate(moduleId); claimed = false; if (claimed) event.preventDefault(); }", "a claim held in a binding that can change"],
    ["(event) => { const claimed = href ? requestClinicModuleActivate(moduleId) : false; if (claimed) event.preventDefault(); }", "a choice where one outcome never asks"],
    ["(event) => { if (requestClinicModuleActivate(moduleId)) console.log(event.preventDefault); }", "prevention named but not called"],
    ["handleClick", "a handler the control does not spell"],
  ] as const) {
    assertBreach(control(handler), /a module href that does not ask the owner first/, why);
  }
  for (const handler of [
    "(event) => { if (requestClinicModuleActivate(moduleId)) event.preventDefault(); }",
    "(event) => { console.log(moduleId); const claimed = href ? requestAdminModuleActivate(moduleId) : requestClinicModuleActivate(moduleId); if (claimed) { event.preventDefault(); } }",
  ]) {
    assert.deepEqual(
      ownershipViolations(control(handler)).filter((violation) => violation.startsWith(SECOND_OWNER)),
      [],
      handler,
    );
  }
});

// The bell is NOT an approved navigation authority. On the admin surface its
// destination is a `?module=` url pushed with no claim: the one module
// navigation outside the interpreter that this guard lets stand, because
// routing it through the owner is a runtime change. What is pinned here is its
// size, so it cannot grow into a second owner unnoticed.
test("the bell's external commit stays the one the roadmap inventories", () => {
  const bell = TREE.get("frontend/src/components/dashboard/DashboardNotificationsBell.tsx") ?? "";
  const destinations = TREE.get("frontend/src/lib/notification-destinations.ts") ?? "";

  assert.equal(
    compact(bell).split("buildNotificationDestination(").length - 1,
    1,
    "the destination has one source",
  );
  assert.ok(
    compact(bell).includes("const destination = buildNotificationDestination(surface, notification);") &&
      compact(bell).includes(
        "function navigateToNotificationDestination(destination: string) { router.push(destination);",
      ),
    "what the bell pushes is what the destination table built",
  );
  assert.deepEqual(
    [...new Set([...destinations.matchAll(/\?module=([a-z-]+)/g)].map((match) => match[1]))].sort(),
    ["admin-particular-tokens", "admin-report-upload", "audit-log"],
    "the modules a notification can open: a new one is a decision, not an edit",
  );
  assert.equal(
    /\$\{[^}]*\}\?module=\$\{|module=\$\{/.test(destinations),
    false,
    "no computed module in a notification destination",
  );
});

test("fail-closed: an exception names a call that exists, once", () => {
  const bell = "frontend/src/components/dashboard/DashboardNotificationsBell.tsx";

  assertBreach(
    mutated(bell, "router.push(destination);", "router.push(destination);\n    router.push(destination);"),
    /an exception covers one call/,
    "a second call under the bell's exception",
  );
  assertBreach(
    mutated(bell, "router.push(destination);", "void destination;"),
    /a stale exception, the call it names is gone/,
    "an exception that outlives its call",
  );
  assertBreach(
    mutated(bell, "router.push(destination);", "router.replace(destination);"),
    /a dashboard navigation whose destination cannot be read/,
    "the exception is the call as it stands",
  );
});

test("navigation that is not a module selection stays legal", () => {
  for (const body of [
    // Links to full routes and to other surfaces.
    "  return <PublicRouteControl href={ROUTES.dashboardLogistica}>x</PublicRouteControl>;",
    '  return <PublicRouteControl href="/login" replace>x</PublicRouteControl>;',
    // A module control that asks the owner first.
    "  return <PublicRouteControl href={buildDashboardModuleHref(ROUTES.dashboard, moduleId)} onClick={(event) => { if (requestClinicModuleActivate(moduleId)) event.preventDefault(); }}>x</PublicRouteControl>;",
    // Router navigation that names no module, and what is not navigation.
    "  const router = useRouter();\n  router.push(ROUTES.dashboardInformes);",
    "  const router = useRouter();\n  router.replace(`${ROUTES.dashboardLogistica}?offset=0&limit=${moduleId}`, { scroll: false });",
    "  const router = useRouter();\n  router.refresh();\n  router.prefetch(href);",
    // Reading history, and names that only look like it.
    "  const depth = window.history.length;\n  const state = history.state;",
    "  const items: string[] = [];\n  items.push(moduleId);\n  const text = href.replace(\"a\", \"b\");",
    "  // router.push(buildDashboardModuleHref(ROUTES.dashboard, moduleId)); history.back();",
  ]) {
    assert.deepEqual(
      ownershipViolations(secondOwner(body)).filter((violation) => violation.startsWith(SECOND_OWNER)),
      [],
      body,
    );
  }

  // Outside the dashboard a destination that cannot be read is not a module.
  assert.deepEqual(
    ownershipViolations(
      withSource(
        "frontend/src/components/public/Elsewhere.tsx",
        'import { useRouter } from "next/navigation";\nexport function Elsewhere({ href }: { href: string }) {\n  const router = useRouter();\n  router.push(href);\n  return null;\n}',
      ),
    ),
    [],
  );
});

test("the dashboard retry may replace only the complete current URL", () => {
  const button = "frontend/src/components/dashboard/DashboardRefreshButton.tsx";
  const current = "`${window.location.pathname}${window.location.search}${window.location.hash}`";
  assert.deepEqual(ownershipViolations(TREE), []);
  for (const destination of [
    "`${window.location.pathname}${window.location.search}`",
    "`${window.location.pathname}?module=informes${window.location.hash}`",
    "`${window.location.pathname}${moduleId}${window.location.hash}`",
    "href",
  ]) {
    assertBreach(
      mutated(button, current, destination),
      /a dashboard navigation whose destination cannot be read|a module selection navigated outside the owner/,
      `the retry destination changed to ${destination}`,
    );
  }
});
