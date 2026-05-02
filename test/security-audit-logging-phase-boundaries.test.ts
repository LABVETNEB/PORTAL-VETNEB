import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const REPO_ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));

const AUDIT_LOGGING_PHASE_BOUNDARIES = {
  preconditions: [
    "trusted origin",
    "authenticated actor",
    "permission",
    "ownership",
    "validation",
    "resource lifecycle",
  ],
  mutation: [
    "persist session",
    "persist report status",
    "persist report upload",
    "persist report access token create or revoke",
    "record public token access",
  ],
  audit: [
    "write structured audit log after successful mutation",
    "preserve actor and target identifiers",
    "avoid raw secrets in metadata",
  ],
  response: [
    "send success response only after audit attempt",
    "do not let audit storage failure break the business response",
  ],
} as const;

function readSource(relativePath: string): string {
  return readFileSync(resolve(REPO_ROOT, relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
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
      `${context} must keep phase order before marker: ${marker}`,
    );

    lastIndex = index;
  }
}

function assertRouteKeepsInjectedAuditDeps(file: string): void {
  const source = readSource(file);

  assertContains(source, "writeAuditLog?:", `${file} audit dependency type`);
  assertContains(
    source,
    "writeAuditLog: audit.writeAuditLog",
    `${file} real audit default`,
  );
  assertMatches(
    source,
    /options\.writeAuditLog \?\? defaultDeps!\.writeAuditLog|writeAuditLog: options\.writeAuditLog \?\? defaultDeps!\.writeAuditLog/,
    `${file} injected audit dependency selection`,
  );
}

test("audit logging phase matrix documents the protected contract", () => {
  assert.deepEqual(AUDIT_LOGGING_PHASE_BOUNDARIES, {
    preconditions: [
      "trusted origin",
      "authenticated actor",
      "permission",
      "ownership",
      "validation",
      "resource lifecycle",
    ],
    mutation: [
      "persist session",
      "persist report status",
      "persist report upload",
      "persist report access token create or revoke",
      "record public token access",
    ],
    audit: [
      "write structured audit log after successful mutation",
      "preserve actor and target identifiers",
      "avoid raw secrets in metadata",
    ],
    response: [
      "send success response only after audit attempt",
      "do not let audit storage failure break the business response",
    ],
  });
});

test("writeAuditLog keeps audit storage failures isolated from business flow", () => {
  const source = readSource("server/lib/audit.ts");

  assertContainsInOrder(
    source,
    [
      "const payload = buildAuditLogInsert(req as RequestWithContext, input);",
      "await deps.createAuditLog(payload);",
      'deps.logInfo("AUDIT_LOG_WRITTEN", {',
    ],
    "audit write success phase",
  );

  assertContainsInOrder(
    source,
    [
      "} catch (error) {",
      'deps.logError("AUDIT_LOG_WRITE_ERROR", {',
      "error: deps.serializeError(error),",
    ],
    "audit write error phase",
  );

  assertContains(
    source,
    "metadata: normalizeAuditMetadata(input.metadata),",
    "audit insert metadata normalization",
  );
  assertContains(
    source,
    "requestPath: req.originalUrl ? sanitizeUrlForLogs(req.originalUrl) : null",
    "audit insert sanitized request path",
  );
  assertNotContains(source, "throw error;", "audit writer must absorb errors");
});

test("auth login audit happens after session persistence and before success response", () => {
  const clinicAuth = readSource("server/routes/auth.fastify.ts");
  const adminAuth = readSource("server/routes/admin-auth.fastify.ts");

  assertContainsInOrder(
    clinicAuth,
    [
      "if (!enforceTrustedOrigin(request, reply, allowedOrigins)) {",
      "const token = deps.generateSessionToken();",
      "await deps.createActiveSession({",
      "await deps.writeAuditLog(createAuditRequestLike(request), {",
      "event: AUDIT_EVENTS.CLINIC_LOGIN_SUCCEEDED",
      "return reply.code(200).send({",
    ],
    "clinic auth login audit phase",
  );

  assertContainsInOrder(
    adminAuth,
    [
      "if (!enforceTrustedOrigin(request, reply, allowedOrigins)) {",
      "const token = deps.generateSessionToken();",
      "await deps.createAdminSession({",
      "await deps.writeAuditLog(createAuditRequestLike(request), {",
      "event: AUDIT_EVENTS.ADMIN_LOGIN_SUCCEEDED",
      "return reply.code(200).send({",
    ],
    "admin auth login audit phase",
  );
});

test("report mutation audit happens after durable mutation and before success response", () => {
  const reportsStatus = readSource("server/routes/reports-status.fastify.ts");
  const adminReports = readSource("server/routes/admin-reports.fastify.ts");

  assertContainsInOrder(
    reportsStatus,
    [
      "if (!enforceTrustedOrigin(request, reply, allowedOrigins)) {",
      "const auth = await authenticateClinicUser(",
      "const updated = await deps.updateReportStatus({",
      "await deps.writeAuditLog(createAuditRequestLike(request, auth), {",
      "event: AUDIT_EVENTS.REPORT_STATUS_CHANGED",
      "return reply.code(200).send({",
    ],
    "clinic report status audit phase",
  );

  assertContainsInOrder(
    adminReports,
    [
      "if (!enforceTrustedOrigin(request, reply, allowedOrigins)) {",
      "const admin = await authenticateAdminUser(",
      "const storagePath = await deps.uploadReport({",
      "const report = await deps.upsertReport({",
      "await deps.writeAuditLog(createAuditRequestLike(request, admin), {",
      "event: AUDIT_EVENTS.REPORT_UPLOADED",
      "return reply.code(201).send({",
    ],
    "admin report upload audit phase",
  );
});

test("report access token audit happens after create or revoke persistence", () => {
  const clinicTokens = readSource("server/routes/report-access-tokens.fastify.ts");
  const adminTokens = readSource("server/routes/admin-report-access-tokens.fastify.ts");

  assertContainsInOrder(
    clinicTokens,
    [
      "const reportAccessToken = await deps.createReportAccessToken({",
      "await deps.writeAuditLog(createAuditRequestLike(request, auth), {",
      "event: AUDIT_EVENTS.REPORT_ACCESS_TOKEN_CREATED",
      "return reply.code(201).send({",
    ],
    "clinic report access token create audit phase",
  );

  assertContainsInOrder(
    clinicTokens,
    [
      "const revoked = await deps.revokeReportAccessToken({",
      "await deps.writeAuditLog(createAuditRequestLike(request, auth), {",
      "event: AUDIT_EVENTS.REPORT_ACCESS_TOKEN_REVOKED",
      "return reply.code(200).send({",
    ],
    "clinic report access token revoke audit phase",
  );

  assertContainsInOrder(
    adminTokens,
    [
      "const reportAccessToken = await deps.createReportAccessToken({",
      "await deps.writeAuditLog(createAuditRequestLike(request, admin), {",
      "event: AUDIT_EVENTS.REPORT_ACCESS_TOKEN_CREATED",
      "return reply.code(201).send({",
    ],
    "admin report access token create audit phase",
  );

  assertContainsInOrder(
    adminTokens,
    [
      "const revoked = await deps.revokeReportAccessToken({",
      "await deps.writeAuditLog(createAuditRequestLike(request, admin), {",
      "event: AUDIT_EVENTS.REPORT_ACCESS_TOKEN_REVOKED",
      "return reply.code(200).send({",
    ],
    "admin report access token revoke audit phase",
  );
});

test("public report access audits only after token validation lifecycle and access recording", () => {
  const source = readSource("server/routes/public-report-access.fastify.ts");

  assertContainsInOrder(
    source,
    [
      "const parsed = reportAccessTokenRawTokenSchema.safeParse(request.params.token);",
      "if (!parsed.success) {",
      "const tokenHash = deps.hashSessionToken(parsed.data);",
      "const record = await deps.getReportAccessTokenWithReportByTokenHash(tokenHash);",
      "if (!record) {",
      "const tokenState = getReportAccessTokenState(record.token, new Date(currentTime));",
      'if (tokenState === "revoked") {',
      'if (tokenState === "expired") {',
      "if (!canAccessReportPublicly(record.report.currentStatus)) {",
      "const updatedToken = await deps.recordReportAccessTokenAccess(record.token.id);",
      "await deps.writeAuditLog(request, {",
      "event: AUDIT_EVENTS.REPORT_PUBLIC_ACCESSED",
      "return reply.code(200).send({",
    ],
    "public report access audit lifecycle phase",
  );

  assertContains(
    source,
    "actor: buildPublicReportAccessTokenActor(record.token.id)",
    "public report access audit actor",
  );
  assertContains(
    source,
    "targetReportAccessTokenId: record.token.id",
    "public report access audit target",
  );
});

test("critical audit routes keep writeAuditLog injectable with real defaults", () => {
  for (const file of [
    "server/routes/admin-auth.fastify.ts",
    "server/routes/auth.fastify.ts",
    "server/routes/reports-status.fastify.ts",
    "server/routes/report-access-tokens.fastify.ts",
    "server/routes/admin-report-access-tokens.fastify.ts",
    "server/routes/public-report-access.fastify.ts",
    "server/routes/admin-reports.fastify.ts",
    "server/routes/study-tracking.fastify.ts",
    "server/routes/admin-study-tracking.fastify.ts",
  ] as const) {
    assertRouteKeepsInjectedAuditDeps(file);
  }
});

test("runtime audit tests remain explicit for success and failure phases", () => {
  const auditWriteTests = readSource("test/audit-write.test.ts");
  const auditCriticalFlowTests = readSource("test/audit-critical-flow-writes.test.ts");
  const publicReportAccessTests = readSource("test/public-report-access.fastify.test.ts");

  assertContains(
    auditWriteTests,
    "writeAuditLog absorbe errores de escritura",
    "audit writer error isolation runtime test",
  );
  assertContains(
    auditCriticalFlowTests,
    "assertContainsInOrder(",
    "critical flow audit order helper",
  );
  assertMatches(
    auditCriticalFlowTests,
    /report status cr.tico audita despu.s de mutar estado exitosamente/,
    "report status audit phase runtime guard",
  );
  assertMatches(
    auditCriticalFlowTests,
    /public report access audita acceso exitoso con actor de token p.blico/,
    "public report access audit phase runtime guard",
  );
  assertMatches(
    publicReportAccessTests,
    /writeAuditLog:\s*async \(\) => \{\s*throw new Error\("[^"]*no debe escribir auditor/s,
    "expired public token must not audit",
  );
});

test("audit logging phase guardrail source stays ascii only", () => {
  const source = readSource("test/security-audit-logging-phase-boundaries.test.ts");
  const replacementCharacter = String.fromCharCode(0xfffd);

  assertNotContains(source, replacementCharacter, "audit phase guardrail source");

  for (let index = 0; index < source.length; index += 1) {
    assert.equal(
      source.charCodeAt(index) <= 0x7f,
      true,
      `audit phase guardrail source must stay ascii-only at index ${index}`,
    );
  }
});
