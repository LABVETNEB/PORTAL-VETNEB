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

test("frontend API client builds admin sessions query parameters explicitly", () => {
  const source = read(API_CLIENT_PATH);

  assert.ok(source.includes("export async function getAdminSessions("));
  assert.ok(source.includes("params: AdminSessionsQuery = {},"));
  assert.ok(source.includes("options?: RequestInit,"));
  assert.ok(source.includes("): Promise<AdminSessionsSnapshot>"));
  assert.ok(source.includes("const query = new URLSearchParams();"));
  assert.ok(source.includes('query.set("sessionType", params.sessionType);'));
  assert.ok(source.includes('query.set("status", params.status);'));
  assert.ok(source.includes('query.set("limit", String(params.limit));'));
  assert.ok(source.includes('query.set("offset", String(params.offset));'));
  assert.ok(source.includes("const qs = query.toString();"));
});

test("frontend API client reads admin sessions from backend endpoint", () => {
  const source = read(API_CLIENT_PATH);

  assert.ok(source.includes("return apiFetch<AdminSessionsSnapshot>("));
  assert.ok(source.includes("`/api/admin/sessions${qs ? `?${qs}` : \"\"}`,"));
  assert.ok(source.includes("options,"));
});

test("frontend API client revokes admin sessions with typed session type and id", () => {
  const source = read(API_CLIENT_PATH);

  assert.ok(source.includes("export async function revokeAdminSession("));
  assert.ok(source.includes("sessionType: AdminSessionType,"));
  assert.ok(source.includes("sessionId: number,"));
  assert.ok(source.includes("options?: RequestInit,"));
  assert.ok(source.includes("): Promise<AdminSessionRevocationResponse>"));
  assert.ok(source.includes("return apiFetch<AdminSessionRevocationResponse>("));
  assert.ok(source.includes("`/api/admin/sessions/${sessionType}/${sessionId}/revoke`,"));
  assert.ok(source.includes('method: "POST",'));
});

test("frontend admin sessions API helpers remain typed around session snapshots", () => {
  const source = read(API_CLIENT_PATH);

  assert.ok(source.includes("AdminSessionsQuery,"));
  assert.ok(source.includes("AdminSessionsSnapshot,"));
  assert.ok(source.includes("AdminSessionRevocationResponse,"));
  assert.ok(source.includes("AdminSessionType,"));
});
