import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const API_CLIENT_PATH = "frontend/src/lib/api.ts";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("frontend API client resolves backend base URL with explicit public safeguards", () => {
  const source = read(API_CLIENT_PATH);

  assert.ok(source.includes("const LOCAL_DEVELOPMENT_API_BASE_URL = \"http://localhost:3000\";"));
  assert.ok(source.includes('const SAME_ORIGIN_API_BASE_URL = "";'));
  assert.ok(source.includes("export const PUBLIC_API_CONFIGURATION_ERROR_MESSAGE ="));
  assert.ok(source.includes("El servicio público no está configurado para recibir solicitudes."));
  assert.ok(source.includes("export function resolveApiBaseUrlForRuntime("));
  assert.ok(source.includes("const nodeEnv = input.nodeEnv ?? process.env.NODE_ENV ?? \"development\";"));
  assert.ok(source.includes("const isBrowserRuntime ="));
  assert.ok(source.includes("if (isBrowserRuntime) {"));
  assert.ok(source.includes("return SAME_ORIGIN_API_BASE_URL;"));
  assert.ok(source.includes("if (!nextPublicApiUrl) {"));
  assert.ok(source.includes("if (isDevelopment) {"));
  assert.ok(source.includes("return LOCAL_DEVELOPMENT_API_BASE_URL;"));
  assert.ok(source.includes("throw new Error(PUBLIC_API_CONFIGURATION_ERROR_MESSAGE);"));
  assert.ok(source.includes("if (!isDevelopment && isLocalOrLanHostname(parsedUrl.hostname)) {"));
  assert.ok(source.includes("async function apiFetch<T>("));
  assert.ok(source.includes("path: string,"));
  assert.ok(source.includes("options: RequestInit = {},"));
  assert.ok(source.includes("export const BACKEND_CONNECTION_ERROR_MESSAGE ="));

  const browserBranchIndex = source.indexOf("if (isBrowserRuntime) {");
  const missingConfigIndex = source.indexOf("if (!nextPublicApiUrl) {");
  assert.ok(
    browserBranchIndex < missingConfigIndex,
    "browser same-origin branch must run before server API URL validation",
  );
});

test("frontend API client sends cookies by default", () => {
  const source = read(API_CLIENT_PATH);

  assert.ok(source.includes("const apiBaseUrl = resolveApiBaseUrlForRuntime();"));
  assert.ok(source.includes("res = await fetch(`${apiBaseUrl}${path}`, {"));
  assert.ok(source.includes("...options,"));
  assert.ok(source.includes('credentials: options.credentials ?? "include",'));
  assert.ok(source.includes("headers,"));
});

test("frontend API client keeps localhost fallback restricted to development-only", () => {
  const source = read(API_CLIENT_PATH);

  assert.ok(source.includes("function isLocalOrLanHostname(hostname: string): boolean"));
  assert.ok(source.includes('normalizedHost === "localhost"'));
  assert.ok(source.includes('normalizedHost === "127.0.0.1"'));
  assert.ok(source.includes('return normalizedHost.startsWith("192.168.");'));
  assert.ok(source.includes("if (!isDevelopment && isLocalOrLanHostname(parsedUrl.hostname)) {"));
});

test("frontend API client manages JSON content type without overriding FormData", () => {
  const source = read(API_CLIENT_PATH);

  assert.ok(source.includes("const headers = new Headers(options.headers);"));
  assert.ok(source.includes("const hasFormDataBody ="));
  assert.ok(source.includes('typeof FormData !== "undefined" && options.body instanceof FormData;'));
  assert.ok(source.includes("options.body !== undefined &&"));
  assert.ok(source.includes("!hasFormDataBody &&"));
  assert.ok(source.includes('!headers.has("Content-Type")'));
  assert.ok(source.includes('headers.set("Content-Type", "application/json");'));
});

test("frontend API client surfaces backend errors safely", () => {
  const source = read(API_CLIENT_PATH);

  assert.ok(source.includes('import { ApiResponseError } from "@/lib/api-error";'));
  assert.ok(source.includes("if (!res.ok) {"));
  assert.ok(source.includes("const body = (await res.json().catch(() => ({}))) as {"));
  assert.ok(source.includes("error?: unknown;"));
  assert.ok(source.includes("message?: unknown;"));
  assert.ok(source.includes("retryAfterSeconds?: unknown;"));
  assert.ok(source.includes("const backendMessage ="));
  assert.ok(source.includes("if (res.status === 429) {"));
  assert.ok(source.includes("buildRateLimitErrorMessage(retryAfterSeconds)"));
  assert.equal(source.includes("buildRateLimitErrorMessage(backendMessage,"), false);
  assert.ok(source.includes("if (backendMessage) {"));
  assert.ok(
    source.includes(
      "throw new ApiResponseError(res.status, backendMessage);",
    ),
  );
  assert.ok(source.includes("if (res.status >= 500) {"));
  assert.ok(source.includes("throw new ApiResponseError("));
  assert.ok(source.includes("BACKEND_OPERATION_ERROR_MESSAGE,"));
  assert.ok(
    source.includes(
      "throw new ApiResponseError(res.status, `HTTP ${res.status}`);",
    ),
  );
});

test("frontend API client formats 429 rate-limit guidance from headers or JSON metadata", () => {
  const source = read(API_CLIENT_PATH);

  assert.ok(source.includes("export const LOGIN_RATE_LIMIT_CLIENT_ERROR_MESSAGE ="));
  assert.ok(source.includes("Acceso temporalmente restringido. Intent"));
  assert.equal(source.includes("Demasiados intentos"), false);
  assert.equal(source.includes("LOGIN_RATE_LIMIT_HEADERS_MISSING_MESSAGE"), false);
  assert.equal(source.includes("El backend no informó cuándo reintentar"), false);
  assert.equal(source.includes("const LOGIN_RATE_LIMIT_REQUIRED_HEADERS ="), false);
  assert.ok(source.includes("function parseRetryAfterSeconds("));
  assert.ok(source.includes('parseRetryAfterSeconds(headers.get("Retry-After")) ??'));
  assert.ok(source.includes('parseRetryAfterSeconds(headers.get("RateLimit-Reset")) ??'));
  assert.ok(source.includes("parseRetryAfterSeconds(body?.retryAfterSeconds) ??"));
  assert.ok(source.includes("parseRetryAfterSeconds(body?.retryAfter)"));
  assert.ok(source.includes("retryAfterSeconds < 0"));
  assert.equal(source.includes("retryAfterSeconds <= 0"), false);
  assert.equal(source.includes("function isLoginRateLimitPath("), false);
  assert.equal(source.includes("function hasRequiredLoginRateLimitHeaders("), false);
  assert.equal(
    source.includes("!retryAfterSeconds || !hasRequiredLoginRateLimitHeaders"),
    false,
  );
  assert.ok(source.includes("function buildRateLimitErrorMessage("));
  assert.ok(source.includes("retryAfterSeconds === null || retryAfterSeconds === 0"));
  assert.ok(source.includes("Reintente en"));
});

test("frontend API client maps fetch network and CORS errors to operational admin guidance", () => {
  const source = read(API_CLIENT_PATH);

  assert.ok(source.includes("try {"));
  assert.ok(source.includes("} catch (error) {"));
  assert.ok(source.includes("console.warn(`[API] ${path}: ${errorDetail}`);"));
  assert.ok(source.includes("if (error instanceof TypeError) {"));
  assert.ok(source.includes("throw new Error(BACKEND_CONNECTION_ERROR_MESSAGE);"));
  assert.ok(source.includes("No se pudo conectar con el backend. Verifique sesión admin, CORS y despliegue backend/frontend."));
});

test("frontend API client handles empty and JSON responses", () => {
  const source = read(API_CLIENT_PATH);

  assert.ok(source.includes("if (res.status === 204) {"));
  assert.ok(source.includes("return undefined as T;"));
  assert.ok(source.includes("return res.json() as Promise<T>;"));
});

const NEXT_CONFIG_PATH = "frontend/next.config.ts";

test("resolveApiBaseUrlForRuntime retorna NEXT_PUBLIC_API_URL normalizado cuando es válido", () => {
  const source = read(API_CLIENT_PATH);

  assert.ok(
    source.includes("function normalizeApiBaseUrl(value: string): string"),
  );
  assert.ok(source.includes('return value.replace(/\\/+$/, "");'));
  assert.ok(
    source.includes("return normalizeApiBaseUrl(nextPublicApiUrl);"),
    "con NEXT_PUBLIC_API_URL válido debe retornar base absoluta normalizada",
  );
});

test("resolveApiBaseUrlForRuntime usa same-origin en browser para que rewrites preserven cookies de sesión", () => {
  const source = read(API_CLIENT_PATH);

  assert.ok(
    source.includes("const isBrowserRuntime ="),
    "debe detectar runtime browser/server",
  );
  assert.ok(
    source.includes('input.isBrowserRuntime ?? typeof window !== "undefined"'),
    "debe permitir branch explícito de browser en tests y runtime",
  );
  assert.ok(
    source.includes("if (isBrowserRuntime) {"),
    "en browser debe usar base same-origin",
  );
  assert.ok(
    source.includes("return SAME_ORIGIN_API_BASE_URL;"),
    "en browser la base debe resolver al proxy same-origin",
  );
});

test("next.config.ts declara rewrites que proxyan /api/** al backend cuando NEXT_PUBLIC_API_URL está configurado", () => {
  const source = read(NEXT_CONFIG_PATH);

  assert.ok(source.includes("async rewrites()"), "debe exportar rewrites()");
  assert.ok(source.includes('source: "/api/:path*"'), "debe reescribir /api/**");
  assert.ok(
    source.includes("NEXT_PUBLIC_API_URL"),
    "debe leer NEXT_PUBLIC_API_URL para la destination",
  );
  assert.ok(
    source.includes('destination: `${apiUrl}/api/:path*`'),
    "destination debe proxiar al backend",
  );
});

test("resolveApiBaseUrlForRuntime exempts the CI-only local E2E fixture with a fail-closed 4-condition guard", () => {
  const source = read(API_CLIENT_PATH);

  assert.ok(
    source.includes('const E2E_FIXTURE_API_ORIGIN = "http://127.0.0.1:3107";'),
    "must pin the exact E2E fixture origin as a constant",
  );
  assert.ok(
    source.includes(
      "function isE2eLocalFixtureOriginAllowed(origin: string): boolean {",
    ),
  );
  assert.ok(
    source.includes('process.env.NODE_ENV === "production" &&'),
    "exception must require the real (non-injectable) NODE_ENV to be production",
  );
  assert.ok(source.includes('process.env.CI === "true" &&'));
  assert.ok(
    source.includes(
      'process.env.VETNEB_E2E_ALLOW_LOCAL_API === "1" &&',
    ),
  );
  assert.ok(source.includes("origin === E2E_FIXTURE_API_ORIGIN"));

  // The original production guard must remain byte-for-byte untouched: the
  // exception is a preceding early-return, never a rewrite of the throw.
  assert.ok(
    source.includes("if (!isDevelopment && isLocalOrLanHostname(parsedUrl.hostname)) {"),
    "original throw guard must stay intact for the fail-closed default",
  );
  assert.ok(source.includes("throw new Error(PUBLIC_API_CONFIGURATION_ERROR_MESSAGE);"));

  const exceptionIndex = source.indexOf("isE2eLocalFixtureOriginAllowed(parsedUrl.origin)");
  const originalGuardIndex = source.indexOf(
    "if (!isDevelopment && isLocalOrLanHostname(parsedUrl.hostname)) {",
  );
  assert.ok(
    exceptionIndex > 0 && exceptionIndex < originalGuardIndex,
    "the E2E exception must be evaluated before the original throw guard",
  );

  const browserBranchIndex = source.indexOf("if (isBrowserRuntime) {");
  assert.ok(
    browserBranchIndex < exceptionIndex,
    "browser same-origin branch must still run before any server-side URL validation",
  );

  // Only the exact fixture origin is exempt — no localhost, no other port, no LAN IP.
  assert.equal(source.includes('"http://localhost:3107"'), false);
  assert.equal(source.includes('"http://127.0.0.1:3000"'), false);
  assert.equal(
    /origin === "http:\/\/192\.168\./.test(source),
    false,
    "must not special-case any LAN origin",
  );
});

test("next API rewrite contract does not shadow login rate-limit headers", () => {
  const source = read(NEXT_CONFIG_PATH);

  assert.ok(source.includes('source: "/api/:path*"'));
  assert.ok(source.includes('destination: `${apiUrl}/api/:path*`'));

  for (const headerName of [
    "Retry-After",
    "RateLimit-Policy",
    "RateLimit-Limit",
    "RateLimit-Remaining",
    "RateLimit-Reset",
  ]) {
    assert.equal(
      source.includes(`key: "${headerName}"`),
      false,
      `next config must not override ${headerName}`,
    );
  }
});
