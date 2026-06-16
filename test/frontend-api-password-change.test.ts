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

  const nextFunction = source.indexOf(
    "\nexport async function ",
    start + signature.length,
  );

  return nextFunction === -1
    ? source.slice(start)
    : source.slice(start, nextFunction);
}

test("frontend API client exposes a shared change-password input contract", () => {
  const source = read(API_CLIENT_PATH);

  assert.ok(source.includes("export type ChangePasswordInput = {"));
  assert.ok(source.includes("currentPassword: string;"));
  assert.ok(source.includes("newPassword: string;"));
  assert.ok(source.includes("export type ChangePasswordResponse = {"));
  assert.ok(source.includes("success: true;"));
});

test("frontend API client changes clinic password against authenticated auth endpoint", () => {
  const source = read(API_CLIENT_PATH);
  const functionSource = getFunctionSource(source, "changeClinicPassword");

  assert.ok(
    functionSource.includes(
      "export async function changeClinicPassword(",
    ),
  );
  assert.ok(functionSource.includes("input: ChangePasswordInput,"));
  assert.ok(functionSource.includes("): Promise<ChangePasswordResponse>"));
  assert.ok(
    functionSource.includes(
      'return apiFetch<ChangePasswordResponse>("/api/auth/change-password", {',
    ),
  );
  assert.ok(functionSource.includes('method: "POST",'));
});

test("frontend API client changes admin password against admin auth endpoint", () => {
  const source = read(API_CLIENT_PATH);
  const functionSource = getFunctionSource(source, "changeAdminPassword");

  assert.ok(
    functionSource.includes(
      "export async function changeAdminPassword(",
    ),
  );
  assert.ok(functionSource.includes("input: ChangePasswordInput,"));
  assert.ok(functionSource.includes("): Promise<ChangePasswordResponse>"));
  assert.ok(
    functionSource.includes(
      'return apiFetch<ChangePasswordResponse>("/api/admin/auth/change-password", {',
    ),
  );
  assert.ok(functionSource.includes('method: "POST",'));
});

test("change-password clients send exactly currentPassword and newPassword", () => {
  const source = read(API_CLIENT_PATH);

  for (const functionName of [
    "changeClinicPassword",
    "changeAdminPassword",
  ]) {
    const functionSource = getFunctionSource(source, functionName);

    assert.ok(
      functionSource.includes("body: JSON.stringify({"),
      `${functionName} must serialize a JSON body`,
    );
    assert.ok(
      functionSource.includes("currentPassword: input.currentPassword,"),
      `${functionName} must forward currentPassword`,
    );
    assert.ok(
      functionSource.includes("newPassword: input.newPassword,"),
      `${functionName} must forward newPassword`,
    );
  }
});

test("change-password clients reuse the shared apiFetch credentials and JSON contract", () => {
  const source = read(API_CLIENT_PATH);

  // apiFetch centralizes credentials: "include" and Content-Type: application/json,
  // so the clients must not re-implement fetch nor override those defaults.
  for (const functionName of [
    "changeClinicPassword",
    "changeAdminPassword",
  ]) {
    const functionSource = getFunctionSource(source, functionName);

    assert.ok(
      functionSource.includes("apiFetch<ChangePasswordResponse>("),
      `${functionName} must delegate to the shared apiFetch helper`,
    );
    assert.equal(
      functionSource.includes("await fetch("),
      false,
      `${functionName} must not bypass apiFetch with a raw fetch`,
    );
    assert.equal(
      functionSource.includes("credentials:"),
      false,
      `${functionName} must inherit the shared include-credentials default`,
    );
  }
});

test("change-password clients defer error handling to the shared API pattern", () => {
  const source = read(API_CLIENT_PATH);

  // No bespoke try/catch and no enumerative messages: failures propagate through
  // the existing ApiResponseError / generic-message path in apiFetch.
  for (const functionName of [
    "changeClinicPassword",
    "changeAdminPassword",
  ]) {
    const functionSource = getFunctionSource(source, functionName);

    assert.equal(
      functionSource.includes("try {"),
      false,
      `${functionName} must not wrap apiFetch in a bespoke try/catch`,
    );
    assert.equal(
      functionSource.includes("catch"),
      false,
      `${functionName} must not swallow or re-map backend errors`,
    );
  }
});

test("change-password clients never persist or log password material", () => {
  const source = read(API_CLIENT_PATH);

  for (const functionName of [
    "changeClinicPassword",
    "changeAdminPassword",
  ]) {
    const functionSource = getFunctionSource(source, functionName);

    assert.equal(
      functionSource.includes("localStorage"),
      false,
      `${functionName} must not touch localStorage`,
    );
    assert.equal(
      functionSource.includes("sessionStorage"),
      false,
      `${functionName} must not touch sessionStorage`,
    );
    assert.equal(
      functionSource.includes("document.cookie"),
      false,
      `${functionName} must not write cookies directly`,
    );
    assert.equal(
      /console\.(log|warn|error|info)/.test(functionSource),
      false,
      `${functionName} must not log password material`,
    );
  }

  // Defense in depth: the whole API client never reaches for web storage.
  assert.equal(source.includes("localStorage"), false);
  assert.equal(source.includes("sessionStorage"), false);
});

test("change-password clients stay scoped to clinic and admin surfaces only", () => {
  const source = read(API_CLIENT_PATH);

  for (const functionName of [
    "changeClinicPassword",
    "changeAdminPassword",
  ]) {
    const functionSource = getFunctionSource(source, functionName);

    assert.equal(
      functionSource.toLowerCase().includes("particular"),
      false,
      `${functionName} must not touch the particular surface`,
    );
  }

  // Only the two authenticated change-password endpoints are wired from the client.
  assert.ok(source.includes('"/api/auth/change-password"'));
  assert.ok(source.includes('"/api/admin/auth/change-password"'));
  assert.equal(
    source.includes("/api/particular/auth/change-password"),
    false,
  );
});
