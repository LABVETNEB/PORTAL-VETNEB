import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, relative, resolve, sep } from "node:path";
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

type RouteValidationCutoff = {
  file: string;
  method: "get" | "post" | "patch";
  path: string;
  validation: string;
  guard: string;
  status: 400 | 404;
  operations: readonly string[];
};

// Executable cut-offs protected by this guard. `validation` is the comment-free canonical
// declaration, `guard` the canonical branch condition and `operations` the sensitive
// callees that must only run once the branch has rejected invalid input.
const ROUTE_VALIDATION_CUTOFFS: readonly RouteValidationCutoff[] = [
  {
    file: PUBLIC_REPORT_ACCESS_FILE,
    method: "get",
    path: "/:token",
    validation: "const parsed = reportAccessTokenRawTokenSchema.safeParse(request.params.token);",
    guard: "!parsed.success",
    status: 404,
    operations: ["reportAccess.access"],
  },
  {
    file: "server/routes/reports-status.fastify.ts",
    method: "patch",
    path: "/:reportId/status",
    validation: "const reportId = parseReportId(request.params.reportId);",
    guard: 'typeof reportId !== "number"',
    status: 400,
    operations: ["composition.queries.transitionClinicReportStatus", "composition.writeAuditLog"],
  },
  {
    file: "server/routes/reports-status.fastify.ts",
    method: "patch",
    path: "/:reportId/status",
    validation: "const nextStatus = parseReportStatus(request.body?.status);",
    guard: "!nextStatus",
    status: 400,
    operations: ["composition.queries.transitionClinicReportStatus", "composition.writeAuditLog"],
  },
  {
    file: "server/routes/report-access-tokens.fastify.ts",
    method: "post",
    path: "/",
    validation: "const parsed = clinicCreateReportAccessTokenSchema.safeParse(request.body);",
    guard: "!parsed.success",
    status: 400,
    operations: ["reportAccess.createToken"],
  },
  {
    file: "server/routes/report-access-tokens.fastify.ts",
    method: "patch",
    path: "/:tokenId/revoke",
    validation: "const tokenId = parseEntityId(request.params.tokenId);",
    guard: 'typeof tokenId !== "number"',
    status: 400,
    operations: ["reportAccess.revokeToken"],
  },
  {
    file: "server/routes/admin-reports.fastify.ts",
    method: "post",
    path: "/upload",
    validation: "const clinicId = parseReportId(body.clinicId);",
    guard: 'typeof clinicId !== "number"',
    status: 400,
    operations: ["composition.service.uploadAdminReport"],
  },
  {
    file: "server/routes/study-tracking.fastify.ts",
    method: "post",
    path: "/",
    validation: "const parsed = clinicCreateStudyTrackingSchema.safeParse(request.body);",
    guard: "!parsed.success",
    status: 400,
    operations: ["clinicOperations.createClinicStudyTrackingCase"],
  },
  {
    file: "server/routes/admin-study-tracking.fastify.ts",
    method: "post",
    path: "/",
    validation: "const parsed = adminCreateStudyTrackingSchema.safeParse(request.body ?? {});",
    guard: "!parsed.success",
    status: 400,
    operations: ["adminOperations.createAdminStudyTrackingCase"],
  },
  {
    file: "server/routes/admin-study-tracking.fastify.ts",
    method: "patch",
    path: "/:trackingCaseId",
    validation: "const parsed = updateStudyTrackingSchema.safeParse(body);",
    guard: "!parsed.success",
    status: 400,
    operations: ["adminOperations.updateAdminStudyTrackingCase"],
  },
  {
    file: "server/routes/logistics-route-plans.fastify.ts",
    method: "post",
    path: "/heuristic",
    validation: "const parsed = buildGenerateHeuristicRoutePlanInput(request.body, auth.clinicId, auth.id);",
    guard: "!parsed.input",
    status: 400,
    operations: ["generateHeuristicRoutePlan"],
  },
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
  ].flatMap(({ file, validation, list, csv }): RouteValidationCutoff[] => [
    { file, method: "get", path: "/", validation, guard: "errors.length > 0", status: 400, operations: [list] },
    {
      file,
      method: "get",
      path: "/export.csv",
      validation,
      guard: "errors.length > 0",
      status: 400,
      operations: [list, csv],
    },
  ]),
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

function isRejection(statement: ts.Statement, status: number, file: ts.SourceFile): boolean {
  const expression = ts.isReturnStatement(statement) ? statement.expression : undefined;
  if (!expression || !ts.isCallExpression(expression) || !ts.isPropertyAccessExpression(expression.expression)) {
    return false;
  }
  const send = expression.expression;
  return (
    send.name.text === "send" &&
    ts.isCallExpression(send.expression) &&
    canonical(send.expression, file) === `reply.code(${status})`
  );
}

// The single top-level branch that rejects invalid input, or the reason it cannot be
// trusted: missing, duplicated, nested, reordered, neutralized, non-terminating, or
// preceded by a sensitive operation.
function locateRouteCutoff(
  file: ts.SourceFile,
  cutoff: RouteValidationCutoff,
): { cutoff: ts.IfStatement } | { violation: string } {
  const label = routeCutoffLabel(cutoff);
  const registrations = routeHandlers(file, cutoff);
  const handler = registrations.length === 1 ? registrations[0].arguments.at(-1) : undefined;
  if (
    handler === undefined ||
    !(ts.isArrowFunction(handler) || ts.isFunctionExpression(handler)) ||
    !ts.isBlock(handler.body)
  ) {
    return { violation: `${label}: route handler must be registered exactly once with a block body` };
  }

  const body = handler.body;
  const validations = descendants(body, ts.isVariableStatement).filter(
    (statement) => canonical(statement, file) === cutoff.validation,
  );
  const validationIndex =
    validations.length === 1 && validations[0].parent === body ? body.statements.indexOf(validations[0]) : -1;
  if (validationIndex === -1) {
    return { violation: `${label}: validation must be declared exactly once at handler top level` };
  }

  const branches = descendants(body, ts.isIfStatement).filter(
    (statement) => canonical(statement.expression, file) === cutoff.guard,
  );
  const branch = branches.length === 1 && branches[0].parent === body ? branches[0] : undefined;
  const branchIndex = branch ? body.statements.indexOf(branch) : -1;
  if (!branch || branchIndex <= validationIndex) {
    return { violation: `${label}: cut-off must be a single top-level branch after validation` };
  }

  const thenStatements = ts.isBlock(branch.thenStatement) ? [...branch.thenStatement.statements] : [branch.thenStatement];
  const last = thenStatements.at(-1);
  if (
    last === undefined ||
    thenStatements.filter(ts.isReturnStatement).length !== 1 ||
    !isRejection(last, cutoff.status, file)
  ) {
    return { violation: `${label}: cut-off branch must end in return reply.code(${cutoff.status}).send(...)` };
  }

  for (const operation of cutoff.operations) {
    const calls = descendants(body, ts.isCallExpression).filter(
      (call) => canonical(call.expression, file) === operation,
    );
    if (calls.length === 0) {
      return { violation: `${label}: ${operation} must be present in the handler` };
    }
    for (const call of calls) {
      // A call wrapped in a nested function may run earlier than its position (hoisting).
      let topLevel: ts.Node = call;
      let wrapped = false;
      while (topLevel.parent !== undefined && topLevel.parent !== body) {
        topLevel = topLevel.parent;
        wrapped ||= ts.isFunctionLike(topLevel);
      }
      if (wrapped || body.statements.indexOf(topLevel as ts.Statement) <= branchIndex) {
        return { violation: `${label}: ${operation} must only run after the cut-off` };
      }
    }
  }

  const bindings = new Set(
    validations[0].declarationList.declarations.flatMap((declaration) =>
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

  return { cutoff: branch };
}

function evaluateRouteValidationCutoffs(
  source: string,
  fileName: string,
  cutoffs: readonly RouteValidationCutoff[],
): string[] {
  const file = parseRouteSource(source, fileName);
  if (file === undefined) {
    return [`${fileName}: source must parse as TypeScript before evaluation`];
  }

  return cutoffs.flatMap((cutoff) => {
    const located = locateRouteCutoff(file, cutoff);
    return "violation" in located ? [located.violation] : [];
  });
}

function routeCutoffsFor(fileName: string): RouteValidationCutoff[] {
  return ROUTE_VALIDATION_CUTOFFS.filter((cutoff) => cutoff.file === fileName);
}

const POSITIVE_ID_HELPERS = [
  { file: "server/features/report-access/report-access-token.ts", name: "parseEntityId" },
  { file: "server/features/particular-access/particular-token.ts", name: "parseEntityId" },
  { file: "server/features/study-tracking/domain/study-tracking.ts", name: "parseEntityId" },
  { file: "server/features/reports/domain/reports.ts", name: "parseReportId" },
] as const;

function positiveIdBody(local: string): string {
  return `{ const ${local} = Number(value); return Number.isInteger(${local}) && ${local} > 0 ? ${local} : undefined; }`;
}

// Route cut-offs test `typeof id !== "number"`, so the helper itself must turn NaN,
// zero, negatives and fractions into undefined with executable code.
function evaluatePositiveIdHelperSource(source: string, fileName: string, name: string): string[] {
  const file = parseRouteSource(source, fileName);
  if (file === undefined) {
    return [`${fileName}: source must parse as TypeScript before evaluation`];
  }

  const helpers = descendants(file, ts.isFunctionDeclaration).filter((declaration) => declaration.name?.text === name);
  const body = helpers.length === 1 && helpers[0].parent === file ? helpers[0].body : undefined;
  return body !== undefined && ["parsed", "reportId"].some((local) => canonical(body, file) === positiveIdBody(local))
    ? []
    : [`${fileName}: ${name} must return only positive integers and undefined otherwise`];
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

test("mutation proof: commented-out positive id check keeps legacy markers but fails the helper evaluator", () => {
  const { file, name } = POSITIVE_ID_HELPERS[0];
  const source = readSource(file);
  const check = "return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;";
  const violation = `${file}: ${name} must return only positive integers and undefined otherwise`;
  assert.deepEqual(evaluatePositiveIdHelperSource(source, file, name), []);

  const cases = {
    // NaN from Number("abc") is typeof "number" and passes every route cut-off.
    "check commented out behind a raw return": replaceExactlyOnce(source, check, `return parsed; // ${check}`),
    "check kept only in a string": replaceExactlyOnce(source, check, `return parsed || "${check}";`),
    "helper duplicated with a permissive variant": `${source}\nfunction ${name}(value: unknown): number | undefined {\n  return Number(value);\n}\n`,
  };

  for (const [kind, mutated] of Object.entries(cases)) {
    assert.notEqual(mutated, source, kind);
    assertLegacyParseEntityId(mutated, file);
    assert.deepEqual(evaluatePositiveIdHelperSource(mutated, file, name), [violation], kind);
  }

  assert.equal(readSource(file), source, "production source is never written");
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
