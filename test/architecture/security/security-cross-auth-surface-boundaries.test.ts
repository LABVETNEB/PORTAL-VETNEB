import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const CLINIC_COOKIE = "cookies[ENV.cookieName]";
const ADMIN_COOKIE = "cookies[ENV.adminCookieName]";
const PARTICULAR_COOKIE = "cookies[ENV.particularCookieName]";

const clinicFiles = [
  "server/routes/auth.fastify.ts",
  "server/routes/clinic-audit.fastify.ts",
  "server/routes/clinic-public-profile.fastify.ts",
  "server/routes/particular-tokens.fastify.ts",
  "server/routes/report-access-tokens.fastify.ts",
  "server/routes/reports-status.fastify.ts",
  "server/routes/reports.fastify.ts",
  "server/routes/study-tracking.fastify.ts",
] as const;

// WBR-08c: clinic-audit and clinic-public-profile joined the Reports/
// Logistics families in delegating cookie access to the canonical helper
// (mirrors the admin family's fastify-admin-auth.ts split below).
// WBR-08c: no clinic route surfaces implement clinic auth locally anymore.
const clinicLocalAuthFiles: readonly string[] = [];

const clinicDelegatedAuthFiles = [
  "server/routes/report-access-tokens.fastify.ts",
  "server/routes/reports-status.fastify.ts",
  "server/routes/reports.fastify.ts",
  "server/routes/clinic-audit.fastify.ts",
  "server/routes/clinic-public-profile.fastify.ts",
  "server/routes/study-tracking.fastify.ts",
  "server/routes/particular-tokens.fastify.ts",
  "server/routes/auth.fastify.ts",
] as const;

const adminFiles = [
  "server/routes/admin-auth.fastify.ts",
  "server/routes/admin-audit.fastify.ts",
  "server/routes/admin-failed-login-alerts.fastify.ts",
  "server/routes/admin-particular-tokens.fastify.ts",
  "server/routes/admin-report-access-tokens.fastify.ts",
  "server/routes/admin-reports.fastify.ts",
  "server/routes/admin-sessions.fastify.ts",
  "server/routes/admin-study-tracking.fastify.ts",
  "server/routes/admin-system-health.fastify.ts",
  "server/routes/admin-system-maintenance.fastify.ts",
  "server/routes/admin-system-schema-health.fastify.ts",
  "server/routes/admin-users-roles.fastify.ts",
] as const;

const particularFiles = [
  "server/routes/particular-audit.fastify.ts",
  "server/routes/particular-auth.fastify.ts",
  "server/routes/particular-study-tracking.fastify.ts",
] as const;

const publicTokenFiles = [
  "server/routes/public-report-access.fastify.ts",
] as const;

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

function assertContains(source: string, marker: string, context: string): void {
  assert.ok(source.includes(marker), `${context}: missing marker ${marker}`);
}

function assertNotContains(source: string, marker: string, context: string): void {
  assert.ok(!source.includes(marker), `${context}: forbidden marker ${marker}`);
}

function evaluateCookieBoundarySource(
  source: string,
  requiredCookie: string,
  forbiddenCookies: readonly string[],
  context: string,
): string[] {
  const violations: string[] = [];

  if (!source.includes(requiredCookie)) {
    violations.push(`${context}: missing marker ${requiredCookie}`);
  }

  for (const forbiddenCookie of forbiddenCookies) {
    if (source.includes(forbiddenCookie)) {
      violations.push(`${context}: forbidden marker ${forbiddenCookie}`);
    }
  }

  return violations;
}

function assertCookieBoundary(
  files: readonly string[],
  requiredCookie: string,
  forbiddenCookies: readonly string[],
): void {
  for (const file of files) {
    assert.deepEqual(
      evaluateCookieBoundarySource(read(file), requiredCookie, forbiddenCookies, file),
      [],
    );
  }
}

function countOccurrences(source: string, needle: string): number {
  return source.split(needle).length - 1;
}

function replaceExactlyOnce(source: string, target: string, replacement: string): string {
  assert.equal(countOccurrences(source, target), 1, `mutation target must appear exactly once: ${target}`);
  return source.replace(target, () => replacement);
}

const ADMIN_AUTH_HELPER_FILE = "server/lib/fastify-admin-auth.ts";
const ADMIN_FORBIDDEN_COOKIES = [CLINIC_COOKIE, PARTICULAR_COOKIE] as const;

test("clinic route surfaces accept only clinic session cookies", () => {
  assertCookieBoundary(clinicLocalAuthFiles, CLINIC_COOKIE, [
    ADMIN_COOKIE,
    PARTICULAR_COOKIE,
  ]);

  const clinicAuthHelperSource = read("server/lib/fastify-clinic-auth.ts");
  assertContains(clinicAuthHelperSource, "ENV.cookieName", "server/lib/fastify-clinic-auth.ts");
  assertNotContains(clinicAuthHelperSource, "ENV.adminCookieName", "server/lib/fastify-clinic-auth.ts");
  assertNotContains(clinicAuthHelperSource, "ENV.particularCookieName", "server/lib/fastify-clinic-auth.ts");

  for (const file of clinicDelegatedAuthFiles) {
    const source = read(file);

    assertContains(source, "authenticateFastifyClinicUser", file);
    assertNotContains(source, ADMIN_COOKIE, file);
    assertNotContains(source, PARTICULAR_COOKIE, file);
  }
});

test("admin route surfaces accept only admin session cookies", () => {
  assertCookieBoundary([ADMIN_AUTH_HELPER_FILE], ADMIN_COOKIE, ADMIN_FORBIDDEN_COOKIES);

  for (const file of adminFiles) {
    const source = read(file);

    assertContains(source, "authenticateFastifyAdmin", file);
    assertNotContains(source, CLINIC_COOKIE, file);
    assertNotContains(source, PARTICULAR_COOKIE, file);
  }
});

test("mutation proof: admin auth helper accepting the clinic cookie as fallback is rejected", () => {
  const real = read(ADMIN_AUTH_HELPER_FILE);

  assert.deepEqual(
    evaluateCookieBoundarySource(real, ADMIN_COOKIE, ADMIN_FORBIDDEN_COOKIES, ADMIN_AUTH_HELPER_FILE),
    [],
  );

  const mutated = replaceExactlyOnce(
    real,
    `const raw = ${ADMIN_COOKIE};`,
    `const raw = ${ADMIN_COOKIE} ?? ${CLINIC_COOKIE};`,
  );

  assert.notEqual(mutated, real);
  assert.equal(countOccurrences(mutated, ADMIN_COOKIE), countOccurrences(real, ADMIN_COOKIE));
  assert.equal(countOccurrences(mutated, CLINIC_COOKIE), 1);
  assert.equal(countOccurrences(mutated, PARTICULAR_COOKIE), 0);
  assert.deepEqual(
    evaluateCookieBoundarySource(mutated, ADMIN_COOKIE, ADMIN_FORBIDDEN_COOKIES, ADMIN_AUTH_HELPER_FILE),
    [`${ADMIN_AUTH_HELPER_FILE}: forbidden marker ${CLINIC_COOKIE}`],
  );
});

test("particular route surfaces accept only particular session cookies", () => {
  assertCookieBoundary(particularFiles, PARTICULAR_COOKIE, [
    CLINIC_COOKIE,
    ADMIN_COOKIE,
  ]);
});

test("public token surfaces do not accept browser session cookies", () => {
  for (const file of publicTokenFiles) {
    const source = read(file);

    for (const cookie of [CLINIC_COOKIE, ADMIN_COOKIE, PARTICULAR_COOKIE]) {
      assertNotContains(source, cookie, file);
    }

    for (const envCookie of [
      "ENV.cookieName",
      "ENV.adminCookieName",
      "ENV.particularCookieName",
    ]) {
      assertNotContains(source, envCookie, file);
    }
  }
});

test("cross auth surface registry keeps every protected route family explicit", () => {
  assert.deepEqual(
    [
      ...clinicFiles,
      ...adminFiles,
      ...particularFiles,
      ...publicTokenFiles,
    ],
    [
      "server/routes/auth.fastify.ts",
      "server/routes/clinic-audit.fastify.ts",
      "server/routes/clinic-public-profile.fastify.ts",
      "server/routes/particular-tokens.fastify.ts",
      "server/routes/report-access-tokens.fastify.ts",
      "server/routes/reports-status.fastify.ts",
      "server/routes/reports.fastify.ts",
      "server/routes/study-tracking.fastify.ts",
      "server/routes/admin-auth.fastify.ts",
      "server/routes/admin-audit.fastify.ts",
      "server/routes/admin-failed-login-alerts.fastify.ts",
      "server/routes/admin-particular-tokens.fastify.ts",
      "server/routes/admin-report-access-tokens.fastify.ts",
      "server/routes/admin-reports.fastify.ts",
      "server/routes/admin-sessions.fastify.ts",
      "server/routes/admin-study-tracking.fastify.ts",
      "server/routes/admin-system-health.fastify.ts",
      "server/routes/admin-system-maintenance.fastify.ts",
      "server/routes/admin-system-schema-health.fastify.ts",
      "server/routes/admin-users-roles.fastify.ts",
      "server/routes/particular-audit.fastify.ts",
      "server/routes/particular-auth.fastify.ts",
      "server/routes/particular-study-tracking.fastify.ts",
      "server/routes/public-report-access.fastify.ts",
    ],
  );
});
