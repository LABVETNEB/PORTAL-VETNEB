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
  assert.ok(source.includes("export const PUBLIC_API_CONFIGURATION_ERROR_MESSAGE ="));
  assert.ok(source.includes("El servicio público no está configurado para recibir solicitudes."));
  assert.ok(source.includes("export function resolveApiBaseUrlForRuntime("));
  assert.ok(source.includes("const nodeEnv = input.nodeEnv ?? process.env.NODE_ENV ?? \"development\";"));
  assert.ok(source.includes("if (!nextPublicApiUrl) {"));
  assert.ok(source.includes("if (isDevelopment) {"));
  assert.ok(source.includes("return LOCAL_DEVELOPMENT_API_BASE_URL;"));
  assert.ok(source.includes("throw new Error(PUBLIC_API_CONFIGURATION_ERROR_MESSAGE);"));
  assert.ok(source.includes("if (!isDevelopment && isLocalOrLanHostname(parsedUrl.hostname)) {"));
  assert.ok(source.includes("async function apiFetch<T>("));
  assert.ok(source.includes("path: string,"));
  assert.ok(source.includes("options: RequestInit = {},"));
  assert.ok(source.includes("export const BACKEND_CONNECTION_ERROR_MESSAGE ="));
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

  assert.ok(source.includes("if (!res.ok) {"));
  assert.ok(source.includes("const body = (await res.json().catch(() => ({}))) as {"));
  assert.ok(source.includes("error?: unknown;"));
  assert.ok(source.includes("message?: unknown;"));
  assert.ok(source.includes("const backendMessage ="));
  assert.ok(source.includes("throw new Error(backendMessage ?? `HTTP ${res.status}`);"));
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
