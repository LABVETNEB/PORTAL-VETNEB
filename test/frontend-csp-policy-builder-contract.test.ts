// test/frontend-csp-policy-builder-contract.test.ts
// VETNEB #748 - Contract tests for buildReportOnlyCsp.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildReportOnlyCsp,
  buildReportOnlyCspDirectives,
  CSP_REPORT_URI_PATH,
} from "../frontend/src/lib/security/csp-policy.ts";

const EXPECTED_BASE_DIRECTIVES: readonly string[] = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "connect-src 'self' https:",
  "frame-src https://www.google.com https://maps.google.com",
  "manifest-src 'self'",
  "worker-src 'self' blob:",
  "upgrade-insecure-requests",
];

// ----- #747 invariants (must not regress) -----

test("buildReportOnlyCsp() without options matches the #746/#747 contract exactly", () => {
  assert.deepEqual(buildReportOnlyCspDirectives(), EXPECTED_BASE_DIRECTIVES);
});

test("buildReportOnlyCsp() returns a single-line header value", () => {
  const csp = buildReportOnlyCsp();
  assert.equal(typeof csp, "string");
  assert.ok(!csp.includes("\n"));
  assert.ok(csp.includes("default-src 'self'; "));
});

test("buildReportOnlyCsp({ nonce }) appends 'nonce-...' to script-src and style-src", () => {
  const nonce = "abc123TESTNONCE==";
  const directives = buildReportOnlyCspDirectives({ nonce });
  const scriptSrc = directives.find((d) => d.startsWith("script-src "));
  const styleSrc = directives.find((d) => d.startsWith("style-src "));
  assert.ok(scriptSrc?.includes(`'nonce-${nonce}'`));
  assert.ok(styleSrc?.includes(`'nonce-${nonce}'`));
});

test("buildReportOnlyCsp({ nonce }) keeps 'unsafe-inline' and 'unsafe-eval'", () => {
  const csp = buildReportOnlyCsp({ nonce: "abc123TESTNONCE==" });
  assert.ok(csp.includes("'unsafe-inline'"));
  assert.ok(csp.includes("'unsafe-eval'"));
});

test("buildReportOnlyCsp() preserves Google Maps frame-src", () => {
  assert.ok(
    buildReportOnlyCsp().includes(
      "frame-src https://www.google.com https://maps.google.com",
    ),
  );
});

test("buildReportOnlyCsp() preserves worker-src and manifest-src", () => {
  const csp = buildReportOnlyCsp();
  assert.ok(csp.includes("worker-src 'self' blob:"));
  assert.ok(csp.includes("manifest-src 'self'"));
});

// ----- #748 new invariants -----

test("CSP_REPORT_URI_PATH is the canonical same-origin endpoint", () => {
  assert.equal(CSP_REPORT_URI_PATH, "/api/security/csp-report");
});

test("buildReportOnlyCsp({ reportUri }) appends report-uri as the LAST directive", () => {
  const directives = buildReportOnlyCspDirectives({
    reportUri: CSP_REPORT_URI_PATH,
  });
  assert.equal(
    directives[directives.length - 1],
    `report-uri ${CSP_REPORT_URI_PATH}`,
  );
});

test("buildReportOnlyCsp({ reportUri }) preserves all base directives in order before report-uri", () => {
  const directives = buildReportOnlyCspDirectives({
    reportUri: CSP_REPORT_URI_PATH,
  });
  assert.deepEqual(directives.slice(0, -1), EXPECTED_BASE_DIRECTIVES);
});

test("buildReportOnlyCsp({ nonce, reportUri }) supports both at once", () => {
  const csp = buildReportOnlyCsp({
    nonce: "abc123TESTNONCE==",
    reportUri: CSP_REPORT_URI_PATH,
  });
  assert.ok(csp.includes("'nonce-abc123TESTNONCE=='"));
  assert.ok(csp.endsWith(`report-uri ${CSP_REPORT_URI_PATH}`));
});

test("buildReportOnlyCsp() NEVER emits report-to (this PR uses only report-uri)", () => {
  for (const opts of [
    {},
    { nonce: "x" },
    { reportUri: CSP_REPORT_URI_PATH },
    { nonce: "x", reportUri: CSP_REPORT_URI_PATH },
  ]) {
    const csp = buildReportOnlyCsp(opts);
    assert.ok(
      !/\breport-to\b/.test(csp),
      `report-to must not appear (opts=${JSON.stringify(opts)})`,
    );
  }
});

test("buildReportOnlyCsp() never claims an enforcing CSP", () => {
  const csp = buildReportOnlyCsp({ reportUri: CSP_REPORT_URI_PATH });
  assert.ok(!csp.toLowerCase().includes("content-security-policy:"));
});

test("directive count: 14 base + 0/1 reporting", () => {
  assert.equal(buildReportOnlyCspDirectives().length, 14);
  assert.equal(
    buildReportOnlyCspDirectives({ reportUri: CSP_REPORT_URI_PATH }).length,
    15,
  );
});
