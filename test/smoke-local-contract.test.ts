import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type PackageJson = {
  scripts?: Record<string, string>;
};

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

function readPackageJson(): PackageJson {
  return JSON.parse(read("package.json")) as PackageJson;
}

function assertIncludes(source: string, expected: string, context: string): void {
  assert.ok(source.includes(expected), `${context} missing ${expected}`);
}

function assertNotIncludes(source: string, unexpected: string, context: string): void {
  assert.ok(
    !source.includes(unexpected),
    `${context} must not include ${unexpected}`
  );
}

test("local smoke scripts are exposed through pnpm commands", () => {
  const pkg = readPackageJson();
  const docs = read("docs/smoke-local.md");

  assert.equal(
    pkg.scripts?.["smoke:test"],
    "node scripts/smoke/smoke-test.mjs"
  );
  assert.equal(
    pkg.scripts?.["smoke:upload"],
    "node scripts/smoke/smoke-upload.mjs"
  );

  for (const marker of [
    "Terminal 1:",
    "pnpm build",
    "pnpm start",
    "pnpm dev",
    "pnpm smoke:test",
    "pnpm smoke:upload",
  ]) {
    assertIncludes(docs, marker, "docs/smoke-local.md");
  }
});

test("local smoke scripts use loopback-safe defaults and local startup guidance", () => {
  const smokeTest = read("scripts/smoke/smoke-test.mjs");
  const smokeUpload = read("scripts/smoke/smoke-upload.mjs");
  const docs = read("docs/smoke-local.md");

  for (const [context, source] of [
    ["scripts/smoke/smoke-test.mjs", smokeTest],
    ["scripts/smoke/smoke-upload.mjs", smokeUpload],
  ] as const) {
    assertIncludes(
      source,
      'process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000"',
      context
    );
    assertIncludes(source, "ECONNREFUSED", context);
    assertIncludes(source, "LEVANTA 'pnpm dev' EN OTRA TERMINAL", context);
    assertNotIncludes(source, "http://localhost:3000", context);
  }

  assertIncludes(
    docs,
    '$env:SMOKE_BASE_URL = "http://127.0.0.1:3000"',
    "docs/smoke-local.md"
  );
  assertIncludes(
    docs,
    "Usar `127.0.0.1` evita diferencias locales de resolucion IPv6 de `localhost`.",
    "docs/smoke-local.md"
  );
});

test("basic local smoke covers the clinic session and reports contract", () => {
  const smokeTest = read("scripts/smoke/smoke-test.mjs");

  for (const endpoint of [
    "${BASE_URL}/health",
    "${BASE_URL}/api/auth/login",
    "${BASE_URL}/api/auth/me",
    "${BASE_URL}/api/reports",
    "${BASE_URL}/api/reports/study-types",
    "${BASE_URL}/api/auth/logout",
  ]) {
    assertIncludes(smokeTest, endpoint, "scripts/smoke/smoke-test.mjs");
  }

  for (const contractAssertion of [
    'healthJson?.checks?.database === "up"',
    'healthJson?.checks?.storage === "up"',
    "setCookie",
    "meJson?.clinicUser?.username === USERNAME",
    "Array.isArray(reportsJson?.reports)",
    "Array.isArray(studyTypesJson?.studyTypes)",
    "meAfterLogoutRes.status === 401",
  ]) {
    assertIncludes(
      smokeTest,
      contractAssertion,
      "scripts/smoke/smoke-test.mjs"
    );
  }
});

test("upload local smoke keeps temp artifacts outside the repo and covers admin upload contract", () => {
  const smokeUpload = read("scripts/smoke/smoke-upload.mjs");

  assertIncludes(
    smokeUpload,
    'process.env.SMOKE_TMP_DIR ?? path.join(os.tmpdir(), "portal-vetneb-smoke")',
    "scripts/smoke/smoke-upload.mjs"
  );
  assertIncludes(
    smokeUpload,
    'const PDF_PATH = path.join(TMP_DIR, "smoke-test.pdf");',
    "scripts/smoke/smoke-upload.mjs"
  );
  assertIncludes(
    smokeUpload,
    "fs.mkdirSync(TMP_DIR, { recursive: true });",
    "scripts/smoke/smoke-upload.mjs"
  );

  assertIncludes(
    smokeUpload,
    "${BASE_URL}/api/admin/reports/upload",
    "scripts/smoke/smoke-upload.mjs"
  );
  assertNotIncludes(
    smokeUpload,
    "${BASE_URL}/api/reports/upload",
    "scripts/smoke/smoke-upload.mjs"
  );

  for (const multipartField of [
    'form.append("file"',
    'form.append("patientName"',
    'form.append("studyType"',
    'form.append("uploadDate"',
  ]) {
    assertIncludes(
      smokeUpload,
      multipartField,
      "scripts/smoke/smoke-upload.mjs"
    );
  }

  for (const uploadAssertion of [
    "uploadRes.status === 201",
    "uploadJson?.success === true",
    "uploadJson?.report?.id",
    "uploadJson?.report?.storagePath",
    "uploadJson?.report?.previewUrl",
    "uploadJson?.report?.downloadUrl",
  ]) {
    assertIncludes(
      smokeUpload,
      uploadAssertion,
      "scripts/smoke/smoke-upload.mjs"
    );
  }
});

test("local smoke documentation keeps credential handling explicit", () => {
  const docs = read("docs/smoke-local.md");
  const smokeTest = read("scripts/smoke/smoke-test.mjs");
  const smokeUpload = read("scripts/smoke/smoke-upload.mjs");
  const forbiddenDefaultPasswordPattern = new RegExp("admin" + "123");

  assert.doesNotMatch(smokeTest, forbiddenDefaultPasswordPattern);
  assert.doesNotMatch(smokeUpload, forbiddenDefaultPasswordPattern);
  assertIncludes(
    smokeTest,
    'requiredEnv("SMOKE_PASSWORD")',
    "scripts/smoke/smoke-test.mjs"
  );
  assertIncludes(
    smokeUpload,
    'requiredEnv("SMOKE_PASSWORD")',
    "scripts/smoke/smoke-upload.mjs"
  );

  for (const marker of [
    "SMOKE_BASE_URL",
    "SMOKE_USERNAME",
    "SMOKE_PASSWORD",
    "SMOKE_TMP_DIR",
    "SMOKE_PASSWORD es obligatorio.",
    "Los scripts no deben registrar la password en consola.",
    "Solo muestran BASE URL y USUARIO.",
    "Las credenciales reales deben configurarse por entorno local y no commitearse.",
  ]) {
    assertIncludes(docs, marker, "docs/smoke-local.md");
  }
});
