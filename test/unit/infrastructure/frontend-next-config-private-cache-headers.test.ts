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
const CONFIG_LOCAL_SPECIFIERS = new Set([
  "./src/lib/security/csp-policy",
  "./src/lib/theme",
  "./src/lib/fonts",
]);

// next.config.ts imports its local modules without an extension, which the
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

// Icons and public images keep stable URLs: the manifest, the document icon
// links, the social metadata and the service worker precache name them. A
// stable URL can change bytes, so it may never be cached for good; it follows
// the manifest that references it. The image optimizer also inherits its
// freshness from the upstream max-age, so a year here would pin every
// optimized variant of a public image for a year under an unchanged URL.
test("next.config keeps the stable icon and image URLs revalidable, never immutable", async () => {
  const { default: nextConfig } = (await import(NEXT_CONFIG_URL)) as NextConfigModule;
  const headerRules = (await nextConfig.headers?.()) ?? [];
  const cacheControlOf = (source: string): string | undefined =>
    headerRules
      .find((rule) => rule.source === source)
      ?.headers.find((header) => header.key === "Cache-Control")?.value;

  const manifestPolicy = cacheControlOf("/manifest.webmanifest");
  assert.equal(manifestPolicy, "public, max-age=3600, must-revalidate");

  for (const source of ["/icons/:path*", "/images/:path*"]) {
    assert.equal(
      cacheControlOf(source),
      manifestPolicy,
      `${source} must follow the manifest policy`,
    );
  }
});

// Whatever the path, a response may be cached for good only when its URL
// changes with its bytes: a hash in the path, or the exact version query of
// the rule. A pattern or a bare stable path can never promise that.
test("next.config grants immutable only to content-versioned URLs", async () => {
  const { default: nextConfig } = (await import(NEXT_CONFIG_URL)) as NextConfigModule;
  const headerRules = (await nextConfig.headers?.()) ?? [];
  const immutableRules = headerRules.filter((rule) =>
    rule.headers.some(
      (header) => header.key === "Cache-Control" && header.value.includes("immutable"),
    ),
  );

  assert.ok(immutableRules.length > 0, "the scan must see the versioned rules");

  for (const rule of immutableRules) {
    assert.equal(
      /[:*(]/.test(rule.source),
      false,
      `${rule.source} is a pattern: immutable needs one literal URL`,
    );

    const versionedByPath = /\.[0-9a-f]{16}\.[a-z0-9]+$/.test(rule.source);
    const versionedByQuery =
      rule.has?.length === 1 &&
      rule.has[0]!.type === "query" &&
      /^[0-9a-f]{16}$/.test(rule.has[0]!.value ?? "");

    assert.ok(
      versionedByPath || versionedByQuery,
      `${rule.source} is immutable without a content version in its URL`,
    );
  }
});

// The font is preloaded by every document. Its hash is part of the file name,
// so only that exact path may be cached for good: a generic /fonts rule would
// also pin any unversioned file published there later.
test("next.config makes the font immutable only at its exact content-versioned path", async () => {
  const { default: nextConfig } = (await import(NEXT_CONFIG_URL)) as NextConfigModule;
  const { INTER_FONT_PATH, INTER_FONT_VERSION } = (await import(
    pathToFileURL(resolve(REPO_ROOT, "frontend/src/lib/fonts.ts")).href
  )) as { INTER_FONT_PATH: string; INTER_FONT_VERSION: string };

  assert.match(INTER_FONT_VERSION, /^[0-9a-f]{16}$/);
  assert.equal(INTER_FONT_PATH, `/fonts/InterVariable.${INTER_FONT_VERSION}.woff2`);

  const headerRules = (await nextConfig.headers?.()) ?? [];
  const fontRules = headerRules.filter((rule) => rule.source.includes("/fonts"));
  assert.equal(fontRules.length, 1, "exactly one header rule may name /fonts");

  const [fontRule] = fontRules;
  assert.equal(fontRule.source, INTER_FONT_PATH);
  assert.equal(fontRule.has, undefined);
  assert.equal(/[:*(]/.test(fontRule.source), false, "the rule must be a literal path, not a pattern");
  assert.deepEqual(fontRule.headers, [
    { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
  ]);
});
