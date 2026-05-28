import test from "node:test";
import assert from "node:assert/strict";

import {
  buildReportOnlyCsp,
  buildReportOnlyCspDirectives,
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

test("buildReportOnlyCsp without nonce matches the PR 746 contract exactly", () => {
  assert.deepEqual(buildReportOnlyCspDirectives(), EXPECTED_BASE_DIRECTIVES);
});

test("buildReportOnlyCsp returns a single-line header value with semicolon separator", () => {
  const csp = buildReportOnlyCsp();
  assert.equal(typeof csp, "string");
  assert.ok(!csp.includes("\n"), "CSP header must be a single line");
  assert.ok(csp.includes("default-src 'self'; "));
});

test("buildReportOnlyCsp with nonce appends nonce to script-src and style-src", () => {
  const nonce = "abc123TESTNONCE==";
  const directives = buildReportOnlyCspDirectives({ nonce });

  const scriptSrc = directives.find((directive) => directive.startsWith("script-src "));
  const styleSrc = directives.find((directive) => directive.startsWith("style-src "));

  assert.ok(scriptSrc, "script-src directive must be present");
  assert.ok(styleSrc, "style-src directive must be present");

  assert.ok(scriptSrc.includes(`'nonce-${nonce}'`));
  assert.ok(styleSrc.includes(`'nonce-${nonce}'`));
});

test("buildReportOnlyCsp with nonce keeps unsafe-inline and unsafe-eval during Report-Only stage", () => {
  const csp = buildReportOnlyCsp({ nonce: "abc123TESTNONCE==" });
  assert.ok(csp.includes("'unsafe-inline'"));
  assert.ok(csp.includes("'unsafe-eval'"));
});

test("buildReportOnlyCsp preserves Google Maps frame-src", () => {
  const csp = buildReportOnlyCsp();
  assert.ok(csp.includes("frame-src https://www.google.com https://maps.google.com"));
});

test("buildReportOnlyCsp preserves worker-src and manifest-src", () => {
  const csp = buildReportOnlyCsp();
  assert.ok(csp.includes("worker-src 'self' blob:"));
  assert.ok(csp.includes("manifest-src 'self'"));
});

test("buildReportOnlyCsp never emits report-uri or report-to", () => {
  const values = [
    buildReportOnlyCsp(),
    buildReportOnlyCsp({ nonce: "abc123TESTNONCE==" }),
  ];

  for (const csp of values) {
    assert.ok(!csp.includes("report-uri"));
    assert.ok(!csp.includes("report-to"));
  }
});

test("buildReportOnlyCsp never claims to be an enforcing CSP", () => {
  const csp = buildReportOnlyCsp({ nonce: "abc123TESTNONCE==" });
  assert.ok(!csp.toLowerCase().includes("content-security-policy:"));
});

test("buildReportOnlyCsp emits 14 directives without nonce and 14 with nonce", () => {
  assert.equal(buildReportOnlyCspDirectives().length, 14);
  assert.equal(buildReportOnlyCspDirectives({ nonce: "abc123TESTNONCE==" }).length, 14);
});

test("buildReportOnlyCsp preserves directive order regardless of nonce presence", () => {
  const withoutNonce = buildReportOnlyCspDirectives().map((directive) => directive.split(" ")[0]);
  const withNonce = buildReportOnlyCspDirectives({ nonce: "abc123TESTNONCE==" }).map(
    (directive) => directive.split(" ")[0],
  );

  assert.deepEqual(withoutNonce, withNonce);
});