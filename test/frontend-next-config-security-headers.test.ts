import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const CONFIG_PATH = "frontend/next.config.ts";
const FOOTER_PATH = "frontend/src/components/layout/Footer.tsx";
const MIDDLEWARE_PATH = "frontend/src/proxy.ts";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("next.config.ts declares all required baseline security headers", () => {
  const source = read(CONFIG_PATH);

  assert.ok(
    source.includes('"X-Content-Type-Options"') && source.includes('"nosniff"'),
    "X-Content-Type-Options: nosniff must be present",
  );
  assert.ok(
    source.includes('"X-Frame-Options"') && source.includes('"DENY"'),
    "X-Frame-Options: DENY must be present",
  );
  assert.ok(
    source.includes('"Referrer-Policy"') &&
      source.includes('"strict-origin-when-cross-origin"'),
    "Referrer-Policy: strict-origin-when-cross-origin must be present",
  );
  assert.ok(
    source.includes('"Permissions-Policy"'),
    "Permissions-Policy must be present",
  );
  assert.ok(
    source.includes('"Strict-Transport-Security"'),
    "Strict-Transport-Security must be declared",
  );
});

test("next.config.ts Permissions-Policy denies all required capabilities", () => {
  const source = read(CONFIG_PATH);

  const permMatch = source.match(/"Permissions-Policy"[\s\S]*?value:\s*"([^"]+)"/);
  assert.ok(permMatch, "Permissions-Policy value must be extractable");

  const permValue = permMatch![1];
  const required = [
    "camera=()",
    "microphone=()",
    "geolocation=()",
    "payment=()",
    "usb=()",
    "bluetooth=()",
    "serial=()",
    "hid=()",
  ];

  for (const cap of required) {
    assert.ok(permValue.includes(cap), `Permissions-Policy must deny ${cap}`);
  }
});

test("next.config.ts HSTS is production-only gated", () => {
  const source = read(CONFIG_PATH);

  assert.ok(
    source.includes("isProduction") &&
      source.includes('"Strict-Transport-Security"'),
    "HSTS must be declared under isProduction guard",
  );
  assert.ok(
    source.includes('process.env.NODE_ENV === "production"'),
    "isProduction must derive from NODE_ENV",
  );
  assert.ok(
    source.includes('"max-age=63072000; includeSubDomains"'),
    "HSTS value must be at least 2 years with includeSubDomains",
  );
  assert.equal(
    source.includes("; preload"),
    false,
    "HSTS must not include preload without explicit justification",
  );
});

test("next.config.ts does not contain deprecated X-XSS-Protection header", () => {
  const source = read(CONFIG_PATH);

  assert.equal(
    source.includes("X-XSS-Protection"),
    false,
    "Deprecated X-XSS-Protection must not be present",
  );
});

test("next.config.ts applies securityHeaders to all routes via catch-all source", () => {
  const source = read(CONFIG_PATH);

  assert.ok(
    source.includes('source: "/(.*)"') && source.includes("securityHeaders"),
    "securityHeaders must be applied to source /(.*)",
  );
});

test("next.config.ts securityHeaders block has no duplicate keys", () => {
  const source = read(CONFIG_PATH);
  const securityHeaderKeys = [
    "X-Content-Type-Options",
    "X-Frame-Options",
    "Referrer-Policy",
    "Permissions-Policy",
    "Strict-Transport-Security",
    "Reporting-Endpoints",
    "Content-Security-Policy-Report-Only",
  ];

  for (const key of securityHeaderKeys) {
    const matches = source.match(new RegExp(`key:\\s*"${key}"`, "g")) ?? [];
    assert.ok(matches.length <= 1, `Duplicate key in securityHeaders: ${key}`);
  }
});

test("next.config.ts poweredByHeader is disabled", () => {
  const source = read(CONFIG_PATH);

  assert.ok(
    source.includes("poweredByHeader: false"),
    "poweredByHeader must be false",
  );
});

test("Footer map iframe preserves non-interactive contract", () => {
  const source = read(FOOTER_PATH);

  assert.ok(
    source.includes('aria-hidden="true"'),
    "Footer map iframe must have aria-hidden=true",
  );
  assert.ok(
    source.includes("tabIndex={-1}"),
    "Footer map iframe must have tabIndex={-1}",
  );
  assert.ok(
    source.includes("pointer-events-none"),
    "Footer map iframe must have pointer-events-none",
  );

  const iframeCount = (source.match(/<iframe/g) ?? []).length;
  assert.equal(iframeCount, 1, "Footer must contain exactly one iframe");
});

test("Footer uses PublicExternalControl for external navigation, no bare <a> tags", () => {
  const source = read(FOOTER_PATH);

  assert.ok(
    source.includes("PublicExternalControl"),
    "Footer must use PublicExternalControl for external links",
  );
  assert.equal(
    source.includes("<a ") || source.includes("<a\n"),
    false,
    "Footer must not use bare <a> tags",
  );
  assert.equal(
    source.includes("next/link"),
    false,
    "Footer must not use next/link",
  );
});

test("middleware session separation contract is intact after next.config changes", () => {
  const source = read(MIDDLEWARE_PATH);

  assert.ok(
    source.includes('CLINIC_SESSION_COOKIE_NAME = "app_session_id"'),
    "clinic session cookie name must be app_session_id",
  );
  assert.ok(
    source.includes('ADMIN_SESSION_COOKIE_NAME = "admin_session_id"'),
    "admin session cookie name must be admin_session_id",
  );
  assert.ok(
    source.includes("return NextResponse.redirect(loginUrl)"),
    "unauthenticated dashboard requests must redirect to login",
  );
  assert.equal(
    source.includes("hasClinicSession || hasAdminSession"),
    false,
    "session check must not mix clinic and admin",
  );
  assert.ok(
    source.includes('matcher: ["/dashboard/:path*"]'),
    "middleware must only match dashboard routes",
  );
});
