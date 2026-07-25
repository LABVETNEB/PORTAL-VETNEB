import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../../", import.meta.url)));

const ACTOR_RELATIONSHIP_BOUNDARIES = {
  admin: {
    sessionProperty: "adminAuth",
    canTargetAnyClinicWithExplicitClinicId: true,
    mustNotUseClinicSessionScope: true,
  },
  clinic: {
    sessionProperty: "auth",
    mustForceAuthenticatedClinicId: true,
    canTargetAnyClinicWithExplicitClinicId: false,
  },
  particular: {
    sessionProperty: "particularAuth",
    mustForceAuthenticatedParticularTokenId: true,
    canTargetClinicOrReportFromClientInput: false,
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

function assertMatches(source: string, pattern: RegExp, context: string) {
  assert.match(source, pattern, `${context} must match ${pattern}`);
}

test("actor relationship matrix documents admin clinic and particular boundaries", () => {
  assert.deepEqual(ACTOR_RELATIONSHIP_BOUNDARIES, {
    admin: {
      sessionProperty: "adminAuth",
      canTargetAnyClinicWithExplicitClinicId: true,
      mustNotUseClinicSessionScope: true,
    },
    clinic: {
      sessionProperty: "auth",
      mustForceAuthenticatedClinicId: true,
      canTargetAnyClinicWithExplicitClinicId: false,
    },
    particular: {
      sessionProperty: "particularAuth",
      mustForceAuthenticatedParticularTokenId: true,
      canTargetClinicOrReportFromClientInput: false,
    },
  });
});

test("admin routes keep explicit clinic relationships before linking reports tokens or tracking", () => {
  const adminParticularTokens = readSource("server/routes/admin-particular-tokens.fastify.ts");
  const adminParticularTokensApplication = readSource(
    "server/features/particular-access/application/admin-particular-access-operations.ts",
  );
  const adminReportAccessTokens = readSource("server/routes/admin-report-access-tokens.fastify.ts");
  const adminReportAccessApplication = readSource(
    "server/features/report-access/application/admin-report-access-operations.ts",
  );
  const adminStudyTracking = readSource("server/routes/admin-study-tracking.fastify.ts");
  const adminStudyTrackingApplication = readSource(
    "server/features/study-tracking/application/admin-study-tracking-operations.ts",
  );

  assertContains(adminParticularTokens, "clinicId?: unknown", "admin particular tokens");
  assertContains(adminParticularTokensApplication, "getClinicById(data.clinicId)", "admin particular tokens");
  assertContains(adminParticularTokensApplication, "belongsToClinic(report.clinicId, data.clinicId)", "admin particular tokens");
  assertContains(adminParticularTokensApplication, "belongsToClinic(report.clinicId, token.clinicId)", "admin particular tokens");
  assertContains(adminParticularTokensApplication, "clinicId: data.clinicId", "admin particular tokens");
  assertContains(adminParticularTokensApplication, "createdByAdminId: adminId", "admin particular tokens");
  assertContains(adminParticularTokensApplication, "createdByClinicUserId: null", "admin particular tokens");

  assertContains(adminReportAccessTokens, "clinicId?: unknown", "admin report access tokens");
  assertContains(adminReportAccessApplication, "getClinicById(data.clinicId)", "admin report access tokens");
  assertContains(adminReportAccessApplication, "getReportById(data.reportId)", "admin report access tokens");
  assertContains(adminReportAccessApplication, "belongsToClinic(report.clinicId, data.clinicId)", "admin report access tokens");

  assertContains(adminStudyTracking, "clinicId?: unknown", "admin study tracking");
  assertContains(adminStudyTrackingApplication, "getClinicById(", "admin study tracking");
  assertContains(adminStudyTrackingApplication, "report.clinicId !== input.data.clinicId", "admin study tracking");
  assertContains(adminStudyTrackingApplication, "particularToken.clinicId !== input.data.clinicId", "admin study tracking");
  assertContains(adminStudyTrackingApplication, "clinicId: input.data.clinicId", "admin study tracking");
  assertContains(adminStudyTrackingApplication, "createdByAdminId: input.actor.adminId", "admin study tracking");
  assertContains(adminStudyTrackingApplication, "createdByClinicUserId: null", "admin study tracking");

  assertNotContains(adminParticularTokens, "clinicId: auth.clinicId", "admin particular tokens");
  assertNotContains(adminReportAccessTokens, "clinicId: auth.clinicId", "admin report access tokens");
  assertNotContains(adminStudyTracking, "clinicId: auth.clinicId", "admin study tracking");
});

test("clinic routes force authenticated clinic relationships and reject cross clinic links", () => {
  const studyTracking = readSource("server/routes/study-tracking.fastify.ts");
  const studyTrackingApplication = readSource(
    "server/features/study-tracking/application/clinic-study-tracking-operations.ts",
  );
  const particularTokens = readSource("server/routes/particular-tokens.fastify.ts");
  const particularTokensApplication = readSource(
    "server/features/particular-access/application/clinic-particular-access-operations.ts",
  );
  const reportAccessTokens = readSource("server/routes/report-access-tokens.fastify.ts");
  const reportAccessApplication = readSource(
    "server/features/report-access/application/clinic-report-access-operations.ts",
  );
  const clinicAudit = readSource("server/routes/clinic-audit.fastify.ts");

  assertContains(studyTracking, "clinicId: auth.clinicId", "clinic study tracking");
  assertContains(studyTrackingApplication, "getClinicScopedReportById", "clinic study tracking");
  assertContains(studyTrackingApplication, "particularToken.clinicId !== input.actor.clinicId", "clinic study tracking");
  assertMatches(
    studyTrackingApplication,
    /getClinicScopedStudyTrackingCase\(\s*input\.trackingCaseId,\s*input\.clinicId/s,
    "clinic study tracking detail",
  );

  assertMatches(
    particularTokens,
    /clinicOperations\.(?:createToken|getToken|listTokens|updateTokenReport)\([\s\S]*auth\.clinicId/s,
    "clinic particular tokens",
  );
  assertContains(particularTokens, "getClinicScopedReportById", "clinic particular tokens");
  assertMatches(
    particularTokensApplication,
    /getClinicScopedParticularToken\(\s*tokenId,\s*clinicId/s,
    "clinic particular token detail",
  );

  assertContains(reportAccessTokens, "clinicId: auth.clinicId", "clinic report access tokens");
  assertContains(reportAccessApplication, "getClinicScopedReportById", "clinic report access tokens");
  assertMatches(
    reportAccessApplication,
    /getClinicScopedReportAccessToken\(tokenId, clinicId\)/s,
    "clinic report access token detail",
  );

  assertMatches(
    clinicAudit,
    /request\.query \?\? \{\},\s*auth\.clinicId/s,
    "clinic audit filters",
  );
});

test("particular routes force authenticated particular token relationships", () => {
  const particularAudit = readSource("server/routes/particular-audit.fastify.ts");
  const particularStudyTracking = readSource("server/routes/particular-study-tracking.fastify.ts");
  const particularAuth = readSource("server/routes/particular-auth.fastify.ts");

  assertMatches(
    particularAudit,
    /listParticularAuditLog\([\s\S]*particular\.tokenId/s,
    "particular audit list",
  );
  assertMatches(
    particularAudit,
    /buildParticularAuditListFilters\([\s\S]*request\.query/s,
    "particular audit filter builder",
  );
  assertContains(particularAudit, "particularTokenId: particular.tokenId", "particular audit response scope");

  assertMatches(
    particularStudyTracking,
    /getParticularStudyTrackingForToken\(\s*particular\.tokenId/s,
    "particular study tracking detail",
  );
  assertContains(
    particularStudyTracking,
    "particularTokenId: particular.tokenId",
    "particular study tracking notifications",
  );

  assertContains(particularAuth, "getClinicScopedReportById", "particular auth report access");
  assertContains(particularAuth, "/report/preview-url", "particular auth preview route");
  assertContains(particularAuth, "/report/download-url", "particular auth download route");
  assertNotContains(particularAuth, "reportId?: unknown", "particular auth must not accept reportId input");
  assertNotContains(particularStudyTracking, "reportId?: unknown", "particular study tracking must not accept reportId input");
});
