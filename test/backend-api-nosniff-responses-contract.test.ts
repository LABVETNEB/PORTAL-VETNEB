import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));

const {
  API_NOSNIFF_HEADER_NAME,
  API_NOSNIFF_HEADER_VALUE,
  API_REFERRER_POLICY_HEADER_NAME,
  API_REFERRER_POLICY_HEADER_VALUE,
  shouldApplyApiSecurityHeaders,
} = await import("../server/lib/api-response-security.ts");

function readSource(relativePath: string): string {
  return readFileSync(resolve(REPO_ROOT, relativePath), "utf8");
}

test("api security headers helper clasifica solo superficie API", () => {
  assert.equal(API_NOSNIFF_HEADER_NAME, "X-Content-Type-Options");
  assert.equal(API_NOSNIFF_HEADER_VALUE, "nosniff");
  assert.equal(API_REFERRER_POLICY_HEADER_NAME, "Referrer-Policy");
  assert.equal(API_REFERRER_POLICY_HEADER_VALUE, "no-referrer");
  assert.equal(shouldApplyApiSecurityHeaders("/api"), true);
  assert.equal(shouldApplyApiSecurityHeaders("/api/health"), true);
  assert.equal(shouldApplyApiSecurityHeaders("/api/admin/system/health"), true);
  assert.equal(shouldApplyApiSecurityHeaders("/api/public/pricing"), true);
  assert.equal(
    shouldApplyApiSecurityHeaders("/api/public/professionals/search?q=histo"),
    true,
  );
  assert.equal(shouldApplyApiSecurityHeaders("/apiary/public"), false);
  assert.equal(shouldApplyApiSecurityHeaders("/dashboard/admin"), false);
  assert.equal(shouldApplyApiSecurityHeaders("/"), false);
});

test("fastify-app registra hook central de security headers antes de cortes tempranos", () => {
  const source = readSource("server/fastify-app.ts");
  const securityHeadersHookIndex = source.indexOf(
    "applyApiSecurityHeaders(request, reply)",
  );
  const trustedOriginHookIndex = source.indexOf(
    'app.addHook("onRequest", requireTrustedOriginForFastify);',
  );

  assert.ok(securityHeadersHookIndex > 0);
  assert.ok(trustedOriginHookIndex > 0);
  assert.ok(securityHeadersHookIndex < trustedOriginHookIndex);
});

test("api security headers no introduce dependencia de frontend o UI", () => {
  const helperSource = readSource("server/lib/api-response-security.ts");
  const fastifyAppSource = readSource("server/fastify-app.ts");
  const combined = `${helperSource}\n${fastifyAppSource}`;

  assert.equal(combined.includes("frontend"), false);
  assert.equal(combined.includes(".tsx"), false);
  assert.equal(combined.includes("components"), false);
  assert.equal(combined.includes("next.config"), false);
});
