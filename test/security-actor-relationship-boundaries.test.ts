import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const REPO_ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));

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
  const adminReportAccessTokens = readSource("server/routes/admin-report-access-tokens.fastify.ts");
  const adminStudyTracking = readSource("server/routes/admin-study-tracking.fastify.ts");

  assertContains(adminParticularTokens, "clinicId?: unknown", "admin particular tokens");
  assertContains(adminParticularTokens, "getClinicById(parsed.data.clinicId)", "admin particular tokens");
  assertContains(adminParticularTokens, "report.clinicId !== parsed.data.clinicId", "admin particular tokens");
  assertContains(adminParticularTokens, "report.clinicId !== token.clinicId", "admin particular tokens");
  assertContains(adminParticularTokens, "clinicId: parsed.data.clinicId", "admin particular tokens");
  assertContains(adminParticularTokens, "createdByAdminId: admin.id", "admin particular tokens");
  assertContains(adminParticularTokens, "createdByClinicUserId: null", "admin particular tokens");

  assertContains(adminReportAccessTokens, "clinicId?: unknown", "admin report access tokens");
  assertContains(adminReportAccessTokens, "getClinicById(parsed.data.clinicId)", "admin report access tokens");
  assertContains(adminReportAccessTokens, "getReportById(parsed.data.reportId)", "admin report access tokens");
  assertContains(adminReportAccessTokens, "report.clinicId !== parsed.data.clinicId", "admin report access tokens");

  assertContains(adminStudyTracking, "clinicId?: unknown", "admin study tracking");
  assertContains(adminStudyTracking, "getClinicById(parsed.data.clinicId)", "admin study tracking");
  assertContains(adminStudyTracking, "report.clinicId !== parsed.data.clinicId", "admin study tracking");
  assertContains(adminStudyTracking, "particularToken.clinicId !== parsed.data.clinicId", "admin study tracking");
  assertContains(adminStudyTracking, "clinicId: parsed.data.clinicId", "admin study tracking");
  assertContains(adminStudyTracking, "createdByAdminId: admin.id", "admin study tracking");
  assertContains(adminStudyTracking, "createdByClinicUserId: null", "admin study tracking");

  assertNotContains(adminParticularTokens, "clinicId: auth.clinicId", "admin particular tokens");
  assertNotContains(adminReportAccessTokens, "clinicId: auth.clinicId", "admin report access tokens");
  assertNotContains(adminStudyTracking, "clinicId: auth.clinicId", "admin study tracking");
});

test("clinic routes force authenticated clinic relationships and reject cross clinic links", () => {
  const studyTracking = readSource("server/routes/study-tracking.fastify.ts");
  const particularTokens = readSource("server/routes/particular-tokens.fastify.ts");
  const reportAccessTokens = readSource("server/routes/report-access-tokens.fastify.ts");
  const clinicAudit = readSource("server/routes/clinic-audit.fastify.ts");

  assertContains(studyTracking, "clinicId: auth.clinicId", "clinic study tracking");
  assertContains(studyTracking, "report.clinicId !== auth.clinicId", "clinic study tracking");
  assertContains(studyTracking, "particularToken.clinicId !== auth.clinicId", "clinic study tracking");
  assertMatches(
    studyTracking,
    /getClinicScopedStudyTrackingCase\(\s*trackingCaseId,\s*auth\.clinicId/s,
    "clinic study tracking detail",
  );

  assertContains(particularTokens, "clinicId: auth.clinicId", "clinic particular tokens");
  assertContains(particularTokens, "report.clinicId !== auth.clinicId", "clinic particular tokens");
  assertMatches(
    particularTokens,
    /getClinicScopedParticularToken\(\s*tokenId,\s*auth\.clinicId/s,
    "clinic particular token detail",
  );

  assertContains(reportAccessTokens, "clinicId: auth.clinicId", "clinic report access tokens");
  assertContains(reportAccessTokens, "report.clinicId !== auth.clinicId", "clinic report access tokens");
  assertMatches(
    reportAccessTokens,
    /getClinicScopedReportAccessToken\(\s*tokenId,\s*auth\.clinicId/s,
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
    /getParticularStudyTrackingCase\(\s*particular\.tokenId/s,
    "particular study tracking detail",
  );
  assertContains(
    particularStudyTracking,
    "particularTokenId: particular.tokenId",
    "particular study tracking notifications",
  );

  assertContains(particularAuth, "getReportById", "particular auth report access");
  assertContains(particularAuth, "/report/preview-url", "particular auth preview route");
  assertContains(particularAuth, "/report/download-url", "particular auth download route");
  assertNotContains(particularAuth, "reportId?: unknown", "particular auth must not accept reportId input");
  assertNotContains(particularStudyTracking, "reportId?: unknown", "particular study tracking must not accept reportId input");
});