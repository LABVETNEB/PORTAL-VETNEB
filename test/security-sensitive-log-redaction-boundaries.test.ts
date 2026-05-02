import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const REPO_ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));

const SENSITIVE_LOG_REDACTION_BOUNDARIES = {
  requestLogs: {
    middleware: "server/middlewares/request-logger.ts",
    redactionMarker: "[REDACTED]",
  },
  authSecrets: {
    sessionHash: "hashSessionToken",
    passwordVerifier: "verifyPassword",
  },
  publicReportAccess: {
    route: "server/routes/public-report-access.fastify.ts",
    actorBuilder: "buildPublicReportAccessTokenActor",
  },
  smokeSecrets: {
    passwordEnv: "SMOKE_PASSWORD",
  },
} as const;

const AUTH_ROUTE_FILES = [
  "server/routes/auth.fastify.ts",
  "server/routes/admin-auth.fastify.ts",
  "server/routes/particular-auth.fastify.ts",
] as const;

const TOKEN_ROUTE_FILES = [
  "server/routes/public-report-access.fastify.ts",
  "server/routes/report-access-tokens.fastify.ts",
  "server/routes/admin-report-access-tokens.fastify.ts",
  "server/routes/particular-tokens.fastify.ts",
  "server/routes/admin-particular-tokens.fastify.ts",
] as const;

const AUDIT_FILES = [
  "server/lib/audit.ts",
  "server/lib/audit-log.ts",
  "server/lib/admin-audit.ts",
  "server/lib/clinic-audit.ts",
  "server/lib/particular-audit.ts",
] as const;

function readSource(relativePath: string): string {
  return readFileSync(resolve(REPO_ROOT, relativePath), "utf8");
}

function assertContains(source: string, marker: string, context: string) {
  assert.ok(source.includes(marker), `${context} must contain: ${marker}`);
}

function assertNotContains(source: string, marker: string, context: string) {
  assert.equal(source.includes(marker), false, `${context} must not contain: ${marker}`);
}

function assertNoDirectSecretLogging(source: string, context: string) {
  const dangerousLogPatterns = [
    /console\.(log|error|warn|info)\([^)]*password/i,
    /console\.(log|error|warn|info)\([^)]*tokenHash/i,
    /console\.(log|error|warn|info)\([^)]*sessionToken/i,
    /console\.(log|error|warn|info)\([^)]*rawToken/i,
    /console\.(log|error|warn|info)\([^)]*authorization/i,
    /console\.(log|error|warn|info)\([^)]*cookie/i,
    /console\.(log|error|warn|info)\([^)]*signedUrl/i,
  ];

  for (const pattern of dangerousLogPatterns) {
    assert.doesNotMatch(source, pattern, `${context} must not log sensitive data with ${pattern}`);
  }
}

test("sensitive log redaction matrix documents protected boundaries", () => {
  assert.deepEqual(SENSITIVE_LOG_REDACTION_BOUNDARIES, {
    requestLogs: {
      middleware: "server/middlewares/request-logger.ts",
      redactionMarker: "[REDACTED]",
    },
    authSecrets: {
      sessionHash: "hashSessionToken",
      passwordVerifier: "verifyPassword",
    },
    publicReportAccess: {
      route: "server/routes/public-report-access.fastify.ts",
      actorBuilder: "buildPublicReportAccessTokenActor",
    },
    smokeSecrets: {
      passwordEnv: "SMOKE_PASSWORD",
    },
  });
});

test("request logger keeps token and query redaction centralized", () => {
  const requestLogger = readSource("server/middlewares/request-logger.ts");
  const logger = readSource("server/lib/logger.ts");

  assertContains(requestLogger, "[REDACTED]", "request logger redaction marker");
  assertContains(requestLogger, "REDACTED", "request logger redaction constant");
  assertContains(requestLogger, "token", "request logger token awareness");
  assertContains(requestLogger, "url", "request logger url awareness");
  assertContains(requestLogger, "method", "request logger method");
  assertContains(requestLogger, "statusCode", "request logger status code");
  assertContains(logger, "console", "central logger console boundary");

  assertNoDirectSecretLogging(requestLogger, "request logger middleware");
});

test("auth routes hash session tokens and avoid logging raw credentials", () => {
  for (const file of AUTH_ROUTE_FILES) {
    const source = readSource(file);

    assertContains(source, "hashSessionToken", `${file} session token hashing`);
    assertNoDirectSecretLogging(source, file);

    if (file !== "server/routes/particular-auth.fastify.ts") {
      assertContains(source, "verifyPassword", `${file} password verification`);
      assertContains(source, "metadata", `${file} audit metadata boundary`);
    } else {
      assertContains(source, "getParticularTokenByTokenHash", `${file} token verification`);
      assertContains(source, "updateParticularTokenLastLogin", `${file} login side effect`);
    }
  }
});

test("token routes avoid raw token leakage in audit metadata and logs", () => {
  for (const file of TOKEN_ROUTE_FILES) {
    const source = readSource(file);

    assertNoDirectSecretLogging(source, file);
  }

  for (const file of [
    "server/routes/public-report-access.fastify.ts",
    "server/routes/report-access-tokens.fastify.ts",
    "server/routes/admin-report-access-tokens.fastify.ts",
  ] as const) {
    const source = readSource(file);

    assertContains(source, "metadata", `${file} audit metadata boundary`);
  }

  const publicReportAccess = readSource("server/routes/public-report-access.fastify.ts");

  assertContains(publicReportAccess, "buildPublicReportAccessTokenActor", "public report access actor redaction boundary");
  assertContains(publicReportAccess, "targetReportAccessTokenId", "public report access target id boundary");
  assertContains(publicReportAccess, "record.token.id", "public report access uses token id");
  assertNotContains(publicReportAccess, "record.token.raw", "public report access must not expose raw token");
});

test("audit helpers export structured identifiers without raw secrets", () => {
  for (const file of AUDIT_FILES) {
    const source = readSource(file);

    assertNoDirectSecretLogging(source, file);
    assertNotContains(source, "password", `${file} no password export`);
    assertNotContains(source, "sessionToken", `${file} no session token export`);
    assertNotContains(source, "tokenHash", `${file} no token hash export`);
    assertNotContains(source, "rawToken", `${file} no raw token export`);
  }

  const audit = readSource("server/lib/audit.ts");
  const auditLog = readSource("server/lib/audit-log.ts");

  assertContains(audit, "actorAdminUserId", "audit admin actor id");
  assertContains(audit, "actorClinicUserId", "audit clinic actor id");
  assertContains(audit, "actorReportAccessTokenId", "audit public token actor id");
  assertContains(audit, "targetReportAccessTokenId", "audit target token id");

  assertContains(auditLog, "actorAdminUserId", "audit csv admin actor id");
  assertContains(auditLog, "actorClinicUserId", "audit csv clinic actor id");
  assertContains(auditLog, "actorReportAccessTokenId", "audit csv public token actor id");
  assertContains(auditLog, "targetReportAccessTokenId", "audit csv target token id");
});

test("environment secret names are parsed but not logged directly", () => {
  const envSource = readSource("server/lib/env.ts");

  assertContains(envSource, "SUPABASE_SERVICE_ROLE_KEY", "supabase service role env parsing");
  assertContains(envSource, "SMTP_PASS", "smtp password env parsing");
  assertContains(envSource, "supabaseServiceRoleKey", "supabase service role typed env");
  assertContains(envSource, "pass: rawEnv.SMTP_PASS", "smtp password typed env");

  assertNoDirectSecretLogging(envSource, "env module");
  assertNotContains(envSource, "console.error", "env module direct console.error");
});

test("runtime tests remain explicit for redaction and secret-safe logging", () => {
  const requestLoggerTests = readSource("test/request-logger.test.ts");
  const requestLoggerEdgeTests = readSource("test/request-logger-edge.test.ts");
  const requestLoggerMiddlewareTests = readSource("test/request-logger-middleware.test.ts");
  const loggerAndEmailTests = readSource("test/logger-and-email.test.ts");
  const productionInvariants = readSource("test/security-production-invariants.test.ts");
  const smokeEnvContract = readSource("test/smoke-env-contract.test.ts");

  assertContains(requestLoggerTests, "REDACTED", "request logger unit redaction test");
  assertContains(requestLoggerEdgeTests, "REDACTED", "request logger edge redaction test");
  assertContains(requestLoggerMiddlewareTests, "REDACTED", "request logger middleware redaction test");

  assertContains(loggerAndEmailTests, "logger", "logger test coverage");
  assertContains(productionInvariants, "logs de request sanitizan tokens", "production request log sanitization guardrail");

  assertContains(smokeEnvContract, "SMOKE_PASSWORD", "smoke password env coverage");
  assertContains(smokeEnvContract, "console.log", "smoke console log inspection");
  assertContains(smokeEnvContract, "assert.doesNotMatch(line, /PASSWORD|SMOKE_PASSWORD/)", "smoke password log redaction");
});

test("signed url tests keep storage access delegated without public urls", () => {
  const supabaseSignedUrlTests = readSource("test/supabase-signed-url.test.ts");
  const supabaseStorageBoundariesTests = readSource("test/supabase-storage-boundaries.test.ts");

  assertContains(supabaseSignedUrlTests, "createSignedStorageUrl", "signed storage url test");
  assertContains(supabaseSignedUrlTests, "createSignedReportDownloadUrl", "signed report download url test");
  assertContains(supabaseSignedUrlTests, "signedUrl", "signed url fixture coverage");

  assertContains(supabaseStorageBoundariesTests, "createSignedStorageUrl", "storage boundary signed url guard");
  assertContains(supabaseStorageBoundariesTests, "createSignedReportDownloadUrl", "storage boundary signed download guard");
  assertContains(supabaseStorageBoundariesTests, "getPublicUrl", "storage boundary public url assertion");
  assertContains(supabaseStorageBoundariesTests, "assert.equal(createSignedStorageUrlSource.includes(\"getPublicUrl\"), false)", "preview avoids public url");
  assertContains(supabaseStorageBoundariesTests, "assert.equal(createSignedReportDownloadUrlSource.includes(\"getPublicUrl\"), false)", "download avoids public url");
});

test("sensitive log redaction guardrail source stays ascii only", () => {
  const source = readSource("test/security-sensitive-log-redaction-boundaries.test.ts");
  const mojibakeLead = String.fromCharCode(0x00c3);
  const replacementCharacter = String.fromCharCode(0xfffd);

  assertNotContains(source, mojibakeLead, "guardrail source");
  assertNotContains(source, replacementCharacter, "guardrail source");

  for (let index = 0; index < source.length; index += 1) {
    assert.equal(
      source.charCodeAt(index) <= 0x7f,
      true,
      `guardrail source must stay ascii-only at index ${index}`,
    );
  }
});