import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { listTrackedSourceFiles } from "../helpers/tracked-source-files.ts";

// ─────────────────────────────────────────────────────────────────────────────
// E2E-GLOBAL-11 (LIMPIEZA E2E R-02 + §23) — fixture ↔ Fastify contract.
//
// The E2E suite never starts Fastify: server components read the shared
// fixture (`admin-populated-api-server.mjs`) and client components may be
// served by `page.route`. This guard reconciles, statically and without any
// server, DB, browser or network:
//
// A. every route the fixture dispatches against the route table Fastify
//    registers (`server/fastify-app.ts` prefixes + plugin `app.<verb>()`
//    literals), and for each reconciled route the 2xx status, the top-level
//    response keys and the query keys, all read through the TypeScript checker;
// B. every `page.route` / `context.route` under `frontend/e2e` against the
//    fixture routes: a call site counts as a second payload source only when
//    its handler can `fulfill`/`abort` a GET for that pathname (`continue` and
//    `fallback` leave the fixture as the only source).
//
// Both censuses fail closed: an unrecognized dispatch, route registration or
// matcher throws instead of being skipped. Divergences that exist today are
// pinned below one by one; a new one fails, and a pinned one that disappears
// fails as stale so the ledger can only shrink.
//
// Method policy: fixture branches without a method guard answer every verb
// with a read payload; they are reconciled as GET, the only verb the fixture
// serves. Non-2xx statuses are fixture session simulation (404/405/401) and are
// not compared: Fastify emits its auth failures outside the route handlers.
// ─────────────────────────────────────────────────────────────────────────────

const TEST_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(TEST_FILE), "..", "..");

const FASTIFY_APP = "server/fastify-app.ts";
const FIXTURE = "frontend/e2e/fixtures/admin-populated-api-server.mjs";
const E2E_ROOT = "frontend/e2e";
const SOURCE_EXTENSIONS = [".ts", ".mts", ".cts", ".js", ".mjs", ".cjs"];
const PROBE_SPEC = "frontend/e2e/admin/audit/e2e-global-11-probe.spec.ts";
const HTTP_VERBS = new Set(["get", "post", "put", "patch", "delete", "head", "options"]);
const UNSUPPORTED_REGISTRATIONS = new Set(["route", "all"]);
const SAMPLE_ORIGIN = "http://127.0.0.1:3000";

// ── Declared divergences ─────────────────────────────────────────────────────

type DivergenceClass =
  | "SYNTHETIC_FIXTURE_ROUTE"
  | "PRODUCT_CONTRACT_DEFECT"
  | "FIXTURE_ONLY_FIELD"
  | "FIXTURE_ONLY_INPUT"
  | "TEST_OPT_IN_INPUT";

type Divergence = { readonly classification: DivergenceClass; readonly reason: string };

const DIVERGENCE_CLASSES: ReadonlySet<string> = new Set<DivergenceClass>([
  "SYNTHETIC_FIXTURE_ROUTE",
  "PRODUCT_CONTRACT_DEFECT",
  "FIXTURE_ONLY_FIELD",
  "FIXTURE_ONLY_INPUT",
  "TEST_OPT_IN_INPUT",
]);

const REPORTS_TOP_LEVEL_WINDOW =
  "Fastify nests limit/offset under `pagination`; no frontend reader uses the top-level copy.";
const REPORTS_SEARCH_ONLY_FILTER =
  "The shared fixture filter honours a /search parameter that GET /api/reports does not declare; the app never sends it there.";

const DECLARED_DIVERGENCES: Readonly<Record<string, Divergence>> = {
  "route ANY /__e2e/health": {
    classification: "SYNTHETIC_FIXTURE_ROUTE",
    reason: "Readiness probe of the fixture process (Playwright webServer); not a product endpoint.",
  },
  "route ANY /api/e2e/session-boundary": {
    classification: "SYNTHETIC_FIXTURE_ROUTE",
    reason: "E2E-GLOBAL-03 probe proving the fixture can emit 401/403; the authoritative boundary is E2E-GLOBAL-03B against Fastify.",
  },
  "response-key ANY /api/logistics/field-visits visits": {
    classification: "PRODUCT_CONTRACT_DEFECT",
    reason: "frontend/src/lib/api.ts getLogisticsFieldVisits reads `visits`, Fastify sends `fieldVisits`; the fixture mirrors the frontend, so E2E renders visits the real backend never delivers under that key. Fix is frontend-only, then realign the fixture.",
  },
  "response-key ANY /api/reports limit": { classification: "FIXTURE_ONLY_FIELD", reason: REPORTS_TOP_LEVEL_WINDOW },
  "response-key ANY /api/reports offset": { classification: "FIXTURE_ONLY_FIELD", reason: REPORTS_TOP_LEVEL_WINDOW },
  "response-key ANY /api/reports/search limit": { classification: "FIXTURE_ONLY_FIELD", reason: REPORTS_TOP_LEVEL_WINDOW },
  "response-key ANY /api/reports/search offset": { classification: "FIXTURE_ONLY_FIELD", reason: REPORTS_TOP_LEVEL_WINDOW },
  "response-key GET /api/admin/users-roles totalPages": {
    classification: "FIXTURE_ONLY_FIELD",
    reason: "Absent from the Fastify snapshot and from AdminUsersRolesSnapshot; no frontend reader.",
  },
  "query-key ANY /api/reports query": { classification: "FIXTURE_ONLY_INPUT", reason: REPORTS_SEARCH_ONLY_FILTER },
  "query-key ANY /api/reports studyType": { classification: "FIXTURE_ONLY_INPUT", reason: REPORTS_SEARCH_ONLY_FILTER },
  "query-key GET /api/admin/users-roles dataset": {
    classification: "TEST_OPT_IN_INPUT",
    reason: "CAP-A1 high-volume dataset selector, added to the wire URL only by E2E request rewrites.",
  },
  "query-key GET /api/admin/users-roles query": {
    classification: "FIXTURE_ONLY_INPUT",
    reason: "Fixture alias of `search`; Fastify does not declare it and getAdminUsersRoles never sends it.",
  },
  "query-key GET /api/admin/users-roles status": {
    classification: "FIXTURE_ONLY_INPUT",
    reason: "Fixture-only filter; Fastify does not declare it and getAdminUsersRoles never sends it.",
  },
};

// §23 debt frozen by E2E-GLOBAL-11: routes the shared fixture serves that are
// also fulfilled by page.route in these files. They are NOT justified by the
// architecture (client-component fetches reach the fixture through the Next
// rewrite, and page.route cannot see server-component fetches); the set may
// only shrink, and removing it is a separate test-only scope.
const ACCESSIBILITY_KEYBOARD = "frontend/e2e/platform/accessibility/dashboard-accessibility-keyboard.spec.ts";
const ADAPTIVE_LIMIT_MATRIX = "frontend/e2e/helpers/dashboard-adaptive-limit-matrix.ts";
const ADMIN_MOBILE_CORE = "frontend/e2e/admin/shell/admin-mobile-core-modules-no-scroll.spec.ts";
const ADMIN_MOBILE_OPS = "frontend/e2e/admin/shell/admin-mobile-ops-modules-no-scroll.spec.ts";
const ADMIN_TOKENS_TOOLBAR = "frontend/e2e/admin/tokens/admin-tokens-mobile-toolbar-layout.spec.ts";
const DETAIL_TEXT_INTEGRITY = "frontend/e2e/platform/app-shell/dashboard-detail-text-integrity.spec.ts";
const VISUAL_STRESS = "frontend/e2e/regression/visual/visual-regression-stress.spec.ts";

const LEGACY_DOUBLE_DECLARATIONS: Readonly<Record<string, readonly string[]>> = {
  "ANY /api/logistics/field-visits": [VISUAL_STRESS],
  "ANY /api/logistics/route-plans": [VISUAL_STRESS],
  "ANY /api/logistics/route-plans/:param/metrics": [VISUAL_STRESS],
  "ANY /api/reports": [VISUAL_STRESS],
  "ANY /api/reports/search": [VISUAL_STRESS],
  "GET /api/admin/audit-log": [VISUAL_STRESS],
  "GET /api/admin/particular-tokens": [
    ADMIN_MOBILE_CORE,
    ADMIN_TOKENS_TOOLBAR,
    ADAPTIVE_LIMIT_MATRIX,
    ACCESSIBILITY_KEYBOARD,
    DETAIL_TEXT_INTEGRITY,
    VISUAL_STRESS,
  ],
  "GET /api/admin/report-workflow": [ADMIN_MOBILE_CORE, ADAPTIVE_LIMIT_MATRIX, DETAIL_TEXT_INTEGRITY, VISUAL_STRESS],
  "GET /api/admin/study-tracking/notifications": [VISUAL_STRESS],
  "GET /api/admin/system/health": [VISUAL_STRESS],
  "GET /api/admin/users-roles": [
    ADMIN_MOBILE_OPS,
    ADMIN_TOKENS_TOOLBAR,
    ACCESSIBILITY_KEYBOARD,
    DETAIL_TEXT_INTEGRITY,
    VISUAL_STRESS,
  ],
};

// ── Workspace (real tree + in-memory overrides) ──────────────────────────────

type Workspace = {
  read(path: string): string;
  e2eFiles(): string[];
  sourceFile(path: string): ts.SourceFile;
  readonly checker: ts.TypeChecker;
};

type Overrides = Readonly<Record<string, string>>;

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

function toRepoPath(absolutePath: string): string {
  return relative(REPO_ROOT, absolutePath).split(sep).join("/");
}

function fileKey(fileName: string): string {
  return resolve(fileName).split(sep).join("/").toLowerCase();
}

let compilerOptionsCache: ts.CompilerOptions | undefined;

function compilerOptions(): ts.CompilerOptions {
  if (!compilerOptionsCache) {
    const configPath = resolve(REPO_ROOT, "tsconfig.json");
    const { config, error } = ts.readConfigFile(configPath, ts.sys.readFile);

    if (error) {
      throw new Error(ts.flattenDiagnosticMessageText(error.messageText, "\n"));
    }

    const parsed = ts.parseJsonConfigFileContent(config, ts.sys, REPO_ROOT);
    compilerOptionsCache = { ...parsed.options, allowJs: true, checkJs: false, noEmit: true };
  }

  return compilerOptionsCache;
}

const sharedSourceFiles = new Map<string, ts.SourceFile>();
let pristineProgram: ts.Program | undefined;

function isProgramPath(path: string): boolean {
  return path === FIXTURE || path === FASTIFY_APP || path.startsWith("server/");
}

function createProgram(overrides: Overrides): ts.Program {
  const programOverrides = Object.entries(overrides).filter(([path]) => isProgramPath(path));

  if (programOverrides.length === 0 && pristineProgram) {
    return pristineProgram;
  }

  const overrideByKey = new Map(
    programOverrides.map(([path, text]) => [fileKey(resolve(REPO_ROOT, path)), text]),
  );
  const options = compilerOptions();
  const host = ts.createCompilerHost(options, true);
  const readSourceFile = host.getSourceFile.bind(host);

  host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) => {
    const key = fileKey(fileName);
    const override = overrideByKey.get(key);

    if (override !== undefined) {
      return ts.createSourceFile(fileName, override, languageVersion, true);
    }

    const cached = sharedSourceFiles.get(key);

    if (cached) {
      return cached;
    }

    const created = readSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);

    if (created) {
      sharedSourceFiles.set(key, created);
    }

    return created;
  };

  const program = ts.createProgram({
    rootNames: [FASTIFY_APP, FIXTURE].map((path) => resolve(REPO_ROOT, path)),
    options,
    host,
    oldProgram: pristineProgram,
  });

  if (programOverrides.length === 0) {
    pristineProgram = program;
  }

  return program;
}

function createWorkspace(overrides: Overrides = {}): Workspace {
  const program = createProgram(overrides);

  return {
    read(path) {
      const override = overrides[path];
      return override ?? normalizeNewlines(readFileSync(resolve(REPO_ROOT, path), "utf8"));
    },
    e2eFiles() {
      const onDisk = listTrackedSourceFiles(E2E_ROOT);
      const extra = Object.keys(overrides).filter((path) => path.startsWith(`${E2E_ROOT}/`));
      return [...new Set([...onDisk, ...extra])].sort();
    },
    sourceFile(path) {
      const sourceFile = program.getSourceFile(resolve(REPO_ROOT, path));
      assert.ok(sourceFile, `${path} is not part of the analysis program`);
      return sourceFile;
    },
    checker: program.getTypeChecker(),
  };
}

let pristineWorkspace: Workspace | undefined;

function pristine(): Workspace {
  pristineWorkspace ??= createWorkspace();
  return pristineWorkspace;
}

function mutate(source: string, from: string, to: string): string {
  assert.ok(source.includes(from), `mutation anchor not found: ${from}`);
  return source.replace(from, to);
}

// ── AST helpers ──────────────────────────────────────────────────────────────

function visit(node: ts.Node, callback: (current: ts.Node) => void): void {
  callback(node);
  node.forEachChild((child) => visit(child, callback));
}

function visitOwnBody(node: ts.Node, callback: (current: ts.Node) => void): void {
  callback(node);
  node.forEachChild((child) => {
    if (!ts.isFunctionLike(child)) {
      visitOwnBody(child, callback);
    }
  });
}

function lineOf(node: ts.Node): number {
  const sourceFile = node.getSourceFile();
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function where(node: ts.Node): string {
  return `${toRepoPath(resolve(REPO_ROOT, node.getSourceFile().fileName))}:${lineOf(node)}`;
}

function stringLiteralText(node: ts.Node | undefined): string | undefined {
  return node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    ? node.text
    : undefined;
}

function unwrap(node: ts.Expression): ts.Expression {
  let current = node;

  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAwaitExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isNonNullExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isVoidExpression(current)
  ) {
    current = current.expression;
  }

  return current;
}

function propertyNameText(name: ts.PropertyName): string {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }

  throw new Error(`${where(name)}: computed property names are not statically comparable`);
}

function logicalTerms(expression: ts.Expression): ts.Expression[] {
  const current = unwrap(expression);

  if (
    ts.isBinaryExpression(current) &&
    (current.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
      current.operatorToken.kind === ts.SyntaxKind.BarBarToken)
  ) {
    return [...logicalTerms(current.left), ...logicalTerms(current.right)];
  }

  return [current];
}

function isStrictEquality(node: ts.Expression, negated: boolean): node is ts.BinaryExpression {
  const kind = negated
    ? ts.SyntaxKind.ExclamationEqualsEqualsToken
    : ts.SyntaxKind.EqualsEqualsEqualsToken;
  return ts.isBinaryExpression(node) && node.operatorToken.kind === kind;
}

function memberAccess(node: ts.Node, name: string): node is ts.PropertyAccessExpression {
  return ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && node.name.text === name;
}

function templateOf(raw: string): string {
  if (!raw.startsWith("/") || /[*?()]/.test(raw)) {
    throw new Error(`unsupported route syntax: ${raw}`);
  }

  const trimmed = raw.replace(/\/+$/, "") || "/";
  return trimmed
    .split("/")
    .map((segment) => (segment.startsWith(":") ? ":param" : segment))
    .join("/");
}

type FunctionNode = ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction;

function localFunction(checker: ts.TypeChecker, callee: ts.Expression): FunctionNode | undefined {
  if (!ts.isIdentifier(callee)) {
    return undefined;
  }

  let symbol = checker.getSymbolAtLocation(callee);

  if (symbol && symbol.flags & ts.SymbolFlags.Alias) {
    symbol = checker.getAliasedSymbol(symbol);
  }

  const declaration = symbol?.valueDeclaration;

  if (declaration && ts.isFunctionDeclaration(declaration)) {
    return declaration;
  }

  if (
    declaration &&
    ts.isVariableDeclaration(declaration) &&
    declaration.initializer &&
    (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer))
  ) {
    return declaration.initializer;
  }

  return undefined;
}

function returnedExpressions(fn: FunctionNode): ts.Expression[] {
  if (!fn.body) {
    return [];
  }

  if (!ts.isBlock(fn.body)) {
    return [fn.body];
  }

  const returned: ts.Expression[] = [];
  visitOwnBody(fn.body, (node) => {
    if (ts.isReturnStatement(node) && node.expression) {
      returned.push(node.expression);
    }
  });
  return returned;
}

// ── Response / query key resolution (TypeScript checker first) ───────────────

type KeyScope = ReadonlyMap<string, { readonly expression: ts.Expression; readonly scope: KeyScope }>;

function closedObjectKeys(checker: ts.TypeChecker, type: ts.Type): Set<string> | undefined {
  if (type.isUnion()) {
    const keys = new Set<string>();

    for (const member of type.types) {
      const memberKeys = closedObjectKeys(checker, member);

      if (!memberKeys) {
        return undefined;
      }

      memberKeys.forEach((key) => keys.add(key));
    }

    return keys;
  }

  if (!(type.flags & ts.TypeFlags.Object) && !type.isIntersection()) {
    return undefined;
  }

  if (checker.getIndexInfosOfType(type).length > 0 || type.getCallSignatures().length > 0) {
    return undefined;
  }

  return new Set(checker.getPropertiesOfType(type).map((property) => property.name));
}

function responseKeys(
  checker: ts.TypeChecker,
  expression: ts.Expression,
  scope: KeyScope = new Map(),
  depth = 0,
): Set<string> {
  const current = unwrap(expression);

  if (depth > 8) {
    throw new Error(`${where(current)}: response body resolution is too deep`);
  }

  const typed = closedObjectKeys(checker, checker.getTypeAtLocation(current));

  if (typed) {
    return typed;
  }

  if (ts.isConditionalExpression(current)) {
    return new Set([
      ...responseKeys(checker, current.whenTrue, scope, depth + 1),
      ...responseKeys(checker, current.whenFalse, scope, depth + 1),
    ]);
  }

  if (ts.isObjectLiteralExpression(current)) {
    const keys = new Set<string>();

    for (const property of current.properties) {
      if (ts.isSpreadAssignment(property)) {
        responseKeys(checker, property.expression, scope, depth + 1).forEach((key) => keys.add(key));
      } else if (property.name) {
        keys.add(propertyNameText(property.name));
      }
    }

    return keys;
  }

  if (ts.isIdentifier(current)) {
    const bound = scope.get(current.text);

    if (bound) {
      return responseKeys(checker, bound.expression, bound.scope, depth + 1);
    }

    const declaration = checker.getSymbolAtLocation(current)?.valueDeclaration;

    if (declaration && ts.isVariableDeclaration(declaration) && declaration.initializer) {
      return responseKeys(checker, declaration.initializer, scope, depth + 1);
    }
  }

  if (ts.isCallExpression(current)) {
    const fn = localFunction(checker, current.expression);
    const returned = fn ? returnedExpressions(fn) : [];

    if (fn && returned.length > 0) {
      const inner = new Map<string, { expression: ts.Expression; scope: KeyScope }>();

      fn.parameters.forEach((parameter, index) => {
        const argument = current.arguments[index];

        if (ts.isIdentifier(parameter.name) && argument) {
          inner.set(parameter.name.text, { expression: argument, scope });
        }
      });

      const keys = new Set<string>();
      returned.forEach((value) => responseKeys(checker, value, inner, depth + 1).forEach((key) => keys.add(key)));
      return keys;
    }
  }

  throw new Error(`${where(current)}: response body is not statically resolvable`);
}

function declaredQueryKeys(checker: ts.TypeChecker, call: ts.CallExpression): Set<string> | undefined {
  const typeArgument = call.typeArguments?.[0];

  if (!typeArgument) {
    return undefined;
  }

  const routeType = checker.getTypeFromTypeNode(typeArgument);
  const querystring = checker.getPropertyOfType(routeType, "Querystring");

  return querystring
    ? closedObjectKeys(checker, checker.getTypeOfSymbolAtLocation(querystring, typeArgument))
    : undefined;
}

function fixtureQueryKeys(checker: ts.TypeChecker, roots: readonly ts.Node[]): Set<string> {
  const keys = new Set<string>();
  const seen = new Set<ts.Node>();
  const sourceFile = roots[0].getSourceFile();

  const walk = (root: ts.Node) =>
    visit(root, (node) => {
      if (!ts.isCallExpression(node)) {
        return;
      }

      const callee = node.expression;

      if (
        ts.isPropertyAccessExpression(callee) &&
        ["get", "getAll", "has"].includes(callee.name.text) &&
        ts.isPropertyAccessExpression(callee.expression) &&
        callee.expression.name.text === "searchParams"
      ) {
        const key = stringLiteralText(node.arguments[0]);

        if (key === undefined) {
          throw new Error(`${where(node)}: dynamic query parameter name`);
        }

        keys.add(key);
      }

      const fn = localFunction(checker, callee);

      if (fn && fn.getSourceFile() === sourceFile && !seen.has(fn)) {
        seen.add(fn);
        walk(fn);
      }
    });

  roots.forEach(walk);
  return keys;
}

// ── Backend census ───────────────────────────────────────────────────────────

type BackendRoute = {
  readonly method: string;
  readonly template: string;
  readonly file: string;
  readonly call: ts.CallExpression;
};

type BackendContract = {
  readonly successStatuses: ReadonlySet<number>;
  readonly openSuccessStatus: boolean;
  readonly responseKeysByStatus: ReadonlyMap<number, ReadonlySet<string>>;
  readonly openResponseKeys: ReadonlySet<string>;
  readonly queryKeys: ReadonlySet<string> | undefined;
};

function appCall(node: ts.Node): { verb: string; call: ts.CallExpression } | undefined {
  return ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === "app"
    ? { verb: node.expression.name.text, call: node }
    : undefined;
}

function importedModules(sourceFile: ts.SourceFile): Map<string, string> {
  const modules = new Map<string, string>();

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
      continue;
    }

    const specifier = statement.moduleSpecifier.text;
    const bindings = statement.importClause?.namedBindings;

    if (bindings && ts.isNamedImports(bindings)) {
      bindings.elements.forEach((element) => modules.set(element.name.text, specifier));
    }
  }

  return modules;
}

function routesOf(ws: Workspace, file: string, prefix: string, allowRegister: boolean): BackendRoute[] {
  const sourceFile = ws.sourceFile(file);
  const imports = importedModules(sourceFile);
  const routes: BackendRoute[] = [];

  visit(sourceFile, (node) => {
    const found = appCall(node);

    if (!found) {
      return;
    }

    if (found.verb === "register") {
      assert.ok(allowRegister, `${where(node)}: nested plugin registration is not censused`);
      const [plugin, options] = found.call.arguments;
      const prefixProperty =
        options && ts.isObjectLiteralExpression(options)
          ? options.properties.find(
              (property): property is ts.PropertyAssignment =>
                ts.isPropertyAssignment(property) && staticName(property.name) === "prefix",
            )
          : undefined;
      const pluginPrefix = stringLiteralText(prefixProperty?.initializer);
      const specifier = ts.isIdentifier(plugin) ? imports.get(plugin.text) : undefined;

      assert.ok(pluginPrefix !== undefined, `${where(node)}: register() without a literal prefix`);
      assert.ok(specifier !== undefined && specifier.startsWith("."), `${where(node)}: register() of a non-local plugin`);
      routes.push(...routesOf(ws, toRepoPath(resolve(REPO_ROOT, dirname(file), specifier)), pluginPrefix, false));
      return;
    }

    assert.ok(!UNSUPPORTED_REGISTRATIONS.has(found.verb), `${where(node)}: app.${found.verb}() is not censused`);

    if (!HTTP_VERBS.has(found.verb)) {
      return;
    }

    const path = stringLiteralText(found.call.arguments[0]);
    assert.ok(path !== undefined, `${where(node)}: app.${found.verb}() without a literal path`);
    routes.push({
      method: found.verb.toUpperCase(),
      template: templateOf(`${prefix}${path === "/" && prefix ? "" : path}`),
      file,
      call: found.call,
    });
  });

  return routes;
}

function censusBackend(ws: Workspace): BackendRoute[] {
  return routesOf(ws, FASTIFY_APP, "", true);
}

function replyStatuses(checker: ts.TypeChecker, receiver: ts.Expression): number[] | "open" {
  let current = unwrap(receiver);

  while (ts.isCallExpression(current) && ts.isPropertyAccessExpression(current.expression)) {
    if (["code", "status"].includes(current.expression.name.text)) {
      const argument = current.arguments[0];

      if (argument && ts.isNumericLiteral(argument)) {
        return [Number(argument.text)];
      }

      const type = argument ? checker.getTypeAtLocation(argument) : undefined;
      const members = type?.isUnion() ? type.types : type ? [type] : [];
      return members.length > 0 && members.every((member) => member.isNumberLiteral())
        ? members.map((member) => (member as ts.NumberLiteralType).value)
        : "open";
    }

    current = unwrap(current.expression.expression);
  }

  return [200];
}

function isSuccess(status: number): boolean {
  return status >= 200 && status < 300;
}

function backendContract(ws: Workspace, route: BackendRoute): BackendContract {
  const handler = route.call.arguments.at(-1);
  assert.ok(handler, `${where(route.call)}: route without a handler`);

  const successStatuses = new Set<number>();
  const responseKeysByStatus = new Map<number, Set<string>>();
  const openResponseKeys = new Set<string>();
  let openSuccessStatus = false;
  let payloads = 0;

  visit(handler, (node) => {
    if (
      !ts.isCallExpression(node) ||
      !ts.isPropertyAccessExpression(node.expression) ||
      node.expression.name.text !== "send" ||
      node.arguments.length !== 1
    ) {
      return;
    }

    const statuses = replyStatuses(ws.checker, node.expression.expression);

    if (statuses !== "open" && !statuses.some(isSuccess)) {
      return;
    }

    if (statuses === "open") {
      openSuccessStatus = true;
      responseKeys(ws.checker, node.arguments[0]).forEach((key) => openResponseKeys.add(key));
    } else {
      const keys = responseKeys(ws.checker, node.arguments[0]);
      statuses.filter(isSuccess).forEach((status) => {
        successStatuses.add(status);
        const allowed = responseKeysByStatus.get(status) ?? new Set<string>();
        keys.forEach((key) => allowed.add(key));
        responseKeysByStatus.set(status, allowed);
      });
    }

    payloads += 1;
  });

  assert.ok(payloads > 0, `${where(route.call)}: no statically visible 2xx payload`);

  return {
    successStatuses,
    openSuccessStatus,
    responseKeysByStatus,
    openResponseKeys,
    queryKeys: declaredQueryKeys(ws.checker, route.call),
  };
}

// ── Fixture census ───────────────────────────────────────────────────────────

type Emission = { readonly status: number; readonly body: ts.Expression };

type FixtureRoute = {
  readonly method: string;
  readonly template: string;
  readonly branches: ts.IfStatement[];
  readonly emissions: Emission[];
};

function routeKey(route: { readonly method: string; readonly template: string }): string {
  return `${route.method} ${route.template}`;
}

function setLiterals(checker: ts.TypeChecker, expression: ts.Expression): string[] {
  const declaration = ts.isIdentifier(expression)
    ? checker.getSymbolAtLocation(expression)?.valueDeclaration
    : undefined;
  const initializer =
    declaration && ts.isVariableDeclaration(declaration) ? declaration.initializer : undefined;
  const values =
    initializer && ts.isNewExpression(initializer) ? initializer.arguments?.[0] : undefined;

  assert.ok(values && ts.isArrayLiteralExpression(values), `${where(expression)}: Set of paths is not a literal`);

  return values.elements.map((element) => {
    const text = stringLiteralText(element);
    assert.ok(text !== undefined, `${where(element)}: non-literal path in Set`);
    return text;
  });
}

function regexTemplate(literal: ts.RegularExpressionLiteral): string {
  const end = literal.text.lastIndexOf("/");
  const source = literal.text.slice(1, end);
  const tokens: Array<readonly [string, string]> = [
    ["\\/", "/"],
    ["(\\d+)", ":param"],
    ["([^/]+)", ":param"],
    ["\\.", "."],
    ["\\-", "-"],
  ];

  if (literal.text.slice(end + 1) !== "" || !source.startsWith("^") || !source.endsWith("$")) {
    throw new Error(`${where(literal)}: unsupported pathname regex ${literal.text}`);
  }

  let rest = source.slice(1, -1);
  let path = "";

  while (rest) {
    const token = tokens.find(([pattern]) => rest.startsWith(pattern));
    const plain = /^[A-Za-z0-9_-]/.exec(rest)?.[0];

    if (!token && !plain) {
      throw new Error(`${where(literal)}: unsupported pathname regex ${literal.text}`);
    }

    path += token ? token[1] : plain;
    rest = rest.slice(token ? token[0].length : 1);
  }

  return templateOf(path);
}

function pathnameMatch(
  checker: ts.TypeChecker,
  term: ts.Expression,
): { regex: ts.RegularExpressionLiteral; access: ts.Node } | undefined {
  let candidate: ts.Expression | undefined = term;

  if (ts.isIdentifier(term)) {
    const declaration = checker.getSymbolAtLocation(term)?.valueDeclaration;
    candidate =
      declaration && ts.isVariableDeclaration(declaration) ? declaration.initializer : undefined;
  }

  if (
    candidate &&
    ts.isCallExpression(candidate) &&
    ts.isPropertyAccessExpression(candidate.expression) &&
    candidate.expression.name.text === "match" &&
    memberAccess(candidate.expression.expression, "pathname") &&
    candidate.arguments[0] &&
    ts.isRegularExpressionLiteral(candidate.arguments[0])
  ) {
    return { regex: candidate.arguments[0], access: candidate.expression.expression };
  }

  return undefined;
}

function routeTemplates(checker: ts.TypeChecker, condition: ts.Expression, accounted: Set<ts.Node>): string[] {
  const templates: string[] = [];

  for (const term of logicalTerms(condition)) {
    if (isStrictEquality(term, false)) {
      const access = [term.left, term.right].find((side) => memberAccess(side, "pathname"));

      if (access) {
        const other = access === term.left ? term.right : term.left;
        const literal = stringLiteralText(other);
        assert.ok(literal !== undefined, `${where(term)}: pathname compared with a non-literal`);
        templates.push(templateOf(literal));
        accounted.add(access);
      }

      continue;
    }

    if (
      ts.isCallExpression(term) &&
      ts.isPropertyAccessExpression(term.expression) &&
      term.expression.name.text === "has" &&
      term.arguments.length === 1 &&
      memberAccess(term.arguments[0], "pathname")
    ) {
      setLiterals(checker, term.expression.expression).forEach((path) => templates.push(templateOf(path)));
      accounted.add(term.arguments[0]);
      continue;
    }

    const match = pathnameMatch(checker, term);

    if (match) {
      templates.push(regexTemplate(match.regex));
      accounted.add(match.access);
    }
  }

  return templates;
}

function methodGuard(statement: ts.Statement, accounted: Set<ts.Node>): string | undefined {
  if (!ts.isIfStatement(statement) || !isStrictEquality(unwrap(statement.expression), true)) {
    return undefined;
  }

  const guard = unwrap(statement.expression) as ts.BinaryExpression;
  const access = [guard.left, guard.right].find((side) => memberAccess(side, "method"));
  const other = access === guard.left ? guard.right : guard.left;
  const literal = stringLiteralText(other);
  let exits = false;

  visitOwnBody(statement.thenStatement, (node) => {
    exits ||= ts.isReturnStatement(node);
  });

  if (!access || literal === undefined || !exits) {
    return undefined;
  }

  accounted.add(access);
  return literal;
}

function routeMethod(branch: ts.IfStatement, accounted: Set<ts.Node>): string {
  const inCondition: string[] = [];

  for (const term of logicalTerms(branch.expression)) {
    for (const negated of [false, true]) {
      if (!isStrictEquality(term, negated)) {
        continue;
      }

      const access = [term.left, term.right].find((side) => memberAccess(side, "method"));

      if (access) {
        const literal = stringLiteralText(access === term.left ? term.right : term.left);
        assert.ok(!negated && literal !== undefined, `${where(term)}: unsupported method predicate in a route branch`);
        inCondition.push(literal);
        accounted.add(access);
      }
    }
  }

  assert.ok(inCondition.length <= 1, `${where(branch)}: more than one method in a route branch`);

  if (inCondition.length === 1) {
    return inCondition[0];
  }

  let statement: ts.Node = branch;

  while (statement.parent && !ts.isBlock(statement.parent)) {
    statement = statement.parent;
  }

  const body = statement.parent;
  const owner = body?.parent;

  if (body && ts.isBlock(body) && owner && ts.isFunctionLike(owner)) {
    for (const sibling of body.statements) {
      if (sibling === statement) {
        break;
      }

      const guarded = methodGuard(sibling, accounted);

      if (guarded) {
        return guarded;
      }
    }
  }

  return "ANY";
}

function branchEmissions(branch: ts.IfStatement): Emission[] {
  const emissions: Emission[] = [];
  let headStatus: number | undefined;

  const statusOf = (node: ts.Expression | undefined): number => {
    assert.ok(node && ts.isNumericLiteral(node), `${where(branch)}: non-literal fixture status`);
    return Number(node.text);
  };

  visitOwnBody(branch.thenStatement, (node) => {
    if (!ts.isCallExpression(node)) {
      return;
    }

    if (ts.isIdentifier(node.expression) && node.expression.text === "sendJson") {
      const body = node.arguments[2];
      assert.ok(body, `${where(node)}: sendJson without a body`);
      emissions.push({ status: statusOf(node.arguments[1]), body });
      return;
    }

    if (memberAccess(node.expression, "writeHead")) {
      headStatus = statusOf(node.arguments[0]);
      return;
    }

    if (memberAccess(node.expression, "end")) {
      const payload = node.arguments[0];
      const body =
        payload && ts.isCallExpression(payload) && ts.isPropertyAccessExpression(payload.expression) &&
        payload.expression.name.text === "stringify"
          ? payload.arguments[0]
          : undefined;
      assert.ok(body, `${where(node)}: response.end without a JSON.stringify body`);
      emissions.push({ status: headStatus ?? 200, body });
    }
  });

  assert.ok(emissions.length > 0, `${where(branch)}: route branch emits no response`);
  return emissions;
}

function censusFixture(ws: Workspace): FixtureRoute[] {
  const sourceFile = ws.sourceFile(FIXTURE);
  const accounted = new Set<ts.Node>();
  const routes = new Map<string, FixtureRoute>();

  visit(sourceFile, (node) => {
    if (!ts.isIfStatement(node)) {
      return;
    }

    const templates = routeTemplates(ws.checker, node.expression, accounted);

    if (templates.length === 0) {
      return;
    }

    const method = routeMethod(node, accounted);
    const emissions = branchEmissions(node);

    for (const template of templates) {
      const key = routeKey({ method, template });
      const route = routes.get(key) ?? { method, template, branches: [], emissions: [] };
      route.branches.push(node);
      route.emissions.push(...emissions);
      routes.set(key, route);
    }
  });

  const unaccounted: number[] = [];
  visit(sourceFile, (node) => {
    if ((memberAccess(node, "pathname") || memberAccess(node, "method")) && !accounted.has(node)) {
      unaccounted.push(lineOf(node));
    }
  });

  assert.deepEqual(unaccounted, [], `${FIXTURE}: unrecognized request dispatch at line(s) ${unaccounted.join(", ")}`);
  assert.ok(routes.size > 0, `${FIXTURE}: no route branch recognized`);
  return [...routes.values()];
}

// ── Reconciliation (A) ───────────────────────────────────────────────────────

function reconcile(ws: Workspace): Map<string, string> {
  const backend = censusBackend(ws);
  const violations = new Map<string, string>();

  for (const route of censusFixture(ws)) {
    const key = routeKey(route);
    const method = route.method === "ANY" ? "GET" : route.method;
    const match = backend.find((candidate) => candidate.method === method && candidate.template === route.template);

    if (!match) {
      const methods = backend.filter((candidate) => candidate.template === route.template).map((c) => c.method);
      violations.set(
        `route ${key}`,
        methods.length > 0 ? `Fastify only exposes ${methods.join(", ")}` : "no Fastify route",
      );
      continue;
    }

    const contract = backendContract(ws, match);
    const successes = route.emissions.filter((emission) => isSuccess(emission.status));
    assert.ok(successes.length > 0, `${FIXTURE}: ${key} has no 2xx branch`);

    for (const { status, body } of successes) {
      if (!contract.openSuccessStatus && !contract.successStatuses.has(status)) {
        violations.set(`status ${key} ${status}`, `${match.file} answers ${[...contract.successStatuses].join(", ")}`);
      }

      const allowedKeys = contract.responseKeysByStatus.get(status) ??
        (contract.openSuccessStatus ? contract.openResponseKeys : undefined);
      if (!allowedKeys) {
        continue;
      }
      for (const responseKey of responseKeys(ws.checker, body)) {
        if (!allowedKeys?.has(responseKey)) {
          violations.set(`response-key ${key} ${responseKey}`, `absent from ${match.file} ${status} payload`);
        }
      }
    }

    if (contract.queryKeys) {
      for (const queryKey of fixtureQueryKeys(ws.checker, route.branches)) {
        if (!contract.queryKeys.has(queryKey)) {
          violations.set(`query-key ${key} ${queryKey}`, `not declared by ${match.file} Querystring`);
        }
      }
    }
  }

  return violations;
}

// ── page.route census (B) ────────────────────────────────────────────────────

type Sample = { readonly method: string; readonly pathname: string; readonly href: string };

type Value =
  | { readonly kind: "string"; readonly value: string }
  | { readonly kind: "bool"; readonly value: boolean }
  | { readonly kind: "url" | "request" | "route" | "unknown" }
  | { readonly kind: "object"; readonly node: ts.ObjectLiteralExpression };

type Env = Map<string, Value>;

type Outcome = "FULFILL" | "PASS" | "END";

type Flow = { readonly outcomes: Set<Outcome>; readonly fallsThrough: boolean };

type RouteContext = { readonly ws: Workspace; readonly file: string; readonly sourceFile: ts.SourceFile };

type RouteDeclaration = { readonly file: string; mayFulfill(route: FixtureRoute): boolean };

const UNKNOWN: Value = { kind: "unknown" };

function parseE2e(file: string, text: string): ts.SourceFile {
  const kind = file.endsWith(".ts") || file.endsWith(".mts") || file.endsWith(".cts") ? ts.ScriptKind.TS : ts.ScriptKind.JS;
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
}

function globMatches(glob: string, href: string, node: ts.Node): boolean {
  if (!glob.startsWith("*") || /[?{}[\]]/.test(glob)) {
    throw new Error(`${where(node)}: unsupported page.route glob ${glob}`);
  }

  const pattern = glob
    .split(/(\*\*|\*)/)
    .map((part) => (part === "**" ? ".*" : part === "*" ? "[^/]*" : part.replace(/[.+^${}()|[\]\\/]/g, "\\$&")))
    .join("");
  return new RegExp(`^${pattern}$`).test(href);
}

function regexOf(literal: ts.RegularExpressionLiteral): RegExp {
  const end = literal.text.lastIndexOf("/");
  return new RegExp(literal.text.slice(1, end), literal.text.slice(end + 1));
}

const constantsByFile = new WeakMap<ts.SourceFile, Map<string, Set<string | undefined>>>();

function constantString(sourceFile: ts.SourceFile, name: string): string | undefined {
  let constants = constantsByFile.get(sourceFile);

  if (!constants) {
    const collected = new Map<string, Set<string | undefined>>();
    visit(sourceFile, (node) => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
        const values = collected.get(node.name.text) ?? new Set<string | undefined>();
        values.add(stringLiteralText(node.initializer));
        collected.set(node.name.text, values);
      }
    });
    constants = collected;
    constantsByFile.set(sourceFile, constants);
  }

  const values = constants.get(name);
  return values?.size === 1 ? [...values][0] : undefined;
}

function staticName(name: ts.PropertyName | undefined): string | undefined {
  return name && (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name))
    ? name.text
    : undefined;
}

function objectProperty(node: ts.ObjectLiteralExpression, name: string): Value {
  const property = node.properties.find(
    (candidate): candidate is ts.PropertyAssignment =>
      ts.isPropertyAssignment(candidate) && staticName(candidate.name) === name,
  );
  const text = stringLiteralText(property?.initializer);
  return text === undefined ? UNKNOWN : { kind: "string", value: text };
}

function truth(value: Value): boolean | undefined {
  return value.kind === "bool" ? value.value : undefined;
}

function bool(value: boolean | undefined): Value {
  return value === undefined ? UNKNOWN : { kind: "bool", value };
}

function evaluate(ctx: RouteContext, expression: ts.Expression, env: Env, sample: Sample): Value {
  const node = unwrap(expression);
  const text = stringLiteralText(node);

  if (text !== undefined) {
    return { kind: "string", value: text };
  }

  if (node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword) {
    return { kind: "bool", value: node.kind === ts.SyntaxKind.TrueKeyword };
  }

  if (ts.isIdentifier(node)) {
    const bound = env.get(node.text);

    if (bound) {
      return bound;
    }

    const constant = constantString(ctx.sourceFile, node.text);
    return constant === undefined ? UNKNOWN : { kind: "string", value: constant };
  }

  if (ts.isPropertyAccessExpression(node)) {
    const base = evaluate(ctx, node.expression, env, sample);

    if (base.kind === "url" && node.name.text === "pathname") {
      return { kind: "string", value: sample.pathname };
    }

    if (base.kind === "url" && node.name.text === "href") {
      return { kind: "string", value: sample.href };
    }

    return base.kind === "object" ? objectProperty(base.node, node.name.text) : UNKNOWN;
  }

  if (ts.isNewExpression(node)) {
    const argument = node.arguments?.[0];
    const href = argument ? evaluate(ctx, argument, env, sample) : UNKNOWN;
    return ts.isIdentifier(node.expression) && node.expression.text === "URL" && href.kind === "string" && href.value === sample.href
      ? { kind: "url" }
      : UNKNOWN;
  }

  if (ts.isCallExpression(node)) {
    const callee = node.expression;

    if (ts.isPropertyAccessExpression(callee)) {
      const name = callee.name.text;

      if (ts.isRegularExpressionLiteral(callee.expression) && name === "test") {
        const subject = node.arguments[0] ? evaluate(ctx, node.arguments[0], env, sample) : UNKNOWN;
        return subject.kind === "string" ? bool(regexOf(callee.expression).test(subject.value)) : UNKNOWN;
      }

      const base = evaluate(ctx, callee.expression, env, sample);

      if (base.kind === "route" && name === "request") {
        return { kind: "request" };
      }

      if (base.kind === "request" && name === "method") {
        return { kind: "string", value: sample.method };
      }

      if (base.kind === "request" && name === "url") {
        return { kind: "string", value: sample.href };
      }

      if (base.kind === "string" && ["startsWith", "endsWith", "includes"].includes(name)) {
        const argument = node.arguments[0] ? evaluate(ctx, node.arguments[0], env, sample) : UNKNOWN;

        if (argument.kind === "string") {
          const value =
            name === "startsWith"
              ? base.value.startsWith(argument.value)
              : name === "endsWith"
                ? base.value.endsWith(argument.value)
                : base.value.includes(argument.value);
          return { kind: "bool", value };
        }
      }
    }

    return UNKNOWN;
  }

  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.ExclamationToken) {
    const operand = truth(evaluate(ctx, node.operand, env, sample));
    return bool(operand === undefined ? undefined : !operand);
  }

  if (ts.isBinaryExpression(node)) {
    const operator = node.operatorToken.kind;

    if (operator === ts.SyntaxKind.AmpersandAmpersandToken || operator === ts.SyntaxKind.BarBarToken) {
      const left = truth(evaluate(ctx, node.left, env, sample));
      const right = truth(evaluate(ctx, node.right, env, sample));
      const absorbing = operator === ts.SyntaxKind.BarBarToken;

      if (left === absorbing || right === absorbing) {
        return bool(absorbing);
      }

      return bool(left === undefined || right === undefined ? undefined : !absorbing);
    }

    const equality = [
      ts.SyntaxKind.EqualsEqualsEqualsToken,
      ts.SyntaxKind.EqualsEqualsToken,
      ts.SyntaxKind.ExclamationEqualsEqualsToken,
      ts.SyntaxKind.ExclamationEqualsToken,
    ];

    if (equality.includes(operator)) {
      const left = evaluate(ctx, node.left, env, sample);
      const right = evaluate(ctx, node.right, env, sample);

      if (left.kind === "string" && right.kind === "string") {
        const equal = left.value === right.value;
        const negated =
          operator === ts.SyntaxKind.ExclamationEqualsEqualsToken || operator === ts.SyntaxKind.ExclamationEqualsToken;
        return { kind: "bool", value: negated ? !equal : equal };
      }
    }
  }

  return UNKNOWN;
}

function findFunction(sourceFile: ts.SourceFile, name: string): FunctionNode | undefined {
  let found: FunctionNode | undefined;

  visit(sourceFile, (node) => {
    if (found) {
      return;
    }

    if (ts.isFunctionDeclaration(node) && node.name?.text === name) {
      found = node;
    } else if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name &&
      node.initializer &&
      (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
    ) {
      found = node.initializer;
    }
  });

  return found;
}

function resolveHelper(ctx: RouteContext, name: string, node: ts.Node): { ctx: RouteContext; fn: FunctionNode } {
  const local = findFunction(ctx.sourceFile, name);

  if (local) {
    return { ctx, fn: local };
  }

  for (const statement of ctx.sourceFile.statements) {
    const bindings = ts.isImportDeclaration(statement) ? statement.importClause?.namedBindings : undefined;
    const element =
      bindings && ts.isNamedImports(bindings)
        ? bindings.elements.find((candidate) => candidate.name.text === name)
        : undefined;

    if (!element || !ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
      continue;
    }

    const base = toRepoPath(resolve(REPO_ROOT, dirname(ctx.file), statement.moduleSpecifier.text));
    const file = [base, `${base}.ts`, base.replace(/\.js$/, ".ts"), `${base}/index.ts`].find((candidate) =>
      existsSync(resolve(REPO_ROOT, candidate)) && SOURCE_EXTENSIONS.some((extension) => candidate.endsWith(extension)),
    );
    assert.ok(file, `${where(node)}: cannot resolve helper module ${statement.moduleSpecifier.text}`);

    const imported = { ws: ctx.ws, file, sourceFile: parseE2e(file, ctx.ws.read(file)) };
    const fn = findFunction(imported.sourceFile, (element.propertyName ?? element.name).text);
    assert.ok(fn, `${where(node)}: helper ${name} not found in ${file}`);
    return { ctx: imported, fn };
  }

  throw new Error(`${where(node)}: unresolved route helper ${name}`);
}

function nestedFulfill(expression: ts.Expression): boolean {
  let found = false;

  visit(expression, (node) => {
    found ||=
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ["fulfill", "abort"].includes(node.expression.name.text);
  });

  return found;
}

function helperOutcome(ctx: RouteContext, fn: FunctionNode, depth: number): Outcome | undefined {
  const outcomes = new Set<Outcome>();
  const routeParameter = fn.parameters[0]?.name;

  visit(fn, (node) => {
    if (!ts.isCallExpression(node)) {
      return;
    }

    if (ts.isPropertyAccessExpression(node.expression)) {
      const name = node.expression.name.text;

      if (name === "fulfill" || name === "abort") {
        outcomes.add("FULFILL");
      } else if (name === "fallback" || name === "continue") {
        outcomes.add("PASS");
      }

      return;
    }

    if (
      depth < 3 &&
      ts.isIdentifier(node.expression) &&
      routeParameter &&
      ts.isIdentifier(routeParameter) &&
      node.arguments.some((argument) => ts.isIdentifier(argument) && argument.text === routeParameter.text)
    ) {
      const helper = resolveHelper(ctx, node.expression.text, node);
      const nested = helperOutcome(helper.ctx, helper.fn, depth + 1);

      if (nested) {
        outcomes.add(nested);
      }
    }
  });

  return outcomes.has("FULFILL") ? "FULFILL" : outcomes.has("PASS") ? "PASS" : undefined;
}

function callOutcome(ctx: RouteContext, expression: ts.Expression, env: Env, sample: Sample): Outcome | undefined {
  const node = unwrap(expression);

  if (!ts.isCallExpression(node)) {
    return undefined;
  }

  if (ts.isPropertyAccessExpression(node.expression)) {
    const receiver = evaluate(ctx, node.expression.expression, env, sample);
    const name = node.expression.name.text;

    if (receiver.kind !== "route") {
      return undefined;
    }

    return name === "fulfill" || name === "abort"
      ? "FULFILL"
      : name === "fallback" || name === "continue"
        ? "PASS"
        : undefined;
  }

  if (
    ts.isIdentifier(node.expression) &&
    node.arguments.some((argument) => evaluate(ctx, argument, env, sample).kind === "route")
  ) {
    const helper = resolveHelper(ctx, node.expression.text, node);
    return helperOutcome(helper.ctx, helper.fn, 0);
  }

  return undefined;
}

function execute(ctx: RouteContext, statement: ts.Statement, env: Env, sample: Sample): Flow {
  const done = (outcome: Outcome): Flow => ({ outcomes: new Set([outcome]), fallsThrough: false });
  const pass: Flow = { outcomes: new Set(), fallsThrough: true };

  if (ts.isBlock(statement)) {
    return executeAll(ctx, statement.statements, env, sample);
  }

  if (ts.isVariableStatement(statement)) {
    for (const declaration of statement.declarationList.declarations) {
      const value = declaration.initializer ? evaluate(ctx, declaration.initializer, env, sample) : UNKNOWN;

      if (ts.isIdentifier(declaration.name)) {
        env.set(declaration.name.text, value);
      } else {
        visit(declaration.name, (node) => {
          if (ts.isBindingElement(node) && ts.isIdentifier(node.name)) {
            env.set(node.name.text, UNKNOWN);
          }
        });
      }
    }

    return pass;
  }

  if (ts.isExpressionStatement(statement)) {
    const outcome = callOutcome(ctx, statement.expression, env, sample);

    if (outcome) {
      return done(outcome);
    }

    return nestedFulfill(statement.expression) ? { outcomes: new Set(["FULFILL"]), fallsThrough: true } : pass;
  }

  if (ts.isReturnStatement(statement)) {
    const expression = statement.expression;
    const outcome = expression ? callOutcome(ctx, expression, env, sample) : undefined;
    return done(outcome ?? (expression && nestedFulfill(expression) ? "FULFILL" : "END"));
  }

  if (ts.isThrowStatement(statement)) {
    return done("END");
  }

  if (ts.isIfStatement(statement)) {
    const condition = truth(evaluate(ctx, statement.expression, env, sample));
    const branches: Flow[] = [];

    if (condition !== false) {
      branches.push(execute(ctx, statement.thenStatement, new Map(env), sample));
    }

    if (condition !== true) {
      branches.push(statement.elseStatement ? execute(ctx, statement.elseStatement, new Map(env), sample) : pass);
    }

    return {
      outcomes: new Set(branches.flatMap((branch) => [...branch.outcomes])),
      fallsThrough: branches.some((branch) => branch.fallsThrough),
    };
  }

  if (ts.isTryStatement(statement)) {
    const attempt = execute(ctx, statement.tryBlock, env, sample);
    const recovery = statement.catchClause ? execute(ctx, statement.catchClause.block, new Map(env), sample) : pass;
    return {
      outcomes: new Set([...attempt.outcomes, ...recovery.outcomes]),
      fallsThrough: attempt.fallsThrough || recovery.fallsThrough,
    };
  }

  if (
    ts.isForStatement(statement) ||
    ts.isForOfStatement(statement) ||
    ts.isForInStatement(statement) ||
    ts.isWhileStatement(statement) ||
    ts.isDoStatement(statement)
  ) {
    return { outcomes: execute(ctx, statement.statement, new Map(env), sample).outcomes, fallsThrough: true };
  }

  if (ts.isSwitchStatement(statement)) {
    const outcomes = new Set<Outcome>();
    statement.caseBlock.clauses.forEach((clause) =>
      executeAll(ctx, clause.statements, new Map(env), sample).outcomes.forEach((outcome) => outcomes.add(outcome)),
    );
    return { outcomes, fallsThrough: true };
  }

  return pass;
}

function executeAll(ctx: RouteContext, statements: readonly ts.Statement[], env: Env, sample: Sample): Flow {
  const outcomes = new Set<Outcome>();

  for (const statement of statements) {
    const flow = execute(ctx, statement, env, sample);
    flow.outcomes.forEach((outcome) => outcomes.add(outcome));

    if (!flow.fallsThrough) {
      return { outcomes, fallsThrough: false };
    }
  }

  return { outcomes, fallsThrough: true };
}

function handlerOutcomes(ctx: RouteContext, handler: ts.Expression, env: Env, sample: Sample): Set<Outcome> {
  let target: ts.Node = unwrap(handler);
  let targetCtx = ctx;

  if (ts.isIdentifier(target)) {
    const helper = resolveHelper(ctx, target.text, target);
    target = helper.fn;
    targetCtx = helper.ctx;
  }

  assert.ok(
    ts.isArrowFunction(target) || ts.isFunctionExpression(target) || ts.isFunctionDeclaration(target),
    `${where(handler)}: unsupported page.route handler`,
  );

  const scope = new Map(env);
  const routeParameter = target.parameters[0]?.name;

  if (routeParameter && ts.isIdentifier(routeParameter)) {
    scope.set(routeParameter.text, { kind: "route" });
  }

  if (!target.body) {
    return new Set(["END"]);
  }

  if (!ts.isBlock(target.body)) {
    const body = target.body;
    return new Set([callOutcome(targetCtx, body, scope, sample) ?? (nestedFulfill(body) ? "FULFILL" : "END")]);
  }

  const flow = executeAll(targetCtx, target.body.statements, scope, sample);
  return flow.fallsThrough ? new Set([...flow.outcomes, "END"]) : flow.outcomes;
}

function matcherMatches(ctx: RouteContext, matcher: ts.Expression, env: Env, sample: Sample): boolean {
  const node = unwrap(matcher);

  if (ts.isRegularExpressionLiteral(node)) {
    return regexOf(node).test(sample.href);
  }

  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
    const scope = new Map(env);
    const parameter = node.parameters[0]?.name;

    if (parameter && ts.isIdentifier(parameter)) {
      scope.set(parameter.text, { kind: "url" });
    }

    const returned = returnedExpressions(node);
    assert.ok(returned.length === 1, `${where(node)}: page.route predicate must return one expression`);
    return truth(evaluate(ctx, returned[0], scope, sample)) !== false;
  }

  const value = evaluate(ctx, node, env, sample);
  assert.ok(value.kind === "string", `${where(node)}: unresolvable page.route matcher`);
  return globMatches(value.value, sample.href, node);
}

function templateMatchesPath(template: string, pathname: string): boolean {
  const expected = template.split("/").filter(Boolean);
  const actual = pathname.replace(/\/+$/, "").split("/").filter(Boolean);
  return expected.length === actual.length && expected.every((segment, index) => segment === ":param" || segment === actual[index]);
}

function pathnameLiterals(value: string): string[] {
  return value.match(/\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*/g) ?? [];
}

function matcherSamples(
  ctx: RouteContext,
  matcher: ts.Expression,
  env: Env,
  template: string,
  method: string,
): Sample[] {
  const pathnames = new Set<string>();
  const add = (pathname: string) => {
    if (templateMatchesPath(template, pathname)) {
      pathnames.add(pathname);
    }
  };
  const resolved = evaluate(ctx, matcher, env, {
    method,
    pathname: template.replaceAll(":param", "1"),
    href: `${SAMPLE_ORIGIN}${template.replaceAll(":param", "1")}`,
  });

  if (resolved.kind === "string") {
    pathnameLiterals(resolved.value).forEach(add);
  }

  visit(matcher, (node) => {
    const literal = ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) ? node.text : undefined;
    if (literal !== undefined) {
      pathnameLiterals(literal).forEach(add);
    }
  });

  for (const witness of ["1", "x"]) {
    add(template.replaceAll(":param", witness));
  }

  return [...pathnames].map((pathname) => ({ method, pathname, href: `${SAMPLE_ORIGIN}${pathname}` }));
}

function loopBindings(call: ts.CallExpression): Map<string, Set<string>> {
  const declared = new Set<string>();

  for (let node: ts.Node | undefined = call.parent; node; node = node.parent) {
    if (ts.isForOfStatement(node) && ts.isVariableDeclarationList(node.initializer)) {
      node.initializer.declarations.forEach((declaration) => {
        if (ts.isIdentifier(declaration.name)) {
          declared.add(declaration.name.text);
        }
      });
    }

    if (ts.isFunctionLike(node)) {
      node.parameters.forEach((parameter) => {
        if (ts.isIdentifier(parameter.name)) {
          declared.add(parameter.name.text);
        }
      });
    }
  }

  const usedInMatcher = new Set<string>();
  visit(call.arguments[0], (node) => {
    if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && declared.has(node.expression.text)) {
      usedInMatcher.add(node.expression.text);
    }
  });

  const bindings = new Map<string, Set<string>>();
  visit(call, (node) => {
    if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && usedInMatcher.has(node.expression.text)) {
      const properties = bindings.get(node.expression.text) ?? new Set<string>();
      properties.add(node.name.text);
      bindings.set(node.expression.text, properties);
    }
  });

  return bindings;
}

function bindingEnvironments(ctx: RouteContext, call: ts.CallExpression): Env[] {
  let environments: Env[] = [new Map()];

  for (const [name, properties] of loopBindings(call)) {
    const candidates: ts.ObjectLiteralExpression[] = [];

    visit(ctx.sourceFile, (node) => {
      if (!ts.isObjectLiteralExpression(node)) {
        return;
      }

      const own = new Set(
        node.properties.flatMap((property) => {
          const text = staticName(property.name);
          return text === undefined ? [] : [text];
        }),
      );

      if ([...properties].every((property) => own.has(property))) {
        candidates.push(node);
      }
    });

    assert.ok(candidates.length > 0, `${where(call)}: no definition object provides ${name}.{${[...properties].join(",")}}`);
    environments = environments.flatMap((env) =>
      candidates.map((candidate) => {
        const next: Env = new Map(env);
        next.set(name, { kind: "object", node: candidate });
        return next;
      }),
    );
  }

  return environments;
}

function routeDeclarations(ws: Workspace, file: string): RouteDeclaration[] {
  const text = ws.read(file);

  if (!/\.route(?:FromHAR|WebSocket)?\s*\(/.test(text)) {
    return [];
  }

  const ctx: RouteContext = { ws, file, sourceFile: parseE2e(file, text) };
  const declarations: RouteDeclaration[] = [];

  visit(ctx.sourceFile, (node) => {
    if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) {
      return;
    }

    const name = node.expression.name.text;
    assert.ok(name !== "routeFromHAR" && name !== "routeWebSocket", `${where(node)}: ${name}() is not censused`);

    if (name !== "route") {
      return;
    }

    assert.ok(node.arguments.length >= 2, `${where(node)}: route() without matcher and handler`);
    const [matcher, handler] = node.arguments;
    const environments = bindingEnvironments(ctx, node);

    declarations.push({
      file,
      mayFulfill: (route) =>
        environments.some(
          (env) =>
            matcherSamples(ctx, matcher, env, route.template, route.method === "ANY" ? "GET" : route.method).some(
              (sample) =>
                matcherMatches(ctx, matcher, env, sample) &&
                handlerOutcomes(ctx, handler, env, sample).has("FULFILL"),
            ),
        ),
    });
  });

  return declarations;
}

function doubleDeclarations(ws: Workspace): Map<string, string[]> {
  const declarations = ws.e2eFiles().flatMap((file) => routeDeclarations(ws, file));
  const overlaps = new Map<string, string[]>();

  for (const route of censusFixture(ws)) {
    const files = [
      ...new Set(declarations.filter((declaration) => declaration.mayFulfill(route)).map((d) => d.file)),
    ].sort();

    if (files.length > 0) {
      overlaps.set(routeKey(route), files);
    }
  }

  return overlaps;
}

// ── Ledger comparison ────────────────────────────────────────────────────────

type LedgerDiff = { readonly unexpected: string[]; readonly stale: string[] };

function divergenceDiff(observed: ReadonlyMap<string, string>, declared: Readonly<Record<string, Divergence>>): LedgerDiff {
  return {
    unexpected: [...observed].filter(([key]) => !(key in declared)).map(([key, detail]) => `${key} — ${detail}`).sort(),
    stale: Object.keys(declared).filter((key) => !observed.has(key)).sort(),
  };
}

function overlapDiff(
  observed: ReadonlyMap<string, readonly string[]>,
  declared: Readonly<Record<string, readonly string[]>>,
): LedgerDiff {
  const pairs = (entries: Iterable<readonly [string, readonly string[]]>) =>
    new Set([...entries].flatMap(([route, files]) => files.map((file) => `${route} <- ${file}`)));
  const seen = pairs(observed);
  const pinned = pairs(Object.entries(declared));

  return {
    unexpected: [...seen].filter((pair) => !pinned.has(pair)).sort(),
    stale: [...pinned].filter((pair) => !seen.has(pair)).sort(),
  };
}

function invalidDivergences(declared: Readonly<Record<string, Divergence>>): string[] {
  return Object.entries(declared)
    .filter(
      ([key, entry]) =>
        !/^(route|status|response-key|query-key) [A-Z]+ \/\S*( \S+)?$/.test(key) ||
        !DIVERGENCE_CLASSES.has(entry.classification) ||
        entry.reason.trim().length < 20,
    )
    .map(([key]) => key);
}

function report(diff: LedgerDiff): string {
  return [
    diff.unexpected.length > 0 ? `unexpected:\n  ${diff.unexpected.join("\n  ")}` : "",
    diff.stale.length > 0 ? `stale (remove from the ledger):\n  ${diff.stale.join("\n  ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

// ── Real tree ────────────────────────────────────────────────────────────────

test("E2E-GLOBAL-11: the Fastify census resolves every registered route", () => {
  const routes = censusBackend(pristine());
  const keys = routes.map(routeKey);

  assert.ok(routes.length > 0);
  assert.equal(new Set(keys).size, keys.length, "duplicate Fastify method + path");
  assert.ok(routes.every((route) => route.file === FASTIFY_APP || route.file.startsWith("server/routes/")));
});

test("E2E-GLOBAL-11: fixture routes reconcile with Fastify except the declared divergences", () => {
  const ws = pristine();
  assert.ok(censusFixture(ws).length > 0);
  assert.deepEqual(invalidDivergences(DECLARED_DIVERGENCES), []);

  const diff = divergenceDiff(reconcile(ws), DECLARED_DIVERGENCES);
  assert.deepEqual(diff, { unexpected: [], stale: [] }, report(diff));
});

test("E2E-GLOBAL-11: no fixture route gains a fulfilling page.route outside the frozen §23 debt", () => {
  const diff = overlapDiff(doubleDeclarations(pristine()), LEGACY_DOUBLE_DECLARATIONS);
  assert.deepEqual(diff, { unexpected: [], stale: [] }, report(diff));
});

test("E2E-GLOBAL-11: the normal E2E census is tracked-only and overrides remain explicit", () => {
  assert.deepEqual(pristine().e2eFiles(), listTrackedSourceFiles(E2E_ROOT));

  const overridden = createWorkspace({ [PROBE_SPEC]: 'export const probe = true;\n' }).e2eFiles();
  assert.ok(overridden.includes(PROBE_SPEC));
  assert.deepEqual(overridden.filter((path) => path !== PROBE_SPEC), listTrackedSourceFiles(E2E_ROOT));
});

// ── Mutation proofs (in memory: no tracked file is written or restored) ──────

const APP_VERSION_ROUTE = "server/routes/app-version.fastify.ts";

function fixtureWith(from: string, to: string): Workspace {
  return createWorkspace({ [FIXTURE]: mutate(pristine().read(FIXTURE), from, to) });
}

function unexpectedDivergences(ws: Workspace): string[] {
  return divergenceDiff(reconcile(ws), DECLARED_DIVERGENCES).unexpected.map((entry) => entry.split(" — ")[0]);
}

function probe(body: string): LedgerDiff {
  const spec = `import { test } from "@playwright/test";\n\ntest("probe", async ({ page }) => {\n${body}\n});\n`;
  return overlapDiff(doubleDeclarations(createWorkspace({ [PROBE_SPEC]: spec })), LEGACY_DOUBLE_DECLARATIONS);
}

test("E2E-GLOBAL-11 mutation 1: a fixture route Fastify does not register fails", () => {
  const ws = fixtureWith(
    'if (url.pathname === "/api/admin/system/health") {',
    'if (url.pathname === "/api/admin/e2e-ghost") {\n    sendJson(response, 200, { success: true });\n    return;\n  }\n\n  if (url.pathname === "/api/admin/system/health") {',
  );

  assert.deepEqual(unexpectedDivergences(ws), ["route GET /api/admin/e2e-ghost"]);
});

test("E2E-GLOBAL-11 mutation 2: an HTTP method drift fails on either side", () => {
  const fixtureSide = unexpectedDivergences(
    fixtureWith('if (request.method !== "GET") {', 'if (request.method !== "PUT") {'),
  );

  assert.deepEqual(fixtureSide, [
    "route PUT /api/admin/audit-log",
    "route PUT /api/admin/particular-tokens",
    "route PUT /api/admin/report-workflow",
    "route PUT /api/admin/study-tracking/notifications",
    "route PUT /api/admin/system/health",
    "route PUT /api/admin/users-roles",
  ]);

  const backendSide = reconcile(
    createWorkspace({
      [APP_VERSION_ROUTE]: mutate(pristine().read(APP_VERSION_ROUTE), 'app.get("/", async', 'app.post("/", async'),
    }),
  );

  assert.equal(backendSide.get("route ANY /api/app-version"), "Fastify only exposes POST");
});

test("E2E-GLOBAL-11 mutation 3: a pathname drift fails for literal and regex dispatch", () => {
  assert.deepEqual(
    unexpectedDivergences(
      fixtureWith('url.pathname === "/api/admin/report-workflow"', 'url.pathname === "/api/admin/report-workflows"'),
    ),
    ["route GET /api/admin/report-workflows"],
  );
  assert.deepEqual(unexpectedDivergences(fixtureWith("\\/metrics$/", "\\/metric$/")), [
    "route ANY /api/logistics/route-plans/:param/metric",
  ]);
});

test("E2E-GLOBAL-11 mutation 4: a fixture route fulfilled by page.route fails; pass-through does not", () => {
  const pair = (route: string) => `${route} <- ${PROBE_SPEC}`;

  assert.deepEqual(
    probe('  await page.route("**/api/admin/audit-log**", (route) => route.fulfill({ json: { success: true } }));'),
    { unexpected: [pair("GET /api/admin/audit-log")], stale: [] },
  );

  assert.deepEqual(
    probe('  await page.route("**/api/logistics/route-plans/8601/metrics", (route) => route.fulfill({ json: {} }));'),
    { unexpected: [pair("ANY /api/logistics/route-plans/:param/metrics")], stale: [] },
  );
  assert.deepEqual(
    probe('  await page.route("**/api/logistics/route-plans/8601/history", (route) => route.fulfill({ json: {} }));'),
    { unexpected: [], stale: [] },
  );

  assert.deepEqual(
    probe(
      [
        '  const stubs = [{ urlPattern: "**/api/admin/system/health**", pathname: "/api/admin/system/health", method: "GET" }];',
        "  for (const stub of stubs) {",
        "    await page.route(stub.urlPattern, async (route) => {",
        "      const request = route.request();",
        "      if (request.method() !== stub.method || new URL(request.url()).pathname !== stub.pathname) {",
        "        return route.fallback();",
        "      }",
        "      return route.fulfill({ json: {} });",
        "    });",
        "  }",
      ].join("\n"),
    ).unexpected,
    [pair("GET /api/admin/system/health")],
  );

  assert.deepEqual(
    probe(
      [
        '  const notifications = "**/api/admin/study-tracking/notifications**";',
        "  await page.route(notifications, (route) => route.fulfill({ json: {} }));",
      ].join("\n"),
    ).unexpected,
    [pair("GET /api/admin/study-tracking/notifications")],
  );

  const catchAll = probe(
    [
      "  const answer = (route, body) => route.fulfill({ json: body });",
      '  await page.route("**/api/**", (route) => answer(route, {}));',
    ].join("\n"),
  );
  assert.equal(catchAll.unexpected.length, 13);
  assert.ok(catchAll.unexpected.includes(pair("ANY /api/app-version")));

  assert.deepEqual(probe('  await page.route("**/api/admin/audit-log**", (route) => route.continue());'), {
    unexpected: [],
    stale: [],
  });
  assert.deepEqual(
    probe(
      [
        '  await page.route((url) => url.pathname === "/api/admin/audit-log", async (route) => {',
        '    if (route.request().method() !== "POST") return route.fallback();',
        "    await route.fulfill({ json: {} });",
        "  });",
      ].join("\n"),
    ),
    { unexpected: [], stale: [] },
  );
});

test("E2E-GLOBAL-11 mutation 5: stale or invalid ledger entries fail", () => {
  const neutralized = overlapDiff(
    doubleDeclarations(
      createWorkspace({
        [VISUAL_STRESS]: mutate(pristine().read(VISUAL_STRESS), 'page.route("**/api/**"', 'page.route("**/api-off/**"'),
      }),
    ),
    LEGACY_DOUBLE_DECLARATIONS,
  );
  assert.equal(neutralized.unexpected.length, 0);
  assert.equal(neutralized.stale.length, 11);
  assert.ok(neutralized.stale.every((entry) => entry.endsWith(`<- ${VISUAL_STRESS}`)));

  assert.deepEqual(
    divergenceDiff(reconcile(fixtureWith("      total,\n      totalPages,\n", "      total,\n")), DECLARED_DIVERGENCES),
    { unexpected: [], stale: ["response-key GET /api/admin/users-roles totalPages"] },
  );

  const reason = "Synthetic entry used only by the ledger mutation proof.";
  assert.deepEqual(
    divergenceDiff(reconcile(pristine()), {
      ...DECLARED_DIVERGENCES,
      "route GET /api/admin/never-served": { classification: "FIXTURE_ONLY_FIELD", reason },
    }).stale,
    ["route GET /api/admin/never-served"],
  );
  assert.deepEqual(
    overlapDiff(doubleDeclarations(pristine()), {
      ...LEGACY_DOUBLE_DECLARATIONS,
      "GET /api/admin/never-served": [VISUAL_STRESS],
    }).stale,
    [`GET /api/admin/never-served <- ${VISUAL_STRESS}`],
  );
  assert.deepEqual(
    invalidDivergences({
      "route GET /api/admin/users-roles": { classification: "ACCEPTED" as DivergenceClass, reason },
      "response-key /api/reports": { classification: "FIXTURE_ONLY_FIELD", reason },
      "query-key GET /api/reports query": { classification: "FIXTURE_ONLY_INPUT", reason: "tbd" },
    }),
    ["route GET /api/admin/users-roles", "response-key /api/reports", "query-key GET /api/reports query"],
  );
});

test("E2E-GLOBAL-11 mutation 6: payload, status and query drift fail", () => {
  assert.deepEqual(
    unexpectedDivergences(fixtureWith("{ routePlans: CLINIC_ROUTE_PLANS }", "{ plans: CLINIC_ROUTE_PLANS }")),
    ["response-key ANY /api/logistics/route-plans plans"],
  );
  assert.deepEqual(
    unexpectedDivergences(
      fixtureWith("sendJson(response, 200, auditSnapshot(url));", "sendJson(response, 201, auditSnapshot(url));"),
    ),
    ["status GET /api/admin/audit-log 201"],
  );
  assert.deepEqual(
    unexpectedDivergences(fixtureWith('url.searchParams.get("clinicId")', 'url.searchParams.get("clinic")')),
    ["query-key GET /api/admin/particular-tokens clinic"],
  );
});

test("E2E-GLOBAL-11 mutation 7: Fastify status and payload keys stay correlated", () => {
  const ws = createWorkspace({
    [APP_VERSION_ROUTE]: [
      'import type { FastifyPluginAsync } from "fastify";',
      "export const appVersionNativeRoutes: FastifyPluginAsync = async (app) => {",
      '  app.get("/", async (_request, reply) => {',
      "    if (Math.random() > 0.5) return reply.code(201).send({ id: \"created\" });",
      "    return reply.code(200).send({ items: [] });",
      "  });",
      "};",
    ].join("\n"),
  });
  const route = censusBackend(ws).find((candidate) => routeKey(candidate) === "GET /api/app-version");
  assert.ok(route);
  const contract = backendContract(ws, route);

  assert.deepEqual([...contract.responseKeysByStatus.get(200) ?? []], ["items"]);
  assert.deepEqual([...contract.responseKeysByStatus.get(201) ?? []], ["id"]);
  assert.equal(contract.responseKeysByStatus.get(200)?.has("id"), false, "fixture 200 { id } must fail");
  assert.equal(contract.responseKeysByStatus.get(200)?.has("items"), true, "fixture 200 { items } must pass");
  assert.equal(contract.responseKeysByStatus.get(201)?.has("id"), true, "fixture 201 { id } must pass");
});

test("E2E-GLOBAL-11 mutation 8: unrecognized dispatch, matchers and registrations fail closed", () => {
  assert.throws(
    () =>
      censusFixture(
        fixtureWith(
          'if (url.pathname === "/api/admin/system/health") {',
          'if (url.pathname.startsWith("/api/admin/ghost")) {\n    sendJson(response, 200, {});\n    return;\n  }\n\n  if (url.pathname === "/api/admin/system/health") {',
        ),
      ),
    /unrecognized request dispatch/,
  );
  assert.throws(
    () => probe("  const pattern = String(Date.now());\n  await page.route(pattern, (route) => route.fulfill({}));"),
    /unresolvable page\.route matcher/,
  );
  assert.throws(
    () =>
      censusBackend(
        createWorkspace({
          [APP_VERSION_ROUTE]: mutate(
            pristine().read(APP_VERSION_ROUTE),
            '  app.get("/", async',
            '  app.all("/legacy", async () => ({}));\n  app.get("/", async',
          ),
        }),
      ),
    /app\.all\(\) is not censused/,
  );
});
