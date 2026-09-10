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
  headers: { key: string; value: string }[];
};

type NextConfigModule = {
  default: { headers?: () => Promise<HeaderRule[]> };
};

const REPO_ROOT = resolve(import.meta.dirname, "../../..");
const NEXT_CONFIG_URL = pathToFileURL(resolve(REPO_ROOT, "frontend/next.config.ts")).href;
const CSP_POLICY_SPECIFIER = "./src/lib/security/csp-policy";

// next.config.ts imports the CSP policy without an extension, which the
// type-stripping loader cannot resolve. Limit the fallback to that exact
// configuration import, so this process installs no general module resolver.
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (context.parentURL !== NEXT_CONFIG_URL || specifier !== CSP_POLICY_SPECIFIER) {
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
