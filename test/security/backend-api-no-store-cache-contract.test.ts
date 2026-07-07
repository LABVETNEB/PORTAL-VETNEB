import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));

const {
  SENSITIVE_API_CACHE_CONTROL,
  shouldApplySensitiveApiNoStore,
} = await import("../../server/lib/sensitive-response-cache.ts");

function readSource(relativePath: string): string {
  return readFileSync(resolve(REPO_ROOT, relativePath), "utf8");
}

test("sensitive response cache helper clasifica API no publica para no-store", () => {
  assert.equal(SENSITIVE_API_CACHE_CONTROL, "no-store");
  assert.equal(shouldApplySensitiveApiNoStore("/api/admin/auth/me"), true);
  assert.equal(
    shouldApplySensitiveApiNoStore("/api/admin/auth/change-password"),
    true,
  );
  assert.equal(shouldApplySensitiveApiNoStore("/api/auth/change-password"), true);
  assert.equal(
    shouldApplySensitiveApiNoStore("/api/admin/failed-login-alerts?limit=5"),
    true,
  );
  assert.equal(shouldApplySensitiveApiNoStore("/api/reports"), true);
  assert.equal(shouldApplySensitiveApiNoStore("/api/public/pricing"), false);
  assert.equal(
    shouldApplySensitiveApiNoStore("/api/public/professionals/search"),
    false,
  );
  assert.equal(shouldApplySensitiveApiNoStore("/dashboard/admin"), false);
});

test("fastify-app registra onSend y delega no-store sensible al helper backend", () => {
  const source = readSource("server/fastify-app.ts");

  assert.ok(source.includes('app.addHook(\n    "onSend"'));
  assert.ok(source.includes("applySensitiveApiNoStoreHeaders(request, reply)"));
});

const AUTHENTICATED_ROUTES_WITHOUT_OWN_CACHE_HEADER: readonly {
  file: string;
  label: string;
}[] = [
  { file: "server/routes/auth.fastify.ts", label: "clinic auth" },
  { file: "server/routes/admin-auth.fastify.ts", label: "admin auth" },
  { file: "server/routes/admin-reports.fastify.ts", label: "admin reports" },
  { file: "server/routes/admin-sessions.fastify.ts", label: "admin sessions" },
  {
    file: "server/routes/admin-particular-tokens.fastify.ts",
    label: "admin particular tokens",
  },
  {
    file: "server/routes/admin-report-access-tokens.fastify.ts",
    label: "admin report access tokens",
  },
  {
    file: "server/routes/admin-failed-login-alerts.fastify.ts",
    label: "admin failed login alerts",
  },
  {
    file: "server/routes/admin-study-tracking.fastify.ts",
    label: "admin study tracking",
  },
  {
    file: "server/routes/particular-auth.fastify.ts",
    label: "particular auth",
  },
  { file: "server/routes/reports.fastify.ts", label: "clinic reports" },
] as const;

for (const { file, label } of AUTHENTICATED_ROUTES_WITHOUT_OWN_CACHE_HEADER) {
  test(`${label} no sobreescribe Cache-Control (delega al hook global)`, () => {
    const source = readSource(file);

    const hasOwnCacheControl =
      /reply\s*\.\s*header\s*\(\s*["']cache-control["']/i.test(source);

    assert.equal(
      hasOwnCacheControl,
      false,
      `${file} no debe setear Cache-Control propio; el hook global de fastify-app.ts lo cubre`,
    );
  });
}

test("public-pricing mantiene Cache-Control publico propio", () => {
  const source = readSource("server/routes/public-pricing.fastify.ts");

  assert.ok(/reply\s*\.\s*header\s*\(\s*["']Cache-Control["']/i.test(source));
  assert.ok(source.includes("public, max-age="));
});

test("no-store sensible no introduce dependencia de frontend o UI", () => {
  const helperSource = readSource("server/lib/sensitive-response-cache.ts");
  const fastifyAppSource = readSource("server/fastify-app.ts");
  const combined = `${helperSource}\n${fastifyAppSource}`;

  assert.equal(combined.includes("frontend"), false);
  assert.equal(combined.includes(".tsx"), false);
  assert.equal(combined.includes("components"), false);
});
