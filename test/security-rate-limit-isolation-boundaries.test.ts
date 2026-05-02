import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const REPO_ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));

const RATE_LIMIT_ISOLATION_BOUNDARIES = {
  authLogin: [
    "clinic auth login",
    "admin auth login",
    "particular auth login",
  ],
  publicRead: [
    "public professionals search",
    "public professionals detail",
    "public report access",
  ],
  protectedMutation: [
    "clinic report access token create",
    "clinic report access token revoke",
    "admin report access token create",
    "admin report access token revoke",
  ],
  guarantees: [
    "separate stores per route module",
    "429 includes RateLimit headers",
    "429 does not set session cookies",
    "429 returns before DB storage signing or audit work",
    "request logs mark 429 as RATE_LIMITED",
  ],
} as const;

function readSource(relativePath: string): string {
  return readFileSync(resolve(REPO_ROOT, relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

function assertContains(source: string, marker: string, context: string): void {
  assert.ok(source.includes(marker), `${context} must contain: ${marker}`);
}

function assertNotContains(source: string, marker: string, context: string): void {
  assert.equal(
    source.includes(marker),
    false,
    `${context} must not contain: ${marker}`,
  );
}

function assertMatches(source: string, pattern: RegExp, context: string): void {
  assert.match(source, pattern, `${context} must match ${pattern}`);
}

function assertContainsInOrder(
  source: string,
  markers: readonly string[],
  context: string,
): void {
  let lastIndex = -1;

  for (const marker of markers) {
    const index = source.indexOf(marker, lastIndex + 1);

    assert.notEqual(index, -1, `${context} must contain: ${marker}`);
    assert.ok(
      index > lastIndex,
      `${context} must keep order before marker: ${marker}`,
    );

    lastIndex = index;
  }
}

function assertRateLimitHeaders(source: string, context: string): void {
  for (const marker of [
    '"RateLimit-Policy"',
    '"RateLimit-Limit"',
    '"RateLimit-Remaining"',
    '"RateLimit-Reset"',
  ]) {
    assertContains(source, marker, context);
  }
}

test("rate limit isolation matrix documents the protected contract", () => {
  assert.deepEqual(RATE_LIMIT_ISOLATION_BOUNDARIES, {
    authLogin: [
      "clinic auth login",
      "admin auth login",
      "particular auth login",
    ],
    publicRead: [
      "public professionals search",
      "public professionals detail",
      "public report access",
    ],
    protectedMutation: [
      "clinic report access token create",
      "clinic report access token revoke",
      "admin report access token create",
      "admin report access token revoke",
    ],
    guarantees: [
      "separate stores per route module",
      "429 includes RateLimit headers",
      "429 does not set session cookies",
      "429 returns before DB storage signing or audit work",
      "request logs mark 429 as RATE_LIMITED",
    ],
  });
});

test("rate limit constants remain split by auth public read and token mutation domains", () => {
  const login = readSource("server/lib/login-rate-limit.ts");
  const publicProfessionals = readSource(
    "server/lib/public-professionals-rate-limit.ts",
  );
  const publicReportAccess = readSource(
    "server/lib/public-report-access-rate-limit.ts",
  );
  const reportAccessTokenMutation = readSource(
    "server/lib/report-access-token-rate-limit.ts",
  );

  assertContains(login, "LOGIN_RATE_LIMIT_WINDOW_MS", "login rate limit");
  assertContains(login, "LOGIN_RATE_LIMIT_MAX_ATTEMPTS", "login rate limit");
  assertContains(
    login,
    "LOGIN_RATE_LIMIT_ERROR_MESSAGE",
    "login rate limit",
  );

  assertContains(
    publicProfessionals,
    "PUBLIC_PROFESSIONALS_SEARCH_RATE_LIMIT_WINDOW_MS",
    "public professionals search rate limit",
  );
  assertContains(
    publicProfessionals,
    "PUBLIC_PROFESSIONAL_DETAIL_RATE_LIMIT_WINDOW_MS",
    "public professionals detail rate limit",
  );
  assertContains(
    publicProfessionals,
    "PUBLIC_PROFESSIONALS_SEARCH_RATE_LIMIT_ERROR_MESSAGE",
    "public professionals search rate limit",
  );
  assertContains(
    publicProfessionals,
    "PUBLIC_PROFESSIONAL_DETAIL_RATE_LIMIT_ERROR_MESSAGE",
    "public professionals detail rate limit",
  );

  assertContains(
    publicReportAccess,
    "PUBLIC_REPORT_ACCESS_RATE_LIMIT_WINDOW_MS",
    "public report access rate limit",
  );
  assertContains(
    publicReportAccess,
    "PUBLIC_REPORT_ACCESS_RATE_LIMIT_ERROR_MESSAGE",
    "public report access rate limit",
  );

  assertContains(
    reportAccessTokenMutation,
    "REPORT_ACCESS_TOKEN_MUTATION_RATE_LIMIT_WINDOW_MS",
    "report access token mutation rate limit",
  );
  assertContains(
    reportAccessTokenMutation,
    "REPORT_ACCESS_TOKEN_MUTATION_RATE_LIMIT_ERROR_MESSAGE",
    "report access token mutation rate limit",
  );

  assertNotContains(login, "PUBLIC_REPORT_ACCESS_", "login rate limit");
  assertNotContains(login, "PUBLIC_PROFESSIONAL", "login rate limit");
  assertNotContains(login, "REPORT_ACCESS_TOKEN_MUTATION", "login rate limit");

  assertNotContains(
    publicProfessionals,
    "LOGIN_RATE_LIMIT",
    "public professionals rate limit",
  );
  assertNotContains(
    publicReportAccess,
    "LOGIN_RATE_LIMIT",
    "public report access rate limit",
  );
  assertNotContains(
    reportAccessTokenMutation,
    "LOGIN_RATE_LIMIT",
    "report access token mutation rate limit",
  );
});

test("auth login rate limits keep separate in-memory stores per auth domain", () => {
  for (const file of [
    "server/routes/auth.fastify.ts",
    "server/routes/admin-auth.fastify.ts",
    "server/routes/particular-auth.fastify.ts",
  ] as const) {
    const source = readSource(file);

    assertContains(
      source,
      'from "../lib/login-rate-limit.ts"',
      `${file} login rate limit import`,
    );
    assertContains(
      source,
      "const loginFailures = new Map<string, { count: number; resetAt: number }>();",
      `${file} login store`,
    );
    assertContains(
      source,
      "options.loginRateLimitWindowMs ?? LOGIN_RATE_LIMIT_WINDOW_MS",
      `${file} login window`,
    );
    assertContains(
      source,
      "options.loginRateLimitMaxAttempts ?? LOGIN_RATE_LIMIT_MAX_ATTEMPTS",
      `${file} login max attempts`,
    );
    assertContains(
      source,
      "const rateLimitKey = request.ip || \"unknown\";",
      `${file} login key`,
    );
    assertContains(
      source,
      "error: LOGIN_RATE_LIMIT_ERROR_MESSAGE",
      `${file} login error`,
    );
    assertRateLimitHeaders(source, `${file} login headers`);

    assertNotContains(
      source,
      "PUBLIC_REPORT_ACCESS_RATE_LIMIT",
      `${file} must not share public report access limiter`,
    );
    assertNotContains(
      source,
      "REPORT_ACCESS_TOKEN_MUTATION_RATE_LIMIT",
      `${file} must not share token mutation limiter`,
    );
  }
});

test("public professionals search and detail keep independent fixed-window stores", () => {
  const source = readSource("server/routes/public-professionals.fastify.ts");

  assertContains(
    source,
    'from "../lib/public-professionals-rate-limit.ts"',
    "public professionals rate limit import",
  );
  assertContains(
    source,
    "const entries = new Map<string, { count: number; resetAt: number }>();",
    "public professionals fixed window store",
  );
  assertContainsInOrder(
    source,
    [
      "const searchRateLimit = createFixedWindowRateLimit({",
      "PUBLIC_PROFESSIONALS_SEARCH_RATE_LIMIT_WINDOW_MS",
      "PUBLIC_PROFESSIONALS_SEARCH_RATE_LIMIT_MAX_ATTEMPTS",
      "PUBLIC_PROFESSIONALS_SEARCH_RATE_LIMIT_ERROR_MESSAGE",
      "const detailRateLimit = createFixedWindowRateLimit({",
      "PUBLIC_PROFESSIONAL_DETAIL_RATE_LIMIT_WINDOW_MS",
      "PUBLIC_PROFESSIONAL_DETAIL_RATE_LIMIT_MAX_ATTEMPTS",
      "PUBLIC_PROFESSIONAL_DETAIL_RATE_LIMIT_ERROR_MESSAGE",
    ],
    "public professionals separate limiter setup",
  );
  assertContains(
    source,
    "preHandler: searchRateLimit",
    "public professionals search limiter",
  );
  assertContains(
    source,
    "preHandler: detailRateLimit",
    "public professionals detail limiter",
  );
  assertRateLimitHeaders(source, "public professionals rate limit headers");

  assertNotContains(source, "reply.header(\"set-cookie\"", "public professionals");
  assertNotContains(source, "LOGIN_RATE_LIMIT", "public professionals");
  assertNotContains(
    source,
    "PUBLIC_REPORT_ACCESS_RATE_LIMIT",
    "public professionals",
  );
});

test("public report access rate limit cuts off before token hashing DB signing and audit", () => {
  const source = readSource("server/routes/public-report-access.fastify.ts");

  assertContains(
    source,
    'from "../lib/public-report-access-rate-limit.ts"',
    "public report access rate limit import",
  );
  assertContains(
    source,
    "const accessAttempts = new Map<string, { count: number; resetAt: number }>();",
    "public report access store",
  );
  assertContainsInOrder(
    source,
    [
      "const accessEntry = getAccessEntry(",
      "if (accessEntry.count >= publicReportAccessRateLimitMaxAttempts) {",
      "setRateLimitHeaders(reply, {",
      "return reply.code(429).send({",
      "error: PUBLIC_REPORT_ACCESS_RATE_LIMIT_ERROR_MESSAGE",
      "accessEntry.count += 1;",
      "const parsed = reportAccessTokenRawTokenSchema.safeParse(request.params.token);",
      "const tokenHash = deps.hashSessionToken(parsed.data);",
      "const record = await deps.getReportAccessTokenWithReportByTokenHash(tokenHash);",
      "const updatedToken = await deps.recordReportAccessTokenAccess(record.token.id);",
      "const [previewUrl, downloadUrl] = await Promise.all([",
      "await deps.writeAuditLog(request, {",
    ],
    "public report access rate limit cut-off",
  );
  assertRateLimitHeaders(source, "public report access rate limit headers");

  assertNotContains(source, "reply.header(\"set-cookie\"", "public report access");
  assertNotContains(source, "LOGIN_RATE_LIMIT", "public report access");
  assertNotContains(
    source,
    "REPORT_ACCESS_TOKEN_MUTATION_RATE_LIMIT",
    "public report access",
  );
});

test("report access token mutation rate limits cut off before auth and writes", () => {
  for (const scenario of [
    {
      file: "server/routes/report-access-tokens.fastify.ts",
      authMarker: "const auth = await authenticateClinicUser(request, reply, deps, now);",
    },
    {
      file: "server/routes/admin-report-access-tokens.fastify.ts",
      authMarker: "const admin = await authenticateAdminUser(request, reply, deps, now);",
    },
  ] as const) {
    const source = readSource(scenario.file);

    assertContains(
      source,
      'from "../lib/report-access-token-rate-limit.ts"',
      `${scenario.file} mutation rate limit import`,
    );
    assertContains(
      source,
      "const mutationAttempts = new Map<string, { count: number; resetAt: number }>();",
      `${scenario.file} mutation store`,
    );
    assertContains(
      source,
      "const applyMutationRateLimit = (",
      `${scenario.file} mutation limiter function`,
    );
    assertContainsInOrder(
      source,
      [
        "if (entry.count >= mutationRateLimitMaxAttempts) {",
        "setMutationRateLimitHeaders(reply, {",
        "reply.code(429).send({",
        "error: REPORT_ACCESS_TOKEN_MUTATION_RATE_LIMIT_ERROR_MESSAGE",
        "return null;",
        "entry.count += 1;",
      ],
      `${scenario.file} mutation limiter cut-off`,
    );
    assertContainsInOrder(
      source,
      [
        "if (!applyMutationRateLimit(request, reply)) {",
        "return reply;",
        scenario.authMarker,
      ],
      `${scenario.file} mutation limiter before auth`,
    );
    assertContainsInOrder(
      source,
      [
        "if (!applyMutationRateLimit(request, reply)) {",
        scenario.authMarker,
        "await deps.writeAuditLog(",
      ],
      `${scenario.file} mutation limiter before audit`,
    );
    assertRateLimitHeaders(source, `${scenario.file} mutation headers`);

    assertNotContains(
      source,
      "PUBLIC_REPORT_ACCESS_RATE_LIMIT",
      `${scenario.file} must not share public access limiter`,
    );
    assertNotContains(
      source,
      "PUBLIC_PROFESSIONAL",
      `${scenario.file} must not share public professionals limiter`,
    );
  }
});

test("rate-limited responses are logged with the shared RATE_LIMITED marker only on 429", () => {
  const logger = readSource("server/middlewares/request-logger.ts");

  assertContainsInOrder(
    logger,
    [
      "if (input.statusCode === 429) {",
      "return `${baseLine} RATE_LIMITED`;",
    ],
    "request logger rate limit marker",
  );
  assertContains(
    logger,
    "return baseLine;",
    "request logger non-rate-limited branch",
  );

  for (const file of [
    "test/public-professionals-logging-invariants.test.ts",
    "test/request-logger.test.ts",
  ] as const) {
    const source = readSource(file);
    assertContains(source, "RATE_LIMITED", `${file} runtime marker coverage`);
  }
});

test("runtime rate limit tests remain explicit for isolated public and mutation buckets", () => {
  const publicProfessionals = readSource("test/public-professionals.fastify.test.ts");
  const publicProfessionalsResponseHeaders = readSource(
    "test/public-professionals-response-headers-invariants.test.ts",
  );
  const publicReportAccess = readSource("test/public-report-access.fastify.test.ts");
  const reportAccessTokens = readSource("test/report-access-tokens.fastify.test.ts");
  const adminReportAccessTokens = readSource(
    "test/admin-report-access-tokens.fastify.test.ts",
  );
  const productionInvariants = readSource("test/security-production-invariants.test.ts");

  assertMatches(
    publicProfessionals,
    /no comparte bucket de rate limit entre search y detail/,
    "public professionals isolated search/detail runtime test",
  );
  assertMatches(
    publicProfessionalsResponseHeaders,
    /no setea cookies en 429/,
    "public professionals no cookies on 429 runtime test",
  );
  assertMatches(
    publicProfessionals,
    /harness reinicia rate limit store por instancia de app/,
    "public professionals per-app store runtime test",
  );
  assertMatches(
    publicReportAccess,
    /aplica rate limit nativo fijo por IP/,
    "public report access rate limit runtime test",
  );
  assertMatches(
    reportAccessTokens,
    /aplica rate limit nativo fijo sobre mutaciones/,
    "clinic token mutation rate limit runtime test",
  );
  assertMatches(
    adminReportAccessTokens,
    /aplica rate limit nativo fijo sobre mutaciones/,
    "admin token mutation rate limit runtime test",
  );
  assertContains(
    productionInvariants,
    "RATE_LIMITED",
    "production invariants rate-limited logging coverage",
  );
});

test("rate limit isolation guardrail source stays ascii only", () => {
  const source = readSource("test/security-rate-limit-isolation-boundaries.test.ts");
  const replacementCharacter = String.fromCharCode(0xfffd);

  assertNotContains(source, replacementCharacter, "rate limit guardrail source");

  for (let index = 0; index < source.length; index += 1) {
    assert.equal(
      source.charCodeAt(index) <= 0x7f,
      true,
      `rate limit guardrail source must stay ascii-only at index ${index}`,
    );
  }
});
