import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = process.cwd();
const nextConfigPath = join(repoRoot, "frontend", "next.config.ts");
const footerPath = join(
  repoRoot,
  "frontend",
  "src",
  "components",
  "layout",
  "Footer.tsx",
);

function readIfExists(path: string): string {
  return existsSync(path) ? readFileSync(path, "utf8").replace(/\r\n/g, "\n") : "";
}

const nextConfigSrc = readIfExists(nextConfigPath);
const footerSrc = readIfExists(footerPath);

function extractCspReportOnlyValue(source: string): string | null {
  const headerMatch = source.match(
    /key:\s*["']Content-Security-Policy-Report-Only["']\s*,\s*value:\s*([^,}]+?)(?=\s*[,}])/s,
  );

  if (!headerMatch) {
    return null;
  }

  const expression = headerMatch[1].trim();

  if (
    (expression.startsWith('"') && expression.endsWith('"')) ||
    (expression.startsWith("'") && expression.endsWith("'")) ||
    (expression.startsWith("`") && expression.endsWith("`"))
  ) {
    return expression.slice(1, -1);
  }

  const directivesMatch = source.match(
    /const\s+cspReportOnlyDirectives\s*=\s*\[([\s\S]+?)\];/,
  );

  if (!directivesMatch) {
    return null;
  }

  const directives = directivesMatch[1]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("//"))
    .map((line) => line.replace(/,\s*$/, "").trim())
    .map((line) => {
      if (
        (line.startsWith('"') && line.endsWith('"')) ||
        (line.startsWith("'") && line.endsWith("'")) ||
        (line.startsWith("`") && line.endsWith("`"))
      ) {
        return line.slice(1, -1);
      }

      return null;
    })
    .filter((line): line is string => line !== null);

  return directives.length > 0 ? directives.join("; ") : null;
}

const cspValue = extractCspReportOnlyValue(nextConfigSrc);

test("CSP Report-Only: declares Content-Security-Policy-Report-Only", () => {
  assert.ok(nextConfigSrc.length > 0, "frontend/next.config.ts must be readable");
  assert.match(
    nextConfigSrc,
    /["']Content-Security-Policy-Report-Only["']/,
    "Content-Security-Policy-Report-Only header must be declared",
  );
});

test("CSP Report-Only: does not declare enforcing Content-Security-Policy", () => {
  const enforcingMatches = nextConfigSrc.match(
    /["']Content-Security-Policy["'](?!-Report-Only)/g,
  );

  assert.equal(
    enforcingMatches,
    null,
    "This PR must only add Content-Security-Policy-Report-Only, not enforcing CSP",
  );
});

test("CSP Report-Only: preserves browser security headers from PR 745", () => {
  assert.match(
    nextConfigSrc,
    /key:\s*["']X-Content-Type-Options["']\s*,\s*value:\s*["']nosniff["']/,
    "X-Content-Type-Options: nosniff must remain intact",
  );
  assert.match(
    nextConfigSrc,
    /key:\s*["']X-Frame-Options["']\s*,\s*value:\s*["']DENY["']/,
    "X-Frame-Options: DENY must remain intact",
  );
  assert.match(
    nextConfigSrc,
    /key:\s*["']Referrer-Policy["']\s*,\s*value:\s*["']strict-origin-when-cross-origin["']/,
    "Referrer-Policy must remain intact",
  );
  assert.match(
    nextConfigSrc,
    /camera=\(\)\s*,\s*microphone=\(\)\s*,\s*geolocation=\(\)\s*,\s*payment=\(\)\s*,\s*usb=\(\)\s*,\s*bluetooth=\(\)\s*,\s*serial=\(\)\s*,\s*hid=\(\)/,
    "Permissions-Policy must remain exactly aligned with PR 745",
  );
  assert.match(
    nextConfigSrc,
    /max-age=63072000\s*;\s*includeSubDomains/,
    "Strict-Transport-Security must remain aligned with PR 745",
  );
});

test("CSP Report-Only: HSTS does not include preload", () => {
  assert.doesNotMatch(
    nextConfigSrc,
    /max-age=63072000[^"']*preload/,
    "HSTS preload must not be added in this PR",
  );
});

test("CSP Report-Only: includes required directives", () => {
  assert.ok(cspValue, "CSP Report-Only value must be extractable");

  const requiredDirectives = [
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
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    "upgrade-insecure-requests",
  ];

  for (const directive of requiredDirectives) {
    assert.ok(cspValue.includes(directive), `Missing CSP directive: ${directive}`);
  }
});

test("CSP Report-Only: frame-src permits the public Google Maps iframe", () => {
  assert.ok(cspValue, "CSP Report-Only value must be extractable");
  assert.match(
    cspValue,
    /frame-src[^;]*https:\/\/www\.google\.com/,
    "frame-src must include https://www.google.com",
  );
  assert.match(
    cspValue,
    /frame-src[^;]*https:\/\/maps\.google\.com/,
    "frame-src must include https://maps.google.com",
  );
});

test("CSP Report-Only: does not add report-uri or report-to without a safe endpoint", () => {
  assert.doesNotMatch(
    nextConfigSrc,
    /\breport-uri\b/,
    "report-uri must not be added until a safe report endpoint exists",
  );
  assert.doesNotMatch(
    nextConfigSrc,
    /\breport-to\b/,
    "report-to must not be added until a safe report endpoint exists",
  );
});

test("CSP Report-Only: header remains the last securityHeaders entry", () => {
  const securityHeadersMatch = nextConfigSrc.match(
    /const\s+securityHeaders\s*=\s*\[([\s\S]*?)\n\s*\];/,
  );

  assert.ok(securityHeadersMatch, "securityHeaders array must be present");

  const keys = [...securityHeadersMatch[1].matchAll(/key:\s*["']([^"']+)["']/g)].map(
    (match) => match[1],
  );

  assert.ok(keys.length >= 5, `securityHeaders appears incomplete: ${keys.length} keys found`);
  assert.equal(
    keys[keys.length - 1],
    "Content-Security-Policy-Report-Only",
    "Content-Security-Policy-Report-Only must be the last security header",
  );
});

test("CSP Report-Only: Footer does not reintroduce next/link or native anchors", () => {
  assert.ok(footerSrc.length > 0, "Footer.tsx must be readable");
  assert.doesNotMatch(
    footerSrc,
    /from\s+["']next\/link["']/,
    "Footer must not import next/link",
  );
  assert.doesNotMatch(
    footerSrc,
    /<a[\s>]/,
    "Footer must not use native <a> elements",
  );
});

test("CSP Report-Only: Footer iframe remains non-interactive", () => {
  assert.ok(footerSrc.length > 0, "Footer.tsx must be readable");

  if (!footerSrc.includes("<iframe")) {
    return;
  }

  assert.match(footerSrc, /pointer-events-none/, "Footer iframe must keep pointer-events-none");
  assert.match(footerSrc, /aria-hidden=["']true["']/, 'Footer iframe must keep aria-hidden="true"');
  assert.match(footerSrc, /tabIndex=\{-1\}/, "Footer iframe must keep tabIndex={-1}");
});