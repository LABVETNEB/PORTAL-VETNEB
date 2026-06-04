import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
    label: "clinic",
    files: [
      "server/routes/auth.fastify.ts",
      "server/routes/clinic-audit.fastify.ts",
      "server/routes/clinic-public-profile.fastify.ts",
      "server/routes/logistics-field-visits.fastify.ts",
      "server/routes/logistics-route-events.fastify.ts",
      "server/routes/logistics-route-plans.fastify.ts",
      "server/routes/logistics-sla.fastify.ts",
      "server/routes/particular-tokens.fastify.ts",
      "server/routes/report-access-tokens.fastify.ts",
      "server/routes/reports.fastify.ts",
      "server/routes/reports-status.fastify.ts",
      "server/routes/study-tracking.fastify.ts",
    ],
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
  assertContains(
    publicReportAccess,
    "reportAccessTokenRawTokenSchema.safeParse",
    "public report access token validation",
  );
  assertContains(
    publicReportAccess,
    "hashSessionToken(parsed.data)",
    "public report access token hashing",
  );
});

test("session cookie names remain separated across backend and dashboard proxy", () => {
  const envSource = read("server/lib/env.ts");
  const middlewareSource = read("frontend/src/proxy.ts");

  assertContains(envSource, 'cookieName: rawEnv.COOKIE_NAME ?? "app_session_id"', "env clinic cookie");
  assertContains(
    envSource,
    'adminCookieName: rawEnv.ADMIN_COOKIE_NAME ?? "admin_session_id"',
    "env admin cookie",
  );
  assertContains(envSource, "PARTICULAR_COOKIE_NAME", "env particular cookie");

  assertContains(
    middlewareSource,
    'const CLINIC_SESSION_COOKIE_NAME = "app_session_id"',
    "frontend clinic cookie",
  );
  assertContains(
    middlewareSource,
    'const ADMIN_SESSION_COOKIE_NAME = "admin_session_id"',
    "frontend admin cookie",
  );
  assertContains(
    middlewareSource,
    "ADMIN_DASHBOARD_PATH_PREFIX",
    "frontend admin dashboard boundary",
  );
  assertContains(
    middlewareSource,
    'return new NextResponse("Not Found", { status: 404 })',
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

test("global auth boundary guardrail source stays ascii only", () => {
  const source = read("test/global-auth-boundary-contract.test.ts");

  for (let index = 0; index < source.length; index += 1) {
    assert.equal(
      source.charCodeAt(index) <= 0x7f,
      true,
      `global auth boundary source must stay ascii-only at index ${index}`,
    );
  }
});
