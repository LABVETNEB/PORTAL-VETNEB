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

test("frontend API client uses configured backend base URL with local fallback", () => {
  const source = read(API_CLIENT_PATH);

  assert.ok(source.includes("const API_BASE_URL ="));
  assert.ok(source.includes('process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";'));
  assert.ok(source.includes("async function apiFetch<T>("));
  assert.ok(source.includes("path: string,"));
  assert.ok(source.includes("options: RequestInit = {},"));
});

test("frontend API client sends cookies by default", () => {
  const source = read(API_CLIENT_PATH);

  assert.ok(source.includes("await fetch(`${API_BASE_URL}${path}`, {"));
  assert.ok(source.includes("...options,"));
  assert.ok(source.includes('credentials: options.credentials ?? "include",'));
  assert.ok(source.includes("headers,"));
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
  assert.ok(source.includes("const body = await res.json().catch(() => ({}));"));
  assert.ok(source.includes("throw new Error("));
  assert.ok(source.includes('(body as { error?: string }).error ?? `HTTP ${res.status}`,'));
});

test("frontend API client handles empty and JSON responses", () => {
  const source = read(API_CLIENT_PATH);

  assert.ok(source.includes("if (res.status === 204) {"));
  assert.ok(source.includes("return undefined as T;"));
  assert.ok(source.includes("return res.json() as Promise<T>;"));
});
