import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../../", import.meta.url)));

const ACCESS_LIFECYCLE_BOUNDARIES = {
  publicReportAccessToken: {
    invalidTokenStatus: 404,
    revokedOrExpiredStatus: 404,
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

function assertMatches(source: string, pattern: RegExp, context: string) {
  assert.match(source, pattern, `${context} must match ${pattern}`);
}

test("access lifecycle matrix documents public token revoke session and rate-limit states", () => {
  assert.deepEqual(ACCESS_LIFECYCLE_BOUNDARIES, {
    publicReportAccessToken: {
      invalidTokenStatus: 404,
      revokedOrExpiredStatus: 404,
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
  const publicReportAccessApplication = readSource(
    "server/features/report-access/application/public-report-access-operations.ts",
  );

  assertContains(publicReportAccessApplication, "recordReportAccessTokenAccess", "public report token access mutation");
  assertContains(publicReportAccessApplication, "updatedToken?.accessCount ?? record.token.accessCount + 1", "public report access count lifecycle");
  assertContains(publicReportAccessApplication, "updatedToken?.lastAccessAt ?? new Date(currentTime)", "public report last access lifecycle");

  assertContains(publicReportAccessApplication, "createSignedReportUrl", "public report access preview URL");
  assertContains(publicReportAccessApplication, "createSignedReportDownloadUrl", "public report access download URL");

  assertContains(publicReportAccessApplication, 'event: "report.public_accessed"', "public report access audit event");
  assertContains(publicReportAccessApplication, "deps.buildPublicActor(record.token.id)", "public report access audit actor");
  assertContains(publicReportAccessApplication, "targetReportAccessTokenId: record.token.id", "public report access audit target");

  assertContains(publicReportAccess, "PUBLIC_REPORT_ACCESS_RATE_LIMIT_ERROR_MESSAGE", "public report access rate limit");
});

test("report access token revocation records lifecycle actor and audit event", () => {
  const reportAccessTokens = readSource("server/features/report-access/application/clinic-report-access-operations.ts");
  const adminReportAccessTokens = readSource("server/features/report-access/application/admin-report-access-operations.ts");

  assertContains(reportAccessTokens, "revokedByClinicUserId: actor.clinicUserId", "clinic revoke actor");
  assertContains(reportAccessTokens, "revokedByAdminUserId: null", "clinic revoke admin null");
  assertContains(reportAccessTokens, 'event: "report_access_token.revoked"', "clinic revoke audit event");
  assertContains(reportAccessTokens, 'revokedVia: "clinic"', "clinic revoke audit metadata");
  assertContains(reportAccessTokens, "revokedAt: token.revokedAt", "clinic revoke timestamp metadata");

  assertContains(adminReportAccessTokens, "revokedByClinicUserId: null", "admin revoke clinic null");
  assertContains(adminReportAccessTokens, "revokedByAdminUserId: actor.id", "admin revoke actor");
  assertContains(adminReportAccessTokens, 'event: "report_access_token.revoked"', "admin revoke audit event");
  assertContains(adminReportAccessTokens, 'revokedVia: "admin"', "admin revoke audit metadata");
  assertContains(adminReportAccessTokens, "revokedAt: token.revokedAt", "admin revoke timestamp metadata");
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
    /publicReportAccessNativeRoutes oculta token malformado como informe no encontrado/,
    "public invalid token runtime test",
  );
  assertMatches(
    publicReportAccessTests,
    /publicReportAccessNativeRoutes oculta token revocado como informe no encontrado/,
    "public revoked token runtime test",
  );
  assertMatches(
    publicReportAccessTests,
    /publicReportAccessNativeRoutes oculta token expirado como informe no encontrado/,
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
    "updatedToken?.accessCount ?? record.token.accessCount + 1",
    "critical flow access count guard",
  );
  assertContains(
    auditCriticalFlowTests,
    "updatedToken?.lastAccessAt ?? new Date(currentTime)",
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
