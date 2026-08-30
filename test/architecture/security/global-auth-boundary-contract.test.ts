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
