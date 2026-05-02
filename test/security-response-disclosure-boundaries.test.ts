import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const REPO_ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));

const RESPONSE_DISCLOSURE_BOUNDARIES = {
  unauthenticated: {
    status: 401,
    meaning: "missing invalid or expired session",
  },
  forbidden: {
    status: 403,
    meaning: "authenticated actor lacks permission or origin is blocked",
  },
  hiddenOrMissing: {
    status: 404,
    meaning: "missing resource or resource hidden from current scope",
  },
  stateConflict: {
    status: 409,
    meaning: "resource exists but current state does not allow the requested public action",
  },
  gone: {
    status: 410,
    meaning: "public access token is expired or revoked",
  },
  rateLimited: {
    status: 429,
    meaning: "rate limit reached",
  },
} as const;

function readSource(relativePath: string): string {
  return readFileSync(resolve(REPO_ROOT, relativePath), "utf8");
}

function assertContains(source: string, marker: string, context: string) {
  assert.ok(source.includes(marker), `${context} must contain: ${marker}`);
}

function assertNotContains(source: string, marker: string, context: string) {
  assert.equal(source.includes(marker), false, `${context} must not contain: ${marker}`);
}

test("response disclosure matrix documents stable public error semantics", () => {
  assert.deepEqual(RESPONSE_DISCLOSURE_BOUNDARIES, {
    unauthenticated: {
      status: 401,
      meaning: "missing invalid or expired session",
    },
    forbidden: {
      status: 403,
      meaning: "authenticated actor lacks permission or origin is blocked",
    },
    hiddenOrMissing: {
      status: 404,
      meaning: "missing resource or resource hidden from current scope",
    },
    stateConflict: {
      status: 409,
      meaning: "resource exists but current state does not allow the requested public action",
    },
    gone: {
      status: 410,
      meaning: "public access token is expired or revoked",
    },
    rateLimited: {
      status: 429,
      meaning: "rate limit reached",
    },
  });
});

test("public report access uses explicit 400 404 409 410 and 429 boundaries", () => {
  const publicReportAccess = readSource("server/routes/public-report-access.fastify.ts");

  assertContains(publicReportAccess, "reportAccessTokenRawTokenSchema.safeParse", "public token shape validation");
  assertContains(publicReportAccess, "return reply.code(400).send", "public invalid token response");

  assertContains(publicReportAccess, "getReportAccessTokenWithReportByTokenHash", "public token lookup");
  assertContains(publicReportAccess, "reply.code(404).send", "public unknown token response");

  assertContains(publicReportAccess, 'tokenState === "revoked"', "public revoked token response");
  assertContains(publicReportAccess, 'tokenState === "expired"', "public expired token response");
  assertContains(publicReportAccess, "reply.code(410).send", "public gone token response");

  assertContains(publicReportAccess, "canAccessReportPublicly", "public report availability gate");
  assertContains(publicReportAccess, "reply.code(409).send", "public unavailable report response");

  assertContains(publicReportAccess, "PUBLIC_REPORT_ACCESS_RATE_LIMIT_ERROR_MESSAGE", "public report access rate limit response");
  assertContains(publicReportAccess, "reply.code(429).send", "public report access rate limit status");
});

test("clinic report and token surfaces do not disclose cross-scope resources as readable data", () => {
  const reports = readSource("server/routes/reports.fastify.ts");
  const reportsStatus = readSource("server/routes/reports-status.fastify.ts");
  const reportAccessTokens = readSource("server/routes/report-access-tokens.fastify.ts");

  assertContains(reports, "report.clinicId !== clinicId", "clinic report ownership check");
  assertContains(reports, "reply.code(403).send", "clinic foreign report response");
  assertContains(reports, "Informe no encontrado", "clinic report not found body");

  assertContains(reportsStatus, "report.clinicId !== clinicId", "clinic report status ownership check");
  assertContains(reportsStatus, "reply.code(403).send", "clinic foreign report status response");
  assertContains(reportsStatus, "reply.code(404).send", "clinic missing report status response");
  assertContains(reportsStatus, "Informe no encontrado", "clinic report status not found body");

  assertContains(reportAccessTokens, "getClinicScopedReportAccessToken", "clinic token scoped lookup");
  assertContains(reportAccessTokens, "reply.code(404).send", "clinic hidden or missing token response");
  assertContains(reportAccessTokens, "getClinicScopedReport", "clinic token report scoped lookup");
});

test("particular surfaces keep unauthenticated inactive missing and unlinked states distinct", () => {
  const particularAuth = readSource("server/routes/particular-auth.fastify.ts");
  const particularAudit = readSource("server/routes/particular-audit.fastify.ts");
  const particularStudyTracking = readSource("server/routes/particular-study-tracking.fastify.ts");

  for (const [context, source] of [
    ["particular auth", particularAuth],
    ["particular audit", particularAudit],
    ["particular study tracking", particularStudyTracking],
  ] as const) {
    assertContains(source, "reply.code(401).send", `${context} unauthenticated response`);
    assertContains(source, "session.expiresAt", `${context} expired session branch`);
    assertContains(source, "deleteParticularSession", `${context} expired or inactive session cleanup`);
    assertContains(source, "buildClearParticularSessionCookie", `${context} clear cookie on invalid state`);
    assertContains(source, "particularToken.isActive", `${context} inactive token branch`);
  }

  assertContains(particularAuth, "reply.code(409).send", "particular report missing link conflict");
  assertContains(particularAuth, "report.clinicId !== particular.clinicId", "particular report hidden ownership check");
  assertContains(particularAuth, "reply.code(404).send", "particular hidden or missing linked report response");

  assertContains(particularStudyTracking, "getParticularStudyTrackingCase", "particular tracking scoped lookup");
  assertContains(particularStudyTracking, "reply.code(404).send", "particular missing tracking response");
});

test("audit export surfaces force auth scope rather than leaking cross-scope filters", () => {
  const adminAudit = readSource("server/routes/admin-audit.fastify.ts");
  const clinicAudit = readSource("server/routes/clinic-audit.fastify.ts");
  const particularAudit = readSource("server/routes/particular-audit.fastify.ts");

  assertContains(adminAudit, "reply.code(401).send", "admin audit unauthenticated response");
  assertContains(adminAudit, "ADMIN_AUDIT_CSV_EXPORT_MAX_ROWS", "admin audit export bounded response");

  assertContains(clinicAudit, "reply.code(401).send", "clinic audit unauthenticated response");
  assertContains(clinicAudit, "clinicId: auth.clinicId", "clinic audit forced clinic scope");
  assertContains(clinicAudit, "CLINIC_AUDIT_CSV_EXPORT_MAX_ROWS", "clinic audit export bounded response");

  assertContains(particularAudit, "reply.code(401).send", "particular audit unauthenticated response");
  assertContains(particularAudit, "particularTokenId: particular.tokenId", "particular audit forced token scope");
  assertContains(particularAudit, "PARTICULAR_AUDIT_CSV_EXPORT_MAX_ROWS", "particular audit export bounded response");
});

test("runtime disclosure tests remain explicit for hidden resources and response codes", () => {
  const reportsTests = readSource("test/reports.fastify.test.ts");
  const reportsStatusTests = readSource("test/reports-status.fastify.test.ts");
  const reportAccessTokenTests = readSource("test/report-access-tokens.fastify.test.ts");
  const publicReportAccessTests = readSource("test/public-report-access.fastify.test.ts");
  const particularAuditTests = readSource("test/particular-audit.fastify.test.ts");
  const particularStudyTrackingTests = readSource("test/particular-study-tracking.fastify.test.ts");
  const auditExportTests = readSource("test/audit-export-boundaries.test.ts");

  assertContains(reportsTests, "reportsNativeRoutes bloquea informe ajeno en rutas parametrizadas", "reports foreign resource runtime test");
  assertContains(reportsTests, "reportsNativeRoutes devuelve 404 cuando el informe no existe en rutas parametrizadas", "reports missing resource runtime test");

  assertContains(reportsStatusTests, "reportsStatusNativeRoutes bloquea informe ajeno o inexistente", "report status hidden or missing runtime test");

  assertContains(reportAccessTokenTests, "reportAccessTokensNativeRoutes oculta detalle de token ajeno con 404", "token detail hidden runtime test");
  assertContains(reportAccessTokenTests, "reportAccessTokensNativeRoutes oculta revocacion de token ajeno antes de mutar", "token revoke hidden runtime test");

  assertContains(publicReportAccessTests, "publicReportAccessNativeRoutes devuelve 400 cuando el token es invalido", "public invalid token runtime test");
  assertContains(publicReportAccessTests, "publicReportAccessNativeRoutes devuelve 410 cuando el token fue revocado", "public revoked token runtime test");
  assertContains(publicReportAccessTests, "publicReportAccessNativeRoutes devuelve 410 cuando el token expir", "public expired token runtime test");
  assertContains(publicReportAccessTests, "publicReportAccessNativeRoutes devuelve 409 cuando el informe no", "public unavailable report runtime test");
  assertContains(publicReportAccessTests, "publicReportAccessNativeRoutes aplica rate limit nativo fijo por IP", "public rate limit runtime test");

  assertContains(particularAuditTests, "particularAuditNativeRoutes bloquea GET / sin cookie particular", "particular audit unauthenticated runtime test");
  assertContains(particularAuditTests, "particularAuditNativeRoutes bloquea token particular inactivo antes de listar", "particular audit inactive token runtime test");

  assertContains(particularStudyTrackingTests, "particularStudyTrackingNativeRoutes bloquea GET /me sin", "particular tracking unauthenticated runtime test");
  assertContains(particularStudyTrackingTests, "particularStudyTrackingNativeRoutes devuelve 404 cuando no existe seguimiento", "particular tracking missing runtime test");

  assertContains(auditExportTests, "audit exports rechazan cookies de dominios cruzados antes de listar", "audit cross-domain unauthenticated runtime test");
  assertContains(auditExportTests, "expectedStatus: 401", "audit export 401 runtime expectation");
});

test("response disclosure guardrail avoids checking localized mojibake strings", () => {
  const source = readSource("test/security-response-disclosure-boundaries.test.ts");
  const mojibakeLead = String.fromCharCode(0x00c3);
  const replacementCharacter = String.fromCharCode(0xfffd);

  assertNotContains(source, mojibakeLead, "guardrail source");
  assertNotContains(source, replacementCharacter, "guardrail source");
});