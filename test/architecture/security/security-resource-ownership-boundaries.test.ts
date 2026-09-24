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

const CLINIC_STUDY_TRACKING_OPERATIONS =
  "server/features/study-tracking/application/clinic-study-tracking-operations.ts";
const CLINIC_CREATE_CASE_SIGNATURE = "async createClinicStudyTrackingCase(";
const CLINIC_TOKEN_REJECTION = '"particular_token_wrong_clinic"';
const LEGACY_CLINIC_TOKEN_MARKER = "particularToken.clinicId !== input.actor.clinicId";

function compactEarlyReturn(condition: string, status: string): string {
  const earlyReturn = `return\\{status:"${status}",?\\};?`;
  return `if\\(${condition}\\)(?:\\{${earlyReturn}\\}|${earlyReturn})`;
}

// Whitespace-free shape of the token branch: lookup, not-found and wrong-clinic rejection, contiguous.
const CLINIC_TOKEN_OWNERSHIP_GUARD = new RegExp(
  [
    'if\\(typeofinput\\.data\\.particularTokenId==="number"\\)\\{',
    "constparticularToken=awaitdeps\\.referenceRepository\\.getParticularTokenById\\(input\\.data\\.particularTokenId,?\\);",
    compactEarlyReturn("!particularToken", "particular_token_not_found"),
    compactEarlyReturn(
      "(?:particularToken\\.clinicId!==input\\.actor\\.clinicId|input\\.actor\\.clinicId!==particularToken\\.clinicId)",
      "particular_token_wrong_clinic",
    ),
    "\\}",
  ].join(""),
  "g",
);

const PERSISTENT_WRITE_CALL = /\.\s*(?:create|update|insert|delete|mark)\w*\s*\(/;

function extractMethodBody(source: string, signature: string): string | undefined {
  const start = source.indexOf(signature);
  if (start === -1 || source.indexOf(signature, start + signature.length) !== -1) {
    return undefined;
  }

  const open = source.indexOf("{", start + signature.length);
  if (open === -1) {
    return undefined;
  }

  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") {
      depth += 1;
    } else if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(open + 1, index);
      }
    }
  }

  return undefined;
}

function evaluateClinicStudyTrackingTokenOwnership(rawSource: string): string[] {
  const raw = rawSource.replace(/^﻿/, "").replace(/\r\n/g, "\n");
  const code = raw.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
  const rawBody = extractMethodBody(raw, CLINIC_CREATE_CASE_SIGNATURE);
  const body = extractMethodBody(code, CLINIC_CREATE_CASE_SIGNATURE);

  if (rawBody === undefined || body === undefined) {
    return ["clinic study tracking createClinicStudyTrackingCase is not evaluable"];
  }

  const violations: string[] = [];
  const guards = body.replace(/\s+/g, "").match(CLINIC_TOKEN_OWNERSHIP_GUARD)?.length ?? 0;
  if (guards !== 1) {
    violations.push(`clinic study tracking particular token ownership guard must appear exactly once, found ${guards}`);
  }

  const rejections = body.split(CLINIC_TOKEN_REJECTION).length - 1;
  if (rejections !== 1) {
    violations.push(`clinic study tracking wrong-clinic rejection must appear exactly once, found ${rejections}`);
  }

  // Ordering runs on the raw body so a write hidden behind comment-like text still counts.
  const lastRejection = rawBody.lastIndexOf(CLINIC_TOKEN_REJECTION);
  const firstWrite = rawBody.search(PERSISTENT_WRITE_CALL);
  if (firstWrite === -1) {
    violations.push("clinic study tracking writes are not evaluable");
  } else if (lastRejection !== -1 && firstWrite < lastRejection) {
    violations.push("clinic study tracking must reject a foreign particular token before any write");
  }

  return violations;
}

function replaceOnce(source: string, target: string, replacement: string): string {
  const first = source.indexOf(target);

  assert.notEqual(first, -1, `mutation target must exist in source: ${target}`);
  assert.equal(
    source.indexOf(target, first + target.length),
    -1,
    `mutation target must be unique in source: ${target}`,
  );

  return source.slice(0, first) + replacement + source.slice(first + target.length);
}

function readClinicStudyTrackingSource(): string {
  return readSource(CLINIC_STUDY_TRACKING_OPERATIONS).replace(/^﻿/, "").replace(/\r\n/g, "\n");
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
  const reportQueries = readSource(
    "server/features/reports/application/report-query-use-cases.ts",
  );
  const reportAccessApplication = readSource(
    "server/features/report-access/application/clinic-report-access-operations.ts",
  );
  const particularTokens = readSource("server/routes/particular-tokens.fastify.ts");
  const particularTokensApplication = readSource(
    "server/features/particular-access/application/clinic-particular-access-operations.ts",
  );
  const studyTracking = readSource("server/routes/study-tracking.fastify.ts");
  const studyTrackingApplication = readSource(
    "server/features/study-tracking/application/clinic-study-tracking-operations.ts",
  );

  assertContains(reports, "getReadClinicScope", "clinic reports query scope");
  assertContains(reports, "scope.clinicId", "clinic reports query scope");
  assertContains(reports, "getClinicReportHistory", "clinic reports parameterized scope");
  assertContains(reportQueries, "findClinicScopedReport", "clinic reports parameterized scope");
  assertContains(reportQueries, "findClinicScopedReportById", "clinic reports parameterized scope");

  assertContains(reportsStatus, "transitionClinicReportStatus", "clinic report status ownership");
  assertContains(reportQueries, "findClinicScopedReportById", "clinic report status ownership");
  assertContains(reportsStatus, "auth.clinicId", "clinic report status ownership");

  assertContains(reportAccessApplication, "getClinicScopedReportById", "clinic report access token report ownership");
  assertMatches(
    reportAccessApplication,
    /getClinicScopedReportAccessToken\(tokenId, clinicId\)/s,
    "clinic report access token detail ownership",
  );

  assertContains(particularTokens, "getClinicScopedReportById", "clinic particular token report ownership");
  assertMatches(
    particularTokens,
    /clinicOperations\.getToken\(\s*tokenId,\s*auth\.clinicId/s,
    "clinic particular token detail ownership",
  );
  assertMatches(
    particularTokensApplication,
    /getClinicScopedParticularToken\(\s*tokenId,\s*clinicId/s,
    "clinic particular token application ownership",
  );

  assertContains(studyTrackingApplication, "getClinicScopedReportById", "clinic study tracking report ownership");
  assertContains(studyTrackingApplication, "particularToken.clinicId !== input.actor.clinicId", "clinic study tracking token ownership");
  assert.deepEqual(evaluateClinicStudyTrackingTokenOwnership(studyTrackingApplication), []);
  assertMatches(
    studyTrackingApplication,
    /getClinicScopedStudyTrackingCase\(\s*input\.trackingCaseId,\s*input\.clinicId/s,
    "clinic study tracking case ownership",
  );
  assertContains(studyTracking, "clinicId: auth.clinicId", "clinic study tracking list ownership");
});

const CLINIC_TOKEN_GUARD_BLOCK = [
  "        if (particularToken.clinicId !== input.actor.clinicId) {",
  '          return { status: "particular_token_wrong_clinic" };',
  "        }",
].join("\n");

test("clinic study tracking token ownership evaluator accepts equivalent refactors", () => {
  const source = readClinicStudyTrackingSource();

  assert.deepEqual(evaluateClinicStudyTrackingTokenOwnership(source), []);
  assert.deepEqual(
    evaluateClinicStudyTrackingTokenOwnership(
      replaceOnce(source, LEGACY_CLINIC_TOKEN_MARKER, "input.actor.clinicId !== particularToken.clinicId"),
    ),
    [],
  );
  assert.deepEqual(
    evaluateClinicStudyTrackingTokenOwnership(
      replaceOnce(
        source,
        CLINIC_TOKEN_GUARD_BLOCK,
        '        if (particularToken.clinicId !== input.actor.clinicId) return { status: "particular_token_wrong_clinic" };',
      ),
    ),
    [],
  );
  assert.deepEqual(
    evaluateClinicStudyTrackingTokenOwnership(
      replaceOnce(
        source,
        `        if (${LEGACY_CLINIC_TOKEN_MARKER}) {`,
        [
          "        // A token owned by another clinic must never be bound to this case.",
          "        if (",
          "          particularToken.clinicId !==",
          "          input.actor.clinicId",
          "        ) {",
        ].join("\n"),
      ),
    ),
    [],
  );
});

test("clinic study tracking token ownership mutations turn the evaluator red", () => {
  const source = readClinicStudyTrackingSource();
  const guardMissing = "clinic study tracking particular token ownership guard must appear exactly once, found 0";
  const rejectionMissing = "clinic study tracking wrong-clinic rejection must appear exactly once, found 0";
  const tokenBranch = '      if (typeof input.data.particularTokenId === "number") {';
  const mutations = [
    {
      name: "ownership comparison inverted",
      target: LEGACY_CLINIC_TOKEN_MARKER,
      replacement: "particularToken.clinicId === input.actor.clinicId",
      expected: [guardMissing],
      legacyMarkerKept: false,
    },
    {
      name: "wrong-clinic rejection removed",
      target: '          return { status: "particular_token_wrong_clinic" };\n',
      replacement: "",
      expected: [guardMissing, rejectionMissing],
      legacyMarkerKept: true,
    },
    {
      name: "ownership guard neutralized by a dead branch",
      target: `if (${LEGACY_CLINIC_TOKEN_MARKER}) {`,
      replacement: `if (false && ${LEGACY_CLINIC_TOKEN_MARKER}) {`,
      expected: [guardMissing],
      legacyMarkerKept: true,
    },
    {
      name: "ownership guard kept only as a comment",
      target: CLINIC_TOKEN_GUARD_BLOCK,
      replacement: CLINIC_TOKEN_GUARD_BLOCK.split("\n").map((line) => `        // ${line.trim()}`).join("\n"),
      expected: [guardMissing, rejectionMissing],
      legacyMarkerKept: true,
    },
    {
      name: "foreign token relinked before the ownership guard",
      target: tokenBranch,
      replacement: [
        '      if (typeof input.data.particularTokenId === "number" && typeof input.data.reportId === "number") {',
        "        await deps.referenceRepository.updateParticularTokenReport(",
        "          input.data.particularTokenId,",
        "          input.data.reportId,",
        "        );",
        "      }",
        "",
        tokenBranch,
      ].join("\n"),
      expected: ["clinic study tracking must reject a foreign particular token before any write"],
      legacyMarkerKept: true,
    },
  ] as const;

  for (const mutation of mutations) {
    const mutated = replaceOnce(source, mutation.target, mutation.replacement);

    assert.notEqual(mutated, source, `${mutation.name} must change the source`);
    assert.deepEqual(
      evaluateClinicStudyTrackingTokenOwnership(mutated),
      [...mutation.expected],
      `mutation must be detected: ${mutation.name}`,
    );
    // Legacy substring marker alone stays green on these regressions; only the evaluator catches them.
    assert.equal(mutated.includes(LEGACY_CLINIC_TOKEN_MARKER), mutation.legacyMarkerKept, mutation.name);
  }
});

test("clinic study tracking token ownership evaluator fails closed on unevaluable structure", () => {
  const source = readClinicStudyTrackingSource();
  const notEvaluable = ["clinic study tracking createClinicStudyTrackingCase is not evaluable"];

  assert.deepEqual(evaluateClinicStudyTrackingTokenOwnership(""), notEvaluable);
  assert.deepEqual(
    evaluateClinicStudyTrackingTokenOwnership(
      `${source}\nconst shadow = { async createClinicStudyTrackingCase() { return null; } };\n`,
    ),
    notEvaluable,
  );
  assert.deepEqual(
    evaluateClinicStudyTrackingTokenOwnership(
      source.slice(0, source.indexOf("const delivery = applyEstimatedDeliveryRules(")),
    ),
    notEvaluable,
  );
  assert.deepEqual(
    evaluateClinicStudyTrackingTokenOwnership(
      replaceOnce(source, CLINIC_TOKEN_GUARD_BLOCK, `${CLINIC_TOKEN_GUARD_BLOCK}\n${CLINIC_TOKEN_GUARD_BLOCK}`),
    ),
    [
      "clinic study tracking particular token ownership guard must appear exactly once, found 0",
      "clinic study tracking wrong-clinic rejection must appear exactly once, found 2",
    ],
  );

  assert.throws(
    () => replaceOnce(source, "particularToken.tenantId !== input.actor.clinicId", ""),
    /mutation target must exist in source/,
  );
  assert.throws(
    () => replaceOnce(source, "input.actor.clinicId", "input.data.clinicId"),
    /mutation target must be unique in source/,
  );
});

test("admin-owned linking validates target clinic before binding resources", () => {
  const adminReportAccessApplication = readSource(
    "server/features/report-access/application/admin-report-access-operations.ts",
  );
  const adminParticularTokens = readSource("server/routes/admin-particular-tokens.fastify.ts");
  const adminParticularTokensApplication = readSource(
    "server/features/particular-access/application/admin-particular-access-operations.ts",
  );
  const adminStudyTracking = readSource("server/routes/admin-study-tracking.fastify.ts");
  const adminStudyTrackingApplication = readSource(
    "server/features/study-tracking/application/admin-study-tracking-operations.ts",
  );

  assertContains(
    adminReportAccessApplication,
    "belongsToClinic(report.clinicId, data.clinicId)",
    "admin report access token report ownership",
  );

  assertContains(
    adminParticularTokensApplication,
    "belongsToClinic(report.clinicId, data.clinicId)",
    "admin particular token create report ownership",
  );
  assertContains(
    adminParticularTokensApplication,
    "belongsToClinic(report.clinicId, token.clinicId)",
    "admin particular token relink report ownership",
  );

  assertContains(
    adminStudyTrackingApplication,
    "report.clinicId !== input.data.clinicId",
    "admin study tracking create report ownership",
  );
  assertContains(
    adminStudyTrackingApplication,
    "particularToken.clinicId !== input.data.clinicId",
    "admin study tracking create token ownership",
  );
  assertContains(
    adminStudyTrackingApplication,
    "report.clinicId !== input.current.clinicId",
    "admin study tracking update report ownership",
  );
  assertContains(
    adminStudyTrackingApplication,
    "particularToken.clinicId !== input.current.clinicId",
    "admin study tracking update token ownership",
  );
  assertMatches(
    adminStudyTrackingApplication,
    /queries\.getClinicScopedStudyTrackingCase\(\s*input\.trackingCaseId,\s*input\.clinicId/s,
    "admin study tracking optional clinic-scoped lookup",
  );
});

test("particular and public surfaces derive ownership from authenticated or raw tokens", () => {
  const particularAudit = readSource("server/routes/particular-audit.fastify.ts");
  const particularStudyTracking = readSource("server/routes/particular-study-tracking.fastify.ts");
  const particularStudyTrackingApplication = readSource(
    "server/features/study-tracking/application/particular-study-tracking-operations.ts",
  );
  const publicReportAccessApplication = readSource(
    "server/features/report-access/application/public-report-access-operations.ts",
  );

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
    publicReportAccessApplication,
    "clinicId: record.token.clinicId",
    "public report access audit clinic ownership",
  );
  assertContains(
    publicReportAccessApplication,
    "reportId: record.token.reportId",
    "public report access audit report ownership",
  );
  assertContains(
    publicReportAccessApplication,
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
