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

const PUBLIC_REPORT_ACCESS_FILE = "server/routes/public-report-access.fastify.ts";
const HIDDEN_REPORT_RESPONSE = "return reply.code(404).send(REPORT_NOT_FOUND_RESPONSE);";
const MALFORMED_TOKEN_BRANCH = /if\s*\(\s*!parsed\.success\s*\)\s*\{/g;
const NOT_FOUND_TOKEN_BRANCH = /if\s*\(\s*result\.kind\s*===\s*"not_found"\s*\)\s*\{/g;

function countOccurrences(source: string, target: string): number {
  return source.split(target).length - 1;
}

function replaceExactlyOnce(source: string, target: string, replacement: string): string {
  assert.ok(source.includes(target), `mutation target must exist: ${target}`);
  assert.equal(countOccurrences(source, target), 1, `mutation target must appear exactly once: ${target}`);
  return source.replace(target, () => replacement);
}

// Returns the normalized body of the single braced branch matching `header`, or
// undefined when the branch is absent, duplicated or its braces are unbalanced.
function extractSingleBranchBody(source: string, header: RegExp): string | undefined {
  const matches = [...source.matchAll(header)];
  const match = matches[0];
  if (matches.length !== 1 || match?.index === undefined) {
    return undefined;
  }

  const bodyStart = match.index + match[0].length;
  let depth = 1;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") {
      depth += 1;
    } else if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(bodyStart, index).trim().split(/\s+/).join(" ");
      }
    }
  }

  return undefined;
}

function evaluatePublicReportAccessDisclosureSource(source: string, context: string): string[] {
  const violations: string[] = [];
  const branches = [
    {
      header: MALFORMED_TOKEN_BRANCH,
      guard: "!parsed.success",
      violation: "malformed public report token must remain hidden as 404",
    },
    {
      header: NOT_FOUND_TOKEN_BRANCH,
      guard: 'result.kind === "not_found"',
      violation: "unknown or unusable public report token must remain hidden as 404",
    },
  ];

  for (const branch of branches) {
    const body =
      countOccurrences(source, branch.guard) === 1
        ? extractSingleBranchBody(source, branch.header)
        : undefined;
    if (body !== HIDDEN_REPORT_RESPONSE) {
      violations.push(`${context}: ${branch.violation}`);
    }
  }

  return violations;
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

  assert.deepEqual(
    evaluatePublicReportAccessDisclosureSource(publicReportAccess, PUBLIC_REPORT_ACCESS_FILE),
    [],
  );
});

test("mutation proof: malformed public token cannot disclose token shape with 400", () => {
  const source = readSource(PUBLIC_REPORT_ACCESS_FILE).split("\r\n").join("\n");
  assert.deepEqual(evaluatePublicReportAccessDisclosureSource(source, PUBLIC_REPORT_ACCESS_FILE), []);

  const mutated = replaceExactlyOnce(
    source,
    ["if (!parsed.success) {", `      ${HIDDEN_REPORT_RESPONSE}`, "    }"].join("\n"),
    ["if (!parsed.success) {", "      return reply.code(400).send(REPORT_NOT_FOUND_RESPONSE);", "    }"].join("\n"),
  );
  assert.notEqual(mutated, source);

  // Legacy file-wide markers stay green on the degraded source: the 404 of the
  // not_found branch still satisfies "reply.code(404).send".
  assertContains(mutated, "reportAccessTokenRawTokenSchema.safeParse", "public token shape validation");
  assertContains(mutated, "REPORT_NOT_FOUND_RESPONSE", "public generic not found response");
  assertContains(mutated, "reply.code(404).send", "public unknown token response");
  assertNotContains(mutated, "reply.code(410).send", "public token lifecycle must not reveal prior existence");
  assertContains(mutated, "reply.code(409).send", "public unavailable report response");
  assertContains(mutated, "reply.code(429).send", "public report access rate limit status");
  assert.equal(countOccurrences(mutated, "reply.code(404).send(REPORT_NOT_FOUND_RESPONSE)"), 1);
  assert.equal(extractSingleBranchBody(mutated, NOT_FOUND_TOKEN_BRANCH), HIDDEN_REPORT_RESPONSE);

  assert.deepEqual(evaluatePublicReportAccessDisclosureSource(mutated, PUBLIC_REPORT_ACCESS_FILE), [
    `${PUBLIC_REPORT_ACCESS_FILE}: malformed public report token must remain hidden as 404`,
  ]);
});

test("public report access disclosure evaluator fails closed on missing duplicated or reshaped branches", () => {
  const source = readSource(PUBLIC_REPORT_ACCESS_FILE).split("\r\n").join("\n");
  const malformedViolation = `${PUBLIC_REPORT_ACCESS_FILE}: malformed public report token must remain hidden as 404`;
  const notFoundViolation = `${PUBLIC_REPORT_ACCESS_FILE}: unknown or unusable public report token must remain hidden as 404`;

  const cases = [
    {
      name: "malformed branch removed",
      mutated: replaceExactlyOnce(source, "if (!parsed.success) {", "if (parsed.success === false) {"),
      expected: [malformedViolation],
    },
    {
      name: "malformed branch duplicated",
      mutated: replaceExactlyOnce(
        source,
        "const result = await reportAccess.access(",
        "if (!parsed.success) {\n      return reply.code(400).send(REPORT_NOT_FOUND_RESPONSE);\n    }\n\n    const result = await reportAccess.access(",
      ),
      expected: [malformedViolation],
    },
    {
      name: "not_found branch discloses a distinct body",
      mutated: replaceExactlyOnce(
        source,
        `if (result.kind === "not_found") {\n      ${HIDDEN_REPORT_RESPONSE}`,
        `if (result.kind === "not_found") {\n      return reply.code(404).send({ success: false, error: "Token inexistente" });`,
      ),
      expected: [notFoundViolation],
    },
    {
      name: "not_found branch reshaped without braces",
      mutated: replaceExactlyOnce(
        source,
        `if (result.kind === "not_found") {\n      ${HIDDEN_REPORT_RESPONSE}\n    }`,
        `if (result.kind === "not_found") ${HIDDEN_REPORT_RESPONSE}`,
      ),
      expected: [notFoundViolation],
    },
  ];

  for (const { name, mutated, expected } of cases) {
    assert.notEqual(mutated, source, name);
    assert.deepEqual(evaluatePublicReportAccessDisclosureSource(mutated, PUBLIC_REPORT_ACCESS_FILE), expected, name);
  }
});

test("clinic report and token surfaces do not disclose cross-scope resources as readable data", () => {
  const reports = readSource("server/routes/reports.fastify.ts");
  const reportsStatus = readSource("server/routes/reports-status.fastify.ts");
  const reportQueries = readSource(
    "server/features/reports/application/report-query-use-cases.ts",
  );
  const reportAccessTokens = readSource("server/routes/report-access-tokens.fastify.ts");

  assertContains(reportQueries, "findClinicScopedReportById", "clinic report ownership check");
  assertContains(reports, "reply.code(404).send", "clinic foreign report response");
  assertContains(reports, "Informe no encontrado", "clinic report not found body");

  assertContains(reportQueries, "findClinicScopedReportById", "clinic report status ownership check");
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
  const clinicFastifyAuth = readSource("server/lib/fastify-clinic-auth.ts");
  const particularAudit = readSource("server/routes/particular-audit.fastify.ts");

  assertContains(adminAudit, "authenticateAdminUser", "admin audit auth gate");
  assertContains(adminFastifyAuth, "reply.code(401).send", "admin shared unauthenticated response");
  assertContains(adminAudit, "ADMIN_AUDIT_CSV_EXPORT_MAX_ROWS", "admin audit export bounded response");

  // WBR-08c: clinic-audit.fastify.ts delegates the unauthenticated response
  // to the canonical clinic auth helper.
  assertContains(clinicAudit, "authenticateFastifyClinicUser", "clinic audit auth gate");
  assertContains(clinicFastifyAuth, "reply.code(401).send", "clinic shared unauthenticated response");
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
