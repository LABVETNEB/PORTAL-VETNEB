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
  assertContains(
    adminAuth,
    "cookies[ENV.adminCookieName]",
    "admin-auth.fastify.ts",
  );
  assertContains(
    adminAuth,
    "name: ENV.adminCookieName",
    "admin-auth.fastify.ts",
  );
  assertNotContains(
    adminAuth,
    "cookies[ENV.cookieName]",
    "admin-auth.fastify.ts",
  );
  assertNotContains(
    adminAuth,
    "cookies[ENV.particularCookieName]",
    "admin-auth.fastify.ts",
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
  for (const file of authRouteFiles) {
    const source = read(file);

    assertContains(
      source,
      'const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);',
      file,
    );
    assertContains(source, "function normalizeOrigin(value: string): string | null", file);
    assertContains(source, "new URL(value).origin.trim().toLowerCase()", file);
    assertContains(source, "function getRequestOrigin(request: FastifyRequest): string | null", file);
    assertContains(source, "function enforceTrustedOrigin(", file);
    assertContains(source, "if (!requestOrigin) {", file);
    assertContains(source, "if (allowedOrigins.has(requestOrigin))", file);
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
  assertContains(source, 'console.error("[API ERROR]"', file);
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
  assertContains(source, "path: request.url", file);
});

test("logs de request sanitizan tokens y accesos públicos antes de escribir consola", () => {
  const loggerFile = "server/middlewares/request-logger.ts";
  const loggerSource = read(loggerFile);

  assertContains(loggerSource, "export function sanitizeUrlForLogs(url: string): string", loggerFile);
  assertContains(loggerSource, "\\/api\\/public\\/report-access\\/", loggerFile);
  assertContains(loggerSource, "[REDACTED]", loggerFile);
  assertContains(loggerSource, "token|reportAccessToken", loggerFile);
  assertContains(loggerSource, "RATE_LIMITED", loggerFile);

  for (const file of authRouteFiles) {
    const source = read(file);

    assertContains(source, "sanitizeUrlForLogs(request.url)", file);
    assertContains(source, "url: safeUrl", file);
    assertContains(source, "buildRequestLogLine({", file);
  }
});
