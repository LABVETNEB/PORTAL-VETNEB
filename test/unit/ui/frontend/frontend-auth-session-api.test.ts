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

function getFunctionSource(source: string, functionName: string): string {
  const signature = `export async function ${functionName}`;
  const start = source.indexOf(signature);

  if (start === -1) {
    return "";
  }

  const nextFunction = source.indexOf("\nexport async function ", start + signature.length);

  return nextFunction === -1 ? source.slice(start) : source.slice(start, nextFunction);
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

test("frontend API client recovers null only for expected particular session auth states", () => {
  const source = read(API_CLIENT_PATH);
  const functionSource = getFunctionSource(source, "getParticularSession");

  assert.ok(source.includes("const PARTICULAR_SESSION_RECOVERABLE_ERRORS = new Set(["));
  assert.ok(source.includes('"Particular no autenticado"'));
  assert.ok(source.includes('"Sesión particular inválida"'));
  assert.ok(source.includes('"Sesión particular expirada"'));
  assert.ok(source.includes('"Token particular inválido o inactivo"'));
  assert.ok(functionSource.includes("export async function getParticularSession(): Promise<ParticularAuthResponse | null>"));
  assert.ok(functionSource.includes('return await apiFetch<ParticularAuthResponse>("/api/particular/auth/me");'));
  assert.ok(functionSource.includes("if ("));
  assert.ok(functionSource.includes("error instanceof Error"));
  assert.ok(functionSource.includes("PARTICULAR_SESSION_RECOVERABLE_ERRORS.has(error.message)"));
  assert.ok(functionSource.includes("return null;"));
  assert.ok(functionSource.includes("throw error;"));
});
