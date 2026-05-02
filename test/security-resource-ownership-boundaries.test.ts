import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const REPO_ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));

const RESOURCE_OWNERSHIP_BOUNDARIES = {
  report: {
    ownerKey: "clinicId",
    clinicScope: "auth.clinicId",
  },
  reportAccessToken: {
    ownerKeys: ["clinicId", "reportId"],
    clinicScope: "auth.clinicId",
  },
  particularToken: {
    ownerKeys: ["clinicId", "reportId"],
    clinicScope: "auth.clinicId",
  },
  studyTrackingCase: {
    ownerKeys: ["clinicId", "reportId", "particularTokenId"],
    clinicScope: "auth.clinicId",
    particularScope: "particular.tokenId",
  },
  studyTrackingNotification: {
    ownerKeys: ["clinicId", "reportId", "particularTokenId", "studyTrackingCaseId"],
    clinicScope: "auth.clinicId",
    particularScope: "particular.tokenId",
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

test("resource ownership matrix documents protected owner keys", () => {
  assert.deepEqual(RESOURCE_OWNERSHIP_BOUNDARIES, {
    report: {
      ownerKey: "clinicId",
      clinicScope: "auth.clinicId",
    },
    reportAccessToken: {
      ownerKeys: ["clinicId", "reportId"],
      clinicScope: "auth.clinicId",
    },
    particularToken: {
      ownerKeys: ["clinicId", "reportId"],
      clinicScope: "auth.clinicId",
    },
    studyTrackingCase: {
      ownerKeys: ["clinicId", "reportId", "particularTokenId"],
      clinicScope: "auth.clinicId",
      particularScope: "particular.tokenId",
    },
    studyTrackingNotification: {
      ownerKeys: ["clinicId", "reportId", "particularTokenId", "studyTrackingCaseId"],
      clinicScope: "auth.clinicId",
      particularScope: "particular.tokenId",
    },
  });
});

test("clinic-owned resources reject cross-clinic reports tokens and tracking cases", () => {
  const reports = readSource("server/routes/reports.fastify.ts");
  const reportsStatus = readSource("server/routes/reports-status.fastify.ts");
  const reportAccessTokens = readSource("server/routes/report-access-tokens.fastify.ts");
  const particularTokens = readSource("server/routes/particular-tokens.fastify.ts");
  const studyTracking = readSource("server/routes/study-tracking.fastify.ts");

  assertContains(reports, "getReadClinicScope", "clinic reports query scope");
  assertContains(reports, "scope.clinicId", "clinic reports query scope");
  assertContains(reports, "getAuthorizedReport", "clinic reports parameterized scope");
  assertContains(reports, "report.clinicId !== clinicId", "clinic reports parameterized scope");

  assertContains(reportsStatus, "getAuthorizedReport", "clinic report status ownership");
  assertContains(reportsStatus, "report.clinicId !== clinicId", "clinic report status ownership");
  assertContains(reportsStatus, "auth.clinicId", "clinic report status ownership");

  assertContains(reportAccessTokens, "report.clinicId !== auth.clinicId", "clinic report access token report ownership");
  assertMatches(
    reportAccessTokens,
    /getClinicScopedReportAccessToken\(\s*tokenId,\s*auth\.clinicId/s,
    "clinic report access token detail ownership",
  );

  assertContains(particularTokens, "report.clinicId !== auth.clinicId", "clinic particular token report ownership");
  assertMatches(
    particularTokens,
    /getClinicScopedParticularToken\(\s*tokenId,\s*auth\.clinicId/s,
    "clinic particular token detail ownership",
  );

  assertContains(studyTracking, "report.clinicId !== auth.clinicId", "clinic study tracking report ownership");
  assertContains(studyTracking, "particularToken.clinicId !== auth.clinicId", "clinic study tracking token ownership");
  assertMatches(
    studyTracking,
    /getClinicScopedStudyTrackingCase\(\s*trackingCaseId,\s*auth\.clinicId/s,
    "clinic study tracking case ownership",
  );
  assertContains(studyTracking, "clinicId: auth.clinicId", "clinic study tracking list ownership");
});

test("admin-owned linking validates target clinic before binding resources", () => {
  const adminReportAccessTokens = readSource("server/routes/admin-report-access-tokens.fastify.ts");
  const adminParticularTokens = readSource("server/routes/admin-particular-tokens.fastify.ts");
  const adminStudyTracking = readSource("server/routes/admin-study-tracking.fastify.ts");

  assertContains(
    adminReportAccessTokens,
    "report.clinicId !== parsed.data.clinicId",
    "admin report access token report ownership",
  );

  assertContains(
    adminParticularTokens,
    "report.clinicId !== parsed.data.clinicId",
    "admin particular token create report ownership",
  );
  assertContains(
    adminParticularTokens,
    "report.clinicId !== token.clinicId",
    "admin particular token relink report ownership",
  );

  assertContains(
    adminStudyTracking,
    "report.clinicId !== parsed.data.clinicId",
    "admin study tracking create report ownership",
  );
  assertContains(
    adminStudyTracking,
    "particularToken.clinicId !== parsed.data.clinicId",
    "admin study tracking create token ownership",
  );
  assertContains(
    adminStudyTracking,
    "report.clinicId !== current.clinicId",
    "admin study tracking update report ownership",
  );
  assertContains(
    adminStudyTracking,
    "particularToken.clinicId !== current.clinicId",
    "admin study tracking update token ownership",
  );
  assertMatches(
    adminStudyTracking,
    /getClinicScopedStudyTrackingCase\(trackingCaseId,\s*clinicId\)/s,
    "admin study tracking optional clinic-scoped lookup",
  );
});

test("particular and public surfaces derive ownership from authenticated or raw tokens", () => {
  const particularAudit = readSource("server/routes/particular-audit.fastify.ts");
  const particularStudyTracking = readSource("server/routes/particular-study-tracking.fastify.ts");
  const publicReportAccess = readSource("server/routes/public-report-access.fastify.ts");

  assertContains(
    particularAudit,
    "particularTokenId: particular.tokenId",
    "particular audit token ownership",
  );

  assertMatches(
    particularStudyTracking,
    /getParticularTokenById\(\s*session\.particularTokenId/s,
    "particular session token ownership",
  );
  assertMatches(
    particularStudyTracking,
    /getParticularStudyTrackingCase\(\s*particular\.tokenId/s,
    "particular study tracking case ownership",
  );
  assertContains(
    particularStudyTracking,
    "particularTokenId: particular.tokenId",
    "particular study tracking notifications ownership",
  );

  assertContains(
    publicReportAccess,
    "clinicId: record.token.clinicId",
    "public report access audit clinic ownership",
  );
  assertContains(
    publicReportAccess,
    "reportId: record.token.reportId",
    "public report access audit report ownership",
  );
  assertContains(
    publicReportAccess,
    "targetReportAccessTokenId: record.token.id",
    "public report access audit token ownership",
  );
});

test("critical ownership tests remain explicit and runtime-backed", () => {
  const reportsTests = readSource("test/reports.fastify.test.ts");
  const reportsStatusTests = readSource("test/reports-status.fastify.test.ts");
  const reportAccessTokenTests = readSource("test/report-access-tokens.fastify.test.ts");
  const particularStudyTrackingTests = readSource("test/particular-study-tracking.fastify.test.ts");

  assertContains(
    reportsTests,
    "reportsNativeRoutes bloquea informe ajeno en rutas parametrizadas",
    "reports ownership tests",
  );
  assertContains(
    reportsTests,
    "reportsNativeRoutes bloquea clinicId ajeno",
    "reports clinicId ownership tests",
  );

  assertContains(
    reportsStatusTests,
    "reportsStatusNativeRoutes bloquea informe ajeno o inexistente",
    "report status ownership tests",
  );

  assertContains(
    reportAccessTokenTests,
    "reportAccessTokensNativeRoutes oculta detalle de token ajeno con 404",
    "report access token detail ownership tests",
  );
  assertContains(
    reportAccessTokenTests,
    "reportAccessTokensNativeRoutes oculta revocacion de token ajeno antes de mutar",
    "report access token revoke ownership tests",
  );

  assertContains(
    particularStudyTrackingTests,
    "particularStudyTrackingNativeRoutes expone GET /me con seguimiento del token autenticado",
    "particular study tracking ownership tests",
  );
  assertContains(
    particularStudyTrackingTests,
    "particularStudyTrackingNativeRoutes expone GET /notifications con filtro por token particular",
    "particular study tracking notification ownership tests",
  );
});