// test/frontend-csp-report-uri-contract.test.ts
// VETNEB #749 - Asserts that the CSP Report-Only emitted from next.config.ts
// uses the shared CSP builder and only enables Reporting-Endpoints / report-to
// when a strict canonical frontend origin is configured.
//
// This test reads next.config.ts as source. It does not boot Next.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import {
  buildCspReportingEndpointConfig,
  buildReportOnlyCsp,
  CSP_REPORT_TO_GROUP,
  CSP_REPORT_URI_PATH,
} from "../frontend/src/lib/security/csp-policy.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const NEXT_CONFIG_PATH = resolve(__dirname, "../frontend/next.config.ts");
const NEXT_CONFIG_SOURCE = readFileSync(NEXT_CONFIG_PATH, "utf8");
const BASELINE_CSP = buildReportOnlyCsp({ reportUri: CSP_REPORT_URI_PATH });

test("next.config.ts consumes buildReportOnlyCsp() as the CSP source of truth", () => {
  assert.match(
    NEXT_CONFIG_SOURCE,
    /buildReportOnlyCsp\(\s*\{/,
    "expected next.config.ts to build CSP through buildReportOnlyCsp()",
  );
  assert.doesNotMatch(
    NEXT_CONFIG_SOURCE,
    /const\s+cspReportOnlyDirectives\s*=/,
    "next.config.ts must not duplicate the long CSP directive list",
  );
  assert.match(
    NEXT_CONFIG_SOURCE,
    /reportUri:\s*CSP_REPORT_URI_PATH/,
    "next.config.ts must pass the canonical report-uri path to buildReportOnlyCsp()",
  );
});

test("next.config.ts CSP Report-Only references /api/security/csp-report", () => {
  assert.match(
    BASELINE_CSP,
    new RegExp(`report-uri\\s+${CSP_REPORT_URI_PATH.replaceAll("/", "\\/")}`),
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

test("next.config.ts wires report-to and Reporting-Endpoints to the trusted origin guard", () => {
  assert.match(
    NEXT_CONFIG_SOURCE,
    /options\.siteUrl\s*===\s*undefined[\s\S]*?process\.env\.NEXT_PUBLIC_SITE_URL[\s\S]*?buildCspReportingEndpointConfig\(siteUrl\)/,
    "next.config.ts must validate NEXT_PUBLIC_SITE_URL before reporting endpoint headers",
  );
  assert.match(
    NEXT_CONFIG_SOURCE,
    /reportTo:\s*reportingConfig\?\.reportToGroup/,
    "report-to must be driven by the validated reporting config",
  );
  assert.match(
    NEXT_CONFIG_SOURCE,
    /key:\s*"Reporting-Endpoints"[\s\S]*?value:\s*reportingConfig\.reportingEndpointsHeaderValue/,
    "Reporting-Endpoints must use the validated endpoint header value",
  );
});

test("CSP builder omits report-to when no trusted canonical origin exists", () => {
  assert.doesNotMatch(
    BASELINE_CSP,
    /\breport-to\b/,
    "report-to must not appear without a trusted canonical origin",
  );
  assert.equal(buildCspReportingEndpointConfig(undefined), null);
});

test("CSP reporting config emits report-to and Reporting-Endpoints for a trusted canonical origin", () => {
  const reportingConfig = buildCspReportingEndpointConfig("https://Portal.Example.com/");
  assert.ok(reportingConfig, "expected a reporting config for a trusted origin");
  const csp = buildReportOnlyCsp({
    reportUri: CSP_REPORT_URI_PATH,
    reportTo: reportingConfig.reportToGroup,
  });

  assert.match(csp, new RegExp(`\\breport-uri\\s+${CSP_REPORT_URI_PATH}\\b`));
  assert.match(csp, new RegExp(`\\breport-to\\s+${CSP_REPORT_TO_GROUP}\\b`));
  assert.equal(
    reportingConfig.reportingEndpointsHeaderValue,
    `${CSP_REPORT_TO_GROUP}="https://portal.example.com${CSP_REPORT_URI_PATH}"`,
  );
});

test("CSP reporting config rejects unsafe canonical origin inputs for reporting", () => {
  const unsafeOrigins = [
    "http://portal.example.com",
    "https://portal.example.com/path",
    "https://portal.example.com/?q=1",
    "https://portal.example.com/#hash",
    "https://user:pass@portal.example.com",
    "https://localhost",
    "https://127.0.0.1",
    "https://0.0.0.0",
  ];

  for (const siteUrl of unsafeOrigins) {
    assert.equal(
      buildCspReportingEndpointConfig(siteUrl),
      null,
      `Reporting-Endpoints config leaked for ${siteUrl}`,
    );
  }
});

test("next.config.ts does not emit legacy Report-To header", () => {
  assert.doesNotMatch(
    NEXT_CONFIG_SOURCE,
    /key:\s*["']Report-To["']/,
    "legacy Report-To header must not be introduced",
  );
});

test("next.config.ts preserves Google Maps frame-src", () => {
  assert.match(BASELINE_CSP, /frame-src\s+https:\/\/www\.google\.com\s+https:\/\/maps\.google\.com/);
});

test("next.config.ts preserves worker-src and manifest-src", () => {
  assert.match(BASELINE_CSP, /worker-src\s+'self'\s+blob:/);
  assert.match(BASELINE_CSP, /manifest-src\s+'self'/);
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

// ─── Smoke: CSP reporting header assembly for the 3 NEXT_PUBLIC_SITE_URL scenarios ─────
//
// next.config.ts cannot be imported directly in this test runner because it uses
// the bare specifier "./src/lib/security/csp-policy" (no .ts extension) which
// --experimental-specifier-resolution=node does not resolve for TypeScript files.
// The smoke below replicates the assembly from buildSecurityHeaders() using the
// same exported builders; source-text assertions above already confirm
// next.config.ts wires these builders in exactly this pattern.

type SmokeHeaders = {
  cspReportOnly: string;
  reportingEndpoints: string | null;
};

function assembleReportingHeaders(siteUrl: string | null | undefined): SmokeHeaders {
  const reportingConfig = buildCspReportingEndpointConfig(siteUrl);
  return {
    cspReportOnly: buildReportOnlyCsp({
      reportUri: CSP_REPORT_URI_PATH,
      reportTo: reportingConfig?.reportToGroup,
    }),
    reportingEndpoints: reportingConfig?.reportingEndpointsHeaderValue ?? null,
  };
}

test("smoke(no siteUrl): Content-Security-Policy-Report-Only present, report-uri /api/security/csp-report present, no report-to, no Reporting-Endpoints", () => {
  const { cspReportOnly, reportingEndpoints } = assembleReportingHeaders(null);

  assert.ok(cspReportOnly, "Content-Security-Policy-Report-Only value must be non-empty");
  assert.match(
    cspReportOnly,
    new RegExp(`report-uri\\s+${CSP_REPORT_URI_PATH.replaceAll("/", "\\/")}`),
    "report-uri /api/security/csp-report must be present",
  );
  assert.doesNotMatch(
    cspReportOnly,
    /\breport-to\b/,
    "report-to must not appear without a trusted canonical origin",
  );
  assert.equal(
    reportingEndpoints,
    null,
    "Reporting-Endpoints must not be emitted without a trusted canonical origin",
  );
});

test("smoke(secure siteUrl): Content-Security-Policy-Report-Only present, report-uri present, report-to csp-endpoint present, Reporting-Endpoints points to canonical endpoint", () => {
  const siteUrl = "https://example.com";
  const { cspReportOnly, reportingEndpoints } = assembleReportingHeaders(siteUrl);

  assert.ok(cspReportOnly, "Content-Security-Policy-Report-Only value must be non-empty");
  assert.match(
    cspReportOnly,
    new RegExp(`report-uri\\s+${CSP_REPORT_URI_PATH.replaceAll("/", "\\/")}`),
    "report-uri /api/security/csp-report must be present",
  );
  assert.match(
    cspReportOnly,
    new RegExp(`\\breport-to\\s+${CSP_REPORT_TO_GROUP}\\b`),
    "report-to csp-endpoint must be present with a trusted canonical origin",
  );
  assert.ok(
    reportingEndpoints,
    "Reporting-Endpoints must be emitted with a trusted canonical origin",
  );
  assert.equal(
    reportingEndpoints,
    `${CSP_REPORT_TO_GROUP}="${siteUrl}${CSP_REPORT_URI_PATH}"`,
    "Reporting-Endpoints must point to the canonical CSP report endpoint using normalized origin",
  );
});

test("smoke(insecure siteUrl): report-uri /api/security/csp-report preserved, no report-to, no Reporting-Endpoints", () => {
  const { cspReportOnly, reportingEndpoints } = assembleReportingHeaders("http://example.com");

  assert.ok(cspReportOnly, "Content-Security-Policy-Report-Only value must be non-empty");
  assert.match(
    cspReportOnly,
    new RegExp(`report-uri\\s+${CSP_REPORT_URI_PATH.replaceAll("/", "\\/")}`),
    "report-uri /api/security/csp-report must still be present with an insecure origin",
  );
  assert.doesNotMatch(
    cspReportOnly,
    /\breport-to\b/,
    "report-to must not appear with an insecure (http) origin",
  );
  assert.equal(
    reportingEndpoints,
    null,
    "Reporting-Endpoints must not be emitted with an insecure (http) origin",
  );
});
