import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../../", import.meta.url)));

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
    meaning: "missing resource, hidden scope, or unusable public report token",
  },
  stateConflict: {
    status: 409,
    meaning: "resource exists but current state does not allow the requested public action",
  },
  rateLimited: {
    status: 429,
    meaning: "rate limit reached",
  },
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
// already migrated into enterprise subdirectories (TEST-ARCH-13). Prefers the exact
// path; falls back to a unique basename match under the same top-level directory.
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
  return readFileSync(resolve(REPO_ROOT, resolved), "utf8");
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
      meaning: "missing resource, hidden scope, or unusable public report token",
    },
    stateConflict: {
      status: 409,
      meaning: "resource exists but current state does not allow the requested public action",
    },
    rateLimited: {
      status: 429,
      meaning: "rate limit reached",
    },
  });
});

test("public report access unifies unusable tokens as 404 and preserves 409 and 429", () => {
  const publicReportAccess = readSource("server/routes/public-report-access.fastify.ts");
  const publicReportAccessApplication = readSource(
    "server/features/report-access/application/public-report-access-operations.ts",
  );

  assertContains(publicReportAccess, "reportAccessTokenRawTokenSchema.safeParse", "public token shape validation");
  assertContains(publicReportAccess, "REPORT_NOT_FOUND_RESPONSE", "public generic not found response");

  assertContains(publicReportAccessApplication, "getReportAccessTokenWithReportByTokenHash", "public token lookup");
  assertContains(publicReportAccess, "reply.code(404).send", "public unknown token response");

  assertContains(publicReportAccessApplication, 'getReportAccessTokenState(record.token, new Date(currentTime)) !== "active"', "public revoked or expired token response");
  assertNotContains(publicReportAccess, "reply.code(410).send", "public token lifecycle must not reveal prior existence");

  assertContains(publicReportAccessApplication, "canAccessReportPublicly", "public report availability gate");
  assertContains(publicReportAccess, "reply.code(409).send", "public unavailable report response");

  assertContains(publicReportAccess, "PUBLIC_REPORT_ACCESS_RATE_LIMIT_ERROR_MESSAGE", "public report access rate limit response");
  assertContains(publicReportAccess, "reply.code(429).send", "public report access rate limit status");
});

test("clinic report and token surfaces do not disclose cross-scope resources as readable data", () => {
  const reports = readSource("server/routes/reports.fastify.ts");
  const reportsStatus = readSource("server/routes/reports-status.fastify.ts");
  const reportAccessTokens = readSource("server/routes/report-access-tokens.fastify.ts");

  assertContains(reports, "getClinicScopedReportById", "clinic report ownership check");
  assertContains(reports, "status: 404", "clinic foreign report response");
  assertContains(reports, "Informe no encontrado", "clinic report not found body");

  assertContains(reportsStatus, "getClinicScopedReportById", "clinic report status ownership check");
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
  assertContains(particularAuth, "getClinicScopedReportById", "particular report hidden ownership check");
  assertContains(particularAuth, "reply.code(404).send", "particular hidden or missing linked report response");

  assertContains(particularStudyTracking, "getParticularStudyTrackingCase", "particular tracking scoped lookup");
  assertContains(particularStudyTracking, "reply.code(404).send", "particular missing tracking response");
});

test("audit export surfaces force auth scope rather than leaking cross-scope filters", () => {
  const adminAudit = readSource("server/routes/admin-audit.fastify.ts");
  const adminFastifyAuth = readSource("server/lib/fastify-admin-auth.ts");
  const clinicAudit = readSource("server/routes/clinic-audit.fastify.ts");
  const particularAudit = readSource("server/routes/particular-audit.fastify.ts");

  assertContains(adminAudit, "authenticateAdminUser", "admin audit auth gate");
  assertContains(adminFastifyAuth, "reply.code(401).send", "admin shared unauthenticated response");
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
  const auditExportTests = readSource("test/security/audit-export-boundaries.test.ts");

  assertContains(reportsTests, "reportsNativeRoutes unifica informe ajeno e inexistente como 404 seguro", "reports hidden or missing runtime test");

  assertContains(reportsStatusTests, "reportsStatusNativeRoutes unifica informe ajeno e inexistente como 404 seguro", "report status hidden or missing runtime test");

  assertContains(reportAccessTokenTests, "reportAccessTokensNativeRoutes oculta detalle de token ajeno con 404", "token detail hidden runtime test");
  assertContains(reportAccessTokenTests, "reportAccessTokensNativeRoutes oculta revocacion de token ajeno antes de mutar", "token revoke hidden runtime test");

  assertContains(publicReportAccessTests, "publicReportAccessNativeRoutes oculta token malformado como informe no encontrado", "public invalid token runtime test");
  assertContains(publicReportAccessTests, "publicReportAccessNativeRoutes oculta token revocado como informe no encontrado", "public revoked token runtime test");
  assertContains(publicReportAccessTests, "publicReportAccessNativeRoutes oculta token expirado como informe no encontrado", "public expired token runtime test");
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
  const source = readSource("test/architecture/security/security-response-disclosure-boundaries.test.ts");
  const mojibakeLead = String.fromCharCode(0x00c3);
  const replacementCharacter = String.fromCharCode(0xfffd);

  assertNotContains(source, mojibakeLead, "guardrail source");
  assertNotContains(source, replacementCharacter, "guardrail source");
});
