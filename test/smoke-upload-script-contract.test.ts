import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const REPO_ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));
const SCRIPT_PATH = resolve(REPO_ROOT, "scripts/smoke/smoke-upload.mjs");

function readSource(path: string): string {
  return readFileSync(path, "utf8").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
}

function assertContains(source: string, marker: string, context: string): void {
  assert.ok(source.includes(marker), `${context} must contain: ${marker}`);
}

function assertNotContains(source: string, marker: string, context: string): void {
  assert.equal(source.includes(marker), false, `${context} must not contain: ${marker}`);
}

test("smoke upload script references expected env vars", () => {
  const source = readSource(SCRIPT_PATH);

  for (const marker of [
    "SMOKE_BASE_URL",
    "SMOKE_USERNAME",
    "SMOKE_PASSWORD",
    "SMOKE_TMP_DIR",
    "SMOKE_UPLOAD_FILE",
  ]) {
    assertContains(source, marker, "smoke upload script env vars");
  }
});

test("smoke upload script includes login, upload, download-url and logout surfaces", () => {
  const source = readSource(SCRIPT_PATH);

  for (const marker of [
    "/api/auth/login",
    "/api/auth/logout",
    "/api/reports/",
    "download-url",
    "/api/admin/reports/upload",
  ]) {
    assertContains(source, marker, "smoke upload script endpoint registry");
  }
});

test("smoke upload script enforces signed URL evidence without full URL disclosure", () => {
  const source = readSource(SCRIPT_PATH);

  assertContains(source, "signedUrl=present", "smoke upload script signed URL marker");

  for (const pattern of [
    /console\.log\(\s*process\.env\.SMOKE_PASSWORD/i,
    /console\.log\(\s*setCookie\b/i,
    /console\.log\(\s*signedUrl\b/i,
    /console\.log\(\s*downloadUrl\b/i,
    /console\.log\(\s*url\b/i,
  ]) {
    assert.equal(
      pattern.test(source),
      false,
      `smoke upload script must avoid direct sensitive output pattern ${pattern}`,
    );
  }
});

test("smoke upload script creates a temporary PDF when SMOKE_UPLOAD_FILE is missing", () => {
  const source = readSource(SCRIPT_PATH);

  assertContains(source, "function ensureTmpPdf", "smoke upload script temp PDF helper");
  assertContains(source, "%PDF-1.1", "smoke upload script pdf signature");
  assertContains(source, "resolveUploadFile", "smoke upload script file resolver");
  assertContains(source, "generatedTemporaryFile: true", "smoke upload script temp flag");
  assertContains(source, "SMOKE_UPLOAD_FILE fue provisto pero el archivo no existe", "smoke upload script safe missing file message");
});

test("smoke upload script uses multipart form upload contract", () => {
  const source = readSource(SCRIPT_PATH);

  for (const marker of [
    "new FormData()",
    'form.append("file"',
    'form.append("patientName"',
    'form.append("studyType"',
    'form.append("uploadDate"',
  ]) {
    assertContains(source, marker, "smoke upload script multipart markers");
  }
});

test("smoke upload script does not include real secrets or unsafe placeholders", () => {
  const source = readSource(SCRIPT_PATH);

  for (const marker of [
    "SUPABASE_SERVICE_ROLE_KEY=",
    "DATABASE_URL=",
    "SMTP_PASS=",
    "password real",
    "token real",
  ]) {
    assertNotContains(source, marker, "smoke upload script forbidden secret marker");
  }
});

test("smoke upload script avoids direct logging of sensitive env vars and cookies", () => {
  const source = readSource(SCRIPT_PATH);

  for (const pattern of [
    /Write-Host\s+\$env:SMOKE_ADMIN_PASSWORD/i,
    /Write-Host\s+\$env:SMOKE_CLINIC_PASSWORD/i,
    /Write-Host\s+\$env:SMOKE_PARTICULAR_TOKEN/i,
    /console\.log\(\s*process\.env\.SMOKE_PASSWORD/i,
    /console\.log\(\s*process\.env\.SMOKE_USERNAME/i,
    /console\.log\(\s*set-cookie\b/i,
    /console\.log\(\s*cookie\b/i,
  ]) {
    assert.equal(
      pattern.test(source),
      false,
      `smoke upload script must avoid direct sensitive pattern ${pattern}`,
    );
  }
});

test("smoke upload script contract source stays ascii only", () => {
  const source = readSource(resolve(REPO_ROOT, "test/smoke-upload-script-contract.test.ts"));
  const replacementCharacter = String.fromCharCode(0xfffd);

  assert.equal(
    source.includes(replacementCharacter),
    false,
    "smoke upload script contract source must not contain replacement characters",
  );

  for (let index = 0; index < source.length; index += 1) {
    assert.equal(
      source.charCodeAt(index) <= 0x7f,
      true,
      `smoke upload script contract source must stay ascii-only at index ${index}`,
    );
  }
});
