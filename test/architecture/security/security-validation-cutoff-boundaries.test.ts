import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, posix, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import ts from "typescript";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../../", import.meta.url)));

const VALIDATION_CUTOFF_BOUNDARIES = {
  publicRawTokens: [
    "parse raw public token shape",
    "return generic 404 before hash db signing audit",
  ],
  routeParams: [
    "parse ids as positive integers only",
    "return 400 before scoped lookup mutation audit",
  ],
  bodySchemas: [
    "safeParse request body",
    "return 400 before resource lookup persistent writes audit",
  ],
  multipartUpload: [
    "parse clinicId before storage upload",
    "return 400 before upload upsert signed urls audit",
  ],
  auditFilters: [
    "collect invalid filters",
    "return 400 before list or export",
  ],
} as const;

function listFilesRecursive(relativeDir: string): string[] {
  const rootDir = resolve(REPO_ROOT, relativeDir);
  if (!existsSync(rootDir)) {
    return [];
  }

  const files: string[] = [];
  const walk = (absoluteDir: string): void => {
    for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
      const absolute = resolve(absoluteDir, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
      } else if (entry.isFile()) {
        files.push(relative(REPO_ROOT, absolute).split(sep).join("/"));
      }
    }
  };

  walk(rootDir);
  return files;
}

// Resolve a legacy test-root path to its current canonical location, tolerating tests
// already migrated into enterprise subdirectories (TEST-ARCH-13/15). Prefers the exact
// path; falls back to a unique basename match under the same top-level directory. Zero or
// multiple matches return undefined so the caller fails explicitly (no silent match).
function resolveExistingSourcePath(relativePath: string): string | undefined {
  const normalized = relativePath.split(sep).join("/");
  if (existsSync(resolve(REPO_ROOT, normalized))) {
    return normalized;
  }

  const targetName = basename(normalized);
  const topDir = normalized.split("/")[0];
  const matches = listFilesRecursive(topDir).filter(
    (candidate) => basename(candidate) === targetName,
  );

  return matches.length === 1 ? matches[0] : undefined;
}

function readSource(relativePath: string): string {
  const resolved = resolveExistingSourcePath(relativePath);
  assert.ok(resolved, `source not found for ${relativePath}`);
  return readFileSync(resolve(REPO_ROOT, resolved), "utf8")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n");
}

function assertContains(source: string, marker: string, context: string): void {
  assert.ok(source.includes(marker), `${context} must contain: ${marker}`);
}

function assertNotContains(source: string, marker: string, context: string): void {
  assert.equal(
    source.includes(marker),
    false,
    `${context} must not contain: ${marker}`,
  );
}

function assertMatches(source: string, pattern: RegExp, context: string): void {
  assert.match(source, pattern, `${context} must match ${pattern}`);
}

function sliceFrom(source: string, marker: string, context: string): string {
  const index = source.indexOf(marker);

  assert.notEqual(index, -1, `${context} must contain route marker: ${marker}`);

  return source.slice(index);
}

function assertContainsInOrder(
  source: string,
  markers: readonly string[],
  context: string,
): void {
  let lastIndex = -1;

  for (const marker of markers) {
    const index = source.indexOf(marker, lastIndex + 1);

    assert.notEqual(index, -1, `${context} must contain: ${marker}`);
    assert.ok(
      index > lastIndex,
      `${context} must keep validation cut-off order before marker: ${marker}`,
    );

    lastIndex = index;
  }
}


function extractFunctionBlock(
  source: string,
  marker: string,
  context: string,
): string {
  const start = source.indexOf(marker);

  assert.notEqual(start, -1, `${context} must contain function marker: ${marker}`);

  const end = source.indexOf("\n}\n", start);

  assert.notEqual(end, -1, `${context} must contain function end`);

  return source.slice(start, end + 3);
}

const PUBLIC_REPORT_ACCESS_FILE = "server/routes/public-report-access.fastify.ts";
const PUBLIC_REPORT_ACCESS_ROUTE_CUTOFF_MARKERS = [
  "const parsed = reportAccessTokenRawTokenSchema.safeParse(request.params.token);",
  "if (!parsed.success) {",
  "return reply.code(404).send(REPORT_NOT_FOUND_RESPONSE);",
  "const result = await reportAccess.access(",
] as const;

function assertLegacyPublicReportAccessRouteCutoff(source: string): void {
  assertContainsInOrder(
    source,
    PUBLIC_REPORT_ACCESS_ROUTE_CUTOFF_MARKERS,
    "public report access token route validation cut-off",
  );
}

// Payload field value that must be a string literal: static copy may change freely, but
// it cannot carry request data or internal error objects.
const STATIC_TEXT = "<string literal>";

type RouteRejectionPayload =
  | { constant: string; value: string }
  | { fields: Readonly<Record<string, string>> };

const VALIDATION_ERROR_PAYLOAD: RouteRejectionPayload = {
  fields: { success: "false", error: "buildValidationError(parsed.error)" },
};
const STATIC_ERROR_PAYLOAD: RouteRejectionPayload = { fields: { success: "false", error: STATIC_TEXT } };
const AUDIT_FILTER_ERROR_PAYLOAD: RouteRejectionPayload = { fields: { success: "false", error: "errors[0]" } };

type RouteValidationCutoff = {
  file: string;
  method: "get" | "post" | "patch";
  path: string;
  validation: string;
  validator: string;
  guard: string;
  status: 400 | 404;
  payload: RouteRejectionPayload;
  operations: readonly string[];
  allowedBefore?: readonly string[];
};

const REPORT_ACCESS_DOMAIN = "server/features/report-access/report-access-token.ts";
const REPORTS_DOMAIN = "server/features/reports/domain/reports.ts";
const STUDY_TRACKING_DOMAIN = "server/features/study-tracking/domain/study-tracking.ts";
const LOGISTICS_ROUTES = "server/routes/logistics-route-plans.fastify.ts";
const AUDIT_LOG_HELPERS = "server/lib/audit-log.ts";

// Executable cut-offs protected by this guard. `validation` is the comment-free canonical
// declaration and `validator` the module that declares its callee (for an injected
// dependency, the module of its production default). `guard` is the canonical branch
// condition and `payload` the only response it may send. No call rooted at an
// `operations` receiver may run before the branch or in a request hook, except
// `allowedBefore` (documented precedence); each operation must run after it, and nothing
// after it may read the raw input the validation consumed.
const ROUTE_VALIDATION_CUTOFFS: readonly RouteValidationCutoff[] = [
  {
    file: PUBLIC_REPORT_ACCESS_FILE,
    method: "get",
    path: "/:token",
    validation: "const parsed = reportAccessTokenRawTokenSchema.safeParse(request.params.token);",
    validator: REPORT_ACCESS_DOMAIN,
    guard: "!parsed.success",
    status: 404,
    // Malformed tokens must be indistinguishable from unknown ones (same generic body).
    payload: {
      constant: "REPORT_NOT_FOUND_RESPONSE",
      value: '{ success: false, error: "Informe no encontrado", } as const',
    },
    operations: ["reportAccess.access"],
  },
  {
    file: "server/routes/reports-status.fastify.ts",
    method: "patch",
    path: "/:reportId/status",
    validation: "const reportId = parseReportId(request.params.reportId);",
    validator: REPORTS_DOMAIN,
    guard: 'typeof reportId !== "number"',
    status: 400,
    payload: STATIC_ERROR_PAYLOAD,
    operations: ["composition.queries.transitionClinicReportStatus", "composition.writeAuditLog"],
  },
  {
    file: "server/routes/reports-status.fastify.ts",
    method: "patch",
    path: "/:reportId/status",
    validation: "const nextStatus = parseReportStatus(request.body?.status);",
    validator: REPORTS_DOMAIN,
    guard: "!nextStatus",
    status: 400,
    payload: { fields: { success: "false", error: STATIC_TEXT, allowedStatuses: "REPORT_STATUSES" } },
    operations: ["composition.queries.transitionClinicReportStatus", "composition.writeAuditLog"],
  },
  {
    file: "server/routes/report-access-tokens.fastify.ts",
    method: "post",
    path: "/",
    validation: "const parsed = clinicCreateReportAccessTokenSchema.safeParse(request.body);",
    validator: REPORT_ACCESS_DOMAIN,
    guard: "!parsed.success",
    status: 400,
    payload: VALIDATION_ERROR_PAYLOAD,
    operations: ["reportAccess.createToken"],
  },
  {
    file: "server/routes/report-access-tokens.fastify.ts",
    method: "patch",
    path: "/:tokenId/revoke",
    validation: "const tokenId = parseEntityId(request.params.tokenId);",
    validator: REPORT_ACCESS_DOMAIN,
    guard: 'typeof tokenId !== "number"',
    status: 400,
    payload: STATIC_ERROR_PAYLOAD,
    operations: ["reportAccess.revokeToken"],
  },
  {
    file: "server/routes/admin-reports.fastify.ts",
    method: "post",
    path: "/upload",
    validation: "const clinicId = parseReportId(body.clinicId);",
    validator: REPORTS_DOMAIN,
    guard: 'typeof clinicId !== "number"',
    status: 400,
    payload: STATIC_ERROR_PAYLOAD,
    operations: ["composition.service.uploadAdminReport"],
  },
  {
    file: "server/routes/study-tracking.fastify.ts",
    method: "post",
    path: "/",
    validation: "const parsed = clinicCreateStudyTrackingSchema.safeParse(request.body);",
    validator: STUDY_TRACKING_DOMAIN,
    guard: "!parsed.success",
    status: 400,
    payload: VALIDATION_ERROR_PAYLOAD,
    operations: ["clinicOperations.createClinicStudyTrackingCase"],
  },
  {
    file: "server/routes/admin-study-tracking.fastify.ts",
    method: "post",
    path: "/",
    validation: "const parsed = adminCreateStudyTrackingSchema.safeParse(request.body ?? {});",
    validator: STUDY_TRACKING_DOMAIN,
    guard: "!parsed.success",
    status: 400,
    payload: VALIDATION_ERROR_PAYLOAD,
    operations: ["adminOperations.createAdminStudyTrackingCase"],
  },
  {
    file: "server/routes/admin-study-tracking.fastify.ts",
    method: "patch",
    path: "/:trackingCaseId",
    validation: "const trackingCaseId = parseEntityId(request.params.trackingCaseId);",
    validator: STUDY_TRACKING_DOMAIN,
    guard: 'typeof trackingCaseId !== "number"',
    status: 400,
    payload: STATIC_ERROR_PAYLOAD,
    operations: ["adminOperations.resolveAdminStudyTrackingCase", "adminOperations.updateAdminStudyTrackingCase"],
  },
  {
    file: "server/routes/admin-study-tracking.fastify.ts",
    method: "patch",
    path: "/:trackingCaseId",
    validation: "const parsed = updateStudyTrackingSchema.safeParse(body);",
    validator: STUDY_TRACKING_DOMAIN,
    guard: "!parsed.success",
    status: 400,
    payload: VALIDATION_ERROR_PAYLOAD,
    operations: ["adminOperations.updateAdminStudyTrackingCase"],
    // Lookup-before-body precedence: an unknown case answers 404 before body validation.
    allowedBefore: ["adminOperations.resolveAdminStudyTrackingCase"],
  },
  {
    file: LOGISTICS_ROUTES,
    method: "post",
    path: "/heuristic",
    validation: "const parsed = buildGenerateHeuristicRoutePlanInput(request.body, auth.clinicId, auth.id);",
    validator: LOGISTICS_ROUTES,
    guard: "!parsed.input",
    status: 400,
    payload: { fields: { success: "false", error: 'parsed.error ?? "Body invalido"' } },
    operations: ["generateHeuristicRoutePlan"],
  },
  // Audit filter builders are injected `deps` whose production default is the audit-log helper.
  ...[
    {
      file: "server/routes/admin-audit.fastify.ts",
      validation: "const { filters, errors } = deps.buildAdminAuditListFilters(request.query ?? {});",
      list: "deps.listAuditLog",
      csv: "deps.buildAdminAuditCsv",
    },
    {
      file: "server/routes/clinic-audit.fastify.ts",
      validation:
        "const { filters, errors } = deps.buildClinicAuditListFilters(request.query ?? {}, auth.clinicId);",
      list: "deps.listAuditLog",
      csv: "deps.buildAdminAuditCsv",
    },
    {
      file: "server/routes/particular-audit.fastify.ts",
      validation: "const { filters, errors } = deps.buildParticularAuditListFilters(request.query ?? {});",
      list: "deps.listParticularAuditLog",
      csv: "deps.buildAuditCsv",
    },
  ].flatMap(({ file, validation, list, csv }): RouteValidationCutoff[] =>
    [
      { path: "/", operations: [list] },
      { path: "/export.csv", operations: [list, csv] },
    ].map(({ path, operations }) => ({
      file,
      method: "get",
      path,
      validation,
      validator: AUDIT_LOG_HELPERS,
      guard: "errors.length > 0",
      status: 400,
      payload: AUDIT_FILTER_ERROR_PAYLOAD,
      operations,
    })),
  ),
];

function countOccurrences(source: string, target: string): number {
  return source.split(target).length - 1;
}

function replaceExactlyOnce(source: string, target: string, replacement: string): string {
  assert.ok(source.includes(target), `mutation target must exist: ${target}`);
  assert.equal(countOccurrences(source, target), 1, `mutation target must appear exactly once: ${target}`);
  return source.replace(target, () => replacement);
}

const CANONICAL_PRINTER = ts.createPrinter({ removeComments: true });

// AST text without comments or layout: comments, strings and templates are never
// mistaken for the statements they merely spell out.
function canonical(node: ts.Node, file: ts.SourceFile): string {
  return CANONICAL_PRINTER.printNode(ts.EmitHint.Unspecified, node, file).replace(/\s+/g, " ").trim();
}

function parseRouteSource(source: string, fileName: string): ts.SourceFile | undefined {
  const { diagnostics = [] } = ts.transpileModule(source, { fileName, reportDiagnostics: true });
  return diagnostics.length > 0
    ? undefined
    : ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function descendants<T extends ts.Node>(root: ts.Node, match: (node: ts.Node) => node is T): T[] {
  const found: T[] = [];
  const visit = (node: ts.Node): void => {
    if (match(node)) {
      found.push(node);
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(root, visit);
  return found;
}

function routeCutoffLabel(cutoff: RouteValidationCutoff): string {
  return `${cutoff.file} ${cutoff.method.toUpperCase()} ${cutoff.path} if (${cutoff.guard})`;
}

// `app.<method>("<path>", handler)` registrations; sibling handlers never count.
function routeHandlers(file: ts.SourceFile, cutoff: RouteValidationCutoff): ts.CallExpression[] {
  return descendants(file, ts.isCallExpression).filter((call) => {
    const [path] = call.arguments;
    return (
      ts.isPropertyAccessExpression(call.expression) &&
      ts.isIdentifier(call.expression.expression) &&
      call.expression.expression.text === "app" &&
      call.expression.name.text === cutoff.method &&
      path !== undefined &&
      ts.isStringLiteral(path) &&
      path.text === cutoff.path
    );
  });
}

function leftmostIdentifier(expression: ts.Expression): ts.Identifier | undefined {
  let current = expression;
  while (
    ts.isPropertyAccessExpression(current) ||
    ts.isElementAccessExpression(current) ||
    ts.isCallExpression(current) ||
    ts.isNonNullExpression(current) ||
    ts.isParenthesizedExpression(current)
  ) {
    current = current.expression;
  }
  return ts.isIdentifier(current) ? current : undefined;
}

const BINDING_DECLARATIONS: readonly ((node: ts.Node) => boolean)[] = [
  ts.isVariableDeclaration,
  ts.isParameter,
  ts.isBindingElement,
  ts.isFunctionDeclaration,
  ts.isFunctionExpression,
  ts.isClassDeclaration,
  ts.isClassExpression,
  ts.isImportSpecifier,
  ts.isImportClause,
  ts.isNamespaceImport,
  ts.isImportEqualsDeclaration,
  ts.isEnumDeclaration,
];

// Every declaration in the file that binds `name`, whatever the scope: a shadowing
// declaration anywhere makes the reference ambiguous.
function bindingDeclarations(file: ts.SourceFile, name: string): ts.Node[] {
  return descendants(file, ts.isIdentifier)
    .filter(
      (identifier) =>
        identifier.text === name &&
        BINDING_DECLARATIONS.some((isDeclaration) => isDeclaration(identifier.parent)) &&
        (identifier.parent as ts.NamedDeclaration).name === identifier,
    )
    .map((identifier) => identifier.parent);
}

function declaresTopLevel(file: ts.SourceFile, name: string, exported: boolean): boolean {
  return file.statements.some((statement) => {
    const modifiers = ts.canHaveModifiers(statement) ? (ts.getModifiers(statement) ?? []) : [];
    if (exported && !modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
      return false;
    }
    return ts.isFunctionDeclaration(statement)
      ? statement.name?.text === name
      : ts.isVariableStatement(statement) &&
          statement.declarationList.declarations.some(
            (declaration) => ts.isIdentifier(declaration.name) && declaration.name.text === name,
          );
  });
}

function readRepoFile(relativePath: string): string | undefined {
  const absolute = resolve(REPO_ROOT, relativePath);
  return existsSync(absolute) ? readFileSync(absolute, "utf8").replace(/\r\n/g, "\n") : undefined;
}

function moduleTarget(fromFile: string, specifier: string): string {
  return posix.normalize(posix.join(posix.dirname(fromFile), specifier));
}

const EXPORT_RESOLUTION = new Map<string, string | undefined>();

// The single module that declares `name`, following named and star re-exports; ambiguity,
// cycles, missing modules and unparsable sources resolve to undefined. `modules` holds
// in-memory module sources for mutation proofs; the disk cache is only used without them.
function resolveExportedDeclaration(
  modulePath: string,
  name: string,
  modules: ReadonlyMap<string, string>,
  depth = 0,
): string | undefined {
  const key = `${modulePath}#${name}`;
  if (modules.size === 0 && EXPORT_RESOLUTION.has(key)) {
    return EXPORT_RESOLUTION.get(key);
  }

  const source = depth < 8 ? (modules.get(modulePath) ?? readRepoFile(modulePath)) : undefined;
  const file = source === undefined ? undefined : parseRouteSource(source, modulePath);
  let resolved: string | undefined;
  if (file !== undefined && declaresTopLevel(file, name, true)) {
    resolved = modulePath;
  } else if (file !== undefined) {
    // An explicit re-export shadows star re-exports of the same name.
    const named: (string | undefined)[] = [];
    const starred: (string | undefined)[] = [];
    for (const statement of file.statements.filter(ts.isExportDeclaration)) {
      const specifier = statement.moduleSpecifier;
      if (specifier === undefined || !ts.isStringLiteral(specifier) || statement.isTypeOnly) {
        continue;
      }
      const target = moduleTarget(modulePath, specifier.text);
      if (statement.exportClause === undefined) {
        starred.push(resolveExportedDeclaration(target, name, modules, depth + 1));
      } else if (ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements.filter((element) => element.name.text === name)) {
          named.push(resolveExportedDeclaration(target, element.propertyName?.text ?? name, modules, depth + 1));
        }
      }
    }
    const candidates = named.length > 0 ? named : starred.filter((candidate) => candidate !== undefined);
    resolved = candidates.length === 1 ? candidates[0] : undefined;
  }
  if (modules.size === 0) {
    EXPORT_RESOLUTION.set(key, resolved);
  }
  return resolved;
}

// Module that declares the binding `name`: the file itself for a local declaration,
// otherwise its single import followed through barrels. Shadowed names never resolve.
function resolveBindingModule(
  file: ts.SourceFile,
  name: string,
  modules: ReadonlyMap<string, string>,
): string | undefined {
  if (bindingDeclarations(file, name).length !== 1) {
    return undefined;
  }
  if (declaresTopLevel(file, name, false)) {
    return file.fileName;
  }

  const imports = file.statements.filter(ts.isImportDeclaration).flatMap((statement) => {
    const bindings = statement.importClause?.namedBindings;
    const specifier = statement.moduleSpecifier;
    if (!bindings || !ts.isNamedImports(bindings) || !ts.isStringLiteral(specifier) || statement.importClause?.isTypeOnly) {
      return [];
    }
    return bindings.elements
      .filter((element) => element.name.text === name && !element.isTypeOnly)
      .map((element) => ({
        target: moduleTarget(file.fileName, specifier.text),
        exported: element.propertyName?.text ?? name,
      }));
  });
  return imports.length === 1 ? resolveExportedDeclaration(imports[0].target, imports[0].exported, modules) : undefined;
}

// Module that declares the validator. An injected `deps.<name>` must be wired as
// `options.<name> ?? defaultDeps!.<name>` with a single production default whose binding
// resolves like any import: the runtime tests inject fakes and never see that default.
function resolveValidatorModule(
  file: ts.SourceFile,
  validation: ts.VariableStatement,
  modules: ReadonlyMap<string, string>,
): string | undefined {
  const [declaration] = validation.declarationList.declarations;
  let initializer = declaration?.initializer;
  if (initializer !== undefined && ts.isAwaitExpression(initializer)) {
    initializer = initializer.expression;
  }
  if (initializer === undefined || !ts.isCallExpression(initializer)) {
    return undefined;
  }

  const callee = initializer.expression;
  if (!ts.isPropertyAccessExpression(callee) || !ts.isIdentifier(callee.expression) || callee.expression.text !== "deps") {
    const root = leftmostIdentifier(callee);
    return root === undefined ? undefined : resolveBindingModule(file, root.text, modules);
  }

  // `deps` must be the nearest enclosing `const deps = { ... }`, not rebound in the handler.
  const handler = validation.parent.parent;
  const rebound = descendants(handler, ts.isIdentifier).some(
    (identifier) =>
      identifier.text === "deps" &&
      BINDING_DECLARATIONS.some((isDeclaration) => isDeclaration(identifier.parent)) &&
      (identifier.parent as ts.NamedDeclaration).name === identifier,
  );
  let scope: ts.Node | undefined = handler.parent;
  let enclosing: ts.VariableDeclaration | undefined;
  while (scope !== undefined && enclosing === undefined) {
    if (ts.isBlock(scope) || ts.isSourceFile(scope)) {
      enclosing = scope.statements
        .filter(ts.isVariableStatement)
        .flatMap((statement) => [...statement.declarationList.declarations])
        .find((candidate) => ts.isIdentifier(candidate.name) && candidate.name.text === "deps");
    }
    scope = scope.parent;
  }

  const property = callee.name.text;
  const wiredIn = (node: ts.Node) =>
    descendants(node, ts.isPropertyAssignment).filter(
      (assignment) =>
        ts.isIdentifier(assignment.name) &&
        assignment.name.text === property &&
        canonical(assignment.initializer, file) === `options.${property} ?? defaultDeps!.${property}`,
    );
  const assignments = descendants(file, ts.isPropertyAssignment).filter(
    (assignment) => ts.isIdentifier(assignment.name) && assignment.name.text === property,
  );
  const defaults = assignments.map((assignment) => assignment.initializer).filter(ts.isIdentifier);
  return !rebound &&
    enclosing?.initializer !== undefined &&
    ts.isObjectLiteralExpression(enclosing.initializer) &&
    wiredIn(enclosing.initializer).length === 1 &&
    assignments.length === 2 &&
    defaults.length === 1
    ? resolveBindingModule(file, defaults[0].text, modules)
    : undefined;
}

// The single argument of the branch's only statement, `return reply.code(<status>).send(<arg>)`.
function rejectionArgument(branch: ts.IfStatement, status: number, file: ts.SourceFile): ts.Expression | undefined {
  const statements = ts.isBlock(branch.thenStatement) ? [...branch.thenStatement.statements] : [branch.thenStatement];
  const [statement] = statements;
  const call = statements.length === 1 && ts.isReturnStatement(statement) ? statement.expression : undefined;
  if (
    call === undefined ||
    !ts.isCallExpression(call) ||
    call.arguments.length !== 1 ||
    !ts.isPropertyAccessExpression(call.expression) ||
    call.expression.name.text !== "send" ||
    !ts.isCallExpression(call.expression.expression)
  ) {
    return undefined;
  }
  return canonical(call.expression.expression, file) === `reply.code(${status})` ? call.arguments[0] : undefined;
}

function sendsApprovedPayload(argument: ts.Expression, payload: RouteRejectionPayload, file: ts.SourceFile): boolean {
  if ("constant" in payload) {
    // The identifier must be the single module-level const of that name, with its value.
    const declarations = bindingDeclarations(file, payload.constant);
    const [declaration] = declarations;
    return (
      ts.isIdentifier(argument) &&
      argument.text === payload.constant &&
      declarations.length === 1 &&
      ts.isVariableDeclaration(declaration) &&
      ts.isVariableDeclarationList(declaration.parent) &&
      (declaration.parent.flags & ts.NodeFlags.Const) !== 0 &&
      declaration.parent.parent.parent === file &&
      declaration.initializer !== undefined &&
      canonical(declaration.initializer, file) === payload.value
    );
  }

  if (!ts.isObjectLiteralExpression(argument)) {
    return false;
  }
  const expected = payload.fields;
  const fields = argument.properties.map((property) =>
    ts.isPropertyAssignment(property) && ts.isIdentifier(property.name)
      ? { name: property.name.text, value: property.initializer }
      : undefined,
  );
  const names = fields.map((field) => field?.name);
  return (
    names.length === Object.keys(expected).length &&
    new Set(names).size === names.length &&
    fields.every((field) => {
      if (field === undefined || !Object.hasOwn(expected, field.name)) {
        return false;
      }
      return expected[field.name] === STATIC_TEXT
        ? ts.isStringLiteral(field.value) || ts.isNoSubstitutionTemplateLiteral(field.value)
        : canonical(field.value, file) === expected[field.name];
    })
  );
}

function withoutFallback(expression: ts.Expression): ts.Expression {
  return ts.isBinaryExpression(expression) && expression.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
    ? expression.left
    : expression;
}

// Operations must consume the validated binding: the raw request input handed to the
// validator (and any top-level const derived from it before the branch) cannot appear
// after the branch, where it would bypass what validation stripped or normalized.
function rawInputUsedAfter(
  body: ts.Block,
  validation: ts.VariableStatement,
  branchIndex: number,
  handlerGuards: ReadonlySet<string>,
  file: ts.SourceFile,
): string | undefined {
  const [declaration] = validation.declarationList.declarations;
  let initializer = declaration?.initializer;
  if (initializer !== undefined && ts.isAwaitExpression(initializer)) {
    initializer = initializer.expression;
  }
  if (initializer === undefined || !ts.isCallExpression(initializer)) {
    return undefined;
  }

  const locals = new Map<string, ts.Expression>();
  for (const statement of body.statements.slice(0, branchIndex)) {
    if (ts.isVariableStatement(statement) && statement !== validation) {
      for (const local of statement.declarationList.declarations) {
        if (ts.isIdentifier(local.name) && local.initializer !== undefined) {
          locals.set(local.name.text, local.initializer);
        }
      }
    }
  }

  // Request access chains (`request.body ?? {}`) or a direct parse of the request
  // (`getMultipartBody(request)`); an authenticated actor built from request is not input.
  const requestSourced = (expression: ts.Expression): boolean => {
    const unwrapped = withoutFallback(expression);
    if (ts.isCallExpression(unwrapped)) {
      const [argument] = unwrapped.arguments;
      return unwrapped.arguments.length === 1 && ts.isIdentifier(argument) && argument.text === "request";
    }
    return leftmostIdentifier(unwrapped)?.text === "request";
  };

  const raw = new Set<string>();
  for (const argument of initializer.arguments.map(withoutFallback)) {
    const root = leftmostIdentifier(argument)?.text;
    const local = root === undefined ? undefined : locals.get(root);
    if (ts.isCallExpression(argument) || !(root === "request" || (local !== undefined && requestSourced(local)))) {
      continue;
    }
    raw.add(canonical(argument, file));
    if (ts.isIdentifier(argument) && local !== undefined && !ts.isCallExpression(withoutFallback(local))) {
      raw.add(canonical(withoutFallback(local), file));
    }
  }

  const references = (node: ts.Node): ts.Expression[] =>
    descendants(node, (child): child is ts.Expression => ts.isPropertyAccessExpression(child) || ts.isIdentifier(child)).filter(
      (reference) => !(ts.isPropertyAccessExpression(reference.parent) && reference.parent.name === reference),
    );
  // One level: a const computed from the raw input before the branch is raw as well.
  const direct = new Set(raw);
  for (const [name, source] of locals) {
    if (references(source).some((reference) => direct.has(canonical(reference, file)))) {
      raw.add(name);
    }
  }

  // Past the handler's last cut-off the whole `request` may still be handed to audit
  // helpers, but no request field may be read: any of them is unvalidated input
  // (`request.url`, `rawBody`). Earlier reads feed the handler's later validations.
  const lastCutoffIndex = Math.max(
    branchIndex,
    ...body.statements.map((statement, index) =>
      ts.isIfStatement(statement) && handlerGuards.has(canonical(statement.expression, file)) ? index : -1,
    ),
  );
  for (const [offset, statement] of body.statements.slice(branchIndex + 1).entries()) {
    const requestRead =
      branchIndex + 1 + offset > lastCutoffIndex
        ? descendants(statement, (child): child is ts.Expression =>
            ts.isPropertyAccessExpression(child) || ts.isElementAccessExpression(child),
          ).find((access) => leftmostIdentifier(access)?.text === "request")
        : undefined;
    const leaked = requestRead ?? references(statement).find((reference) => raw.has(canonical(reference, file)));
    if (leaked !== undefined) {
      return canonical(leaked, file);
    }
  }
  return undefined;
}

// The single top-level branch that rejects invalid input, or the reason it cannot be
// trusted: missing, duplicated, nested, rebound, reordered, neutralized, non-terminating,
// disclosing, preceded by a sensitive call, or bypassed with the raw input.
function locateRouteCutoff(
  file: ts.SourceFile,
  cutoff: RouteValidationCutoff,
  modules: ReadonlyMap<string, string> = new Map(),
): { cutoff: ts.IfStatement } | { violation: string } {
  const label = routeCutoffLabel(cutoff);
  const registrations = routeHandlers(file, cutoff);
  // Exactly (path, handler): route options could add a preHandler that runs first.
  const handler =
    registrations.length === 1 && registrations[0].arguments.length === 2 ? registrations[0].arguments[1] : undefined;
  if (
    handler === undefined ||
    !(ts.isArrowFunction(handler) || ts.isFunctionExpression(handler)) ||
    !ts.isBlock(handler.body)
  ) {
    return { violation: `${label}: route handler must be registered exactly once with a block body` };
  }

  // Request hooks run before every handler of the plugin, hence before the cut-off.
  const receivers = new Set(cutoff.operations.map((operation) => operation.split(".")[0]));
  const hooked = descendants(file, ts.isCallExpression)
    .filter((call) => canonical(call.expression, file) === "app.addHook")
    .flatMap((hook) => descendants(hook, ts.isCallExpression))
    .find((call) => receivers.has(leftmostIdentifier(call.expression)?.text ?? ""));
  if (hooked !== undefined) {
    return { violation: `${label}: ${canonical(hooked.expression, file)} must not run in a request hook` };
  }

  const body = handler.body;
  const validations = descendants(body, ts.isVariableStatement).filter(
    (statement) => canonical(statement, file) === cutoff.validation,
  );
  const validation = validations.length === 1 && validations[0].parent === body ? validations[0] : undefined;
  const validationIndex = validation ? body.statements.indexOf(validation) : -1;
  if (!validation || validationIndex === -1) {
    return { violation: `${label}: validation must be declared exactly once at handler top level` };
  }
  if (resolveValidatorModule(file, validation, modules) !== cutoff.validator) {
    return { violation: `${label}: validation must resolve to ${cutoff.validator}` };
  }

  const branches = descendants(body, ts.isIfStatement).filter(
    (statement) => canonical(statement.expression, file) === cutoff.guard,
  );
  const branch = branches.length === 1 && branches[0].parent === body ? branches[0] : undefined;
  const branchIndex = branch ? body.statements.indexOf(branch) : -1;
  if (!branch || branchIndex <= validationIndex) {
    return { violation: `${label}: cut-off must be a single top-level branch after validation` };
  }

  const argument = rejectionArgument(branch, cutoff.status, file);
  if (argument === undefined) {
    return { violation: `${label}: cut-off branch must end in return reply.code(${cutoff.status}).send(...)` };
  }
  if (!sendsApprovedPayload(argument, cutoff.payload, file)) {
    return { violation: `${label}: cut-off must reject with the approved response payload` };
  }

  for (const call of descendants(body, ts.isCallExpression)) {
    const receiver = leftmostIdentifier(call.expression);
    const callee = canonical(call.expression, file);
    if (receiver === undefined || !receivers.has(receiver.text) || cutoff.allowedBefore?.includes(callee)) {
      continue;
    }
    // A hoisted function declaration may run earlier than its position.
    let topLevel: ts.Node = call;
    let hoisted = false;
    while (topLevel.parent !== undefined && topLevel.parent !== body) {
      topLevel = topLevel.parent;
      hoisted ||= ts.isFunctionDeclaration(topLevel);
    }
    if (topLevel !== validation && (hoisted || body.statements.indexOf(topLevel as ts.Statement) <= branchIndex)) {
      return { violation: `${label}: ${callee} must only run after the cut-off` };
    }
  }
  for (const operation of cutoff.operations) {
    if (!descendants(body, ts.isCallExpression).some((call) => canonical(call.expression, file) === operation)) {
      return { violation: `${label}: ${operation} must be present in the handler` };
    }
  }

  const bindings = new Set(
    validation.declarationList.declarations.flatMap((declaration) =>
      ts.isIdentifier(declaration.name)
        ? [declaration.name.text]
        : descendants(declaration.name, ts.isIdentifier).map((identifier) => identifier.text),
    ),
  );
  const touched = body.statements
    .slice(validationIndex + 1, branchIndex)
    .some((statement) => descendants(statement, ts.isIdentifier).some((identifier) => bindings.has(identifier.text)));
  if (touched) {
    return { violation: `${label}: validation result must not be touched before the cut-off` };
  }

  const handlerGuards = new Set(
    ROUTE_VALIDATION_CUTOFFS.filter(
      (other) => other.file === cutoff.file && other.method === cutoff.method && other.path === cutoff.path,
    ).map((other) => other.guard),
  );
  const leak = rawInputUsedAfter(body, validation, branchIndex, handlerGuards, file);
  if (leak !== undefined) {
    return { violation: `${label}: raw input ${leak} must not be used after the cut-off` };
  }

  return { cutoff: branch };
}

function evaluateRouteValidationCutoffs(
  source: string,
  fileName: string,
  cutoffs: readonly RouteValidationCutoff[],
  modules: ReadonlyMap<string, string> = new Map(),
): string[] {
  const file = parseRouteSource(source, fileName);
  if (file === undefined) {
    return [`${fileName}: source must parse as TypeScript before evaluation`];
  }

  return cutoffs.flatMap((cutoff) => {
    const located = locateRouteCutoff(file, cutoff, modules);
    return "violation" in located ? [located.violation] : [];
  });
}

function routeCutoffsFor(fileName: string): RouteValidationCutoff[] {
  return ROUTE_VALIDATION_CUTOFFS.filter((cutoff) => cutoff.file === fileName);
}

const POSITIVE_ID_HELPERS = [
  { file: REPORT_ACCESS_DOMAIN, name: "parseEntityId" },
  { file: "server/features/particular-access/particular-token.ts", name: "parseEntityId" },
  { file: STUDY_TRACKING_DOMAIN, name: "parseEntityId" },
  { file: REPORTS_DOMAIN, name: "parseReportId" },
] as const;

// Absent, empty, non-numeric, zero, negative, fractional and infinite ids. Every one of
// them must become undefined; a default or fallback that maps them to an id breaks scoping.
const INVALID_ID_INPUTS: readonly unknown[] = [
  undefined,
  null,
  "",
  " ",
  "abc",
  Number.NaN,
  0,
  "0",
  -1,
  "-5",
  1.5,
  "1.5",
  Number.POSITIVE_INFINITY,
  "Infinity",
  {},
];
const VALID_ID_INPUTS: readonly (readonly [unknown, number])[] = [
  [1, 1],
  [7, 7],
  ["7", 7],
  ["42", 42],
];

// The whole declaration is the contract: export, single required `value: unknown` without
// default, optional marker or rest, `number | undefined` return and the positive check.
function positiveIdDeclaration(name: string, local: string): string {
  return `export function ${name}(value: unknown): number | undefined { const ${local} = Number(value); return Number.isInteger(${local}) && ${local} > 0 ? ${local} : undefined; }`;
}

// Compiles the declaration alone, with only globals in scope.
function compileIdHelper(declaration: ts.FunctionDeclaration, file: ts.SourceFile, name: string): unknown {
  const { outputText } = ts.transpileModule(CANONICAL_PRINTER.printNode(ts.EmitHint.Unspecified, declaration, file), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  return new Function("exports", `${outputText}\nreturn ${name};`)({});
}

function mapsIdDomain(declaration: ts.FunctionDeclaration, file: ts.SourceFile, name: string): boolean {
  try {
    const helper = compileIdHelper(declaration, file, name);
    return (
      typeof helper === "function" &&
      INVALID_ID_INPUTS.every((input) => helper(input) === undefined) &&
      VALID_ID_INPUTS.every(([input, id]) => helper(input) === id)
    );
  } catch {
    return false;
  }
}

// Route cut-offs test `typeof id !== "number"`, so the helper itself must turn every
// absent or invalid input into undefined with executable code.
function evaluatePositiveIdHelperSource(source: string, fileName: string, name: string): string[] {
  const file = parseRouteSource(source, fileName);
  if (file === undefined) {
    return [`${fileName}: source must parse as TypeScript before evaluation`];
  }

  const helpers = descendants(file, ts.isFunctionDeclaration).filter((declaration) => declaration.name?.text === name);
  const helper = helpers.length === 1 && helpers[0].parent === file ? helpers[0] : undefined;
  if (helper === undefined) {
    return [`${fileName}: ${name} must be declared exactly once at module level`];
  }

  const violations: string[] = [];
  if (!["parsed", "reportId"].some((local) => canonical(helper, file) === positiveIdDeclaration(name, local))) {
    violations.push(`${fileName}: ${name} declaration must be exactly (value: unknown): number | undefined with the positive integer check`);
  }
  // The body's free names resolve in this module: a module-level `const undefined = 1` or a
  // `Number` shadow forges ids while the declaration text stays identical.
  if (["Number", "undefined"].some((global) => bindingDeclarations(file, global).length > 0)) {
    violations.push(`${fileName}: ${name} must resolve Number and undefined to the globals`);
  }
  if (!mapsIdDomain(helper, file, name)) {
    violations.push(`${fileName}: ${name} must map absent or invalid input to undefined and positive integers to themselves`);
  }
  return violations;
}

function assertLegacyParseEntityId(source: string, file: string): void {
  const parseEntityId = extractFunctionBlock(
    source,
    "export function parseEntityId(value: unknown): number | undefined {",
    `${file} parseEntityId`,
  );

  assertContains(
    parseEntityId,
    "return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;",
    `${file} positive id only`,
  );
  assertNotContains(
    parseEntityId,
    "return fallback",
    `${file} parseEntityId must not fallback for sensitive ids`,
  );
}

test("validation cut-off matrix documents the protected contract", () => {
  assert.deepEqual(VALIDATION_CUTOFF_BOUNDARIES, {
    publicRawTokens: [
      "parse raw public token shape",
      "return generic 404 before hash db signing audit",
    ],
    routeParams: [
      "parse ids as positive integers only",
      "return 400 before scoped lookup mutation audit",
    ],
    bodySchemas: [
      "safeParse request body",
      "return 400 before resource lookup persistent writes audit",
    ],
    multipartUpload: [
      "parse clinicId before storage upload",
      "return 400 before upload upsert signed urls audit",
    ],
    auditFilters: [
      "collect invalid filters",
      "return 400 before list or export",
    ],
  });
});

test("public report access validates raw token before hash db signing and audit", () => {
  const source = readSource(PUBLIC_REPORT_ACCESS_FILE);
  const application = readSource(
    "server/features/report-access/application/public-report-access-operations.ts",
  );

  assertLegacyPublicReportAccessRouteCutoff(source);
  assertContainsInOrder(
    application,
    [
      "deps.hashSessionToken(rawToken)",
      "deps.getReportAccessTokenWithReportByTokenHash(",
      "const updatedToken = await deps.recordReportAccessTokenAccess(record.token.id);",
      "const [previewUrl, downloadUrl] = await Promise.all([",
      "await deps.writeAuditLog(auditRequest, {",
    ],
    "public report access token validation cut-off",
  );
});

test("report status validates route id and requested status before lookup mutation audit and signing", () => {
  const source = readSource("server/routes/reports-status.fastify.ts");
  const route = sliceFrom(
    source,
    'app.patch<{\n    Params: {\n      reportId?: unknown;',
    "reports status patch route",
  );

  assertContainsInOrder(
    route,
    [
      "const reportId = parseReportId(request.params.reportId);",
      "const nextStatus = parseReportStatus(request.body?.status);",
      "const note = normalizeOptionalNote(request.body?.note);",
      'if (typeof reportId !== "number") {',
      "return reply.code(400).send({",
      "if (!nextStatus) {",
      "return reply.code(400).send({",
      "const result = await composition.queries.transitionClinicReportStatus({",
      "await composition.writeAuditLog(createAuditRequestLike(request, auth), {",
      "report: result.report,",
    ],
    "report status validation cut-off",
  );
});

test("clinic report access token create validates body before report lookup token generation mutation and audit", () => {
  const source = readSource("server/routes/report-access-tokens.fastify.ts");
  const application = readSource(
    "server/features/report-access/application/clinic-report-access-operations.ts",
  );
  const createRoute = sliceFrom(
    source,
    'app.post<{\n    Body: {\n      reportId?: unknown;',
    "clinic report access token create route",
  );

  assertContainsInOrder(
    createRoute,
    [
      "const parsed = clinicCreateReportAccessTokenSchema.safeParse(request.body);",
      "if (!parsed.success) {",
      "return reply.code(400).send({",
      "const result = await reportAccess.createToken(",
    ],
    "clinic report access token create route validation cut-off",
  );
  assertContainsInOrder(
    application,
    [
      "const report = await deps.getClinicScopedReportById(",
      "const rawToken = deps.generateSessionToken();",
      "const tokenHash = deps.hashSessionToken(rawToken);",
      "const token = await deps.createReportAccessToken({",
      "await deps.writeAuditLog(auditRequest, {",
    ],
    "clinic report access token create application cut-off",
  );
});

test("clinic report access token revoke validates token id before scoped lookup revoke and audit", () => {
  const source = readSource("server/routes/report-access-tokens.fastify.ts");
  const application = readSource(
    "server/features/report-access/application/clinic-report-access-operations.ts",
  );
  const revokeRoute = sliceFrom(
    source,
    'app.patch<{\n    Params: {\n      tokenId: string;',
    "clinic report access token revoke route",
  );

  assertContainsInOrder(
    revokeRoute,
    [
      "const tokenId = parseEntityId(request.params.tokenId);",
      'if (typeof tokenId !== "number") {',
      "return reply.code(400).send({",
      "const result = await reportAccess.revokeToken(",
    ],
    "clinic report access token revoke route validation cut-off",
  );
  assertContainsInOrder(
    application,
    [
      "deps.getClinicScopedReportAccessToken(tokenId, actor.clinicId)",
      "const token = await deps.revokeReportAccessToken({",
      "await deps.writeAuditLog(auditRequest, {",
    ],
    "clinic report access token revoke application cut-off",
  );
});

test("admin report upload validates clinicId before storage upload upsert signed urls and audit", () => {
  const source = readSource("server/routes/admin-reports.fastify.ts");
  const service = readSource(
    "server/features/reports/application/report-route-service.ts",
  );
  const uploadRoute = sliceFrom(
    source,
    'app.post("/upload", async (request, reply) => {',
    "admin report upload route",
  );

  assertContainsInOrder(
    uploadRoute,
    [
      "const body = getMultipartBody(request);",
      "const clinicId = parseReportId(body.clinicId);",
      'if (typeof clinicId !== "number") {',
      "return reply.code(400).send({",
      "await composition.service.uploadAdminReport({",
      "serializeReport(result.report",
    ],
    "admin report upload validation cut-off",
  );
  assertContainsInOrder(
    service,
    [
      "const clinic = await dependencies.getClinicById(input.clinicId);",
      'return { type: "clinic_not_found" };',
      "const storagePath = await dependencies.uploadReport({",
      "const report = await dependencies.createOrEditReport({",
      "await dependencies.writeAuditLog(input.auditContext, {",
    ],
    "admin report upload application cut-off",
  );
});

test("clinic study tracking create validates body before linked lookups writes notifications and audit", () => {
  const source = readSource("server/routes/study-tracking.fastify.ts");
  const applicationSource = readSource(
    "server/features/study-tracking/application/clinic-study-tracking-operations.ts",
  );
  const createRoute = sliceFrom(
    source,
    'app.post<{\n    Body: {\n      reportId?: unknown;',
    "clinic study tracking create route",
  );

  assertContainsInOrder(
    createRoute,
    [
      "const parsed = clinicCreateStudyTrackingSchema.safeParse(request.body);",
      "if (!parsed.success) {",
      "return reply.code(400).send({",
      "const result = await clinicOperations.createClinicStudyTrackingCase({",
    ],
    "clinic study tracking route validation cut-off",
  );

  assertContainsInOrder(
    applicationSource,
    [
      "const clinic = await deps.referenceRepository.getClinicById(",
      'if (typeof input.data.reportId === "number") {',
      "await deps.referenceRepository.getClinicScopedReportById(",
      'if (typeof input.data.particularTokenId === "number") {',
      "await deps.referenceRepository.getParticularTokenById(",
      "const delivery = applyEstimatedDeliveryRules({",
      "const created = await commands.createStudyTrackingCase({",
      "await sideEffects.writeAuditLog(input.auditRequest, {",
    ],
    "clinic study tracking application validation cut-off",
  );
});

test("admin study tracking preserves create validation and PATCH lookup-before-body precedence", () => {
  const source = readSource("server/routes/admin-study-tracking.fastify.ts");
  const applicationSource = readSource(
    "server/features/study-tracking/application/admin-study-tracking-operations.ts",
  );
  const createRoute = sliceFrom(
    source,
    'app.post<{\n    Body: Record<string, unknown>;',
    "admin study tracking create route",
  );
  const updateRoute = sliceFrom(
    source,
    'app.patch<{\n    Params: {\n      trackingCaseId: string;',
    "admin study tracking update route",
  );

  assertContainsInOrder(
    createRoute,
    [
      "const parsed = adminCreateStudyTrackingSchema.safeParse(request.body ?? {});",
      "if (!parsed.success) {",
      "return reply.code(400).send({",
      "const result = await adminOperations.createAdminStudyTrackingCase({",
    ],
    "admin study tracking create validation cut-off",
  );

  assertContainsInOrder(
    updateRoute,
    [
      "const body = request.body ?? {};",
      "parseEntityId(body.clinicId) ?? parseEntityId(request.query.clinicId);",
      "await adminOperations.resolveAdminStudyTrackingCase({",
      "if (!current) {",
      "return reply.code(404).send({",
      "const parsed = updateStudyTrackingSchema.safeParse(body);",
      "if (!parsed.success) {",
      "return reply.code(400).send({",
      "const result = await adminOperations.updateAdminStudyTrackingCase({",
    ],
    "admin study tracking PATCH lookup-before-body precedence",
  );

  assertContainsInOrder(
    applicationSource,
    [
      "const clinic = await deps.referenceRepository.getClinicById(",
      'if (typeof input.data.reportId === "number") {',
      "await deps.referenceRepository.getReportById(",
      'if (typeof input.data.particularTokenId === "number") {',
      "await deps.referenceRepository.getParticularTokenById(",
      "const delivery = applyEstimatedDeliveryRules({",
      "const created = await commands.createStudyTrackingCase({",
      "await sideEffects.writeAuditLog(input.auditRequest, {",
    ],
    "admin study tracking application validation cut-off",
  );
});

test("logistics heuristic route validates fieldVisitIds bound before planning execution", () => {
  const source = readSource("server/routes/logistics-route-plans.fastify.ts");
  const heuristicRoute = sliceFrom(
    source,
    'app.post<{\n    Body: {\n      serviceDate?: unknown;',
    "logistics heuristic route",
  );

  assertContainsInOrder(
    heuristicRoute,
    [
      "const parsed = buildGenerateHeuristicRoutePlanInput(",
      "if (!parsed.input) {",
      "return reply.code(400).send({",
      "const result = await generateHeuristicRoutePlan(parsed.input);",
    ],
    "logistics heuristic validation cut-off",
  );

  assertContains(
    source,
    "fieldVisitIds no puede incluir mas de",
    "logistics heuristic fieldVisitIds bound validation",
  );
});

test("audit list and export filters return 400 before listing or exporting data", () => {
  for (const scenario of [
    {
      file: "server/routes/admin-audit.fastify.ts",
      filtersMarker: "const { filters, errors } = deps.buildAdminAuditListFilters(",
      listMarker: "const result = await deps.listAuditLog(filters);",
      exportListMarker: "const result = await deps.listAuditLog(exportFilters);",
      exportMarker: "const csv = deps.buildAdminAuditCsv(result.items);",
    },
    {
      file: "server/routes/clinic-audit.fastify.ts",
      filtersMarker: "const { filters, errors } = deps.buildClinicAuditListFilters(",
      listMarker: "const result = await deps.listAuditLog(filters);",
      exportListMarker: "const result = await deps.listAuditLog(exportFilters);",
      exportMarker: "const csv = deps.buildAdminAuditCsv(result.items);",
    },
    {
      file: "server/routes/particular-audit.fastify.ts",
      filtersMarker: "const { filters, errors } = deps.buildParticularAuditListFilters(",
      listMarker: "const result = await deps.listParticularAuditLog(",
      exportListMarker: "const result = await deps.listParticularAuditLog(",
      exportMarker: "const csv = deps.buildAuditCsv(result.items);",
    },
  ] as const) {
    const source = readSource(scenario.file);

    const exportRouteStart = source.indexOf('>("/export.csv", async');
    const listRouteStart = source.indexOf('>("/", async');

    assert.notEqual(
      exportRouteStart,
      -1,
      `${scenario.file} must declare audit export route`,
    );
    assert.notEqual(
      listRouteStart,
      -1,
      `${scenario.file} must declare audit list route`,
    );

    const exportRoute = source.slice(
      exportRouteStart,
      listRouteStart > exportRouteStart ? listRouteStart : source.length,
    );
    const listRoute = source.slice(listRouteStart);

    assertContainsInOrder(
      listRoute,
      [
        scenario.filtersMarker,
        "if (errors.length > 0) {",
        "return reply.code(400).send({",
        scenario.listMarker,
      ],
      `${scenario.file} list filter validation cut-off`,
    );

    assertContainsInOrder(
      exportRoute,
      [
        scenario.filtersMarker,
        "if (errors.length > 0) {",
        "return reply.code(400).send({",
        "const exportFilters:",
        scenario.exportListMarker,
        scenario.exportMarker,
      ],
      `${scenario.file} export filter validation cut-off`,
    );
  }
});

test("route validation cut-offs are executable branches that return before sensitive operations", () => {
  const labels = ROUTE_VALIDATION_CUTOFFS.map(routeCutoffLabel);
  assert.deepEqual(labels, [...new Set(labels)], "route cut-offs must be registered once");

  for (const fileName of new Set(ROUTE_VALIDATION_CUTOFFS.map((cutoff) => cutoff.file))) {
    assert.deepEqual(
      evaluateRouteValidationCutoffs(readSource(fileName), fileName, routeCutoffsFor(fileName)),
      [],
      fileName,
    );
  }
});

const PUBLIC_TOKEN_CUTOFF_BRANCH = [
  "    if (!parsed.success) {",
  "      return reply.code(404).send(REPORT_NOT_FOUND_RESPONSE);",
  "    }",
].join("\n");
const PUBLIC_TOKEN_CUTOFF_LABEL = routeCutoffLabel(ROUTE_VALIDATION_CUTOFFS[0]);
const PUBLIC_TOKEN_MISSING_CUTOFF = `${PUBLIC_TOKEN_CUTOFF_LABEL}: cut-off must be a single top-level branch after validation`;

const PUBLIC_TOKEN_DISCLOSING_PAYLOAD = `${PUBLIC_TOKEN_CUTOFF_LABEL}: cut-off must reject with the approved response payload`;

function evaluatePublicReportAccessCutoff(source: string): string[] {
  return evaluateRouteValidationCutoffs(source, PUBLIC_REPORT_ACCESS_FILE, routeCutoffsFor(PUBLIC_REPORT_ACCESS_FILE));
}

test("mutation proof: commented-out public token cut-off keeps every legacy marker but fails the executable evaluator", () => {
  const source = readSource(PUBLIC_REPORT_ACCESS_FILE);
  assert.equal(ROUTE_VALIDATION_CUTOFFS[0].file, PUBLIC_REPORT_ACCESS_FILE);
  assert.deepEqual(evaluatePublicReportAccessCutoff(source), []);

  const commented = {
    "line comments": PUBLIC_TOKEN_CUTOFF_BRANCH.split("\n")
      .map((line) => `    // ${line.trimStart()}`)
      .join("\n"),
    "block comment": `    /*\n${PUBLIC_TOKEN_CUTOFF_BRANCH}\n    */`,
  };

  for (const [kind, replacement] of Object.entries(commented)) {
    // In memory only: invalid tokens now reach reportAccess.access (hash, lookup, signing, audit).
    const mutated = replaceExactlyOnce(source, PUBLIC_TOKEN_CUTOFF_BRANCH, replacement);
    assert.notEqual(mutated, source, kind);

    // Every legacy substring survives inside the comment, in the same order.
    for (const marker of PUBLIC_REPORT_ACCESS_ROUTE_CUTOFF_MARKERS) {
      assert.equal(countOccurrences(mutated, marker), countOccurrences(source, marker), `${kind}: ${marker}`);
    }
    assertLegacyPublicReportAccessRouteCutoff(mutated);

    assert.deepEqual(evaluatePublicReportAccessCutoff(mutated), [PUBLIC_TOKEN_MISSING_CUTOFF], kind);
  }

  assert.equal(readSource(PUBLIC_REPORT_ACCESS_FILE), source, "production source is never written");
});

test("mutation proof: public token rejection keeps 404 and return but discloses a distinct body", () => {
  const source = readSource(PUBLIC_REPORT_ACCESS_FILE);
  const rejection = "      return reply.code(404).send(REPORT_NOT_FOUND_RESPONSE);";
  const disclosing = '      return reply.code(404).send({ success: false, error: "token inv\\u00e1lido o malformado" });';
  assert.deepEqual(evaluatePublicReportAccessCutoff(source), []);

  // Executable 404 branch, but a malformed token becomes distinguishable from an unknown one.
  const mutated = replaceExactlyOnce(
    source,
    PUBLIC_TOKEN_CUTOFF_BRANCH,
    PUBLIC_TOKEN_CUTOFF_BRANCH.replace(rejection, `${disclosing} // ${rejection.trim()}`),
  );
  assert.notEqual(mutated, source);
  for (const marker of PUBLIC_REPORT_ACCESS_ROUTE_CUTOFF_MARKERS) {
    assert.equal(countOccurrences(mutated, marker), countOccurrences(source, marker), marker);
  }
  assertLegacyPublicReportAccessRouteCutoff(mutated);

  assert.deepEqual(evaluatePublicReportAccessCutoff(mutated), [PUBLIC_TOKEN_DISCLOSING_PAYLOAD]);
  assert.equal(readSource(PUBLIC_REPORT_ACCESS_FILE), source, "production source is never written");
});

test("route cut-off evaluator rejects non-executable or displaced cut-offs that legacy markers accept", () => {
  const source = readSource(PUBLIC_REPORT_ACCESS_FILE);
  const declaration = PUBLIC_REPORT_ACCESS_ROUTE_CUTOFF_MARKERS[0];
  const getHead = "  app.get<{\n    Params: {\n      token: string;\n    };\n  }>(\"/:token\", async (request, reply) => {";
  const sibling = [
    '  app.get("/:token/preview", async (request, reply) => {',
    `    ${declaration}`,
    "",
    PUBLIC_TOKEN_CUTOFF_BRANCH,
    "",
    "    return reply.code(204).send();",
    "  });",
    "",
    getHead,
  ].join("\n");

  const cases = [
    {
      name: "cut-off kept only inside a string literal",
      mutated: replaceExactlyOnce(
        source,
        PUBLIC_TOKEN_CUTOFF_BRANCH,
        `    const disabledCutoff = "${PUBLIC_TOKEN_CUTOFF_BRANCH.trim().split(/\s+/).join(" ")}";`,
      ),
      expected: PUBLIC_TOKEN_MISSING_CUTOFF,
    },
    {
      name: "cut-off kept only inside a template literal",
      mutated: replaceExactlyOnce(
        source,
        PUBLIC_TOKEN_CUTOFF_BRANCH,
        `    const disabledCutoff = \`\n${PUBLIC_TOKEN_CUTOFF_BRANCH}\n    \`;`,
      ),
      expected: PUBLIC_TOKEN_MISSING_CUTOFF,
    },
    {
      name: "only the return is commented out",
      mutated: replaceExactlyOnce(
        source,
        PUBLIC_TOKEN_CUTOFF_BRANCH,
        PUBLIC_TOKEN_CUTOFF_BRANCH.replace("      return reply", "      // return reply"),
      ),
      expected: `${PUBLIC_TOKEN_CUTOFF_LABEL}: cut-off branch must end in return reply.code(404).send(...)`,
    },
    {
      name: "cut-off nested under an unrelated condition",
      mutated: replaceExactlyOnce(
        source,
        PUBLIC_TOKEN_CUTOFF_BRANCH,
        PUBLIC_TOKEN_CUTOFF_BRANCH.replace("    if (!parsed.success) {", '    if (request.params.token === "") if (!parsed.success) {'),
      ),
      expected: PUBLIC_TOKEN_MISSING_CUTOFF,
    },
    {
      name: "cut-off moved into a sibling handler",
      mutated: replaceExactlyOnce(replaceExactlyOnce(source, `${PUBLIC_TOKEN_CUTOFF_BRANCH}\n\n`, ""), getHead, sibling),
      expected: PUBLIC_TOKEN_MISSING_CUTOFF,
    },
    {
      name: "validation executed but its result ignored while the declaration survives in a comment",
      mutated: replaceExactlyOnce(
        source,
        declaration,
        [
          "reportAccessTokenRawTokenSchema.safeParse(request.params.token);",
          `    const parsed = { success: true as const, data: request.params.token }; // ${declaration}`,
        ].join("\n"),
      ),
      expected: `${PUBLIC_TOKEN_CUTOFF_LABEL}: validation must be declared exactly once at handler top level`,
    },
    {
      name: "validation result neutralized before the cut-off",
      mutated: replaceExactlyOnce(
        source,
        `${declaration}\n\n${PUBLIC_TOKEN_CUTOFF_BRANCH}`,
        `${declaration}\n    Object.assign(parsed, { success: true });\n\n${PUBLIC_TOKEN_CUTOFF_BRANCH}`,
      ),
      expected: `${PUBLIC_TOKEN_CUTOFF_LABEL}: validation result must not be touched before the cut-off`,
    },
    {
      name: "sensitive operation invoked before the cut-off",
      mutated: replaceExactlyOnce(
        source,
        PUBLIC_TOKEN_CUTOFF_BRANCH,
        `    await reportAccess.access(request.params.token, currentTime, request);\n\n${PUBLIC_TOKEN_CUTOFF_BRANCH}`,
      ),
      expected: `${PUBLIC_TOKEN_CUTOFF_LABEL}: reportAccess.access must only run after the cut-off`,
    },
    {
      name: "sensitive operation hoisted from a function declared after the cut-off",
      mutated: replaceExactlyOnce(
        source,
        PUBLIC_TOKEN_CUTOFF_BRANCH,
        [
          "    await accessBeforeValidation();",
          "",
          PUBLIC_TOKEN_CUTOFF_BRANCH,
          "",
          "    async function accessBeforeValidation() {",
          "      return reportAccess.access(request.params.token, currentTime, request);",
          "    }",
        ].join("\n"),
      ),
      expected: `${PUBLIC_TOKEN_CUTOFF_LABEL}: reportAccess.access must only run after the cut-off`,
    },
    {
      name: "sensitive operation moved into a request hook",
      mutated: replaceExactlyOnce(
        source,
        getHead,
        [
          '  app.addHook("preHandler", async (request) => {',
          "    await reportAccess.access((request.params as { token: string }).token, now(), request);",
          "  });",
          "",
          getHead,
        ].join("\n"),
      ),
      expected: `${PUBLIC_TOKEN_CUTOFF_LABEL}: reportAccess.access must not run in a request hook`,
    },
    {
      name: "route options add a preHandler that runs before the handler",
      mutated: replaceExactlyOnce(
        source,
        '}>("/:token", async (request, reply) => {',
        '}>("/:token", { preHandler: async (request) => { await reportAccess.access(request.params.token, now(), request); } }, async (request, reply) => {',
      ),
      expected: `${PUBLIC_TOKEN_CUTOFF_LABEL}: route handler must be registered exactly once with a block body`,
    },
    {
      name: "response constant shadowed before the cut-off with a disclosing body",
      mutated: replaceExactlyOnce(
        source,
        declaration,
        `const REPORT_NOT_FOUND_RESPONSE = { success: false, error: "Formato de token invalido" } as const;\n    ${declaration}`,
      ),
      expected: PUBLIC_TOKEN_DISCLOSING_PAYLOAD,
    },
    {
      name: "token schema imported from a module other than the report-access domain",
      mutated: replaceExactlyOnce(
        source,
        '  reportAccessTokenRawTokenSchema,\n  serializePublicReportAccess,\n} from "../features/report-access/index.ts";',
        '  serializePublicReportAccess,\n} from "../features/report-access/index.ts";\nimport { reportAccessTokenRawTokenSchema } from "../lib/lenient-token-schema.ts";',
      ),
      expected: `${PUBLIC_TOKEN_CUTOFF_LABEL}: validation must resolve to ${REPORT_ACCESS_DOMAIN}`,
    },
  ];

  for (const { name, mutated, expected } of cases) {
    assert.notEqual(mutated, source, name);
    assertLegacyPublicReportAccessRouteCutoff(mutated);
    assert.deepEqual(evaluatePublicReportAccessCutoff(mutated), [expected], name);
  }
});

test("route cut-off evaluator fails closed on reordered non-terminating duplicated or unparsable handlers", () => {
  const source = readSource(PUBLIC_REPORT_ACCESS_FILE);
  const access = "    const result = await reportAccess.access(\n      parsed.data,\n      currentTime,\n      request,\n    );";

  const cases = [
    {
      name: "cut-off reordered after the sensitive operation",
      mutated: replaceExactlyOnce(
        source,
        `${PUBLIC_TOKEN_CUTOFF_BRANCH}\n\n${access}`,
        `${access}\n\n${PUBLIC_TOKEN_CUTOFF_BRANCH}`,
      ),
      expected: [`${PUBLIC_TOKEN_CUTOFF_LABEL}: reportAccess.access must only run after the cut-off`],
    },
    {
      name: "return replaced by a call that does not stop the handler",
      mutated: replaceExactlyOnce(
        source,
        PUBLIC_TOKEN_CUTOFF_BRANCH,
        PUBLIC_TOKEN_CUTOFF_BRANCH.replace("      return reply", "      reply"),
      ),
      expected: [`${PUBLIC_TOKEN_CUTOFF_LABEL}: cut-off branch must end in return reply.code(404).send(...)`],
    },
    {
      name: "branch returns a success status instead of the rejection",
      mutated: replaceExactlyOnce(
        source,
        PUBLIC_TOKEN_CUTOFF_BRANCH,
        PUBLIC_TOKEN_CUTOFF_BRANCH.replace("reply.code(404)", "reply.code(200)"),
      ),
      expected: [`${PUBLIC_TOKEN_CUTOFF_LABEL}: cut-off branch must end in return reply.code(404).send(...)`],
    },
    {
      name: "cut-off branch duplicated",
      mutated: replaceExactlyOnce(
        source,
        PUBLIC_TOKEN_CUTOFF_BRANCH,
        `${PUBLIC_TOKEN_CUTOFF_BRANCH}\n\n${PUBLIC_TOKEN_CUTOFF_BRANCH}`,
      ),
      expected: [PUBLIC_TOKEN_MISSING_CUTOFF],
    },
    {
      name: "route handler registered twice",
      mutated: replaceExactlyOnce(source, 'app.options("/:token"', 'app.get("/:token"'),
      expected: [`${PUBLIC_TOKEN_CUTOFF_LABEL}: route handler must be registered exactly once with a block body`],
    },
    {
      name: "unterminated comment hides the rest of the handler",
      mutated: replaceExactlyOnce(source, access, `    /*\n${access}`),
      expected: [`${PUBLIC_REPORT_ACCESS_FILE}: source must parse as TypeScript before evaluation`],
    },
    {
      name: "unbalanced braces around the cut-off",
      mutated: replaceExactlyOnce(source, PUBLIC_TOKEN_CUTOFF_BRANCH, PUBLIC_TOKEN_CUTOFF_BRANCH.replace(/\n {4}\}$/, "")),
      expected: [`${PUBLIC_REPORT_ACCESS_FILE}: source must parse as TypeScript before evaluation`],
    },
    {
      name: "sensitive operation reached only through an alias",
      mutated: replaceExactlyOnce(
        source,
        "    const result = await reportAccess.access(\n",
        "    const accessToken = reportAccess.access;\n    const result = await accessToken(\n",
      ),
      expected: [`${PUBLIC_TOKEN_CUTOFF_LABEL}: reportAccess.access must be present in the handler`],
    },
    {
      name: "rejection status changed from 404 to 400",
      mutated: replaceExactlyOnce(
        source,
        PUBLIC_TOKEN_CUTOFF_BRANCH,
        PUBLIC_TOKEN_CUTOFF_BRANCH.replace("reply.code(404)", "reply.code(400)"),
      ),
      expected: [`${PUBLIC_TOKEN_CUTOFF_LABEL}: cut-off branch must end in return reply.code(404).send(...)`],
    },
    {
      name: "guard inverted",
      mutated: replaceExactlyOnce(source, "if (!parsed.success) {", "if (parsed.success) {"),
      expected: [PUBLIC_TOKEN_MISSING_CUTOFF],
    },
    {
      name: "guard removed with its branch",
      mutated: replaceExactlyOnce(source, `${PUBLIC_TOKEN_CUTOFF_BRANCH}\n\n`, ""),
      expected: [PUBLIC_TOKEN_MISSING_CUTOFF],
    },
    {
      name: "validation removed",
      mutated: replaceExactlyOnce(source, `    ${PUBLIC_REPORT_ACCESS_ROUTE_CUTOFF_MARKERS[0]}\n\n`, ""),
      expected: [`${PUBLIC_TOKEN_CUTOFF_LABEL}: validation must be declared exactly once at handler top level`],
    },
    {
      name: "validation applied to a truncated input",
      mutated: replaceExactlyOnce(
        source,
        ".safeParse(request.params.token);",
        ".safeParse(String(request.params.token).slice(0, 64));",
      ),
      expected: [`${PUBLIC_TOKEN_CUTOFF_LABEL}: validation must be declared exactly once at handler top level`],
    },
    {
      name: "generic not-found constant rewritten with a disclosing message",
      mutated: replaceExactlyOnce(source, 'error: "Informe no encontrado",', 'error: "Token con formato invalido",'),
      expected: [PUBLIC_TOKEN_DISCLOSING_PAYLOAD],
    },
    {
      name: "response constant shadowed inside the rejection branch",
      mutated: replaceExactlyOnce(
        source,
        PUBLIC_TOKEN_CUTOFF_BRANCH,
        PUBLIC_TOKEN_CUTOFF_BRANCH.replace(
          "      return reply",
          '      const REPORT_NOT_FOUND_RESPONSE = { success: false, error: "Formato de token invalido" };\n      return reply',
        ),
      ),
      expected: [`${PUBLIC_TOKEN_CUTOFF_LABEL}: cut-off branch must end in return reply.code(404).send(...)`],
    },
    {
      name: "rejection sends a different module constant",
      mutated: replaceExactlyOnce(
        source,
        PUBLIC_TOKEN_CUTOFF_BRANCH,
        PUBLIC_TOKEN_CUTOFF_BRANCH.replace(
          "send(REPORT_NOT_FOUND_RESPONSE)",
          "send(PUBLIC_REPORT_ACCESS_RATE_LIMIT_ERROR_MESSAGE)",
        ),
      ),
      expected: [PUBLIC_TOKEN_DISCLOSING_PAYLOAD],
    },
    {
      name: "known allowed: braceless branch that still returns the rejection",
      mutated: replaceExactlyOnce(
        source,
        PUBLIC_TOKEN_CUTOFF_BRANCH,
        "    if (!parsed.success) return reply.code(404).send(REPORT_NOT_FOUND_RESPONSE);",
      ),
      expected: [],
    },
  ];

  for (const { name, mutated, expected } of cases) {
    assert.notEqual(mutated, source, name);
    assert.deepEqual(evaluatePublicReportAccessCutoff(mutated), expected, name);
  }

  assert.throws(
    () => replaceExactlyOnce(source, "return reply.code(404).send(REPORT_NOT_FOUND_RESPONSE);", ""),
    /mutation target must appear exactly once/,
  );
});

function registeredCutoff(file: string, path: string, guard: string): RouteValidationCutoff {
  const cutoff = ROUTE_VALIDATION_CUTOFFS.find(
    (candidate) => candidate.file === file && candidate.path === path && candidate.guard === guard,
  );
  assert.ok(cutoff, `${file} ${path} if (${guard}) must be registered`);
  return cutoff;
}

// Exact in-memory edit anchored on the AST of one registered cut-off, so text shared with
// sibling handlers can never be hit by mistake.
function spliceAtCutoff(
  source: string,
  cutoff: RouteValidationCutoff,
  edit: (branch: ts.IfStatement, file: ts.SourceFile) => { start: number; end: number; text: string },
): string {
  const file = parseRouteSource(source, cutoff.file);
  assert.ok(file, `${cutoff.file} must parse`);
  const located = locateRouteCutoff(file, cutoff);
  assert.ok("cutoff" in located, routeCutoffLabel(cutoff));
  const { start, end, text } = edit(located.cutoff, file);
  return `${source.slice(0, start)}${text}${source.slice(end)}`;
}

function replaceRejectionPayload(source: string, cutoff: RouteValidationCutoff, payload: string): string {
  return spliceAtCutoff(source, cutoff, (branch, file) => {
    const argument = rejectionArgument(branch, cutoff.status, file);
    assert.ok(argument, routeCutoffLabel(cutoff));
    return { start: argument.getStart(file), end: argument.end, text: payload };
  });
}

test("400 rejection payloads admit static copy but not request data or raw validation errors", () => {
  const tokens = "server/routes/report-access-tokens.fastify.ts";
  const create = registeredCutoff(tokens, "/", "!parsed.success");
  const revoke = registeredCutoff(tokens, "/:tokenId/revoke", 'typeof tokenId !== "number"');
  const status = registeredCutoff("server/routes/reports-status.fastify.ts", "/:reportId/status", "!nextStatus");
  const clinicAudit = registeredCutoff("server/routes/clinic-audit.fastify.ts", "/export.csv", "errors.length > 0");
  const heuristic = registeredCutoff(LOGISTICS_ROUTES, "/heuristic", "!parsed.input");

  const cases = [
    { name: "raw zod error", cutoff: create, payload: "{ success: false, error: parsed.error }", disclosing: true },
    {
      name: "extra issues field",
      cutoff: create,
      payload: "{ success: false, error: buildValidationError(parsed.error), issues: parsed.error.issues }",
      disclosing: true,
    },
    {
      name: "route param echoed in the message",
      cutoff: revoke,
      payload: "{ success: false, error: `ID de token invalido: ${request.params.tokenId}` }",
      disclosing: true,
    },
    {
      name: "received status echoed",
      cutoff: status,
      payload: '{ success: false, error: "Estado invalido", allowedStatuses: REPORT_STATUSES, received: request.body?.status }',
      disclosing: true,
    },
    { name: "query spread into the body", cutoff: clinicAudit, payload: "{ success: false, error: errors[0], ...request.query }", disclosing: true },
    { name: "request body stringified", cutoff: heuristic, payload: "{ success: false, error: parsed.error ?? String(request.body) }", disclosing: true },
    { name: "success flag flipped", cutoff: revoke, payload: '{ success: true, error: "ID de token invalido" }', disclosing: true },
    { name: "success flag omitted", cutoff: revoke, payload: '{ error: "ID de token invalido" }', disclosing: true },
    { name: "known allowed: static copy reworded", cutoff: revoke, payload: '{ success: false, error: "Token id invalido" }', disclosing: false },
  ];

  for (const { name, cutoff, payload, disclosing } of cases) {
    const source = readSource(cutoff.file);
    const mutated = replaceRejectionPayload(source, cutoff, payload);
    assert.notEqual(mutated, source, name);
    assert.deepEqual(
      evaluateRouteValidationCutoffs(mutated, cutoff.file, [cutoff]),
      disclosing ? [`${routeCutoffLabel(cutoff)}: cut-off must reject with the approved response payload`] : [],
      name,
    );
  }
});

test("validator identity and sensitive receivers before the branch are part of the cut-off contract", () => {
  const tokens = "server/routes/report-access-tokens.fastify.ts";
  const revoke = registeredCutoff(tokens, "/:tokenId/revoke", 'typeof tokenId !== "number"');
  const label = routeCutoffLabel(revoke);
  const source = readSource(tokens);
  const importedHelper = "  parseEntityId,\n  parseOffset,";
  assert.deepEqual(evaluateRouteValidationCutoffs(source, tokens, [revoke]), []);

  const cases = [
    {
      // A permissive parser would let `/abc/revoke` through the typeof check.
      name: "id parser imported from another module",
      mutated: replaceExactlyOnce(
        replaceExactlyOnce(source, importedHelper, "  parseOffset,"),
        'import {\n  getClinicPermissions,\n} from "../lib/permissions.ts";',
        'import {\n  getClinicPermissions,\n} from "../lib/permissions.ts";\nimport { parseEntityId } from "../lib/lenient-ids.ts";',
      ),
      expected: `${label}: validation must resolve to ${REPORT_ACCESS_DOMAIN}`,
    },
    {
      name: "id parser redefined locally",
      mutated: `${replaceExactlyOnce(source, importedHelper, "  parseOffset,")}\nfunction parseEntityId(value: unknown): number | undefined {\n  return Number(value);\n}\n`,
      expected: `${label}: validation must resolve to ${REPORT_ACCESS_DOMAIN}`,
    },
    {
      name: "unlisted scoped lookup with the raw param before the cut-off",
      mutated: spliceAtCutoff(source, revoke, (branch, file) => ({
        start: branch.getStart(file),
        end: branch.getStart(file),
        text: "await reportAccess.getToken(Number(request.params.tokenId), auth.clinicId);\n\n    ",
      })),
      expected: `${label}: reportAccess.getToken must only run after the cut-off`,
    },
    {
      name: "id parser shadowed inside the handler",
      mutated: spliceAtCutoff(source, revoke, (branch, file) => {
        const validation = (branch.parent as ts.Block).statements.find(
          (statement) => canonical(statement, file) === revoke.validation,
        );
        assert.ok(validation, label);
        const start = validation.getStart(file);
        return { start, end: start, text: "const parseEntityId = (value: unknown) => Number(value);\n\n    " };
      }),
      expected: `${label}: validation must resolve to ${REPORT_ACCESS_DOMAIN}`,
    },
  ];

  for (const { name, mutated, expected } of cases) {
    assert.notEqual(mutated, source, name);
    assert.deepEqual(evaluateRouteValidationCutoffs(mutated, tokens, [revoke]), [expected], name);
  }

  // The route is untouched; the barrel it imports from starts re-exporting a permissive parser.
  const barrel = "server/features/report-access/index.ts";
  const modules = new Map([
    [barrel, `${readSource(barrel)}export { parseEntityId } from "./lenient-ids.ts";\n`],
    [
      "server/features/report-access/lenient-ids.ts",
      "export function parseEntityId(value: unknown): number | undefined {\n  return Number(value);\n}\n",
    ],
  ]);
  assert.deepEqual(evaluateRouteValidationCutoffs(source, tokens, [revoke], modules), [
    `${label}: validation must resolve to ${REPORT_ACCESS_DOMAIN}`,
  ]);
  assert.deepEqual(evaluateRouteValidationCutoffs(source, tokens, [revoke]), [], "disk sources stay authoritative");
});

function replaceAfterCutoff(source: string, cutoff: RouteValidationCutoff, target: string, replacement: string): string {
  return spliceAtCutoff(source, cutoff, (branch) => {
    const start = source.indexOf(target, branch.end);
    assert.notEqual(start, -1, `${routeCutoffLabel(cutoff)}: ${target} must follow the cut-off`);
    return { start, end: start + target.length, text: replacement };
  });
}

test("injected audit filter validators keep their production default wiring", () => {
  // Runtime audit tests inject fake builders, so only this check sees the production default.
  const adminList = registeredCutoff("server/routes/admin-audit.fastify.ts", "/", "errors.length > 0");
  const clinicExport = registeredCutoff("server/routes/clinic-audit.fastify.ts", "/export.csv", "errors.length > 0");
  const unresolved = (cutoff: RouteValidationCutoff) =>
    `${routeCutoffLabel(cutoff)}: validation must resolve to ${AUDIT_LOG_HELPERS}`;

  const cases = [
    {
      name: "production default replaced by an accept-all builder",
      cutoff: adminList,
      mutated: replaceExactlyOnce(
        readSource(adminList.file),
        "buildAdminAuditListFilters: defaultBuildAdminAuditListFilters,",
        "buildAdminAuditListFilters: () => ({ filters: {} as AdminAuditListFilters, errors: [] as string[] }),",
      ),
    },
    {
      name: "option precedence replaced by an inline builder",
      cutoff: clinicExport,
      mutated: replaceExactlyOnce(
        readSource(clinicExport.file),
        "options.buildClinicAuditListFilters ??\n      defaultDeps!.buildClinicAuditListFilters,",
        "(query: Record<string, unknown>) => ({ filters: query as never, errors: [] as string[] }),",
      ),
    },
    {
      name: "wiring kept in a decoy object while deps gets an accept-all builder",
      cutoff: adminList,
      mutated: replaceExactlyOnce(
        readSource(adminList.file),
        "    buildAdminAuditListFilters:\n      options.buildAdminAuditListFilters ??\n      defaultDeps!.buildAdminAuditListFilters,",
        "    buildAdminAuditListFilters,",
      ).concat(
        "\nconst buildAdminAuditListFilters = () => ({ filters: {}, errors: [] });\n",
        "const decoyWiring = { buildAdminAuditListFilters: options.buildAdminAuditListFilters ?? defaultDeps!.buildAdminAuditListFilters };\n",
      ),
    },
    {
      name: "production default replaced while a decoy default survives elsewhere",
      cutoff: adminList,
      mutated: replaceExactlyOnce(
        readSource(adminList.file),
        "buildAdminAuditListFilters: defaultBuildAdminAuditListFilters,",
        "buildAdminAuditListFilters: () => ({ filters: {} as AdminAuditListFilters, errors: [] as string[] }),",
      ).concat("\nconst decoyDefaults = { buildAdminAuditListFilters: defaultBuildAdminAuditListFilters };\n"),
    },
    {
      name: "deps rebound inside the handler",
      cutoff: adminList,
      mutated: spliceAtCutoff(readSource(adminList.file), adminList, (branch, file) => {
        const validation = (branch.parent as ts.Block).statements.find(
          (statement) => canonical(statement, file) === adminList.validation,
        );
        assert.ok(validation);
        const start = validation.getStart(file);
        return {
          start,
          end: start,
          text: "const deps = acceptAllAuditDeps;\n\n    ",
        };
      }),
    },
  ];

  for (const { name, cutoff, mutated } of cases) {
    assert.notEqual(mutated, readSource(cutoff.file), name);
    assert.deepEqual(evaluateRouteValidationCutoffs(mutated, cutoff.file, [cutoff]), [unresolved(cutoff)], name);
  }
});

test("operations consume the validated binding, never the raw request input", () => {
  const clinicCreate = registeredCutoff("server/routes/study-tracking.fastify.ts", "/", "!parsed.success");
  const tokenCreate = registeredCutoff("server/routes/report-access-tokens.fastify.ts", "/", "!parsed.success");
  const status = registeredCutoff("server/routes/reports-status.fastify.ts", "/:reportId/status", "!nextStatus");

  const cases = [
    {
      // Zod strips unknown keys from parsed.data; the raw body would mass-assign them.
      name: "create operation receives the raw body",
      cutoff: clinicCreate,
      mutated: replaceAfterCutoff(readSource(clinicCreate.file), clinicCreate, "data: parsed.data,", "data: request.body,"),
      leak: "request.body",
    },
    {
      name: "raw body aliased before validation and used by the operation",
      cutoff: tokenCreate,
      mutated: replaceAfterCutoff(
        spliceAtCutoff(readSource(tokenCreate.file), tokenCreate, (branch, file) => {
          const validation = (branch.parent as ts.Block).statements.find(
            (statement) => canonical(statement, file) === tokenCreate.validation,
          );
          assert.ok(validation);
          const start = validation.getStart(file);
          return { start, end: start, text: "const rawBody = request.body as { reportId?: unknown };\n\n    " };
        }),
        tokenCreate,
        "reportId: parsed.data.reportId,",
        "reportId: rawBody.reportId as number,",
      ),
      leak: "rawBody",
    },
    {
      name: "transition receives the unvalidated status",
      cutoff: status,
      mutated: replaceAfterCutoff(readSource(status.file), status, "toStatus: nextStatus,", "toStatus: request.body?.status,"),
      leak: "request.body?.status",
    },
    {
      name: "create operation re-reads the body through another request field",
      cutoff: clinicCreate,
      mutated: replaceAfterCutoff(
        readSource(clinicCreate.file),
        clinicCreate,
        "data: parsed.data,",
        'data: JSON.parse(String(request["rawBody"])),',
      ),
      leak: 'request["rawBody"]',
    },
  ];

  for (const { name, cutoff, mutated, leak } of cases) {
    assert.notEqual(mutated, readSource(cutoff.file), name);
    assert.deepEqual(
      evaluateRouteValidationCutoffs(mutated, cutoff.file, [cutoff]),
      [`${routeCutoffLabel(cutoff)}: raw input ${leak} must not be used after the cut-off`],
      name,
    );
  }
});

test("every registered route cut-off is load-bearing when commented out in place", () => {
  for (const cutoff of ROUTE_VALIDATION_CUTOFFS) {
    const label = routeCutoffLabel(cutoff);
    const source = readSource(cutoff.file);
    const file = parseRouteSource(source, cutoff.file);
    assert.ok(file, `${label}: source must parse`);

    const located = locateRouteCutoff(file, cutoff);
    assert.ok("cutoff" in located, label);
    const start = located.cutoff.getStart(file);
    const original = source.slice(start, located.cutoff.end);
    const mutated = `${source.slice(0, start)}${original
      .split("\n")
      .map((line) => `// ${line}`)
      .join("\n")}${source.slice(located.cutoff.end)}`;

    assert.ok(mutated.includes(original.split("\n")[0]), `${label}: branch header text survives`);
    assert.deepEqual(
      evaluateRouteValidationCutoffs(mutated, cutoff.file, [cutoff]),
      [`${label}: cut-off must be a single top-level branch after validation`],
    );
  }
});
test("numeric id helpers reject invalid identifiers instead of defaulting sensitive ids", () => {
  for (const file of [
    "server/features/report-access/report-access-token.ts",
    "server/features/particular-access/particular-token.ts",
    "server/features/study-tracking/domain/study-tracking.ts",
  ] as const) {
    assertLegacyParseEntityId(readSource(file), file);
  }

  const reports = readSource("server/features/reports/domain/reports.ts");
  const parseReportId = extractFunctionBlock(
    reports,
    "export function parseReportId(value: unknown): number | undefined {",
    "reports parseReportId",
  );

  assertMatches(
    parseReportId,
    /return Number\.isInteger\((parsed|reportId)\) && \1 > 0 \? \1 : undefined;/,
    "reports parseReportId positive id only",
  );
  assertNotContains(
    parseReportId,
    "return fallback",
    "reports parseReportId must not fallback for sensitive ids",
  );

  for (const { file, name } of POSITIVE_ID_HELPERS) {
    assert.deepEqual(evaluatePositiveIdHelperSource(readSource(file), file, name), [], file);
  }
});

const POSITIVE_ID_SIGNATURE = "export function parseEntityId(value: unknown): number | undefined {";
const POSITIVE_ID_CHECK = "return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;";

function positiveIdViolations(file: string, name: string) {
  return {
    unique: `${file}: ${name} must be declared exactly once at module level`,
    declaration: `${file}: ${name} declaration must be exactly (value: unknown): number | undefined with the positive integer check`,
    domain: `${file}: ${name} must map absent or invalid input to undefined and positive integers to themselves`,
    globals: `${file}: ${name} must resolve Number and undefined to the globals`,
  };
}

function compiledIdHelper(source: string, fileName: string, name: string): (value: unknown) => unknown {
  const file = parseRouteSource(source, fileName);
  assert.ok(file, `${fileName} must parse`);
  const [declaration] = descendants(file, ts.isFunctionDeclaration).filter((helper) => helper.name?.text === name);
  assert.ok(declaration, `${fileName} must declare ${name}`);
  const helper = compileIdHelper(declaration, file, name);
  assert.equal(typeof helper, "function");
  return helper as (value: unknown) => unknown;
}

test("mutation proof: commented-out positive id check keeps legacy markers but fails the helper evaluator", () => {
  const { file, name } = POSITIVE_ID_HELPERS[0];
  const source = readSource(file);
  const violation = positiveIdViolations(file, name);
  assert.deepEqual(evaluatePositiveIdHelperSource(source, file, name), []);

  const cases = [
    {
      // NaN from Number("abc") is typeof "number" and passes every route cut-off.
      kind: "check commented out behind a raw return",
      mutated: replaceExactlyOnce(source, POSITIVE_ID_CHECK, `return parsed; // ${POSITIVE_ID_CHECK}`),
      expected: [violation.declaration, violation.domain],
    },
    {
      kind: "check kept only in a string",
      mutated: replaceExactlyOnce(source, POSITIVE_ID_CHECK, `return parsed || "${POSITIVE_ID_CHECK}";`),
      expected: [violation.declaration, violation.domain],
    },
    {
      kind: "helper duplicated with a permissive variant",
      mutated: `${source}\nfunction ${name}(value: unknown): number | undefined {\n  return Number(value);\n}\n`,
      expected: [violation.unique],
    },
  ];

  for (const { kind, mutated, expected } of cases) {
    assert.notEqual(mutated, source, kind);
    assertLegacyParseEntityId(mutated, file);
    assert.deepEqual(evaluatePositiveIdHelperSource(mutated, file, name), expected, kind);
  }

  assert.equal(readSource(file), source, "production source is never written");
});

test("mutation proof: defaulted id parameter keeps body and legacy markers but maps absent ids to entity 1", () => {
  const { file, name } = POSITIVE_ID_HELPERS[0];
  const source = readSource(file);
  const violation = positiveIdViolations(file, name);
  const mutated = replaceExactlyOnce(
    source,
    POSITIVE_ID_SIGNATURE,
    `// ${POSITIVE_ID_SIGNATURE}\n${POSITIVE_ID_SIGNATURE.replace("value: unknown", "value: unknown = 1")}`,
  );

  // Legacy markers survive: the original signature in the comment, the body untouched.
  assertLegacyParseEntityId(mutated, file);
  assert.equal(countOccurrences(mutated, POSITIVE_ID_CHECK), 1);

  // Observable regression: an absent route id now targets entity 1.
  assert.equal(compiledIdHelper(source, file, name)(undefined), undefined);
  assert.equal(compiledIdHelper(mutated, file, name)(undefined), 1);

  assert.deepEqual(evaluatePositiveIdHelperSource(mutated, file, name), [violation.declaration, violation.domain]);
  assert.equal(readSource(file), source, "production source is never written");
});

test("positive id helper evaluator rejects declaration changes around an unchanged body", () => {
  const { file, name } = POSITIVE_ID_HELPERS[0];
  const source = readSource(file);
  const violation = positiveIdViolations(file, name);
  const signature = (from: string, to: string) =>
    replaceExactlyOnce(source, POSITIVE_ID_SIGNATURE, POSITIVE_ID_SIGNATURE.replace(from, to));

  const cases = [
    {
      kind: "string default",
      mutated: signature("value: unknown", 'value: unknown = "1"'),
      expected: [violation.declaration, violation.domain],
    },
    {
      kind: "destructured parameter",
      mutated: signature("value: unknown", "{ value }: { value: unknown }"),
      expected: [violation.declaration, violation.domain],
    },
    {
      kind: "additional fallback parameter used by the check",
      mutated: replaceExactlyOnce(
        signature("value: unknown", "value: unknown, fallback: number | undefined = 1"),
        POSITIVE_ID_CHECK,
        POSITIVE_ID_CHECK.replace(": undefined;", ": fallback;"),
      ),
      expected: [violation.declaration, violation.domain],
    },
    {
      kind: "async declaration",
      mutated: signature("export function", "export async function"),
      expected: [violation.declaration, violation.domain],
    },
    // Fail-closed: these keep the sampled domain but still change the declared contract.
    { kind: "optional parameter", mutated: signature("value: unknown", "value?: unknown"), expected: [violation.declaration] },
    { kind: "rest parameter", mutated: signature("value: unknown", "...value: unknown[]"), expected: [violation.declaration] },
    { kind: "widened return type", mutated: signature("): number | undefined", "): unknown"), expected: [violation.declaration] },
    // Declaration and body untouched; the free names they rely on are rebound in the module.
    {
      kind: "module-level undefined rebound to an id",
      mutated: `${source}\nconst undefined = 1;\n`,
      expected: [violation.globals],
    },
    {
      kind: "module-level Number shadow",
      mutated: `${source}\nfunction Number(_value: unknown): number {\n  return 1;\n}\n`,
      expected: [violation.globals],
    },
  ];

  for (const { kind, mutated, expected } of cases) {
    assert.notEqual(mutated, source, kind);
    assert.deepEqual(evaluatePositiveIdHelperSource(mutated, file, name), expected, kind);
  }
});

test("runtime validation tests remain explicit for cut-off behavior", () => {
  const publicReportAccess = readSource("test/public-report-access.fastify.test.ts");
  const reportsStatus = readSource("test/reports-status.fastify.test.ts");
  const reports = readSource("test/reports.fastify.test.ts");
  const adminReports = readSource("test/admin-reports.fastify.test.ts");
  const publicProfessionals = readSource("test/public-professionals.fastify.test.ts");
  const auditExports = readSource("test/security/audit-export-boundaries.test.ts");
  const accessLifecycle = readSource("test/architecture/security/security-access-lifecycle-boundaries.test.ts");
  const responseDisclosure = readSource("test/architecture/security/security-response-disclosure-boundaries.test.ts");

  assertContains(
    publicReportAccess,
    "publicReportAccessNativeRoutes oculta token malformado como informe no encontrado",
    "public report access invalid token runtime test",
  );
  assertContains(
    reportsStatus,
    "reportsStatusNativeRoutes valida reportId y status invalidos",
    "reports status invalid route/body runtime test",
  );
  assertContains(
    reports,
    "reportsNativeRoutes bloquea reportId",
    "reports invalid route id runtime test",
  );
  assertContains(
    adminReports,
    "clinicId invalido no debe auditar upload",
    "admin report upload invalid clinicId audit cut-off runtime test",
  );
  assertContains(
    publicProfessionals,
    "no ejecuta helpers cuando la respuesta publica se corta por validacion o CORS",
    "public professionals validation helper cut-off runtime test",
  );
  assertMatches(
    auditExports,
    /audit exports bloquean resultados que superan el m.ximo por dominio/,
    "audit export validation runtime test",
  );
  assertContains(
    accessLifecycle,
    "public invalid token runtime test",
    "access lifecycle invalid token guardrail",
  );
  assertContains(
    responseDisclosure,
    "public invalid token runtime test",
    "response disclosure invalid token guardrail",
  );
});

test("validation cut-off guardrail source stays ascii only", () => {
  const source = readSource("test/architecture/security/security-validation-cutoff-boundaries.test.ts");
  const replacementCharacter = String.fromCharCode(0xfffd);

  assertNotContains(source, replacementCharacter, "validation cut-off guardrail source");

  for (let index = 0; index < source.length; index += 1) {
    assert.equal(
      source.charCodeAt(index) <= 0x7f,
      true,
      `validation cut-off guardrail source must stay ascii-only at index ${index}`,
    );
  }
});
