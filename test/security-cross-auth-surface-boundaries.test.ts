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

const adminFiles = [
  "server/routes/admin-auth.fastify.ts",
  "server/routes/admin-audit.fastify.ts",
  "server/routes/admin-particular-tokens.fastify.ts",
  "server/routes/admin-report-access-tokens.fastify.ts",
  "server/routes/admin-study-tracking.fastify.ts",
] as const;

const particularFiles = [
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

function assertCookieBoundary(
  files: readonly string[],
  requiredCookie: string,
  forbiddenCookies: readonly string[],
): void {
  for (const file of files) {
    const source = read(file);

    assertContains(source, requiredCookie, file);

    for (const forbiddenCookie of forbiddenCookies) {
      assertNotContains(source, forbiddenCookie, file);
    }
  }
}

test("clinic route surfaces accept only clinic session cookies", () => {
  assertCookieBoundary(clinicFiles, CLINIC_COOKIE, [
    ADMIN_COOKIE,
    PARTICULAR_COOKIE,
  ]);
});

test("admin route surfaces accept only admin session cookies", () => {
  assertCookieBoundary(adminFiles, ADMIN_COOKIE, [
    CLINIC_COOKIE,
    PARTICULAR_COOKIE,
  ]);
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
      "server/routes/admin-particular-tokens.fastify.ts",
      "server/routes/admin-report-access-tokens.fastify.ts",
      "server/routes/admin-study-tracking.fastify.ts",
      "server/routes/particular-auth.fastify.ts",
      "server/routes/particular-study-tracking.fastify.ts",
      "server/routes/public-report-access.fastify.ts",
    ],
  );
});

