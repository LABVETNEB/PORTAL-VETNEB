import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));

const {
  API_NOSNIFF_HEADER_NAME,
  API_NOSNIFF_HEADER_VALUE,
  shouldApplyApiNosniff,
} = await import("../server/lib/api-response-security.ts");

function readSource(relativePath: string): string {
  return readFileSync(resolve(REPO_ROOT, relativePath), "utf8");
}

test("api nosniff helper clasifica solo superficie API", () => {
  assert.equal(API_NOSNIFF_HEADER_NAME, "X-Content-Type-Options");
  assert.equal(API_NOSNIFF_HEADER_VALUE, "nosniff");
  assert.equal(shouldApplyApiNosniff("/api"), true);
  assert.equal(shouldApplyApiNosniff("/api/health"), true);
  assert.equal(shouldApplyApiNosniff("/api/admin/system/health"), true);
  assert.equal(shouldApplyApiNosniff("/api/public/pricing"), true);
  assert.equal(
    shouldApplyApiNosniff("/api/public/professionals/search?q=histo"),
    true,
  );
  assert.equal(shouldApplyApiNosniff("/apiary/public"), false);
  assert.equal(shouldApplyApiNosniff("/dashboard/admin"), false);
  assert.equal(shouldApplyApiNosniff("/"), false);
});

test("fastify-app registra hook central de nosniff antes de cortes tempranos", () => {
  const source = readSource("server/fastify-app.ts");
  const nosniffHookIndex = source.indexOf(
    "applyApiNosniffHeader(request, reply)",
  );
  const trustedOriginHookIndex = source.indexOf(
    'app.addHook("onRequest", requireTrustedOriginForFastify);',
  );

  assert.ok(nosniffHookIndex > 0);
  assert.ok(trustedOriginHookIndex > 0);
  assert.ok(nosniffHookIndex < trustedOriginHookIndex);
});

test("api nosniff no introduce dependencia de frontend o UI", () => {
  const helperSource = readSource("server/lib/api-response-security.ts");
  const fastifyAppSource = readSource("server/fastify-app.ts");
  const combined = `${helperSource}\n${fastifyAppSource}`;

  assert.equal(combined.includes("frontend"), false);
  assert.equal(combined.includes(".tsx"), false);
  assert.equal(combined.includes("components"), false);
  assert.equal(combined.includes("next.config"), false);
});
