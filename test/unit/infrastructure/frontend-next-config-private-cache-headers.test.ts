import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { registerHooks } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { listSourceFiles, readSourceFile } from "../../helpers/tracked-source-files.ts";

// Moved out of frontend/e2e/platform/auth/dashboard-logout-private-cache.spec.ts
// (E2E-GLOBAL-04): it evaluates the real nextConfig.headers() in Node and never
// needed a browser worker.

type HeaderRule = {
  source: string;
  has?: { type: string; key?: string; value?: string }[];
  headers: { key: string; value: string }[];
};

type RewriteRule = {
  source: string;
  has?: { type: string; key?: string; value?: string }[];
  destination: string;
};

type NextConfigModule = {
  default: {
    headers?: () => Promise<HeaderRule[]>;
    rewrites?: () => Promise<RewriteRule[]>;
  };
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

type ThemeModule = {
  THEME_INIT_LEGACY_SCRIPT_PATH: string;
  THEME_INIT_SCRIPT_SRC: string;
  THEME_INIT_SCRIPT_VERSION: string;
};

async function importThemeModule(): Promise<ThemeModule> {
  return (await import(
    pathToFileURL(resolve(REPO_ROOT, "frontend/src/lib/theme.ts")).href
  )) as ThemeModule;
}

function contentVersion(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex").slice(0, 16);
}

// Every theme script present under frontend/public, tracked or not: whatever
// is there gets served.
function publishedThemeScripts(): string[] {
  return listSourceFiles(resolve(REPO_ROOT, "frontend/public"), { extensions: [".js"] }).filter(
    (file) => file.startsWith("theme-init"),
  );
}

// .gitattributes pins the script to LF, so the text read here is byte for byte
// what Next serves.
function themeScriptBytes(fileName: string): Buffer {
  return Buffer.from(readSourceFile(`frontend/public/${fileName}`), "utf8");
}

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
// Its hash is part of the file name, so only that exact path may be cached for
// good: the unversioned path and any other version keep the default.
test("next.config makes the theme script immutable only at its exact content-versioned path", async () => {
  const { default: nextConfig } = (await import(NEXT_CONFIG_URL)) as NextConfigModule;
  const { THEME_INIT_SCRIPT_SRC, THEME_INIT_SCRIPT_VERSION } = await importThemeModule();

  assert.match(THEME_INIT_SCRIPT_VERSION, /^[0-9a-f]{16}$/);
  assert.equal(THEME_INIT_SCRIPT_SRC, `/theme-init.${THEME_INIT_SCRIPT_VERSION}.js`);

  const headerRules = (await nextConfig.headers?.()) ?? [];
  const scriptRules = headerRules.filter((rule) => rule.source.includes("theme-init"));
  assert.equal(scriptRules.length, 1, "exactly one header rule may name the theme script");

  const [scriptRule] = scriptRules;
  assert.equal(scriptRule.source, THEME_INIT_SCRIPT_SRC);
  assert.equal(scriptRule.has, undefined, "the version lives in the path, not in a query");
  assert.equal(/[:*(]/.test(scriptRule.source), false, "the rule must be a literal path, not a pattern");
  assert.deepEqual(scriptRule.headers, [
    { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
  ]);
});

// The immutable rule above is only as true as the name of the file: the one
// published script must be named after the hash of its own bytes, and nothing
// may publish or reference it without that hash.
test("the published theme script is named after the hash of its own bytes", async () => {
  const { THEME_INIT_SCRIPT_SRC, THEME_INIT_SCRIPT_VERSION } = await importThemeModule();
  const publishedScripts = publishedThemeScripts();

  assert.equal(
    publishedScripts.length,
    1,
    `exactly one theme script is published, found ${publishedScripts.join(", ")}`,
  );

  const bytes = themeScriptBytes(publishedScripts[0]!);
  const servedVersion = contentVersion(bytes);

  assert.equal(publishedScripts[0], `theme-init.${servedVersion}.js`);
  assert.equal(THEME_INIT_SCRIPT_VERSION, servedVersion);
  assert.equal(THEME_INIT_SCRIPT_SRC, `/theme-init.${servedVersion}.js`);

  const changed = Buffer.from(bytes);
  changed[changed.length - 1] = changed[changed.length - 1]! ^ 0xff;
  assert.notEqual(
    `/theme-init.${contentVersion(changed)}.js`,
    THEME_INIT_SCRIPT_SRC,
    "changed bytes can never be published under the URL clients already hold",
  );

  assert.equal(
    readSourceFile("frontend/src/lib/theme.ts").includes("?v="),
    false,
    "the script URL must not be built from a version query",
  );
  assert.equal(
    readSourceFile("frontend/public/sw.js").includes("theme-init"),
    false,
    "sw.js caches the script by request URL only; naming it there would pin stale bytes across script changes",
  );
});

// A document rendered by an earlier build asks for /theme-init.js?v=<version>.
// That URL was immutable under that build, so it may keep resolving only while
// its version is still the one published: once the bytes change it must stop
// resolving instead of serving different bytes under a URL clients pinned.
test("next.config resolves the legacy theme script URL only at the published version", async () => {
  const { default: nextConfig } = (await import(NEXT_CONFIG_URL)) as NextConfigModule;
  const { THEME_INIT_LEGACY_SCRIPT_PATH, THEME_INIT_SCRIPT_SRC, THEME_INIT_SCRIPT_VERSION } =
    await importThemeModule();

  assert.equal(THEME_INIT_LEGACY_SCRIPT_PATH, "/theme-init.js");

  const rewriteRules = (await nextConfig.rewrites?.()) ?? [];
  assert.ok(Array.isArray(rewriteRules), "rewrites must stay afterFiles: a published file always wins");

  const scriptRewrites = rewriteRules.filter(
    (rule) => rule.source.includes("theme-init") || rule.destination.includes("theme-init"),
  );
  assert.deepEqual(scriptRewrites, [
    {
      source: THEME_INIT_LEGACY_SCRIPT_PATH,
      has: [{ type: "query", key: "v", value: THEME_INIT_SCRIPT_VERSION }],
      destination: THEME_INIT_SCRIPT_SRC,
    },
  ]);

  const headerRules = (await nextConfig.headers?.()) ?? [];
  assert.equal(
    headerRules.some((rule) => rule.source === THEME_INIT_LEGACY_SCRIPT_PATH),
    false,
    "the legacy path carries no content identity and must keep the revalidating default",
  );
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
// changes with its bytes: a hash in the path. A pattern, a bare stable path or
// a condition outside the path can never promise that.
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

    assert.equal(rule.has, undefined, `${rule.source} is immutable under a condition outside its path`);
    assert.match(
      rule.source,
      /\.[0-9a-f]{16}\.[a-z0-9]+$/,
      `${rule.source} is immutable without a content version in its path`,
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
