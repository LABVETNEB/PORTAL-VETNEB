import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import ts from "typescript";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../../", import.meta.url)));

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
    "login key includes surface identifier and IP",
  ],
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
  return readFileSync(resolve(REPO_ROOT, resolved), "utf8").replace(
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
  if (source.includes("buildLoginRateLimitHeaders(input)")) {
    assertContains(source, "buildLoginRateLimitHeaders(input)", context);
    return;
  }

  for (const marker of [
    '"RateLimit-Policy"',
    '"RateLimit-Limit"',
    '"RateLimit-Remaining"',
    '"RateLimit-Reset"',
  ]) {
    assertContains(source, marker, context);
  }
}

const REPORT_ACCESS_TOKEN_MUTATION_ROUTES = [
  {
    file: "server/routes/report-access-tokens.fastify.ts",
    // WBR-08b: migrated to the canonical clinic auth helper.
    authMarker: "const clinicAuth = await authenticateFastifyClinicUser(request, reply, deps, now);",
    operationMarker: "const result = await reportAccess.createToken(",
  },
  {
    file: "server/routes/admin-report-access-tokens.fastify.ts",
    authMarker: "const admin = await authenticateAdminUser(request, reply, deps, now);",
    operationMarker: "const result = await reportAccess.createToken(",
  },
] as const;

const EXPECTED_TOKEN_MUTATION_HANDLERS = ['post "/"', 'patch "/:tokenId/revoke"'] as const;
const MUTATION_LIMITER_GATE =
  "if (!(await applyMutationRateLimit(request, reply))) { return reply; }";
const MUTATING_ROUTE_REGISTRATION = /app\.(post|put|patch|delete)\b/g;
const HANDLER_HEAD = /^\s*\(\s*"([^"]+)"\s*,\s*async\s*\(\s*request\s*,\s*reply\s*\)\s*=>\s*\{/;

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

function replaceExactlyOnce(source: string, target: string, replacement: string): string {
  assert.ok(source.includes(target), `mutation target must exist: ${target}`);
  assert.equal(countOccurrences(source, target), 1, `mutation target must appear exactly once: ${target}`);
  return source.replace(target, () => replacement);
}

// Balanced-brace scan starting right after an opening brace; undefined when unbalanced.
function readBlock(source: string, bodyStart: number): string | undefined {
  let depth = 1;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") {
      depth += 1;
    } else if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(bodyStart, index);
      }
    }
  }
  return undefined;
}

// Resolves `app.<method>[<{...}>]("path", async (request, reply) => { body })`.
function locateHandler(rest: string): { path: string; body: string } | undefined {
  let cursor = 0;
  const genericOpen = rest.match(/^\s*<\s*\{/);
  if (genericOpen) {
    const generic = readBlock(rest, genericOpen[0].length);
    const genericClose =
      generic === undefined
        ? null
        : rest.slice(genericOpen[0].length + generic.length + 1).match(/^\s*>/);
    if (generic === undefined || !genericClose) {
      return undefined;
    }
    cursor = genericOpen[0].length + generic.length + 1 + genericClose[0].length;
  }

  const head = rest.slice(cursor).match(HANDLER_HEAD);
  const body = head ? readBlock(rest, cursor + head[0].length) : undefined;
  return head && body !== undefined ? { path: head[1], body } : undefined;
}

// Blanks every comment the TypeScript parser reports as trivia (offsets and newlines kept),
// so non-executable text never satisfies the gate; undefined when the source does not parse.
function executableSource(source: string, fileName: string): string | undefined {
  const { diagnostics = [] } = ts.transpileModule(source, { fileName, reportDiagnostics: true });
  if (diagnostics.length > 0) {
    return undefined;
  }

  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const chars = source.split("");
  const visit = (node: ts.Node): void => {
    for (const range of [
      ...(ts.getTrailingCommentRanges(source, node.pos) ?? []),
      ...(ts.getLeadingCommentRanges(source, node.pos) ?? []),
    ]) {
      for (let index = range.pos; index < range.end; index += 1) {
        if (chars[index] !== "\n" && chars[index] !== "\r") {
          chars[index] = " ";
        }
      }
    }
    node.getChildren(file).forEach(visit);
  };
  visit(file);
  return chars.join("");
}

// Every mutating handler must gate on its own mutation rate limit before auth: a
// limiter call in a sibling handler never satisfies another handler.
function evaluateReportAccessTokenMutationRateLimitSource(
  rawSource: string,
  context: string,
  authMarker: string,
): string[] {
  const source = executableSource(rawSource, context);
  if (source === undefined) {
    return [`${context}: source must parse as TypeScript before evaluation`];
  }

  const violations: string[] = [];
  const seen: string[] = [];

  for (const registration of source.matchAll(MUTATING_ROUTE_REGISTRATION)) {
    const method = registration[1];
    const located =
      registration.index === undefined
        ? undefined
        : locateHandler(source.slice(registration.index + registration[0].length));

    if (!located) {
      violations.push(`${context}: app.${method} handler structure is ambiguous`);
      continue;
    }

    const handler = `${method} "${located.path}"`;
    seen.push(handler);
    const normalized = located.body.trim().split(/\s+/).join(" ");
    const gateIndex = normalized.indexOf(MUTATION_LIMITER_GATE);
    const authIndex = normalized.indexOf(authMarker.split(/\s+/).join(" "));

    if (
      countOccurrences(normalized, MUTATION_LIMITER_GATE) !== 1 ||
      authIndex === -1 ||
      gateIndex > authIndex
    ) {
      violations.push(`${context}: ${handler} must apply the mutation rate limit before auth`);
    }
  }

  if (JSON.stringify([...seen].sort()) !== JSON.stringify([...EXPECTED_TOKEN_MUTATION_HANDLERS].sort())) {
    violations.push(
      `${context}: mutating handlers must be exactly ${EXPECTED_TOKEN_MUTATION_HANDLERS.join(", ")}`,
    );
  }

  return violations;
}

function assertLegacyTokenMutationRateLimitMarkers(
  source: string,
  scenario: (typeof REPORT_ACCESS_TOKEN_MUTATION_ROUTES)[number],
): void {
  assertContains(
    source,
    'from "../lib/report-access-token-rate-limit.ts"',
    `${scenario.file} mutation rate limit import`,
  );
  assertContains(
    source,
    "mutationRateLimitStore?: RateLimitStore;",
    `${scenario.file} injectable mutation store option`,
  );
  assertContains(
    source,
    "options.mutationRateLimitStore ?? createMemoryRateLimitStore();",
    `${scenario.file} memory fallback mutation store`,
  );
  assertContains(
    source,
    "const applyMutationRateLimit = async (",
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
      "const updatedEntry = await incrementRateLimitEntry(",
    ],
    `${scenario.file} mutation limiter cut-off`,
  );
  assertContainsInOrder(
    source,
    [
      "if (!(await applyMutationRateLimit(request, reply))) {",
      "return reply;",
      scenario.authMarker,
    ],
    `${scenario.file} mutation limiter before auth`,
  );
  assertContainsInOrder(
    source,
    [
      "if (!(await applyMutationRateLimit(request, reply))) {",
      scenario.authMarker,
      scenario.operationMarker,
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
      "login key includes surface identifier and IP",
    ],
  });
});

test("rate limit constants remain split by auth public read and token mutation domains", () => {
  const login = readSource("server/lib/login-rate-limit.ts");
  const publicProfessionals = readSource(
    "server/features/public-professionals/infrastructure/public-professionals-rate-limit.ts",
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

test("auth login rate limits keep persistent stores with memory fallback per auth domain", () => {
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
      "loginRateLimitStore?: RateLimitStore;",
      `${file} injectable login rate limit store option`,
    );
    assertContains(
      source,
      "loginRateLimitStore: createPersistentRateLimitStore(",
      `${file} persistent login rate limit store`,
    );
    assertContains(
      source,
      "metadataForKey: getLoginRateLimitKeyMetadata",
      `${file} persistent login metadata`,
    );
    for (const marker of [
      "get: db.getLoginRateLimitEntry,",
      "set: db.setLoginRateLimitEntry,",
      "increment: db.incrementLoginRateLimitEntry,",
      "consume: db.consumeLoginRateLimitAttempt,",
      "cleanupExpired: db.deleteExpiredLoginRateLimitEntries,",
      "delete: db.deleteLoginRateLimitEntry,",
    ]) {
      assertContains(source, marker, `${file} persistent login store adapter`);
    }
    assertContains(
      source,
      "options.loginRateLimitStore ??",
      `${file} injectable login rate limit store precedence`,
    );
    assertContains(
      source,
      "defaultDeps?.loginRateLimitStore ??",
      `${file} persistent login rate limit store precedence`,
    );
    assertContains(
      source,
      "createMemoryRateLimitStore();",
      `${file} memory fallback login rate limit store`,
    );
    assertContains(
      source,
      "await getOrCreateRateLimitEntry(",
      `${file} login rate limit store read`,
    );
    assertContains(
      source,
      "await consumeRateLimitAttempt(",
      `${file} atomic login rate limit consume`,
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
    const realmKeyByFile = {
      "server/routes/auth.fastify.ts": [
        "buildLoginRateLimitKey({",
        'surface: isUnifiedPayload ? "unified" : "clinic",',
        "identifier: loginIdentifier,",
        "ipAddress: request.ip || null,",
        "buildMissingCredentialsLoginRateLimitKey({",
      ],
      "server/routes/admin-auth.fastify.ts": [
        "buildLoginRateLimitKey({",
        'surface: "admin",',
        "identifier: username,",
        "ipAddress: request.ip || null,",
        "buildMissingCredentialsLoginRateLimitKey({",
      ],
      "server/routes/particular-auth.fastify.ts": [
        "buildLoginRateLimitKey({",
        'surface: "particular",',
        "identifier: providedToken,",
        "ipAddress: request.ip || null,",
        "buildMissingCredentialsLoginRateLimitKey({",
      ],
    } satisfies Record<(typeof file), readonly string[]>;

    for (const marker of realmKeyByFile[file]) {
      assertContains(source, marker, `${file} login key`);
    }
    assertNotContains(
      source,
      'const rateLimitKey = `admin:${request.ip || "unknown"}`;',
      `${file} must not use admin IP-only login key`,
    );
    assertNotContains(
      source,
      'const rateLimitKey = `particular:${request.ip || "unknown"}`;',
      `${file} must not use particular IP-only login key`,
    );
    assertContains(
      source,
      "buildLoginRateLimitResponse({",
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
    'from "../features/public-professionals/infrastructure/public-professionals-rate-limit.ts"',
    "public professionals rate limit import",
  );
  assertContains(
    source,
    "searchRateLimitStore?: RateLimitStore;",
    "public professionals search injectable store option",
  );
  assertContains(
    source,
    "detailRateLimitStore?: RateLimitStore;",
    "public professionals detail injectable store option",
  );
  assertContains(
    source,
    "config.store ?? createMemoryRateLimitStore();",
    "public professionals memory fallback store",
  );
  assertContainsInOrder(
    source,
    [
      "const searchRateLimit = createFixedWindowRateLimit({",
      "PUBLIC_PROFESSIONALS_SEARCH_RATE_LIMIT_WINDOW_MS",
      "PUBLIC_PROFESSIONALS_SEARCH_RATE_LIMIT_MAX_ATTEMPTS",
      "PUBLIC_PROFESSIONALS_SEARCH_RATE_LIMIT_ERROR_MESSAGE",
      "store: options.searchRateLimitStore",
      "const detailRateLimit = createFixedWindowRateLimit({",
      "PUBLIC_PROFESSIONAL_DETAIL_RATE_LIMIT_WINDOW_MS",
      "PUBLIC_PROFESSIONAL_DETAIL_RATE_LIMIT_MAX_ATTEMPTS",
      "PUBLIC_PROFESSIONAL_DETAIL_RATE_LIMIT_ERROR_MESSAGE",
      "store: options.detailRateLimitStore",
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
  const application = readSource(
    "server/features/report-access/application/public-report-access-operations.ts",
  );

  assertContains(
    source,
    'from "../lib/public-report-access-rate-limit.ts"',
    "public report access rate limit import",
  );
  assertContains(
    source,
    "publicReportAccessRateLimitStore?: RateLimitStore;",
    "public report access injectable store option",
  );
  assertContains(
    source,
    "publicReportAccessRateLimitStore: createPersistentRateLimitStore({",
    "public report access persistent default store",
  );
  assertContainsInOrder(
    source,
    [
      "const accessEntry = await consumeRateLimitAttempt(",
      "if (accessEntry.count > publicReportAccessRateLimitMaxAttempts) {",
      "setRateLimitHeaders(reply, {",
      "return reply.code(429).send({",
      "error: PUBLIC_REPORT_ACCESS_RATE_LIMIT_ERROR_MESSAGE",
      "const parsed = reportAccessTokenRawTokenSchema.safeParse(request.params.token);",
      "const result = await reportAccess.access(",
    ],
    "public report access rate limit cut-off",
  );
  assertRateLimitHeaders(source, "public report access rate limit headers");
  assertContainsInOrder(
    application,
    [
      "deps.hashSessionToken(rawToken)",
      "deps.getReportAccessTokenWithReportByTokenHash(",
      "deps.recordReportAccessTokenAccess(record.token.id)",
      "const [previewUrl, downloadUrl] = await Promise.all([",
      "await deps.writeAuditLog(auditRequest, {",
    ],
    "public report access application effects",
  );

  assertNotContains(source, "reply.header(\"set-cookie\"", "public report access");
  assertNotContains(source, "LOGIN_RATE_LIMIT", "public report access");
  assertNotContains(
    source,
    "REPORT_ACCESS_TOKEN_MUTATION_RATE_LIMIT",
    "public report access",
  );
});

test("contact rate limit defaults to the persistent store before sending email", () => {
  const source = readSource("server/routes/contact.fastify.ts");

  assertContains(
    source,
    "contactRateLimitStore?: RateLimitStore;",
    "contact rate limit injectable store option",
  );
  assertContains(
    source,
    "contactRateLimitStore: createPersistentRateLimitStore({",
    "contact persistent default store",
  );
  assertContainsInOrder(
    source,
    [
      "const rateLimitEntry = await consumeRateLimitAttempt(",
      "if (rateLimitEntry.count > contactRateLimitMaxAttempts) {",
      "return reply.code(429).send({",
      "result = await deps.sendContactMessageEmail({",
    ],
    "contact rate limit cut-off",
  );
  assertNotContains(
    source,
    "createMemoryRateLimitStore",
    "contact rate limit production composition",
  );
});

test("report access token mutation rate limits cut off before auth and writes", () => {
  for (const scenario of REPORT_ACCESS_TOKEN_MUTATION_ROUTES) {
    const source = readSource(scenario.file);

    assertLegacyTokenMutationRateLimitMarkers(source, scenario);
    assert.deepEqual(
      evaluateReportAccessTokenMutationRateLimitSource(source, scenario.file, scenario.authMarker),
      [],
    );
  }
});

test("mutation proof: token revoke cannot bypass the mutation rate limit via the create handler gate", () => {
  for (const scenario of REPORT_ACCESS_TOKEN_MUTATION_ROUTES) {
    const source = readSource(scenario.file);
    assert.deepEqual(
      evaluateReportAccessTokenMutationRateLimitSource(source, scenario.file, scenario.authMarker),
      [],
    );

    const revokeHead = [
      '}>("/:tokenId/revoke", async (request, reply) => {',
      "    if (!enforceTrustedOrigin(request, reply, allowedOrigins)) {",
      "      return reply;",
      "    }",
      "",
    ];
    const mutated = replaceExactlyOnce(
      source,
      [
        ...revokeHead,
        "    if (!(await applyMutationRateLimit(request, reply))) {",
        "      return reply;",
        "    }",
        "",
      ].join("\n"),
      revokeHead.join("\n"),
    );
    assert.notEqual(mutated, source);
    assert.equal(
      countOccurrences(mutated, "if (!(await applyMutationRateLimit(request, reply))) {"),
      1,
      `${scenario.file}: only the create handler keeps the limiter`,
    );

    // The file-wide ordered markers are satisfied by the create handler alone.
    assertLegacyTokenMutationRateLimitMarkers(mutated, scenario);

    assert.deepEqual(
      evaluateReportAccessTokenMutationRateLimitSource(mutated, scenario.file, scenario.authMarker),
      [`${scenario.file}: patch "/:tokenId/revoke" must apply the mutation rate limit before auth`],
    );
  }
});

test("mutation proof: commented-out revoke limiter text cannot satisfy the executable gate", () => {
  const revokeHead =
    '}>("/:tokenId/revoke", async (request, reply) => {\n    if (!enforceTrustedOrigin(request, reply, allowedOrigins)) {\n      return reply;\n    }\n\n';
  const gate = "    if (!(await applyMutationRateLimit(request, reply))) {\n      return reply;\n    }\n";
  // Own-line, same-line and block comments are distinct trivia ranges; the raw-text matcher
  // accepted all of them.
  const commentedGates = {
    "line comment": `${revokeHead}    // ${MUTATION_LIMITER_GATE}\n`,
    "trailing comment": `${revokeHead.slice(0, -2)} // ${MUTATION_LIMITER_GATE}\n\n`,
    "block comment": `${revokeHead}    /*\n${gate}    */\n`,
  };

  for (const scenario of REPORT_ACCESS_TOKEN_MUTATION_ROUTES) {
    const source = readSource(scenario.file);

    for (const [kind, commented] of Object.entries(commentedGates)) {
      const mutated = replaceExactlyOnce(source, `${revokeHead}${gate}`, commented);
      const context = `${scenario.file} ${kind}`;

      assert.equal(
        countOccurrences(mutated.split(/\s+/).join(" "), MUTATION_LIMITER_GATE),
        2,
        `${context}: gate text survives in the create handler and the comment`,
      );
      assertLegacyTokenMutationRateLimitMarkers(mutated, scenario);
      assert.deepEqual(
        evaluateReportAccessTokenMutationRateLimitSource(mutated, scenario.file, scenario.authMarker),
        [`${scenario.file}: patch "/:tokenId/revoke" must apply the mutation rate limit before auth`],
        context,
      );
    }
  }
});

test("token mutation rate limit evaluator fails closed on reordered duplicated or unregistered handlers", () => {
  const scenario = REPORT_ACCESS_TOKEN_MUTATION_ROUTES[0];
  const source = readSource(scenario.file);
  const gate = [
    "    if (!(await applyMutationRateLimit(request, reply))) {",
    "      return reply;",
    "    }",
    "",
    "",
  ].join("\n");
  const revokeAuth = `${gate}    ${scenario.authMarker}\n\n    if (!clinicAuth) {\n      return reply;\n    }\n\n    const auth = getReportAccessTokenAuthorization(clinicAuth);\n\n    if (!requireReportAccessTokenManagementPermission(auth, reply)) {\n      return reply;\n    }\n\n    const tokenId = parseEntityId(`;
  const revokeViolation = `${scenario.file}: patch "/:tokenId/revoke" must apply the mutation rate limit before auth`;

  const cases = [
    {
      name: "revoke limiter moved after auth",
      mutated: replaceExactlyOnce(
        source,
        revokeAuth,
        revokeAuth.replace(gate, "").replace("    const tokenId = parseEntityId(", `${gate}    const tokenId = parseEntityId(`),
      ),
      expected: [revokeViolation],
    },
    {
      name: "revoke limiter duplicated",
      mutated: replaceExactlyOnce(source, revokeAuth, `${gate}${revokeAuth}`),
      expected: [revokeViolation],
    },
    {
      name: "revoke handler registered outside the recognized shape",
      mutated: replaceExactlyOnce(source, "app.patch<{", "app.route<{"),
      expected: [
        `${scenario.file}: mutating handlers must be exactly ${EXPECTED_TOKEN_MUTATION_HANDLERS.join(", ")}`,
      ],
    },
    {
      name: "revoke handler written with unrecognized syntax",
      mutated: replaceExactlyOnce(
        source,
        '}>("/:tokenId/revoke", async (request, reply) => {',
        '}>("/:tokenId/revoke", async function (request, reply) {',
      ),
      expected: [
        `${scenario.file}: app.patch handler structure is ambiguous`,
        `${scenario.file}: mutating handlers must be exactly ${EXPECTED_TOKEN_MUTATION_HANDLERS.join(", ")}`,
      ],
    },
    {
      name: "extra mutating handler without limiter",
      mutated: replaceExactlyOnce(
        source,
        "  app.patch<{",
        '  app.delete("/:tokenId", async (request, reply) => {\n    return reply.code(204).send();\n  });\n\n  app.patch<{',
      ),
      expected: [
        `${scenario.file}: delete "/:tokenId" must apply the mutation rate limit before auth`,
        `${scenario.file}: mutating handlers must be exactly ${EXPECTED_TOKEN_MUTATION_HANDLERS.join(", ")}`,
      ],
    },
    {
      name: "unterminated comment hides the revoke handler",
      mutated: replaceExactlyOnce(source, "  app.patch<{", "  /* app.patch<{"),
      expected: [`${scenario.file}: source must parse as TypeScript before evaluation`],
    },
  ];

  for (const { name, mutated, expected } of cases) {
    assert.notEqual(mutated, source, name);
    assert.deepEqual(
      evaluateReportAccessTokenMutationRateLimitSource(mutated, scenario.file, scenario.authMarker),
      expected,
      name,
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
    "test/integration/adapters/controllers/public-professionals-logging-invariants.test.ts",
    "test/unit/infrastructure/request-logger.test.ts",
  ] as const) {
    const source = readSource(file);
    assertContains(source, "RATE_LIMITED", `${file} runtime marker coverage`);
  }
});

test("runtime rate limit tests remain explicit for isolated public and mutation buckets", () => {
  const publicProfessionals = readSource("test/public-professionals.fastify.test.ts");
  const publicProfessionalsResponseHeaders = readSource(
    "test/integration/adapters/controllers/public-professionals-response-headers-invariants.test.ts",
  );
  const publicReportAccess = readSource("test/public-report-access.fastify.test.ts");
  const reportAccessTokens = readSource("test/report-access-tokens.fastify.test.ts");
  const adminReportAccessTokens = readSource(
    "test/admin-report-access-tokens.fastify.test.ts",
  );
  const productionInvariants = readSource("test/architecture/security/security-production-invariants.test.ts");

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
  const source = readSource("test/architecture/security/security-rate-limit-isolation-boundaries.test.ts");
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
