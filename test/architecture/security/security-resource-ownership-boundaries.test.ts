import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../../", import.meta.url)));

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
  clinicPublicProfile: {
    ownerKey: "clinicId",
    clinicScope: "session.clinicUser.clinicId",
    foreignInputPolicy: "ignored",
  },
  adminClinics: {
    scope: "admin_global",
    authRealm: "admin_session",
    clinicSessionAccess: false,
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
// already migrated into enterprise subdirectories (TEST-ARCH-13/15). Prefers the exact
// path; falls back to a unique basename match under the same top-level directory. Zero or
// multiple matches return undefined so the caller fails explicitly (no silent match).
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
    clinicPublicProfile: {
      ownerKey: "clinicId",
      clinicScope: "session.clinicUser.clinicId",
      foreignInputPolicy: "ignored",
    },
    adminClinics: {
      scope: "admin_global",
      authRealm: "admin_session",
      clinicSessionAccess: false,
    },
  });
});

test("clinic-owned resources reject cross-clinic reports tokens and tracking cases", () => {
  const reports = readSource("server/routes/reports.fastify.ts");
  const reportsStatus = readSource("server/routes/reports-status.fastify.ts");
  const reportAccessTokens = readSource("server/routes/report-access-tokens.fastify.ts");
  const particularTokens = readSource("server/routes/particular-tokens.fastify.ts");
  const studyTracking = readSource("server/routes/study-tracking.fastify.ts");
  const studyTrackingApplication = readSource(
    "server/features/study-tracking/application/clinic-study-tracking-operations.ts",
  );

  assertContains(reports, "getReadClinicScope", "clinic reports query scope");
  assertContains(reports, "scope.clinicId", "clinic reports query scope");
  assertContains(reports, "getAuthorizedReport", "clinic reports parameterized scope");
  assertContains(reports, "getClinicScopedReportById", "clinic reports parameterized scope");

  assertContains(reportsStatus, "getAuthorizedReport", "clinic report status ownership");
  assertContains(reportsStatus, "getClinicScopedReportById", "clinic report status ownership");
  assertContains(reportsStatus, "auth.clinicId", "clinic report status ownership");

  assertContains(reportAccessTokens, "getClinicScopedReportById", "clinic report access token report ownership");
  assertMatches(
    reportAccessTokens,
    /getClinicScopedReportAccessToken\(\s*tokenId,\s*auth\.clinicId/s,
    "clinic report access token detail ownership",
  );

  assertContains(particularTokens, "getClinicScopedReportById", "clinic particular token report ownership");
  assertMatches(
    particularTokens,
    /getClinicScopedParticularToken\(\s*tokenId,\s*auth\.clinicId/s,
    "clinic particular token detail ownership",
  );

  assertContains(studyTrackingApplication, "getClinicScopedReportById", "clinic study tracking report ownership");
  assertContains(studyTrackingApplication, "particularToken.clinicId !== input.actor.clinicId", "clinic study tracking token ownership");
  assertMatches(
    studyTrackingApplication,
    /getClinicScopedStudyTrackingCase\(\s*input\.trackingCaseId,\s*input\.clinicId/s,
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
  const particularStudyTrackingApplication = readSource(
    "server/features/study-tracking/application/particular-study-tracking-operations.ts",
  );
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
    /getParticularStudyTrackingForToken\(\s*particular\.tokenId/s,
    "particular study tracking case ownership",
  );
  assertContains(
    particularStudyTracking,
    "particularTokenId: particular.tokenId",
    "particular study tracking notifications ownership",
  );
  assertContains(
    particularStudyTrackingApplication,
    "queries.getParticularStudyTrackingCase(particularTokenId)",
    "particular application case ownership",
  );
  assertContains(
    particularStudyTrackingApplication,
    "particularTokenId: input.particularTokenId",
    "particular application notification ownership",
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
    "reportsNativeRoutes unifica informe ajeno e inexistente como 404 seguro",
    "reports ownership tests",
  );
  assertContains(
    reportsTests,
    "reportsNativeRoutes bloquea clinicId ajeno",
    "reports clinicId ownership tests",
  );

  assertContains(
    reportsStatusTests,
    "reportsStatusNativeRoutes unifica informe ajeno e inexistente como 404 seguro",
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

test("Clinics public profile is session-scoped while Admin Clinics stays admin-global", () => {
  const clinicPublicProfile = readSource(
    "server/routes/clinic-public-profile.fastify.ts",
  );
  const adminClinics = readSource(
    "server/routes/admin-clinics.fastify.ts",
  );

  assertMatches(
    clinicPublicProfile,
    /getClinicPublicProfileQuery\(\s*auth\.clinicId/s,
    "Clinics GET ownership",
  );
  assertMatches(
    clinicPublicProfile,
    /patchClinicPublicProfileCommand\(\s*\{\s*clinicId: auth\.clinicId/s,
    "Clinics PATCH ownership",
  );
  assertMatches(
    clinicPublicProfile,
    /uploadClinicPublicAvatarCommand\(\s*\{\s*clinicId: auth\.clinicId/s,
    "Clinics POST avatar ownership",
  );
  assertMatches(
    clinicPublicProfile,
    /deleteClinicPublicAvatarCommand\(\s*\{\s*clinicId: auth\.clinicId/s,
    "Clinics DELETE avatar ownership",
  );

  assertContains(
    adminClinics,
    "authenticateFastifyAdmin",
    "Admin Clinics global administrative authentication",
  );
  assertContains(
    adminClinics,
    "adminAuth",
    "Admin Clinics global administrative audit identity",
  );
  assert.equal(
    adminClinics.includes("authenticateClinicUser"),
    false,
    "Admin Clinics must not be represented as a clinic-session surface",
  );
});

test("resource ownership guardrail references cross-tenant IDOR contract registry", () => {
  const crossTenantIdorContract = readSource("test/architecture/security/security-cross-tenant-idor-contract.test.ts");

  assertContains(
    crossTenantIdorContract,
    "const CROSS_TENANT_IDOR_CONTRACTS",
    "cross-tenant IDOR guardrail matrix",
  );
  assertContains(
    crossTenantIdorContract,
    "CTIDOR-001",
    "cross-tenant IDOR guardrail matrix",
  );
  assertContains(
    crossTenantIdorContract,
    "CTIDOR-016",
    "Clinics cross-tenant IDOR guardrail matrix",
  );
  assertContains(
    crossTenantIdorContract,
    "pending_runtime_staging_evidence",
    "cross-tenant IDOR readiness status",
  );
});
