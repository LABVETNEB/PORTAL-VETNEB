import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const REPO_ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));

type FileAnchor = {
  path: string;
  markers: readonly string[];
};

type SecurityBoundaryGuardrail = {
  slug: string;
  path: string;
  purpose: string;
  protectedDimensions: readonly string[];
  runtimeAnchors: readonly FileAnchor[];
  testAnchors: readonly string[];
};

const SECURITY_BOUNDARY_SUITE: readonly SecurityBoundaryGuardrail[] = [
  {
    slug: "actor-relationship",
    path: "test/security-actor-relationship-boundaries.test.ts",
    purpose:
      "Admin, clinic, particular and public-token actors remain explicit before sensitive reads or writes.",
    protectedDimensions: [
      "admin clinic relationship",
      "clinic authenticated relationship",
      "particular token relationship",
    ],
    runtimeAnchors: [
      {
        path: "server/routes/admin-report-access-tokens.fastify.ts",
        markers: ["authenticateAdminUser", "getClinicById", "getReportById"],
      },
      {
        path: "server/routes/report-access-tokens.fastify.ts",
        markers: ["authenticateClinicUser", "getReportById"],
      },
      {
        path: "server/routes/particular-auth.fastify.ts",
        markers: ["authenticateParticularUser", "particularTokenId", "tokenId: particularToken.id"],
      },
    ],
    testAnchors: [
      "actor relationship matrix documents admin clinic and particular boundaries",
      "admin routes keep explicit clinic relationships before linking reports tokens or tracking",
      "clinic routes force authenticated clinic relationships and reject cross clinic links",
    ],
  },
  {
    slug: "resource-ownership",
    path: "test/security-resource-ownership-boundaries.test.ts",
    purpose:
      "Reports, tokens, tracking cases and notifications preserve owner scope before exposing data.",
    protectedDimensions: [
      "clinic-owned resources",
      "admin target clinic validation",
      "particular and public token ownership",
    ],
    runtimeAnchors: [
      {
        path: "server/routes/reports-status.fastify.ts",
        markers: ["getAuthorizedReport", "updateReportStatus"],
      },
      {
        path: "server/routes/report-access-tokens.fastify.ts",
        markers: ["getClinicScopedReportAccessToken", "revokeReportAccessToken"],
      },
      {
        path: "server/routes/public-report-access.fastify.ts",
        markers: ["getReportAccessTokenWithReportByTokenHash", "recordReportAccessTokenAccess"],
      },
    ],
    testAnchors: [
      "resource ownership matrix documents protected owner keys",
      "clinic-owned resources reject cross-clinic reports tokens and tracking cases",
      "admin-owned linking validates target clinic before binding resources",
    ],
  },
  {
    slug: "write-attribution",
    path: "test/security-write-attribution-boundaries.test.ts",
    purpose:
      "Every critical write keeps durable attribution and audit actor metadata aligned with the writer.",
    protectedDimensions: [
      "admin write attribution",
      "clinic write attribution",
      "particular and public token attribution",
    ],
    runtimeAnchors: [
      {
        path: "server/routes/admin-reports.fastify.ts",
        markers: ["createdByAdminUserId", "writeAuditLog"],
      },
      {
        path: "server/lib/audit.ts",
        markers: ["resolveAuditActorFromRequest", "buildPublicReportAccessTokenActor"],
      },
    ],
    testAnchors: [
      "write attribution matrix documents admin clinic particular and public token actors",
      "admin writes persist admin attribution and audit through admin context",
      "clinic writes persist clinic attribution and audit through clinic context",
    ],
  },
  {
    slug: "access-lifecycle",
    path: "test/security-access-lifecycle-boundaries.test.ts",
    purpose:
      "Public tokens, revocation, expiration, session cleanup and inactive particular states keep lifecycle order.",
    protectedDimensions: [
      "public token states",
      "token revocation lifecycle",
      "particular session lifecycle",
    ],
    runtimeAnchors: [
      {
        path: "server/routes/public-report-access.fastify.ts",
        markers: ["getReportAccessTokenState", "revoked", "expired"],
      },
      {
        path: "server/routes/particular-auth.fastify.ts",
        markers: ["deleteParticularSession", "expiresAt", "isActive"],
      },
    ],
    testAnchors: [
      "access lifecycle matrix documents public token revoke session and rate-limit states",
      "public report access enforces token lifecycle before signed URLs and audit",
      "runtime lifecycle tests remain explicit for public report access",
    ],
  },
  {
    slug: "response-disclosure",
    path: "test/security-response-disclosure-boundaries.test.ts",
    purpose:
      "Security responses preserve stable 400 401 403 404 409 410 and 429 semantics without scope leaks.",
    protectedDimensions: [
      "public response codes",
      "cross-scope hiding",
      "audit export scope",
    ],
    runtimeAnchors: [
      {
        path: "server/routes/public-report-access.fastify.ts",
        markers: ["reply.code(400)", "reply.code(404)", "reply.code(409)", "reply.code(410)"],
      },
      {
        path: "server/routes/report-access-tokens.fastify.ts",
        markers: ["return reply.code(404).send", "getClinicScopedReportAccessToken"],
      },
    ],
    testAnchors: [
      "response disclosure matrix documents stable public error semantics",
      "public report access uses explicit 400 404 409 410 and 429 boundaries",
      "runtime disclosure tests remain explicit for hidden resources and response codes",
    ],
  },
  {
    slug: "session-cookie",
    path: "test/security-session-cookie-boundaries.test.ts",
    purpose:
      "Clinic, admin and particular session cookies stay separated across read, write, clear and legacy rejection flows.",
    protectedDimensions: [
      "cookie names",
      "domain-specific session lookup",
      "clear-cookie contract",
    ],
    runtimeAnchors: [
      {
        path: "server/lib/env.ts",
        markers: ["COOKIE_NAME", "ADMIN_COOKIE_NAME", "PARTICULAR_COOKIE_NAME"],
      },
      {
        path: "server/routes/auth.fastify.ts",
        markers: ["cookies[ENV.cookieName]", "name: ENV.cookieName"],
      },
      {
        path: "server/routes/admin-auth.fastify.ts",
        markers: ["cookies[ENV.adminCookieName]", "name: ENV.adminCookieName"],
      },
      {
        path: "server/routes/particular-auth.fastify.ts",
        markers: ["cookies[ENV.particularCookieName]", "name: ENV.particularCookieName"],
      },
    ],
    testAnchors: [
      "session cookie boundary matrix documents separated auth domains",
      "clinic admin and particular route surfaces read only their own cookie",
      "session cookie guardrail source stays ascii only",
    ],
  },
  {
    slug: "cross-auth-surface",
    path: "test/security-cross-auth-surface-boundaries.test.ts",
    purpose:
      "Clinic, admin, particular and public token route families remain separated by accepted cookie domain.",
    protectedDimensions: [
      "clinic cookie only",
      "admin cookie only",
      "particular cookie only",
      "public token surfaces without browser session cookies",
    ],
    runtimeAnchors: [
      {
        path: "server/routes/auth.fastify.ts",
        markers: ["cookies[ENV.cookieName]"],
      },
      {
        path: "server/routes/admin-auth.fastify.ts",
        markers: ["cookies[ENV.adminCookieName]"],
      },
      {
        path: "server/routes/particular-auth.fastify.ts",
        markers: ["cookies[ENV.particularCookieName]"],
      },
      {
        path: "server/routes/public-report-access.fastify.ts",
        markers: ["reportAccessTokenRawTokenSchema.safeParse", "hashSessionToken"],
      },
    ],
    testAnchors: [
      "clinic route surfaces accept only clinic session cookies",
      "admin route surfaces accept only admin session cookies",
      "particular route surfaces accept only particular session cookies",
      "public token surfaces do not accept browser session cookies",
      "cross auth surface registry keeps every protected route family explicit",
    ],
  },
  {
    slug: "sensitive-log-redaction",
    path: "test/security-sensitive-log-redaction-boundaries.test.ts",
    purpose:
      "Request logging, audit metadata, auth and token routes avoid raw sensitive values and keep redaction centralized.",
    protectedDimensions: [
      "request path redaction",
      "raw token avoidance",
      "secret-safe logging",
    ],
    runtimeAnchors: [
      {
        path: "server/middlewares/request-logger.ts",
        markers: ["sanitizeUrlForLogs", "[REDACTED]", "RATE_LIMITED"],
      },
      {
        path: "server/lib/audit.ts",
        markers: ["sanitizeUrlForLogs", "normalizeAuditMetadata"],
      },
      {
        path: "server/routes/report-access-tokens.fastify.ts",
        markers: ["tokenHash", "rawToken"],
      },
    ],
    testAnchors: [
      "sensitive log redaction matrix documents protected boundaries",
      "request logger keeps token and query redaction centralized",
      "sensitive log redaction guardrail source stays ascii only",
    ],
  },
  {
    slug: "trusted-origin-cors",
    path: "test/security-trusted-origin-cors-boundaries.test.ts",
    purpose:
      "Unsafe auth and mutation routes reject untrusted origins while trusted CORS avoids wildcard credentials.",
    protectedDimensions: [
      "unsafe origin rejection",
      "trusted preflight",
      "trust proxy by environment",
    ],
    runtimeAnchors: [
      {
        path: "server/routes/auth.fastify.ts",
        markers: ["enforceTrustedOrigin", "allowedOrigins"],
      },
      {
        path: "server/routes/admin-auth.fastify.ts",
        markers: ["enforceTrustedOrigin", "allowedOrigins"],
      },
      {
        path: "server/fastify-app.ts",
        markers: ["trustProxy", "ENV.trustProxy"],
      },
    ],
    testAnchors: [
      "Origin no permitido",
      "wildcard",
      "trust proxy",
    ],
  },
  {
    slug: "audit-logging-phase",
    path: "test/security-audit-logging-phase-boundaries.test.ts",
    purpose:
      "Critical audit writes remain after durable mutations, before success responses and isolated from business failure.",
    protectedDimensions: [
      "precondition before audit",
      "durable mutation before audit",
      "audit failure isolation",
    ],
    runtimeAnchors: [
      {
        path: "server/lib/audit.ts",
        markers: ["createWriteAuditLog", "buildAuditLogInsert", "AUDIT_LOG_WRITE_ERROR"],
      },
      {
        path: "server/routes/public-report-access.fastify.ts",
        markers: ["recordReportAccessTokenAccess", "writeAuditLog"],
      },
    ],
    testAnchors: [
      "audit logging phase matrix documents the protected contract",
      "writeAuditLog keeps audit storage failures isolated from business flow",
      "audit logging phase guardrail source stays ascii only",
    ],
  },
  {
    slug: "rate-limit-isolation",
    path: "test/security-rate-limit-isolation-boundaries.test.ts",
    purpose:
      "Auth, public read and protected mutation rate limits keep isolated buckets and cut off before protected work.",
    protectedDimensions: [
      "auth login buckets",
      "public read buckets",
      "mutation cut-off before writes",
    ],
    runtimeAnchors: [
      {
        path: "server/lib/login-rate-limit.ts",
        markers: ["LOGIN_RATE_LIMIT_WINDOW_MS", "LOGIN_RATE_LIMIT_MAX_ATTEMPTS"],
      },
      {
        path: "server/lib/public-report-access-rate-limit.ts",
        markers: ["PUBLIC_REPORT_ACCESS_RATE_LIMIT_WINDOW_MS"],
      },
      {
        path: "server/lib/report-access-token-rate-limit.ts",
        markers: ["REPORT_ACCESS_TOKEN_MUTATION_RATE_LIMIT_WINDOW_MS"],
      },
    ],
    testAnchors: [
      "rate limit isolation matrix documents the protected contract",
      "auth login rate limits keep separate in-memory stores per auth domain",
      "rate limit isolation guardrail source stays ascii only",
    ],
  },
  {
    slug: "validation-cutoff",
    path: "test/security-validation-cutoff-boundaries.test.ts",
    purpose:
      "Invalid tokens, params, bodies, uploads and audit filters return 400 before DB, storage, signing or audit work.",
    protectedDimensions: [
      "raw token validation",
      "route param validation",
      "body schema validation",
      "audit filter validation",
    ],
    runtimeAnchors: [
      {
        path: "server/routes/public-report-access.fastify.ts",
        markers: ["reportAccessTokenRawTokenSchema.safeParse", "hashSessionToken"],
      },
      {
        path: "server/routes/admin-reports.fastify.ts",
        markers: ["parseReportId(body.clinicId)", "uploadReport"],
      },
      {
        path: "server/lib/report-access-token.ts",
        markers: ["reportAccessTokenRawTokenSchema", "parseEntityId"],
      },
    ],
    testAnchors: [
      "validation cut-off matrix documents the protected contract",
      "audit list and export filters return 400 before listing or exporting data",
      "validation cut-off guardrail source stays ascii only",
    ],
  },
];

function readSource(relativePath: string): string {
  return readFileSync(resolve(REPO_ROOT, relativePath), "utf8")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n");
}

function assertContains(source: string, marker: string, context: string): void {
  assert.ok(source.includes(marker), `${context} must contain: ${marker}`);
}

function uniqueValues(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function assertFileExists(relativePath: string): void {
  assert.equal(
    existsSync(resolve(REPO_ROOT, relativePath)),
    true,
    `${relativePath} must exist`,
  );
}

function assertGuardrailFileContract(guardrail: SecurityBoundaryGuardrail): void {
  assertFileExists(guardrail.path);

  const source = readSource(guardrail.path);

  assertContains(source, 'from "node:test"', `${guardrail.path} node:test`);
  assertContains(
    source,
    'from "node:assert/strict"',
    `${guardrail.path} assert strict`,
  );

  for (const marker of guardrail.testAnchors) {
    assertContains(source, marker, guardrail.path);
  }

  assert.equal(
    /^\s*export\s+/m.test(source),
    false,
    `${guardrail.path} must stay local to tests`,
  );
}

test("security boundary suite completeness registry keeps canonical order", () => {
  const slugs = SECURITY_BOUNDARY_SUITE.map((guardrail) => guardrail.slug);
  const paths = SECURITY_BOUNDARY_SUITE.map((guardrail) => guardrail.path);

  assert.deepEqual(slugs, [
    "actor-relationship",
    "resource-ownership",
    "write-attribution",
    "access-lifecycle",
    "response-disclosure",
    "session-cookie",
    "cross-auth-surface",
    "sensitive-log-redaction",
    "trusted-origin-cors",
    "audit-logging-phase",
    "rate-limit-isolation",
    "validation-cutoff",
  ]);

  assert.deepEqual(slugs, uniqueValues(slugs));
  assert.deepEqual(paths, uniqueValues(paths));

  for (const guardrail of SECURITY_BOUNDARY_SUITE) {
    assert.match(guardrail.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.match(basename(guardrail.path), /^security-[a-z0-9-]+-boundaries\.test\.ts$/);
    assert.ok(guardrail.purpose.length >= 80);
    assert.ok(guardrail.protectedDimensions.length >= 3);
    assert.ok(guardrail.runtimeAnchors.length > 0);
    assert.ok(guardrail.testAnchors.length >= 3);
  }
});

test("security boundary suite includes every security boundaries guardrail file", () => {
  const actualFiles = readdirSync(resolve(REPO_ROOT, "test"))
    .filter((fileName) => /^security-.*-boundaries\.test\.ts$/.test(fileName))
    .sort();

  const expectedFiles = SECURITY_BOUNDARY_SUITE.map((guardrail) =>
    basename(guardrail.path),
  ).sort();

  assert.deepEqual(actualFiles, expectedFiles);
});

test("security boundary guardrails use node test assert strict and local-only source", () => {
  for (const guardrail of SECURITY_BOUNDARY_SUITE) {
    assertGuardrailFileContract(guardrail);
  }
});

test("security boundary guardrails remain connected to runtime anchors", () => {
  for (const guardrail of SECURITY_BOUNDARY_SUITE) {
    for (const runtimeAnchor of guardrail.runtimeAnchors) {
      assertFileExists(runtimeAnchor.path);

      const source = readSource(runtimeAnchor.path);

      for (const marker of runtimeAnchor.markers) {
        assertContains(
          source,
          marker,
          `${guardrail.slug} runtime anchor ${runtimeAnchor.path}`,
        );
      }
    }
  }
});

test("security boundary suite keeps required downstream runtime tests explicit", () => {
  const requiredRuntimeTests = [
    {
      path: "test/auth.fastify.test.ts",
      marker: "clinicAuthNativeRoutes bloquea login con origin no permitido",
    },
    {
      path: "test/admin-auth.fastify.test.ts",
      marker: "adminAuthNativeRoutes aplica rate limit de login sobre intentos fallidos",
    },
    {
      path: "test/public-report-access.fastify.test.ts",
      marker: "publicReportAccessNativeRoutes devuelve 400 cuando el token es invalido",
    },
    {
      path: "test/report-access-tokens.fastify.test.ts",
      marker: "reportAccessTokensNativeRoutes oculta revocacion de token ajeno antes de mutar",
    },
    {
      path: "test/reports-status.fastify.test.ts",
      marker: "reportsStatusNativeRoutes valida reportId y status invalidos",
    },
    {
      path: "test/audit-export-boundaries.test.ts",
      marker: "audit exports rechazan cookies de dominios cruzados antes de listar",
    },
    {
      path: "test/security-production-invariants.test.ts",
      marker: "errores internos se loguean, pero la respuesta 500 no expone detalles",
    },
  ] as const;

  for (const runtimeTest of requiredRuntimeTests) {
    assertFileExists(runtimeTest.path);
    assertContains(readSource(runtimeTest.path), runtimeTest.marker, runtimeTest.path);
  }
});

test("security boundary suite completeness guardrail source stays ascii only", () => {
  const source = readSource("test/security-boundary-suite-completeness.test.ts");
  const replacementCharacter = String.fromCharCode(0xfffd);

  assert.equal(
    source.includes(replacementCharacter),
    false,
    "security boundary suite completeness source must not contain replacement characters",
  );

  for (let index = 0; index < source.length; index += 1) {
    assert.equal(
      source.charCodeAt(index) <= 0x7f,
      true,
      `security boundary suite completeness source must stay ascii-only at index ${index}`,
    );
  }
});
