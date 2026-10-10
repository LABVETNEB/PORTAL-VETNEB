import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Moved out of frontend/e2e/platform/auth/dashboard-logout-private-cache.spec.ts
// (E2E-GLOBAL-04): it evaluates the real nextConfig.headers() in Node and never
// needed a browser worker.

type HeaderRule = {
  source: string;
  has?: { type: string; key?: string; value?: string }[];
  headers: { key: string; value: string }[];
};

type NextConfigModule = {
  default: { headers?: () => Promise<HeaderRule[]> };
};

const REPO_ROOT = resolve(import.meta.dirname, "../../..");
const NEXT_CONFIG_URL = pathToFileURL(resolve(REPO_ROOT, "frontend/next.config.ts")).href;
const CONFIG_LOCAL_SPECIFIERS = new Set(["./src/lib/security/csp-policy", "./src/lib/theme"]);

// next.config.ts imports its two local modules without an extension, which the
// type-stripping loader cannot resolve. Limit the fallback to those exact
// configuration imports, so this process installs no general module resolver.
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (context.parentURL !== NEXT_CONFIG_URL || !CONFIG_LOCAL_SPECIFIERS.has(specifier)) {
        throw error;
      }
      return nextResolve(`${specifier}.ts`, context);
    }
  },
});

test("next.config declares no-store Cache-Control for /dashboard", async () => {
  const { default: nextConfig } = (await import(NEXT_CONFIG_URL)) as NextConfigModule;

  const headerRules = (await nextConfig.headers?.()) ?? [];
  const dashboardRule = headerRules.find((rule) => rule.source === "/dashboard/:path*");
  assert.ok(dashboardRule, "private /dashboard header rule");

  const cacheControl = dashboardRule.headers.find((header) => header.key === "Cache-Control");
  assert.ok(
    (cacheControl?.value ?? "").includes("no-store"),
    `/dashboard Cache-Control must contain no-store, got: ${cacheControl?.value ?? "<missing>"}`,
  );
});

// theme-init.js blocks the parser of every document. Served revalidating, each
// document waits on a round trip to the origin before it can render; served
// long-lived without a version, a deploy would leave browsers on the old script.
test("next.config makes theme-init.js immutable only at its exact content version", async () => {
  const { default: nextConfig } = (await import(NEXT_CONFIG_URL)) as NextConfigModule;
  const { THEME_INIT_SCRIPT_PATH, THEME_INIT_SCRIPT_VERSION } = (await import(
    pathToFileURL(resolve(REPO_ROOT, "frontend/src/lib/theme.ts")).href
  )) as { THEME_INIT_SCRIPT_PATH: string; THEME_INIT_SCRIPT_VERSION: string };

  assert.equal(THEME_INIT_SCRIPT_PATH, "/theme-init.js");
  assert.match(THEME_INIT_SCRIPT_VERSION, /^[0-9a-f]{16}$/);

  const headerRules = (await nextConfig.headers?.()) ?? [];
  const scriptRules = headerRules.filter((rule) => rule.source.includes("theme-init"));
  assert.equal(scriptRules.length, 1, "exactly one header rule may name theme-init.js");

  const [scriptRule] = scriptRules;
  assert.equal(scriptRule.source, THEME_INIT_SCRIPT_PATH);
  assert.deepEqual(
    scriptRule.has,
    [{ type: "query", key: "v", value: THEME_INIT_SCRIPT_VERSION }],
    "the rule must apply to the current version only, never to the bare path or another query",
  );
  assert.deepEqual(scriptRule.headers, [
    { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
  ]);
});
