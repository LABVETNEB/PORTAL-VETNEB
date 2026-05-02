import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const REPO_ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));

const WRITE_ATTRIBUTION_BOUNDARIES = {
  admin: {
    persistedCreateKeys: ["createdByAdminId", "createdByAdminUserId"],
    persistedNullKeys: ["createdByClinicUserId"],
    auditRequestContext: "admin",
    auditMetadataVia: "admin",
  },
  clinic: {
    persistedCreateKeys: ["createdByClinicUserId"],
    persistedUpdateKeys: ["changedByClinicUserId", "revokedByClinicUserId"],
    persistedNullKeys: ["createdByAdminId", "createdByAdminUserId", "changedByAdminUserId", "revokedByAdminUserId"],
    auditRequestContext: "auth",
    auditMetadataVia: "clinic",
  },
  particular: {
    sessionKey: "particularTokenId",
    filterKey: "particular.tokenId",
  },
  publicReportAccessToken: {
    actorBuilder: "buildPublicReportAccessTokenActor",
    actorKey: "actorReportAccessTokenId",
    targetKey: "targetReportAccessTokenId",
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

test("write attribution matrix documents admin clinic particular and public token actors", () => {
  assert.deepEqual(WRITE_ATTRIBUTION_BOUNDARIES, {
    admin: {
      persistedCreateKeys: ["createdByAdminId", "createdByAdminUserId"],
      persistedNullKeys: ["createdByClinicUserId"],
      auditRequestContext: "admin",
      auditMetadataVia: "admin",
    },
    clinic: {
      persistedCreateKeys: ["createdByClinicUserId"],
      persistedUpdateKeys: ["changedByClinicUserId", "revokedByClinicUserId"],
      persistedNullKeys: ["createdByAdminId", "createdByAdminUserId", "changedByAdminUserId", "revokedByAdminUserId"],
      auditRequestContext: "auth",
      auditMetadataVia: "clinic",
    },
    particular: {
      sessionKey: "particularTokenId",
      filterKey: "particular.tokenId",
    },
    publicReportAccessToken: {
      actorBuilder: "buildPublicReportAccessTokenActor",
      actorKey: "actorReportAccessTokenId",
      targetKey: "targetReportAccessTokenId",
    },
  });
});

test("admin writes persist admin attribution and audit through admin context", () => {
  const adminReportAccessTokens = readSource("server/routes/admin-report-access-tokens.fastify.ts");
  const adminParticularTokens = readSource("server/routes/admin-particular-tokens.fastify.ts");
  const adminStudyTracking = readSource("server/routes/admin-study-tracking.fastify.ts");

  assertContains(adminReportAccessTokens, "createdByClinicUserId: null", "admin report access token create attribution");
  assertContains(adminReportAccessTokens, "createdByAdminUserId: admin.id", "admin report access token create attribution");
  assertContains(adminReportAccessTokens, "revokedByClinicUserId: null", "admin report access token revoke attribution");
  assertContains(adminReportAccessTokens, "revokedByAdminUserId: admin.id", "admin report access token revoke attribution");
  assertContains(adminReportAccessTokens, "createAuditRequestLike(request, admin)", "admin report access token audit actor");
  assertContains(adminReportAccessTokens, 'createdVia: "admin"', "admin report access token audit metadata");
  assertContains(adminReportAccessTokens, 'revokedVia: "admin"', "admin report access token audit metadata");

  assertContains(adminParticularTokens, "createdByAdminId: admin.id", "admin particular token create attribution");
  assertContains(adminParticularTokens, "createdByClinicUserId: null", "admin particular token create attribution");

  assertContains(adminStudyTracking, "createdByAdminId: admin.id", "admin study tracking create attribution");
  assertContains(adminStudyTracking, "createdByClinicUserId: null", "admin study tracking create attribution");
  assertContains(adminStudyTracking, "createAuditRequestLike(request, admin)", "admin study tracking audit actor");
  assertContains(adminStudyTracking, 'createdVia: "admin"', "admin study tracking audit metadata");
});

test("clinic writes persist clinic attribution and audit through clinic context", () => {
  const reportAccessTokens = readSource("server/routes/report-access-tokens.fastify.ts");
  const particularTokens = readSource("server/routes/particular-tokens.fastify.ts");
  const studyTracking = readSource("server/routes/study-tracking.fastify.ts");
  const reportsStatus = readSource("server/routes/reports-status.fastify.ts");

  assertContains(reportAccessTokens, "createdByClinicUserId: auth.id", "clinic report access token create attribution");
  assertContains(reportAccessTokens, "createdByAdminUserId: null", "clinic report access token create attribution");
  assertContains(reportAccessTokens, "revokedByClinicUserId: auth.id", "clinic report access token revoke attribution");
  assertContains(reportAccessTokens, "revokedByAdminUserId: null", "clinic report access token revoke attribution");
  assertContains(reportAccessTokens, "createAuditRequestLike(request, auth)", "clinic report access token audit actor");
  assertContains(reportAccessTokens, 'createdVia: "clinic"', "clinic report access token audit metadata");
  assertContains(reportAccessTokens, 'revokedVia: "clinic"', "clinic report access token audit metadata");

  assertContains(particularTokens, "createdByAdminId: null", "clinic particular token create attribution");
  assertContains(particularTokens, "createdByClinicUserId: auth.id", "clinic particular token create attribution");

  assertContains(studyTracking, "createdByAdminId: null", "clinic study tracking create attribution");
  assertContains(studyTracking, "createdByClinicUserId: auth.id", "clinic study tracking create attribution");
  assertContains(studyTracking, "createAuditRequestLike(request, auth)", "clinic study tracking audit actor");
  assertContains(studyTracking, 'createdVia: "clinic"', "clinic study tracking audit metadata");

  assertContains(reportsStatus, "changedByClinicUserId: auth.id", "clinic report status attribution");
  assertContains(reportsStatus, "changedByAdminUserId: null", "clinic report status attribution");
  assertContains(reportsStatus, "createAuditRequestLike(request, auth)", "clinic report status audit actor");
});

test("particular and public access attribution derive from authenticated or raw tokens", () => {
  const particularAudit = readSource("server/routes/particular-audit.fastify.ts");
  const particularStudyTracking = readSource("server/routes/particular-study-tracking.fastify.ts");
  const publicReportAccess = readSource("server/routes/public-report-access.fastify.ts");

  assertMatches(
    particularAudit,
    /getParticularTokenById\(\s*session\.particularTokenId/s,
    "particular audit session attribution",
  );
  assertContains(particularAudit, "particularTokenId: particular.tokenId", "particular audit filter attribution");

  assertMatches(
    particularStudyTracking,
    /getParticularTokenById\(\s*session\.particularTokenId/s,
    "particular study tracking session attribution",
  );
  assertContains(
    particularStudyTracking,
    "particularTokenId: particular.tokenId",
    "particular study tracking notification attribution",
  );

  assertContains(publicReportAccess, "buildPublicReportAccessTokenActor(record.token.id)", "public report access actor attribution");
  assertContains(publicReportAccess, "targetReportAccessTokenId: record.token.id", "public report access target attribution");
  assertContains(publicReportAccess, "clinicId: record.token.clinicId", "public report access clinic attribution");
  assertContains(publicReportAccess, "reportId: record.token.reportId", "public report access report attribution");
});

test("audit helpers preserve actor and target attribution fields", () => {
  const auditSource = readSource("server/lib/audit.ts");
  const auditLogSource = readSource("server/lib/audit-log.ts");

  assertContains(auditSource, "actorAdminUserId: actor.adminUserId ?? null", "audit insert admin actor attribution");
  assertContains(auditSource, "actorClinicUserId: actor.clinicUserId ?? null", "audit insert clinic actor attribution");
  assertContains(auditSource, "actorReportAccessTokenId: actor.reportAccessTokenId ?? null", "audit insert public token actor attribution");
  assertContains(auditSource, "targetReportAccessTokenId: input.targetReportAccessTokenId ?? null", "audit insert target token attribution");
  assertContains(auditSource, "buildPublicReportAccessTokenActor", "audit public token actor builder");

  assertContains(auditLogSource, '"actorAdminUserId"', "audit export admin actor attribution");
  assertContains(auditLogSource, '"actorClinicUserId"', "audit export clinic actor attribution");
  assertContains(auditLogSource, '"actorReportAccessTokenId"', "audit export public token actor attribution");
  assertContains(auditLogSource, '"targetReportAccessTokenId"', "audit export target token attribution");
});

test("runtime attribution tests remain explicit for critical writes", () => {
  const adminParticularTokenTests = readSource("test/admin-particular-tokens.fastify.test.ts");
  const particularTokenTests = readSource("test/particular-tokens.fastify.test.ts");
  const reportAccessTokenTests = readSource("test/report-access-tokens.fastify.test.ts");
  const adminReportAccessTokenTests = readSource("test/admin-report-access-tokens.fastify.test.ts");
  const reportsStatusTests = readSource("test/reports-status.fastify.test.ts");
  const studyTrackingTests = readSource("test/study-tracking.fastify.test.ts");
  const adminStudyTrackingTests = readSource("test/admin-study-tracking.fastify.test.ts");
  const publicReportAccessTests = readSource("test/public-report-access.fastify.test.ts");

  assertContains(adminParticularTokenTests, "assert.equal(createCalls[0].createdByAdminId, 1)", "admin particular token runtime attribution");
  assertContains(adminParticularTokenTests, "assert.equal(createCalls[0].createdByClinicUserId, null)", "admin particular token runtime attribution");

  assertContains(particularTokenTests, "assert.equal(createCalls[0].createdByAdminId, null)", "clinic particular token runtime attribution");
  assertContains(particularTokenTests, "assert.equal(createCalls[0].createdByClinicUserId, 9)", "clinic particular token runtime attribution");

  assertContains(reportAccessTokenTests, "assert.equal(createCalls[0].createdByClinicUserId, 9)", "clinic report access token runtime attribution");
  assertContains(reportAccessTokenTests, "assert.equal(auditCalls[0].targetReportAccessTokenId, 9)", "clinic report access token audit attribution");

  assertContains(adminReportAccessTokenTests, "assert.equal(createCalls[0].createdByClinicUserId, null)", "admin report access token runtime attribution");
  assertContains(adminReportAccessTokenTests, "assert.equal(auditCalls[0].targetReportAccessTokenId, 9)", "admin report access token audit attribution");

  assertContains(reportsStatusTests, "changedByClinicUserId: 9", "clinic report status runtime attribution");
  assertContains(reportsStatusTests, "changedByAdminUserId: null", "clinic report status runtime attribution");

  assertContains(studyTrackingTests, "assert.equal(createCalls[0].createdByAdminId, null)", "clinic study tracking runtime attribution");
  assertContains(studyTrackingTests, "assert.equal(createCalls[0].createdByClinicUserId, 9)", "clinic study tracking runtime attribution");

  assertContains(adminStudyTrackingTests, "assert.equal(createCalls[0].createdByAdminId, 1)", "admin study tracking runtime attribution");
  assertContains(adminStudyTrackingTests, "assert.equal(createCalls[0].createdByClinicUserId, null)", "admin study tracking runtime attribution");

  assertContains(publicReportAccessTests, "assert.equal(auditCalls[0].targetReportAccessTokenId, token.id)", "public report access runtime attribution");
});