// test/frontend-csp-report-uri-contract.test.ts
// VETNEB #748 - Asserts that the CSP Report-Only emitted from next.config.ts
// now references the same-origin /api/security/csp-report endpoint and that
// Reporting-Endpoints / report-to are NOT yet present (tracked for #749).
//
// This test reads next.config.ts as source. It does not boot Next.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const NEXT_CONFIG_PATH = resolve(__dirname, "../frontend/next.config.ts");
const NEXT_CONFIG_SOURCE = readFileSync(NEXT_CONFIG_PATH, "utf8");

test("next.config.ts CSP Report-Only references /api/security/csp-report", () => {
  assert.match(
    NEXT_CONFIG_SOURCE,
    /report-uri\s+\/api\/security\/csp-report/,
    "expected report-uri /api/security/csp-report inside CSP Report-Only directives",
  );
});

test("next.config.ts does NOT introduce Content-Security-Policy enforcing", () => {
  // Allow the Report-Only header. Forbid the enforcing one.
  // Match the header KEY only, not the substring inside report-only.
  const enforcing = /["']Content-Security-Policy["']\s*[,:]/i;
  assert.ok(
    !enforcing.test(NEXT_CONFIG_SOURCE),
    "Content-Security-Policy (enforcing) must not appear as a header key",
  );
});

test("next.config.ts does NOT yet add report-to or Reporting-Endpoints (tracked for #749)", () => {
  assert.ok(
    !/\breport-to\b/.test(NEXT_CONFIG_SOURCE),
    "report-to must not appear in this PR",
  );
  assert.ok(
    !/Reporting-Endpoints/i.test(NEXT_CONFIG_SOURCE),
    "Reporting-Endpoints header must not appear in this PR",
  );
});

test("next.config.ts preserves Google Maps frame-src", () => {
  assert.match(
    NEXT_CONFIG_SOURCE,
    /frame-src\s+https:\/\/www\.google\.com\s+https:\/\/maps\.google\.com/,
  );
});

test("next.config.ts preserves worker-src and manifest-src", () => {
  assert.match(NEXT_CONFIG_SOURCE, /worker-src\s+'self'\s+blob:/);
  assert.match(NEXT_CONFIG_SOURCE, /manifest-src\s+'self'/);
});

test("next.config.ts keeps #745 headers intact", () => {
  assert.match(NEXT_CONFIG_SOURCE, /X-Content-Type-Options/);
  assert.match(NEXT_CONFIG_SOURCE, /X-Frame-Options/);
  assert.match(NEXT_CONFIG_SOURCE, /Referrer-Policy/);
  assert.match(NEXT_CONFIG_SOURCE, /Permissions-Policy/);
  assert.match(NEXT_CONFIG_SOURCE, /Strict-Transport-Security/);
});

test("HSTS still has no preload (per #745 contract)", () => {
  // Match the HSTS value line specifically; preload must not be present.
  const hstsValueMatch = NEXT_CONFIG_SOURCE.match(
    /Strict-Transport-Security[\s\S]{0,200}max-age=[^"'`,}]+/,
  );
  assert.ok(hstsValueMatch, "expected Strict-Transport-Security value block");
  assert.ok(
    !/preload/i.test(hstsValueMatch![0]),
    `HSTS must NOT include preload, got: ${hstsValueMatch![0]}`,
  );
});
