import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const REPO_ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));

const VALIDATION_CUTOFF_BOUNDARIES = {
  publicRawTokens: [
    "parse raw public token shape",
    "return 400 before hash db signing audit",
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

function readSource(relativePath: string): string {
  return readFileSync(resolve(REPO_ROOT, relativePath), "utf8")
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
      "return 400 before hash db signing audit",
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

  assertContainsInOrder(
    source,
    [
      "const parsed = reportAccessTokenRawTokenSchema.safeParse(request.params.token);",
      "if (!parsed.success) {",
      "return reply.code(400).send({",
      "const tokenHash = deps.hashSessionToken(parsed.data);",
      "const record = await deps.getReportAccessTokenWithReportByTokenHash(tokenHash);",
      "const updatedToken = await deps.recordReportAccessTokenAccess(record.token.id);",
      "const [previewUrl, downloadUrl] = await Promise.all([",
      "await deps.writeAuditLog(request, {",
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
      "const reportResult = await getAuthorizedReport(",
      "const updated = await deps.updateReportStatus({",
      "await deps.writeAuditLog(createAuditRequestLike(request, auth), {",
      "report: await serializeReport(updated, deps),",
    ],
    "report status validation cut-off",
  );
});

test("clinic report access token create validates body before report lookup token generation mutation and audit", () => {
  const source = readSource("server/routes/report-access-tokens.fastify.ts");
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
      "const report = await deps.getReportById(parsed.data.reportId);",
      "const rawToken = deps.generateSessionToken();",
      "const tokenHash = deps.hashSessionToken(rawToken);",
      "const reportAccessToken = await deps.createReportAccessToken({",
      "await deps.writeAuditLog(createAuditRequestLike(request, auth), {",
    ],
    "clinic report access token create validation cut-off",
  );
});

test("clinic report access token revoke validates token id before scoped lookup revoke and audit", () => {
  const source = readSource("server/routes/report-access-tokens.fastify.ts");
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
      "const existing = await deps.getClinicScopedReportAccessToken(",
      "const revoked = await deps.revokeReportAccessToken({",
      "await deps.writeAuditLog(createAuditRequestLike(request, auth), {",
    ],
    "clinic report access token revoke validation cut-off",
  );
});

test("admin report upload validates clinicId before storage upload upsert signed urls and audit", () => {
  const source = readSource("server/routes/admin-reports.fastify.ts");
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
      "const clinic = await deps.getClinicById(clinicId);",
      "const storagePath = await deps.uploadReport({",
      "const report = await deps.upsertReport({",
      "await deps.writeAuditLog(createAuditRequestLike(request, admin), {",
      "report: await serializeReport(report, deps),",
    ],
    "admin report upload validation cut-off",
  );
});

test("clinic study tracking create validates body before linked lookups writes notifications and audit", () => {
  const source = readSource("server/routes/study-tracking.fastify.ts");
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
      "const clinic = await deps.getClinicById(auth.clinicId);",
      'if (typeof parsed.data.reportId === "number") {',
      "const report = await deps.getReportById(parsed.data.reportId);",
      'if (typeof parsed.data.particularTokenId === "number") {',
      "const particularToken = await deps.getParticularTokenById(",
      "const delivery = applyEstimatedDeliveryRules({",
      "const created = await deps.createStudyTrackingCase({",
      "await deps.writeAuditLog(createAuditRequestLike(request, auth), {",
    ],
    "clinic study tracking create validation cut-off",
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
    "server/lib/report-access-token.ts",
    "server/lib/particular-token.ts",
    "server/lib/study-tracking.ts",
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

  const reports = readSource("server/lib/reports.ts");
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
  const auditExports = readSource("test/audit-export-boundaries.test.ts");
  const accessLifecycle = readSource("test/security-access-lifecycle-boundaries.test.ts");
  const responseDisclosure = readSource("test/security-response-disclosure-boundaries.test.ts");

  assertContains(
    publicReportAccess,
    "publicReportAccessNativeRoutes devuelve 400 cuando el token es invalido",
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
  const source = readSource("test/security-validation-cutoff-boundaries.test.ts");
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
