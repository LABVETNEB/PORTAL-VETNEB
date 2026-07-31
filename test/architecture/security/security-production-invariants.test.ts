import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

function assertContains(source: string, expected: string, file: string): void {
  assert.ok(
    source.includes(expected),
    `${file}: falta invariant esperado: ${expected}`,
  );
}

function assertNotContains(source: string, forbidden: string, file: string): void {
  assert.ok(
    !source.includes(forbidden),
    `${file}: no debe contener invariant prohibido: ${forbidden}`,
  );
}

const authRouteFiles = [
  "server/routes/auth.fastify.ts",
  "server/routes/admin-auth.fastify.ts",
  "server/routes/particular-auth.fastify.ts",
] as const;

const logisticsRouteFiles = [
  "server/routes/logistics-field-visits.fastify.ts",
  "server/routes/logistics-route-events.fastify.ts",
  "server/routes/logistics-route-plans.fastify.ts",
] as const;

const logisticsSlaReadOnlyRouteFiles = [
  "server/routes/logistics-sla.fastify.ts",
] as const;

const blockNullCorsRouteFiles = [
  "server/routes/particular-study-tracking.fastify.ts",
  "server/routes/study-tracking.fastify.ts",
] as const;

const clinicSessionCookieRouteFiles = [
  "server/routes/auth.fastify.ts",
  "server/routes/clinic-audit.fastify.ts",
] as const;

test("ENV mantiene cookies de sesión separadas y política productiva segura", () => {
  const file = "server/lib/env.ts";
  const source = read(file);

  assertContains(
    source,
    'cookieName: rawEnv.COOKIE_NAME ?? "app_session_id"',
    file,
  );
  assertContains(
    source,
    'adminCookieName: rawEnv.ADMIN_COOKIE_NAME ?? "admin_session_id"',
    file,
  );
  assertContains(
    source,
    'rawEnv.PARTICULAR_COOKIE_NAME ?? "particular_session_id"',
    file,
  );

  assertContains(source, 'cookieSecure: nodeEnv === "production"', file);
  assertContains(
    source,
    'cookieSameSite: (nodeEnv === "production" ? "none" : "lax")',
    file,
  );

  assertContains(
    source,
    "TRUST_PROXY: z.coerce.number().int().min(0).max(10).optional()",
    file,
  );
  assertContains(source, "trustProxy: rawEnv.TRUST_PROXY ?? 1", file);
});

test("las rutas de auth serializan cookies HttpOnly, Path=/, SameSite y Secure condicional", () => {
  for (const file of authRouteFiles) {
    const source = read(file);

    assertContains(source, "function serializeCookie(input:", file);
    assertContains(source, '"Path=/"', file);
    assertContains(source, '"HttpOnly"', file);
    assertContains(source, "`SameSite=${ENV.cookieSameSite}`", file);
    assertContains(source, "if (ENV.cookieSecure)", file);
    assertContains(source, 'parts.push("Secure");', file);
    assertContains(source, "maxAgeSeconds: ENV.sessionTtlHours * 60 * 60", file);
    assertContains(
      source,
      'expires: "Thu, 01 Jan 1970 00:00:00 GMT"',
      file,
    );
  }
});
test("rutas clinic-scoped que limpian sesión usan contrato central ENV", () => {
  for (const file of clinicSessionCookieRouteFiles) {
    const source = read(file);

    assertContains(source, 'import { ENV } from "../lib/env.ts";', file);
    assertContains(source, "function serializeCookie(input:", file);
    assertContains(source, '"Path=/"', file);
    assertContains(source, '"HttpOnly"', file);
    assertContains(source, "`SameSite=${ENV.cookieSameSite}`", file);
    assertContains(source, "if (ENV.cookieSecure)", file);
    assertContains(source, 'parts.push("Secure");', file);
    assertContains(source, 'expires: "Thu, 01 Jan 1970 00:00:00 GMT"', file);
    assertNotContains(source, "process.env.COOKIE_NAME", file);
    assertNotContains(source, "process.env.COOKIE_SAME_SITE", file);
    assertNotContains(source, "process.env.COOKIE_SECURE", file);
  }
});

test("cada dominio de sesión lee y escribe únicamente su cookie correspondiente", () => {
  const clinicAuth = read("server/routes/auth.fastify.ts");
  assertContains(clinicAuth, "cookies[ENV.cookieName]", "auth.fastify.ts");
  assertContains(clinicAuth, "name: ENV.cookieName", "auth.fastify.ts");
  assertNotContains(
    clinicAuth,
    "cookies[ENV.adminCookieName]",
    "auth.fastify.ts",
  );
  assertNotContains(
    clinicAuth,
    "cookies[ENV.particularCookieName]",
    "auth.fastify.ts",
  );

  const clinicAudit = read("server/routes/clinic-audit.fastify.ts");
  assertContains(
    clinicAudit,
    "cookies[ENV.cookieName]",
    "clinic-audit.fastify.ts",
  );
  assertContains(
    clinicAudit,
    "name: ENV.cookieName",
    "clinic-audit.fastify.ts",
  );
  assertNotContains(
    clinicAudit,
    "cookies[ENV.adminCookieName]",
    "clinic-audit.fastify.ts",
  );
  assertNotContains(
    clinicAudit,
    "cookies[ENV.particularCookieName]",
    "clinic-audit.fastify.ts",
  );
  assertNotContains(
    clinicAudit,
    '"vetneb_session"',
    "clinic-audit.fastify.ts",
  );

  const adminAuth = read("server/routes/admin-auth.fastify.ts");
  const adminFastifyAuth = read("server/lib/fastify-admin-auth.ts");
  assertContains(
    adminFastifyAuth,
    "cookies[ENV.adminCookieName]",
    "fastify-admin-auth.ts",
  );
  assertContains(
    adminFastifyAuth,
    "name: ENV.adminCookieName",
    "fastify-admin-auth.ts",
  );
  assertContains(adminAuth, "authenticateFastifyAdmin", "admin-auth.fastify.ts");
  assertContains(adminAuth, "name: ENV.adminCookieName", "admin-auth.fastify.ts");
  assertNotContains(
    adminFastifyAuth,
    "cookies[ENV.cookieName]",
    "fastify-admin-auth.ts",
  );
  assertNotContains(
    adminFastifyAuth,
    "cookies[ENV.particularCookieName]",
    "fastify-admin-auth.ts",
  );

  const particularAuth = read("server/routes/particular-auth.fastify.ts");
  assertContains(
    particularAuth,
    "cookies[ENV.particularCookieName]",
    "particular-auth.fastify.ts",
  );
  assertContains(
    particularAuth,
    "name: ENV.particularCookieName",
    "particular-auth.fastify.ts",
  );
  assertNotContains(
    particularAuth,
    "cookies[ENV.cookieName]",
    "particular-auth.fastify.ts",
  );
  assertNotContains(
    particularAuth,
    "cookies[ENV.adminCookieName]",
    "particular-auth.fastify.ts",
  );
});

test("origin/CORS bloquea métodos inseguros con Origin no permitido y no usa wildcard credentials", () => {
  const corsHelper = read("server/lib/cors-headers.ts");

  assertContains(
    corsHelper,
    'export const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);',
    "server/lib/cors-headers.ts",
  );
  assertContains(
    corsHelper,
    "export function normalizeOrigin(value: string): string | null",
    "server/lib/cors-headers.ts",
  );
  assertContains(
    corsHelper,
    "new URL(value).origin.trim().toLowerCase()",
    "server/lib/cors-headers.ts",
  );
  assertContains(
    corsHelper,
    "export function getRequestOrigin(request: FastifyRequest): string | null",
    "server/lib/cors-headers.ts",
  );
  assertContains(
    corsHelper,
    "export function enforceTrustedOrigin(",
    "server/lib/cors-headers.ts",
  );
  assertContains(corsHelper, "if (!requestOrigin", "server/lib/cors-headers.ts");
  assertContains(
    corsHelper,
    "if (!requestOrigin || allowedOrigins.has(requestOrigin))",
    "server/lib/cors-headers.ts",
  );
  assertContains(
    corsHelper,
    "export function enforceTrustedOriginRequired(",
    "server/lib/cors-headers.ts",
  );
  assertContains(
    corsHelper,
    "if (requestOrigin && allowedOrigins.has(requestOrigin))",
    "server/lib/cors-headers.ts",
  );
  assertContains(
    corsHelper,
    'error: "Origen no permitido"',
    "server/lib/cors-headers.ts",
  );

  for (const file of authRouteFiles) {
    const source = read(file);

    assertContains(
      source,
      'from "../lib/cors-headers.ts";',
      file,
    );
    assertContains(source, "  enforceTrustedOrigin,", file);
    assertContains(source, "  getAllowedOriginForCors,", file);
    assertContains(source, "  getAllowedOrigins,", file);
    assertContains(source, "  getRequestOrigin,", file);
    assertContains(source, "function applyCorsHeaders(", file);
    assertNotContains(
      source,
      'const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);',
      file,
    );
    assertNotContains(
      source,
      "function getAllowedOrigins(): string[]",
      file,
    );
    assertNotContains(
      source,
      "function normalizeOrigin(value: string): string | null",
      file,
    );
    assertNotContains(
      source,
      "function getRequestOrigin(request: FastifyRequest): string | null",
      file,
    );
    assertNotContains(source, "function enforceTrustedOrigin(", file);
    assertContains(source, 'error: "Origen no permitido"', file);
    assertContains(source, 'reply.header("vary", "Origin")', file);
    assertContains(source, 'reply.header("access-control-allow-origin", allowedOrigin)', file);
    assertContains(source, 'reply.header("access-control-allow-credentials", "true")', file);
    assertNotContains(source, 'access-control-allow-origin", "*"', file);
  }

  for (const file of logisticsRouteFiles) {
    const source = read(file);

    assertContains(
      source,
      'from "../lib/cors-headers.ts";',
      file,
    );
    assertContains(source, "  UNSAFE_METHODS,", file);
    assertContains(source, "  enforceTrustedOrigin,", file);
    assertContains(source, "  getAllowedOriginForCors,", file);
    assertContains(source, "  getAllowedOrigins,", file);
    assertContains(source, "  getRequestOrigin,", file);
    assertContains(source, "function applyCorsHeaders(", file);
    assertContains(
      source,
      "UNSAFE_METHODS.has(request.method.toUpperCase())",
      file,
    );
    assertNotContains(
      source,
      'const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);',
      file,
    );
    assertNotContains(
      source,
      "function getAllowedOrigins(): string[]",
      file,
    );
    assertNotContains(
      source,
      "function normalizeOrigin(value: string): string | null",
      file,
    );
    assertNotContains(
      source,
      "function getRequestOrigin(request: FastifyRequest): string | null",
      file,
    );
    assertNotContains(source, "function enforceTrustedOrigin(", file);
    assertContains(source, 'error: "Origen no permitido"', file);
    assertContains(source, 'reply.header("vary", "Origin")', file);
    assertContains(source, 'reply.header("access-control-allow-origin", allowedOrigin)', file);
    assertContains(source, 'reply.header("access-control-allow-credentials", "true")', file);
    assertNotContains(source, 'access-control-allow-origin", "*"', file);
  }

  for (const file of logisticsSlaReadOnlyRouteFiles) {
    const source = read(file);

    assertContains(
      source,
      'from "../lib/cors-headers.ts";',
      file,
    );
    assertContains(source, "  getAllowedOriginForCors,", file);
    assertContains(source, "  getAllowedOrigins,", file);
    assertContains(source, "  getRequestOrigin,", file);
    assertContains(source, "function applyCorsHeaders(", file);
    assertContains(
      source,
      'reply.header("access-control-allow-methods", "GET,OPTIONS")',
      file,
    );
    assertNotContains(source, "UNSAFE_METHODS", file);
    assertNotContains(source, "enforceTrustedOrigin,", file);
    assertNotContains(source, "enforceTrustedOrigin(", file);
    assertNotContains(
      source,
      "function getAllowedOrigins(): string[]",
      file,
    );
    assertNotContains(
      source,
      "function normalizeOrigin(value: string): string | null",
      file,
    );
    assertNotContains(source, "function getOriginHeader(", file);
    assertNotContains(source, "function getAllowedOriginForCors(", file);
    assertNotContains(
      source,
      "function getRequestOrigin(request: FastifyRequest): string | null",
      file,
    );
    assertContains(source, 'error: "Origen no permitido"', file);
    assertContains(source, 'reply.header("vary", "Origin")', file);
    assertContains(source, 'reply.header("access-control-allow-origin", allowedOrigin)', file);
    assertContains(source, 'reply.header("access-control-allow-credentials", "true")', file);
    assertNotContains(source, 'access-control-allow-origin", "*"', file);
  }

  for (const file of blockNullCorsRouteFiles) {
    const source = read(file);

    assertContains(
      source,
      'from "../lib/cors-headers.ts";',
      file,
    );
    assertContains(source, "  enforceTrustedOriginRequired as enforceTrustedOrigin,", file);
    assertContains(source, "  getAllowedOriginForCors,", file);
    assertContains(source, "  getAllowedOrigins,", file);
    assertContains(source, "  getRequestOrigin,", file);
    assertContains(source, "function applyCorsHeaders(", file);
    assertNotContains(
      source,
      'const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);',
      file,
    );
    assertNotContains(
      source,
      "function getAllowedOrigins(): string[]",
      file,
    );
    assertNotContains(
      source,
      "function normalizeOrigin(value: string): string | null",
      file,
    );
    assertNotContains(source, "function getOriginHeader(", file);
    assertNotContains(source, "function getAllowedOriginForCors(", file);
    assertNotContains(
      source,
      "function getRequestOrigin(request: FastifyRequest): string | null",
      file,
    );
    assertNotContains(source, "function enforceTrustedOrigin(", file);
    assertContains(source, 'error: "Origen no permitido"', file);
    assertContains(source, 'reply.header("vary", "Origin")', file);
    assertContains(source, 'reply.header("access-control-allow-origin", allowedOrigin)', file);
    assertContains(source, 'reply.header("access-control-allow-credentials", "true")', file);
    assertNotContains(source, 'access-control-allow-origin", "*"', file);
  }

  const middlewareFile = "server/middlewares/trusted-origin.ts";
  const middlewareSource = read(middlewareFile);

  assertContains(
    middlewareSource,
    'const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);',
    middlewareFile,
  );
  assertContains(
    middlewareSource,
    "new URL(value).origin.trim().toLowerCase()",
    middlewareFile,
  );
  assertContains(middlewareSource, 'error: "Origen no permitido"', middlewareFile);

  const fastifyAppFile = "server/fastify-app.ts";
  const fastifyAppSource = read(fastifyAppFile);
  assertContains(
    fastifyAppSource,
    'import { requireTrustedOriginForFastify } from "./middlewares/trusted-origin.ts";',
    fastifyAppFile,
  );
  assertContains(
    fastifyAppSource,
    'app.addHook("onRequest", requireTrustedOriginForFastify);',
    fastifyAppFile,
  );
});

test("Fastify usa trust proxy configurado por ENV y no hardcodea proxies productivos", () => {
  const file = "server/fastify-app.ts";
  const source = read(file);

  assertContains(source, "trustProxy: ENV.trustProxy", file);
  assertNotContains(source, "trustProxy: true", file);
  assertNotContains(source, "trustProxy: false", file);
});

test("errores internos se loguean, pero la respuesta 500 no expone detalles", () => {
  const file = "server/fastify-app.ts";
  const source = read(file);

  assertContains(source, "app.setErrorHandler((error, request, reply) => {", file);
  assertContains(source, 'logError("API_ERROR", {', file);
  assertContains(source, "errorName: serializeError(error).name", file);
  assertNotContains(source, 'console.error("[API ERROR]"', file);
  assertNotContains(source, "\n      error,\n", file);
  assertContains(
    source,
    'error: status >= 500 ? "Error interno del servidor" : message',
    file,
  );
  assertContains(
    source,
    "details: status >= 500 ? undefined : message",
    file,
  );
  assertContains(source, "function getFastifyErrorResponsePath", file);
  assertContains(source, "path: getFastifyErrorResponsePath(request)", file);
});

test("logs de request sanitizan tokens y accesos públicos antes de escribir consola", () => {
  const loggerFile = "server/middlewares/request-logger.ts";
  const loggerSource = read(loggerFile);

  assertContains(loggerSource, "export function sanitizeUrlForLogs(url: string): string", loggerFile);
  assertContains(loggerSource, "\\/api\\/public\\/report-access\\/", loggerFile);
  assertContains(loggerSource, "[REDACTED]", loggerFile);
  assertContains(loggerSource, "token|reportAccessToken", loggerFile);
  assertContains(loggerSource, "RATE_LIMITED", loggerFile);
  assertContains(loggerSource, "HTTP_REQUEST_COMPLETED", loggerFile);

  // El access log ya no deriva ninguna dimension de la URL real: la unica
  // dimension de ruta es el template Fastify normalizado.
  for (const file of authRouteFiles) {
    const source = read(file);

    assertContains(source, "logRequestCompletion({", file);
    assertContains(source, "routeTemplate: request.routeOptions?.url", file);
    assertContains(source, "requestId: request.id", file);
    assertNotContains(source, "console.log(", file);
    assertNotContains(source, "sanitizeUrlForLogs", file);
    assertNotContains(source, "url: safeUrl", file);
  }
});

test("frontend CSP report route file is at the correct App Router path and exports required handlers", () => {
  // Production invariant: if frontend/src/app/api/security/csp-report/route.ts is
  // moved or renamed, the production URL /api/security/csp-report silently changes.
  // Browsers sending CSP reports would get 404s without any test failure in the
  // endpoint contract tests (which import by absolute path, not by URL).
  const ROUTE_FILE = "frontend/src/app/api/security/csp-report/route.ts";
  const routeSource = read(ROUTE_FILE);

  assert.ok(routeSource.length > 0, `${ROUTE_FILE} must exist and be non-empty`);
  assertContains(routeSource, "export async function POST(", ROUTE_FILE);
  assertContains(routeSource, "{ status: 204 }", ROUTE_FILE);
  assertContains(routeSource, "{ status: 405, headers:", ROUTE_FILE);

  // Verify the CSP_REPORT_URI_PATH constant in csp-policy.ts still matches
  // the App Router file path segment. A drift here means the header points
  // browsers to an endpoint that no longer exists at the declared URL.
  const cspPolicyFile = "frontend/src/lib/security/csp-policy.ts";
  const cspPolicySource = read(cspPolicyFile);
  assertContains(
    cspPolicySource,
    'CSP_REPORT_URI_PATH = "/api/security/csp-report"',
    cspPolicyFile,
  );
});

test("next.config.ts declara Content-Security-Policy-Report-Only y no el enforcing", () => {
  // Production invariant: Report-Only must always be emitted.
  // Enforcing Content-Security-Policy must remain absent until a dedicated PR
  // with violation evidence is opened (see docs/security/csp-reporting-rollout.md).
  const file = "frontend/next.config.ts";
  const source = read(file);

  assertContains(source, 'key: "Content-Security-Policy-Report-Only"', file);

  // 'key: "Content-Security-Policy"' with a closing quote is NOT a substring of
  // 'key: "Content-Security-Policy-Report-Only"', so this guard is unambiguous.
  assertNotContains(source, 'key: "Content-Security-Policy"', file);
});

test("docs/security/csp-reporting-rollout.md contiene términos críticos de enforcement readiness", () => {
  // Contract: the rollout doc must not lose critical terms that gate enforcement.
  // If any term is missing, Section 9 (pre-enforcement checklist) has been eroded.
  const file = "docs/security/csp-reporting-rollout.md";
  const source = read(file);

  const criticalTerms = [
    "Content-Security-Policy-Report-Only",
    "Content-Security-Policy",
    "Report-Only",
    "/api/security/csp-report",
    "report-uri",
    "report-to",
    "Reporting-Endpoints",
    "nonce",
    "unsafe-inline",
    "unsafe-eval",
    "preload",
    "rollback",
    "pre-enforcement",
  ];

  for (const term of criticalTerms) {
    assertContains(source, term, file);
  }
});
