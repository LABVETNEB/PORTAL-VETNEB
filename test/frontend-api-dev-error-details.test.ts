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

function getBetween(
  source: string,
  startToken: string,
  endToken: string,
): string {
  const start = source.indexOf(startToken);
  const end = source.indexOf(endToken, start + startToken.length);

  if (start === -1 || end === -1 || end <= start) {
    return "";
  }

  return source.slice(start, end);
}

test("frontend API dev fallback helper keeps endpoint warning and development details", () => {
  const source = read(API_CLIENT_PATH);

  assert.ok(source.includes("function warnApiFallback(functionName: string, error: unknown): void"));
  assert.ok(source.includes("endpoint no disponible"));
  assert.ok(source.includes("error instanceof Error ? error.message : String(error)"));
  assert.ok(source.includes('warnApiFallback("getReports", error);'));
  assert.ok(source.includes('warnApiFallback("getLogisticsFieldVisits", error);'));
  assert.ok(source.includes('warnApiFallback("getRoutePlans", error);'));
  assert.ok(source.includes('credentials: options.credentials ?? "include",'));
});

test("frontend API dev fallback helper avoids cookie/header leakage markers", () => {
  const source = read(API_CLIENT_PATH);
  const helper = getBetween(
    source,
    "function warnApiFallback(functionName: string, error: unknown): void {",
    "async function apiFetch<T>(",
  );

  assert.ok(helper.length > 0);
  assert.equal(helper.includes("headers.cookie"), false);
  assert.equal(helper.includes("Cookie"), false);
});
