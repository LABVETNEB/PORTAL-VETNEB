import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

type AuthSurface = {
  label: string;
  files: readonly string[];
  markers: readonly string[];
};

const AUTH_SURFACES: readonly AuthSurface[] = [
  {
    label: "admin",
    files: [
      "server/routes/admin-audit.fastify.ts",
      "server/routes/admin-auth.fastify.ts",
      "server/routes/admin-clinics.fastify.ts",
      "server/routes/admin-failed-login-alerts.fastify.ts",
      "server/routes/admin-particular-tokens.fastify.ts",
      "server/routes/admin-pricing.fastify.ts",
      "server/routes/admin-report-access-tokens.fastify.ts",
      "server/routes/admin-report-workflow.fastify.ts",
      "server/routes/admin-reports.fastify.ts",
      "server/routes/admin-sessions.fastify.ts",
      "server/routes/admin-study-tracking.fastify.ts",
      "server/routes/admin-system-health.fastify.ts",
      "server/routes/admin-system-maintenance.fastify.ts",
      "server/routes/admin-system-schema-health.fastify.ts",
      "server/routes/admin-users-roles.fastify.ts",
    ],
    markers: ["authenticateFastifyAdmin"],
  },
  {
    // WBR-08c: all clinic route surfaces now delegate to the canonical
    // clinic auth helper (see "migrated clinic routes" below). No local
    // clinic auth files remain.
    label: "clinic",
    files: [],
    markers: ["authenticateClinicUser"],
  },
  {
    label: "particular",
    files: [
      "server/routes/particular-audit.fastify.ts",
      "server/routes/particular-auth.fastify.ts",
      "server/routes/particular-study-tracking.fastify.ts",
    ],
    markers: ["authenticateParticularUser", "ENV.particularCookieName"],
  },
];

const PUBLIC_ROUTE_FILES = [
  "server/routes/contact.fastify.ts",
  "server/routes/public-pricing.fastify.ts",
  "server/routes/public-professionals.fastify.ts",
  "server/routes/public-report-access.fastify.ts",
] as const;

const RETIRED_EXPRESS_AUTH_MIDDLEWARES = [
  "server/middlewares/auth.ts",
  "server/middlewares/admin-auth.ts",
  "server/middlewares/particular-auth.ts",
  "server/middlewares/clinic-permissions.ts",
] as const;

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

function assertContains(source: string, marker: string, context: string): void {
  assert.ok(source.includes(marker), `${context} must contain ${marker}`);
}

test("global auth boundary keeps route families behind expected authenticators", () => {
  for (const surface of AUTH_SURFACES) {
    for (const file of surface.files) {
      const source = read(file);

      for (const marker of surface.markers) {
        assertContains(source, marker, `${surface.label} ${file}`);
      }
    }
  }
});

test("retired Express auth middleware cannot be restored as test-only coverage", () => {
  for (const file of RETIRED_EXPRESS_AUTH_MIDDLEWARES) {
    assert.equal(existsSync(resolve(process.cwd(), file)), false, file);
  }

  const clinicTests = read("test/integration/adapters/controllers/clinic-audit.fastify.test.ts");
  const adminTests = read("test/integration/adapters/controllers/admin-auth.fastify.test.ts");
  const particularTests = read("test/integration/adapters/controllers/particular-audit.fastify.test.ts");
  const permissionTests = read("test/integration/adapters/controllers/clinic-public-profile.fastify.test.ts");
  const clinicAuthRoute = read("server/routes/auth.fastify.ts");

  assertContains(clinicTests, "Sesi\u00f3n expirada", "clinic Fastify session contract");
  assertContains(adminTests, "adminAuthNativeRoutes expone /me", "admin Fastify session contract");
  assertContains(particularTests, "Token particular inv\u00e1lido o inactivo", "particular Fastify session contract");
  assertContains(permissionTests, "No autorizado para administrar recursos de la clinica", "clinic Fastify permission contract");
  assertContains(clinicAuthRoute, "loginRateLimitStore?: RateLimitStore", "clinic Fastify rate-limit contract");
  assertContains(clinicAuthRoute, "await consumeRateLimitAttempt(", "clinic Fastify atomic rate-limit contract");
});

test("migrated clinic routes consume the canonical clinic auth helper", () => {
  const migratedClinicRoutes = [
    "server/routes/logistics-field-visits.fastify.ts",
    "server/routes/logistics-route-events.fastify.ts",
    "server/routes/logistics-route-plans.fastify.ts",
    "server/routes/logistics-sla.fastify.ts",
    "server/routes/reports.fastify.ts",
    "server/routes/reports-status.fastify.ts",
    "server/routes/report-access-tokens.fastify.ts",
    "server/routes/clinic-audit.fastify.ts",
    "server/routes/clinic-public-profile.fastify.ts",
    "server/routes/study-tracking.fastify.ts",
    "server/routes/particular-tokens.fastify.ts",
    "server/routes/auth.fastify.ts",
  ];

  for (const file of migratedClinicRoutes) {
    const source = read(file);

    assertContains(source, 'from "../lib/fastify-clinic-auth.ts"', file);
    assertContains(source, "authenticateFastifyClinicUser", file);
    assert.equal(source.includes("async function authenticateClinicUser"), false, file);
  }
});

test("public route families do not accept browser session authenticators", () => {
  for (const file of PUBLIC_ROUTE_FILES) {
    const source = read(file);

    assert.equal(
      source.includes("authenticateFastifyAdmin"),
      false,
      `${file} must not accept admin sessions`,
    );
    assert.equal(
      source.includes("authenticateClinicUser"),
      false,
      `${file} must not accept clinic sessions`,
    );
    assert.equal(
      source.includes("authenticateParticularUser"),
      false,
      `${file} must not accept particular sessions`,
    );
  }

  const publicReportAccess = read("server/routes/public-report-access.fastify.ts");
  const publicReportAccessApplication = read(
    "server/features/report-access/application/public-report-access-operations.ts",
  );
  assertContains(
    publicReportAccess,
    "reportAccessTokenRawTokenSchema.safeParse",
    "public report access token validation",
  );
  assertContains(
    publicReportAccessApplication,
    "hashSessionToken(rawToken)",
    "public report access token hashing",
  );
});

test("session cookie names remain separated across backend and dashboard proxy", () => {
  const envSource = read("server/lib/env.ts");
  const middlewareSource = read("frontend/src/proxy.ts");

  // The names are a fixed shared contract (A04 R2): the backend no longer resolves
  // them from env, so the anchor is consumption of the contract, not a literal.
  assertContains(
    envSource,
    'from "../../shared/session-cookie-names.ts"',
    "env imports the shared session cookie contract",
  );
  assertContains(envSource, "cookieName: CLINIC_SESSION_COOKIE_NAME", "env clinic cookie");
  assertContains(envSource, "adminCookieName: ADMIN_SESSION_COOKIE_NAME", "env admin cookie");
  assertContains(
    envSource,
    "particularCookieName: resolveParticularSessionCookieName(",
    "env particular cookie",
  );

  assertContains(
    middlewareSource,
    'from "../../shared/session-cookie-names"',
    "frontend proxy imports the shared session cookie contract",
  );
  assertContains(middlewareSource, "CLINIC_SESSION_COOKIE_NAME", "frontend clinic cookie");
  assertContains(middlewareSource, "ADMIN_SESSION_COOKIE_NAME", "frontend admin cookie");
  assertContains(
    middlewareSource,
    "ADMIN_DASHBOARD_PATH_PREFIX",
    "frontend admin dashboard boundary",
  );
  assertContains(
    middlewareSource,
    "return NextResponse.redirect(loginUrl)",
    "frontend admin dashboard unauth response",
  );
});

test("trusted-origin hook stays global and precedes registered route surfaces", () => {
  const fastifyApp = read("server/fastify-app.ts");
  const trustedOriginIndex = fastifyApp.indexOf(
    'app.addHook("onRequest", requireTrustedOriginForFastify);',
  );
  const firstRouteRegistrationIndex = fastifyApp.indexOf(
    "await app.register(adminAuditNativeRoutes",
  );

  assert.notEqual(trustedOriginIndex, -1);
  assert.notEqual(firstRouteRegistrationIndex, -1);
  assert.ok(
    trustedOriginIndex < firstRouteRegistrationIndex,
    "trusted-origin must be installed before route registration",
  );
  assertContains(fastifyApp, "applyApiRequestIdHeader", "fastify request id hook");
  assertContains(fastifyApp, "applyApiSecurityHeaders", "fastify security header hook");
  assertContains(fastifyApp, "applySensitiveApiNoStoreHeaders", "fastify no-store hook");
});

function walkRouteFiles(dir: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(resolve(process.cwd(), dir), { withFileTypes: true })) {
    const child = `${dir}/${entry.name}`;

    if (entry.isDirectory()) {
      files.push(...walkRouteFiles(child));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(child);
    }
  }

  return files;
}

test("WBR-08c: no server/routes surface reintroduces a local clinic auth helper", () => {
  const violations = walkRouteFiles("server/routes").filter((file) =>
    /\bfunction\s+authenticateClinicUser\s*\(/.test(read(file)),
  );

  assert.deepEqual(
    violations,
    [],
    "clinic auth must be centralized in server/lib/fastify-clinic-auth.ts",
  );
});

const SCHEMA_HEALTH_ROUTE_FILE = "server/routes/admin-system-schema-health.fastify.ts";
const SCHEMA_HEALTH_CONTEXT = `${SCHEMA_HEALTH_ROUTE_FILE} GET /`;
const SCHEMA_HEALTH_HANDLER_HEADER = 'app.get("/",async(request,reply)=>{';
const SCHEMA_HEALTH_AUTH_HELPER_HEADER = "async function authenticateAdminUser(";
const SCHEMA_HEALTH_AUTH_DELEGATION = "return authenticateFastifyAdmin(request,reply,{";
const SCHEMA_HEALTH_AUTH_CALL = "const admin=await authenticateAdminUser(request,reply,deps,now);";
const SCHEMA_HEALTH_NULL_GUARD = /if\(!admin\)(?:\{return reply;\}|return reply;)/g;
const SCHEMA_HEALTH_PROTECTED_CALL = "deps.getSchemaHealthSnapshot()";
const SCHEMA_HEALTH_PROTECTED_INVOCATION = /getSchemaHealthSnapshot[!?.]*\(/g;
const SCHEMA_HEALTH_PROTECTED_BEFORE_AUTH =
  `${SCHEMA_HEALTH_CONTEXT}: protected operation ${SCHEMA_HEALTH_PROTECTED_CALL} starts before admin authentication completes`;
const SCHEMA_HEALTH_PROTECTED_MODULE_WIDE =
  `${SCHEMA_HEALTH_ROUTE_FILE}: expected exactly one protected getSchemaHealthSnapshot invocation module-wide`;

function normalizeForAuthOrder(source: string): string {
  return source
    .replace(/\r\n/g, "\n")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'])\/\/[^\n]*/gm, "$1")
    .replace(/\s+/g, " ")
    .replace(/ ?([(){}[\];,=!.<>:?]) ?/g, "$1")
    .trim();
}

function countOccurrences(source: string, needle: string): number {
  return source.split(needle).length - 1;
}

function extractBlockBody(source: string, openBraceIndex: number): string | null {
  if (source[openBraceIndex] !== "{") {
    return null;
  }

  let depth = 0;

  for (let index = openBraceIndex; index < source.length; index += 1) {
    if (source[index] === "{") {
      depth += 1;
    } else if (source[index] === "}") {
      depth -= 1;

      if (depth === 0) {
        return source.slice(openBraceIndex + 1, index);
      }
    }
  }

  return null;
}

function evaluateSchemaHealthAuthOrder(source: string): string[] {
  const normalized = normalizeForAuthOrder(source);
  const violations: string[] = [];

  const helperStart = normalized.indexOf(SCHEMA_HEALTH_AUTH_HELPER_HEADER);
  const helperBody =
    countOccurrences(normalized, SCHEMA_HEALTH_AUTH_HELPER_HEADER) === 1
      ? extractBlockBody(normalized, normalized.indexOf("{", helperStart))
      : null;

  if (helperBody === null || countOccurrences(helperBody, SCHEMA_HEALTH_AUTH_DELEGATION) !== 1) {
    violations.push(
      `${SCHEMA_HEALTH_ROUTE_FILE}: authenticateAdminUser must be defined once and delegate to authenticateFastifyAdmin`,
    );
  }

  if ([...normalized.matchAll(SCHEMA_HEALTH_PROTECTED_INVOCATION)].length !== 1) {
    violations.push(SCHEMA_HEALTH_PROTECTED_MODULE_WIDE);
  }

  if (countOccurrences(normalized, SCHEMA_HEALTH_HANDLER_HEADER) !== 1) {
    violations.push(`${SCHEMA_HEALTH_CONTEXT}: handler must be locatable exactly once`);
    return violations;
  }

  const body = extractBlockBody(
    normalized,
    normalized.indexOf(SCHEMA_HEALTH_HANDLER_HEADER) + SCHEMA_HEALTH_HANDLER_HEADER.length - 1,
  );

  if (body === null) {
    violations.push(`${SCHEMA_HEALTH_CONTEXT}: handler body must be balanced`);
    return violations;
  }

  const guardMatches = [...body.matchAll(SCHEMA_HEALTH_NULL_GUARD)];

  if (
    countOccurrences(body, "authenticateAdminUser(") !== 1 ||
    countOccurrences(body, SCHEMA_HEALTH_AUTH_CALL) !== 1
  ) {
    violations.push(
      `${SCHEMA_HEALTH_CONTEXT}: expected exactly one authenticateAdminUser(request, reply, deps, now) assignment`,
    );
  }

  if (guardMatches.length !== 1) {
    violations.push(`${SCHEMA_HEALTH_CONTEXT}: expected exactly one missing-admin guard returning reply`);
  }

  if (
    countOccurrences(body, "getSchemaHealthSnapshot") !== 1 ||
    countOccurrences(body, SCHEMA_HEALTH_PROTECTED_CALL) !== 1
  ) {
    violations.push(
      `${SCHEMA_HEALTH_CONTEXT}: expected exactly one protected ${SCHEMA_HEALTH_PROTECTED_CALL} call`,
    );
  }

  if (violations.length > 0) {
    return violations;
  }

  const authIndex = body.indexOf(SCHEMA_HEALTH_AUTH_CALL);
  const guardIndex = guardMatches[0].index;
  const protectedIndex = body.indexOf(SCHEMA_HEALTH_PROTECTED_CALL);

  if (protectedIndex < authIndex) {
    violations.push(SCHEMA_HEALTH_PROTECTED_BEFORE_AUTH);
  } else if (guardIndex < authIndex) {
    violations.push(`${SCHEMA_HEALTH_CONTEXT}: missing-admin guard must follow admin authentication`);
  } else if (protectedIndex < guardIndex) {
    violations.push(
      `${SCHEMA_HEALTH_CONTEXT}: protected operation ${SCHEMA_HEALTH_PROTECTED_CALL} starts before a missing admin is rejected`,
    );
  }

  return violations;
}

function replaceExactlyOnce(source: string, target: string, replacement: string): string {
  assert.equal(countOccurrences(source, target), 1, `mutation target must appear exactly once: ${target}`);
  return source.replace(target, () => replacement);
}

function mutateSchemaHealthSnapshotBeforeAdminAuth(source: string): string {
  const authStatement = "const admin = await authenticateAdminUser(request, reply, deps, now);";
  const withEarlyStart = replaceExactlyOnce(
    source,
    authStatement,
    `const snapshotPromise = deps.getSchemaHealthSnapshot();\n    ${authStatement}`,
  );

  return replaceExactlyOnce(
    withEarlyStart,
    "snapshot = await deps.getSchemaHealthSnapshot();",
    "snapshot = await snapshotPromise;",
  );
}

function mutateSchemaHealthSnapshotInsideAuthHelper(source: string): string {
  const delegation = "  return authenticateFastifyAdmin(request, reply, {";

  return replaceExactlyOnce(
    source,
    delegation,
    `  await deps.getSchemaHealthSnapshot();\n${delegation}`,
  );
}

function mutateSchemaHealthSnapshotUnauthenticatedRoute(source: string): string {
  const optionsRegistration = '  app.options("/", optionsHandler);';

  return replaceExactlyOnce(
    source,
    optionsRegistration,
    `${optionsRegistration}\n\n  app.get("/raw", async () => deps.getSchemaHealthSnapshot());`,
  );
}

function assertMutationKeepsHandlerAnchors(mutated: string): void {
  const normalizedMutated = normalizeForAuthOrder(mutated);

  assert.equal(countOccurrences(normalizedMutated, SCHEMA_HEALTH_HANDLER_HEADER), 1);
  assert.equal(countOccurrences(normalizedMutated, SCHEMA_HEALTH_AUTH_CALL), 1);
  assert.equal([...normalizedMutated.matchAll(SCHEMA_HEALTH_NULL_GUARD)].length, 1);
  assert.equal(countOccurrences(normalizedMutated, SCHEMA_HEALTH_PROTECTED_CALL), 2);
  assert.equal(legacyAdminMarkerCheck(mutated), true);
}

function legacyAdminMarkerCheck(source: string): boolean {
  return source.includes("authenticateFastifyAdmin");
}

test("admin schema-health GET / authenticates the admin before the protected operation", () => {
  assert.deepEqual(evaluateSchemaHealthAuthOrder(read(SCHEMA_HEALTH_ROUTE_FILE)), []);
});

test("mutation proof: schema-health operation started before admin auth is rejected", () => {
  const real = read(SCHEMA_HEALTH_ROUTE_FILE);
  const mutated = mutateSchemaHealthSnapshotBeforeAdminAuth(real);
  const normalizedMutated = normalizeForAuthOrder(mutated);

  assert.notEqual(mutated, real);
  assert.equal(countOccurrences(mutated, SCHEMA_HEALTH_PROTECTED_CALL), 1);
  assert.equal(countOccurrences(normalizedMutated, SCHEMA_HEALTH_AUTH_CALL), 1);
  assert.equal([...normalizedMutated.matchAll(SCHEMA_HEALTH_NULL_GUARD)].length, 1);

  assert.equal(
    legacyAdminMarkerCheck(mutated),
    true,
    "legacy authenticateFastifyAdmin marker check stays green on the mutated source (false-green)",
  );
  assert.deepEqual(evaluateSchemaHealthAuthOrder(mutated), [SCHEMA_HEALTH_PROTECTED_BEFORE_AUTH]);
});

test("mutation proof: schema-health operation inside the admin auth helper is rejected", () => {
  const real = read(SCHEMA_HEALTH_ROUTE_FILE);
  const mutated = mutateSchemaHealthSnapshotInsideAuthHelper(real);

  assert.notEqual(mutated, real);
  assertMutationKeepsHandlerAnchors(mutated);
  assert.deepEqual(evaluateSchemaHealthAuthOrder(mutated), [SCHEMA_HEALTH_PROTECTED_MODULE_WIDE]);
});

test("mutation proof: schema-health operation on a second unauthenticated route is rejected", () => {
  const real = read(SCHEMA_HEALTH_ROUTE_FILE);
  const mutated = mutateSchemaHealthSnapshotUnauthenticatedRoute(real);

  assert.notEqual(mutated, real);
  assertMutationKeepsHandlerAnchors(mutated);
  assert.deepEqual(evaluateSchemaHealthAuthOrder(mutated), [SCHEMA_HEALTH_PROTECTED_MODULE_WIDE]);
});

test("schema-health auth order evaluator fails closed when the handler is not evaluable", () => {
  const real = read(SCHEMA_HEALTH_ROUTE_FILE);
  const relocated = replaceExactlyOnce(
    real,
    'app.get("/", async (request, reply) => {',
    'app.get("/snapshot", async (request, reply) => {',
  );

  assert.deepEqual(evaluateSchemaHealthAuthOrder(relocated), [
    `${SCHEMA_HEALTH_CONTEXT}: handler must be locatable exactly once`,
  ]);
  assert.notDeepEqual(evaluateSchemaHealthAuthOrder(""), []);
});

test("global auth boundary guardrail source stays ascii only", () => {
  const source = read("test/architecture/security/global-auth-boundary-contract.test.ts");

  for (let index = 0; index < source.length; index += 1) {
    assert.equal(
      source.charCodeAt(index) <= 0x7f,
      true,
      `global auth boundary source must stay ascii-only at index ${index}`,
    );
  }
});
