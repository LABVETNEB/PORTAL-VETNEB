import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const REPO_ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));

const ACCESS_LIFECYCLE_BOUNDARIES = {
  publicReportAccessToken: {
    invalidTokenStatus: 400,
    revokedOrExpiredStatus: 410,
    unavailableReportStatus: 409,
    rateLimitedStatus: 429,
    successfulAccessEvent: "REPORT_PUBLIC_ACCESSED",
    accessMutationKeys: ["accessCount", "lastAccessAt"],
  },
  reportAccessTokenManagement: {
    revokeEvent: "REPORT_ACCESS_TOKEN_REVOKED",
    clinicRevokeActor: "revokedByClinicUserId",
    adminRevokeActor: "revokedByAdminUserId",
  },
  particularSession: {
    missingSessionStatus: 401,
    expiredSessionAction: "deleteParticularSession",
    activeTokenFlag: "isActive",
    lastAccessAction: "updateParticularSessionLastAccess",
  },
} as const;

function readSource(relativePath: string): string {
  return readFileSync(resolve(REPO_ROOT, relativePath), "utf8");
}

function assertContains(source: string, marker: string, context: string) {
  assert.ok(source.includes(marker), `${context} must contain: ${marker}`);
}

function assertMatches(source: string, pattern: RegExp, context: string) {
  assert.match(source, pattern, `${context} must match ${pattern}`);
}

test("access lifecycle matrix documents public token revoke session and rate-limit states", () => {
  assert.deepEqual(ACCESS_LIFECYCLE_BOUNDARIES, {
    publicReportAccessToken: {
      invalidTokenStatus: 400,
      revokedOrExpiredStatus: 410,
      unavailableReportStatus: 409,
      rateLimitedStatus: 429,
      successfulAccessEvent: "REPORT_PUBLIC_ACCESSED",
      accessMutationKeys: ["accessCount", "lastAccessAt"],
    },
    reportAccessTokenManagement: {
      revokeEvent: "REPORT_ACCESS_TOKEN_REVOKED",
      clinicRevokeActor: "revokedByClinicUserId",
      adminRevokeActor: "revokedByAdminUserId",
    },
    particularSession: {
      missingSessionStatus: 401,
      expiredSessionAction: "deleteParticularSession",
      activeTokenFlag: "isActive",
      lastAccessAction: "updateParticularSessionLastAccess",
    },
  });
});

test("public report access enforces token lifecycle before signed URLs and audit", () => {
  const publicReportAccess = readSource("server/routes/public-report-access.fastify.ts");

  assertContains(publicReportAccess, "recordReportAccessTokenAccess", "public report token access mutation");
  assertContains(publicReportAccess, "accessCount: updatedToken?.accessCount ?? record.token.accessCount + 1", "public report access count lifecycle");
  assertContains(publicReportAccess, "lastAccessAt: updatedToken?.lastAccessAt ?? new Date(currentTime)", "public report last access lifecycle");

  assertContains(publicReportAccess, "createSignedReportUrl", "public report access preview URL");
  assertContains(publicReportAccess, "createSignedReportDownloadUrl", "public report access download URL");

  assertContains(publicReportAccess, "AUDIT_EVENTS.REPORT_PUBLIC_ACCESSED", "public report access audit event");
  assertContains(publicReportAccess, "buildPublicReportAccessTokenActor(record.token.id)", "public report access audit actor");
  assertContains(publicReportAccess, "targetReportAccessTokenId: record.token.id", "public report access audit target");

  assertContains(publicReportAccess, "PUBLIC_REPORT_ACCESS_RATE_LIMIT_ERROR_MESSAGE", "public report access rate limit");
});

test("report access token revocation records lifecycle actor and audit event", () => {
  const reportAccessTokens = readSource("server/routes/report-access-tokens.fastify.ts");
  const adminReportAccessTokens = readSource("server/routes/admin-report-access-tokens.fastify.ts");

  assertContains(reportAccessTokens, "revokedByClinicUserId: auth.id", "clinic revoke actor");
  assertContains(reportAccessTokens, "revokedByAdminUserId: null", "clinic revoke admin null");
  assertContains(reportAccessTokens, "AUDIT_EVENTS.REPORT_ACCESS_TOKEN_REVOKED", "clinic revoke audit event");
  assertContains(reportAccessTokens, 'revokedVia: "clinic"', "clinic revoke audit metadata");
  assertContains(reportAccessTokens, "revokedAt: revoked.revokedAt", "clinic revoke timestamp metadata");

  assertContains(adminReportAccessTokens, "revokedByClinicUserId: null", "admin revoke clinic null");
  assertContains(adminReportAccessTokens, "revokedByAdminUserId: admin.id", "admin revoke actor");
  assertContains(adminReportAccessTokens, "AUDIT_EVENTS.REPORT_ACCESS_TOKEN_REVOKED", "admin revoke audit event");
  assertContains(adminReportAccessTokens, 'revokedVia: "admin"', "admin revoke audit metadata");
  assertContains(adminReportAccessTokens, "revokedAt: revoked.revokedAt", "admin revoke timestamp metadata");
});

test("particular surfaces expire sessions and block inactive tokens before scoped reads", () => {
  const particularAuth = readSource("server/routes/particular-auth.fastify.ts");
  const particularAudit = readSource("server/routes/particular-audit.fastify.ts");
  const particularStudyTracking = readSource("server/routes/particular-study-tracking.fastify.ts");

  for (const [context, source] of [
    ["particular auth", particularAuth],
    ["particular audit", particularAudit],
    ["particular study tracking", particularStudyTracking],
  ] as const) {
    assertContains(source, "deleteParticularSession", `${context} expired session cleanup`);
    assertContains(source, "updateParticularSessionLastAccess", `${context} last access update`);
    assertContains(source, "session.particularTokenId", `${context} session token lookup`);
    assertContains(source, "particularToken.isActive", `${context} inactive token block`);
  }

  assertContains(particularAudit, "particularTokenId: particular.tokenId", "particular audit scoped read");
  assertContains(particularStudyTracking, "particularTokenId: particular.tokenId", "particular study tracking scoped read");
});

test("runtime lifecycle tests remain explicit for public report access", () => {
  const publicReportAccessTests = readSource("test/public-report-access.fastify.test.ts");
  const auditCriticalFlowTests = readSource("test/audit-critical-flow-writes.test.ts");

  assertMatches(
    publicReportAccessTests,
    /publicReportAccessNativeRoutes devuelve 400 cuando el token es invalido/,
    "public invalid token runtime test",
  );
  assertMatches(
    publicReportAccessTests,
    /publicReportAccessNativeRoutes devuelve 410 cuando el token fue revocado/,
    "public revoked token runtime test",
  );
  assertMatches(
    publicReportAccessTests,
    /publicReportAccessNativeRoutes devuelve 410 cuando el token expir/,
    "public expired token runtime test",
  );  assertContains(
    publicReportAccessTests,
    "publicReportAccessNativeRoutes devuelve 409 cuando el informe no",
    "public unavailable report runtime test",
  );
  assertContains(
    publicReportAccessTests,
    "disponible",
    "public unavailable report runtime test",
  );
  assertMatches(
    publicReportAccessTests,
    /publicReportAccessNativeRoutes aplica rate limit nativo fijo por IP/,
    "public report access rate limit runtime test",
  );
  assertContains(
    publicReportAccessTests,
    "assert.equal(auditCalls[0].event, AUDIT_EVENTS.REPORT_PUBLIC_ACCESSED)",
    "public report access audit runtime test",
  );

  assertContains(
    auditCriticalFlowTests,
    "accessCount: updatedToken?.accessCount ?? record.token.accessCount + 1",
    "critical flow access count guard",
  );
  assertContains(
    auditCriticalFlowTests,
    "lastAccessAt: updatedToken?.lastAccessAt ?? new Date(currentTime)",
    "critical flow last access guard",
  );
});

test("runtime lifecycle tests remain explicit for particular sessions and revoke flows", () => {
  const particularAuditTests = readSource("test/particular-audit.fastify.test.ts");
  const particularStudyTrackingTests = readSource("test/particular-study-tracking.fastify.test.ts");
  const reportAccessTokenTests = readSource("test/report-access-tokens.fastify.test.ts");
  const adminReportAccessTokenTests = readSource("test/admin-report-access-tokens.fastify.test.ts");

  assertMatches(
    particularAuditTests,
    /particularAuditNativeRoutes bloquea GET \/ sin cookie particular/,
    "particular audit missing cookie runtime test",
  );  assertContains(
    particularAuditTests,
    "particularAuditNativeRoutes limpia cookie cuando la",
    "particular audit expired session runtime test",
  );
  assertContains(
    particularAuditTests,
    "expira",
    "particular audit expired session runtime test",
  );
  assertMatches(
    particularAuditTests,
    /particularAuditNativeRoutes bloquea token particular inactivo antes de listar/,
    "particular audit inactive token runtime test",
  );  assertContains(
    particularStudyTrackingTests,
    "particularStudyTrackingNativeRoutes bloquea GET /me sin",
    "particular study tracking missing session runtime test",
  );
  assertContains(
    particularStudyTrackingTests,
    "particular",
    "particular study tracking missing session runtime test",
  );  assertContains(
    particularStudyTrackingTests,
    "particularStudyTrackingNativeRoutes limpia cookie cuando la",
    "particular study tracking expired session runtime test",
  );
  assertContains(
    particularStudyTrackingTests,
    "expirada",
    "particular study tracking expired session runtime test",
  );

  assertContains(
    reportAccessTokenTests,
    "assert.equal(input.revokedByClinicUserId, 9)",
    "clinic revoke actor runtime test",
  );
  assertContains(
    reportAccessTokenTests,
    "assert.equal(auditCalls[0].event, AUDIT_EVENTS.REPORT_ACCESS_TOKEN_REVOKED)",
    "clinic revoke audit runtime test",
  );

  assertContains(
    adminReportAccessTokenTests,
    "assert.equal(input.revokedByAdminUserId, 1)",
    "admin revoke actor runtime test",
  );
  assertContains(
    adminReportAccessTokenTests,
    "assert.equal(auditCalls[0].event, AUDIT_EVENTS.REPORT_ACCESS_TOKEN_REVOKED)",
    "admin revoke audit runtime test",
  );
});