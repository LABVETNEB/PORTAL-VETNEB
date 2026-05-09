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

test("frontend API client exposes clinic session lookup against auth me endpoint", () => {
  const source = read(API_CLIENT_PATH);

  assert.ok(source.includes("export async function getClinicSession(): Promise<AuthUser | null>"));
  assert.ok(source.includes('return await apiFetch<AuthUser>("/api/auth/me");'));
  assert.ok(source.includes("} catch {"));
  assert.ok(source.includes("return null;"));
});

test("frontend API client exposes logout against backend auth endpoint", () => {
  const source = read(API_CLIENT_PATH);

  assert.ok(source.includes("export async function logout(): Promise<void>"));
  assert.ok(source.includes('await apiFetch<void>("/api/auth/logout", { method: "POST" });'));
});

test("frontend API client keeps auth response types tied to AuthUser", () => {
  const source = read(API_CLIENT_PATH);

  assert.ok(source.includes("AuthUser,"));
  assert.ok(source.includes("LoginCredentials,"));
  assert.ok(source.includes("export async function loginClinic("));
  assert.ok(source.includes("): Promise<AuthUser>"));
  assert.ok(source.includes("export async function getClinicSession(): Promise<AuthUser | null>"));
});
