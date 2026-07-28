import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

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
  const source = readSource("server/routes/public-report-access.fastify.ts");
  const application = readSource(
    "server/features/report-access/application/public-report-access-operations.ts",
  );

  assertContainsInOrder(
    source,
    [
      "const parsed = reportAccessTokenRawTokenSchema.safeParse(request.params.token);",
      "if (!parsed.success) {",
      "return reply.code(404).send(REPORT_NOT_FOUND_RESPONSE);",
      "const result = await reportAccess.access(",
    ],
    "public report access token route validation cut-off",
  );
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
test("numeric id helpers reject invalid identifiers instead of defaulting sensitive ids", () => {
  for (const file of [
    "server/features/report-access/report-access-token.ts",
    "server/features/particular-access/particular-token.ts",
    "server/features/study-tracking/domain/study-tracking.ts",
  ] as const) {
    const source = readSource(file);
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
