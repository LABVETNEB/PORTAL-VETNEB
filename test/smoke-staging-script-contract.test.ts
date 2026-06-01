import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const REPO_ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));
const SCRIPT_PATH = resolve(REPO_ROOT, "scripts/dev/smoke-staging.ps1");

function readSource(path: string): string {
  return readFileSync(path, "utf8").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
}

function assertContains(source: string, marker: string, context: string): void {
  assert.ok(source.includes(marker), `${context} must contain: ${marker}`);
}

function assertNotContains(source: string, marker: string, context: string): void {
  assert.equal(source.includes(marker), false, `${context} must not contain: ${marker}`);
}

test("staging smoke script defines required optional env vars", () => {
  const source = readSource(SCRIPT_PATH);

  for (const marker of [
    "SMOKE_ADMIN_USERNAME",
    "SMOKE_ADMIN_PASSWORD",
    "SMOKE_CLINIC_USERNAME",
    "SMOKE_CLINIC_PASSWORD",
    "SMOKE_PARTICULAR_TOKEN",
  ]) {
    assertContains(source, marker, "smoke staging script env vars");
  }
});

test("staging smoke script contains authenticated endpoints", () => {
  const source = readSource(SCRIPT_PATH);

  for (const marker of [
    "/api/admin/auth/login",
    "/api/admin/auth/me",
    "/api/admin/system/health",
    "/api/admin/system/schema-health",
    "/api/auth/login",
    "/api/auth/me",
    "/api/reports?limit=10&offset=0",
    "/api/clinic/profile",
    "/api/particular-tokens?limit=10&offset=0",
    "/api/particular/auth/login",
    "/api/particular/auth/me",
    "/api/particular/auth/report/preview-url",
    "/api/particular/auth/report/download-url",
  ]) {
    assertContains(source, marker, "smoke staging script authenticated endpoints");
  }
});

test("staging smoke script forces json body for logout endpoints", () => {
  const source = readSource(SCRIPT_PATH);

  assert.match(
    source,
    /\$adminLogout[\s\S]*?\/api\/admin\/auth\/logout[\s\S]*?-BodyObject @\{\}/,
    "admin logout must include -BodyObject @{}",
  );
  assert.match(
    source,
    /\$clinicLogout[\s\S]*?\/api\/auth\/logout[\s\S]*?-BodyObject @\{\}/,
    "clinic logout must include -BodyObject @{}",
  );
  assert.match(
    source,
    /\$particularLogout[\s\S]*?\/api\/particular\/auth\/logout[\s\S]*?-BodyObject @\{\}/,
    "particular logout must include -BodyObject @{}",
  );
});

test("staging smoke script accepts 409 for particular report urls", () => {
  const source = readSource(SCRIPT_PATH);

  assert.match(
    source,
    /\$particularPreviewUrl[\s\S]*?\/api\/particular\/auth\/report\/preview-url[\s\S]*?-ExpectedStatusCodes @\(200, 409\)/,
    "particular preview url must accept HTTP 200 and 409",
  );
  assert.match(
    source,
    /\$particularDownloadUrl[\s\S]*?\/api\/particular\/auth\/report\/download-url[\s\S]*?-ExpectedStatusCodes @\(200, 409\)/,
    "particular download url must accept HTTP 200 and 409",
  );
  assertContains(
    source,
    "HTTP 409 sin informe vinculado",
    "particular report url checks must document unlinked report token state",
  );
});

test("staging smoke script validates bad origin rejection", () => {
  const source = readSource(SCRIPT_PATH);

  assertContains(source, "https://example.invalid", "smoke staging script bad origin");
  assertContains(source, "Unsafe bad origin blocked", "smoke staging script bad origin check");
});

test("staging smoke script checks secure cookie flags", () => {
  const source = readSource(SCRIPT_PATH);

  assertContains(source, "Secure", "smoke staging script secure cookie marker");
  assertContains(source, "SameSite=None", "smoke staging script sameSite marker");
  assertContains(source, "Get-CookieFlagsFromHeaders", "smoke staging cookie flags helper");
});

test("staging smoke script uses SKIP checks when optional credentials are missing", () => {
  const source = readSource(SCRIPT_PATH);

  assertContains(source, 'Status "SKIP"', "smoke staging script skip status");
  assertContains(source, "Mark-CredentialCheckSkipSet", "smoke staging script skip helper");
  assertContains(
    source,
    "faltan env vars SMOKE_ADMIN_USERNAME/SMOKE_ADMIN_PASSWORD",
    "smoke staging script admin skip reason",
  );
  assertContains(
    source,
    "faltan env vars SMOKE_CLINIC_USERNAME/SMOKE_CLINIC_PASSWORD",
    "smoke staging script clinic skip reason",
  );
  assertContains(
    source,
    "falta env var SMOKE_PARTICULAR_TOKEN",
    "smoke staging script particular skip reason",
  );
});

test("staging smoke script does not contain real secrets or unsafe placeholders", () => {
  const source = readSource(SCRIPT_PATH);

  for (const marker of [
    "SUPABASE_SERVICE_ROLE_KEY=",
    "DATABASE_URL=",
    "SMTP_PASS=",
    "password real",
    "token real",
  ]) {
    assertNotContains(source, marker, "smoke staging script forbidden secret marker");
  }
});

test("staging smoke script avoids direct printing of sensitive values", () => {
  const source = readSource(SCRIPT_PATH);

  const forbiddenPatterns = [
    /Write-Host\s+\$env:SMOKE_ADMIN_PASSWORD/i,
    /Write-Host\s+\$env:SMOKE_CLINIC_PASSWORD/i,
    /Write-Host\s+\$env:SMOKE_PARTICULAR_TOKEN/i,
    /Write-Host\s+\$SetCookie\b/i,
  ];

  for (const pattern of forbiddenPatterns) {
    assert.equal(
      pattern.test(source),
      false,
      `smoke staging script must avoid direct sensitive log pattern ${pattern}`,
    );
  }
});

test("smoke staging script contract source stays ascii only", () => {
  const source = readSource(resolve(REPO_ROOT, "test/smoke-staging-script-contract.test.ts"));
  const replacementCharacter = String.fromCharCode(0xfffd);

  assert.equal(
    source.includes(replacementCharacter),
    false,
    "smoke staging script contract source must not contain replacement characters",
  );

  for (let index = 0; index < source.length; index += 1) {
    assert.equal(
      source.charCodeAt(index) <= 0x7f,
      true,
      `smoke staging script contract source must stay ascii-only at index ${index}`,
    );
  }
});
