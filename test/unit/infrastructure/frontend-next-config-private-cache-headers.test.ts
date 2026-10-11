import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { registerHooks } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { listSourceFiles, readSourceFile } from "../../helpers/tracked-source-files.ts";
import {
  ACCESS_DOCUMENT_PATHS as SERVED_ACCESS_DOCUMENT_PATHS,
  PUBLIC_DOCUMENT_PATHS as SERVED_PUBLIC_DOCUMENT_PATHS,
  cachePolicyViolations,
  unvalidatedReuseSeconds,
  type ServedSurface,
} from "../../../frontend/e2e/helpers/http-cache-policy.ts";

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
  PUBLIC_DOCUMENT_CACHE_CONTROL: string;
  PUBLIC_DOCUMENT_PATHS: readonly string[];
  ACCESS_DOCUMENT_CACHE_CONTROL: string;
  ACCESS_DOCUMENT_PATHS: readonly string[];
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

// A1-5 — documents of a stable URL. Next serves a prerendered page with
// `s-maxage=31536000` unless the response already carries a Cache-Control, and
// a next.config header rule is what puts one there first. The contracts below
// hold the declaration; frontend/e2e/public/cache holds what is served.

// What `next start` (16.3.8) answers when no rule names the path, measured on
// main@2ca8d6ab before the document rules existed.
const NEXT_PRERENDER_DEFAULT = "s-maxage=31536000";
const NEXT_DYNAMIC_DEFAULT = "private, no-cache, no-store, max-age=0, must-revalidate";
const NEXT_PUBLIC_FILE_DEFAULT = "public, max-age=0";
const NEXT_BUILD_ASSET_DEFAULT = "public, max-age=31536000, immutable";

type DeclaredSurface = {
  path: string;
  surface: ServedSurface;
  nextDefault: string;
  contentType?: string;
};

// The three source shapes next.config.ts uses. Any other shape fails here, so
// a new kind of rule cannot be resolved by guesswork.
function ruleApplies(source: string, pathname: string): boolean {
  if (source === "/(.*)") {
    return true;
  }

  if (source.endsWith("/:path*")) {
    const prefix = source.slice(0, -"/:path*".length);

    return !/[:*(]/.test(prefix) && (pathname === prefix || pathname.startsWith(`${prefix}/`));
  }

  assert.equal(/[:*(]/.test(source), false, `unsupported header rule source: ${source}`);

  return source === pathname;
}

// Next applies every matching rule in order, so the last one to set the
// header is the one the response carries.
function declaredCacheControl(rules: HeaderRule[], pathname: string): string | undefined {
  let value: string | undefined;

  for (const rule of rules) {
    if (ruleApplies(rule.source, pathname)) {
      value = rule.headers.find((header) => header.key === "Cache-Control")?.value ?? value;
    }
  }

  return value;
}

function policyViolations(rules: HeaderRule[], surfaces: DeclaredSurface[]): Map<string, string[]> {
  const violations = new Map<string, string[]>();

  for (const { path, surface, nextDefault, contentType } of surfaces) {
    const found = cachePolicyViolations(surface, {
      cacheControl: declaredCacheControl(rules, path) ?? nextDefault,
      contentType,
    });

    if (found.length > 0) {
      violations.set(path, found);
    }
  }

  return violations;
}

async function declaredSurfaces(): Promise<{ rules: HeaderRule[]; surfaces: DeclaredSurface[] }> {
  const config = (await import(NEXT_CONFIG_URL)) as NextConfigModule;
  const { THEME_INIT_SCRIPT_SRC } = await importThemeModule();
  const { INTER_FONT_PATH } = (await import(
    pathToFileURL(resolve(REPO_ROOT, "frontend/src/lib/fonts.ts")).href
  )) as { INTER_FONT_PATH: string };
  const html = "text/html; charset=utf-8";

  return {
    rules: (await config.default.headers?.()) ?? [],
    surfaces: [
      ...config.PUBLIC_DOCUMENT_PATHS.map((path) => ({
        path,
        surface: "public-document" as const,
        nextDefault: NEXT_PRERENDER_DEFAULT,
        contentType: html,
      })),
      ...config.ACCESS_DOCUMENT_PATHS.map((path) => ({
        path,
        surface: "access-document" as const,
        nextDefault: NEXT_PRERENDER_DEFAULT,
        contentType: html,
      })),
      ...["/dashboard", "/dashboard/admin", "/dashboard/informes"].map((path) => ({
        path,
        surface: "private" as const,
        nextDefault: NEXT_DYNAMIC_DEFAULT,
      })),
      { path: "/api/build-info", surface: "private", nextDefault: "no-store, max-age=0" },
      { path: "/sw.js", surface: "private", nextDefault: NEXT_PUBLIC_FILE_DEFAULT },
      {
        path: "/offline-fallback.html",
        surface: "offline-fallback",
        nextDefault: NEXT_PUBLIC_FILE_DEFAULT,
        contentType: html,
      },
      { path: THEME_INIT_SCRIPT_SRC, surface: "immutable-asset", nextDefault: NEXT_PUBLIC_FILE_DEFAULT },
      { path: INTER_FONT_PATH, surface: "immutable-asset", nextDefault: NEXT_PUBLIC_FILE_DEFAULT },
      {
        path: "/_next/static/chunks/build.js",
        surface: "immutable-asset",
        nextDefault: NEXT_BUILD_ASSET_DEFAULT,
      },
      ...["/manifest.webmanifest", "/icons/icon-192x192.png", "/images/hero-microscope-vetneb.webp"].map(
        (path) => ({ path, surface: "stable-asset" as const, nextDefault: NEXT_PUBLIC_FILE_DEFAULT }),
      ),
    ],
  };
}

function withRule(rules: HeaderRule[], source: string, cacheControl: string): HeaderRule[] {
  return [...rules, { source, headers: [{ key: "Cache-Control", value: cacheControl }] }];
}

// Every page the application can prerender gets its policy by name. A route
// that nobody classified would silently keep the one-year default.
test("next.config names every prerendered document route in exactly one cache class", async () => {
  const config = (await import(NEXT_CONFIG_URL)) as NextConfigModule;
  const routes = listSourceFiles(resolve(REPO_ROOT, "frontend/src/app"), { extensions: [".tsx"] })
    .filter((file) => file === "page.tsx" || file.endsWith("/page.tsx"))
    .map((file) => `/${file.slice(0, -"page.tsx".length)}`.replace(/\/$/, "") || "/");

  assert.ok(routes.includes("/") && routes.includes("/servicios"), "the scan must see the public pages");
  assert.deepEqual(
    routes.filter((route) => /[(@]/.test(route)),
    [],
    "route groups and slots change the URL of a page: extend this census before using them",
  );

  const prerendered = routes.filter(
    (route) => !route.includes("[") && route !== "/dashboard" && !route.startsWith("/dashboard/"),
  );
  const classified = [...config.PUBLIC_DOCUMENT_PATHS, ...config.ACCESS_DOCUMENT_PATHS];

  assert.deepEqual([...classified].sort(), [...prerendered].sort());
  assert.equal(new Set(classified).size, classified.length, "a route belongs to one class only");
  assert.deepEqual([...config.ACCESS_DOCUMENT_PATHS], ["/login", "/particulares"]);

  // The served contract walks its own copy of these lists.
  assert.deepEqual([...SERVED_PUBLIC_DOCUMENT_PATHS], [...config.PUBLIC_DOCUMENT_PATHS]);
  assert.deepEqual([...SERVED_ACCESS_DOCUMENT_PATHS], [...config.ACCESS_DOCUMENT_PATHS]);
});

test("next.config gives each document route one literal rule carrying its class policy", async () => {
  const config = (await import(NEXT_CONFIG_URL)) as NextConfigModule;
  const headerRules = (await config.default.headers?.()) ?? [];

  assert.equal(config.PUBLIC_DOCUMENT_CACHE_CONTROL, "public, max-age=0, s-maxage=0, must-revalidate");
  assert.equal(config.ACCESS_DOCUMENT_CACHE_CONTROL, "private, no-cache, max-age=0, must-revalidate");

  for (const [paths, cacheControl] of [
    [config.PUBLIC_DOCUMENT_PATHS, config.PUBLIC_DOCUMENT_CACHE_CONTROL],
    [config.ACCESS_DOCUMENT_PATHS, config.ACCESS_DOCUMENT_CACHE_CONTROL],
  ] as const) {
    for (const path of paths) {
      assert.deepEqual(
        headerRules.filter((rule) => rule.source === path),
        [{ source: path, headers: [{ key: "Cache-Control", value: cacheControl }] }],
        `${path} needs exactly one unconditional rule`,
      );
    }
  }

  // No pattern may decide the cache policy of a document it was not written
  // for: the only patterns that set Cache-Control are these three.
  assert.deepEqual(
    headerRules
      .filter(
        (rule) =>
          /[:*(]/.test(rule.source) && rule.headers.some((header) => header.key === "Cache-Control"),
      )
      .map((rule) => rule.source),
    ["/dashboard/:path*", "/icons/:path*", "/images/:path*"],
  );
});

test("the declared rules leave no document reusable without validation and no other surface changed", async () => {
  const { rules, surfaces } = await declaredSurfaces();

  assert.deepEqual([...policyViolations(rules, surfaces)], []);

  // The default this stage replaces: a year for a shared cache, and no stated
  // lifetime at all for the browser, which is then free to pick its own.
  assert.equal(unvalidatedReuseSeconds("shared", { cacheControl: NEXT_PRERENDER_DEFAULT }), 31_536_000);
  assert.equal(unvalidatedReuseSeconds("private", { cacheControl: NEXT_PRERENDER_DEFAULT }), Infinity);
});

test("the cache contract rejects each way the document policy can be lost or spread", async () => {
  const { rules, surfaces } = await declaredSurfaces();
  const config = (await import(NEXT_CONFIG_URL)) as NextConfigModule;
  const documents = [...config.PUBLIC_DOCUMENT_PATHS, ...config.ACCESS_DOCUMENT_PATHS];
  const flagged = (mutated: HeaderRule[]) => [...policyViolations(mutated, surfaces).keys()];
  const versioned = surfaces.filter(({ surface }) => surface === "immutable-asset").map(({ path }) => path);

  // The rule of one route is dropped: that route falls back to a year.
  assert.deepEqual(flagged(rules.filter((rule) => rule.source !== "/servicios")), ["/servicios"]);

  // Every document rule is dropped: the configuration before A1-5.
  assert.deepEqual(flagged(rules.filter((rule) => !documents.includes(rule.source))), documents);

  // A lifetime comes back, under any of its spellings.
  for (const lifetime of [
    "public, max-age=0, s-maxage=31536000",
    "public, max-age=300, must-revalidate",
    "public, max-age=0, s-maxage=0, stale-while-revalidate=86400",
    "public, max-age=0, s-maxage=0, stale-if-error=86400",
    "public, max-age=31536000, immutable",
    "public, max-age=0, s-maxage=abc",
  ]) {
    assert.deepEqual(flagged(withRule(rules, "/precios", lifetime)), ["/precios"], lifetime);
  }

  // An entry-point document is given the public policy.
  assert.deepEqual(flagged(withRule(rules, "/login", config.PUBLIC_DOCUMENT_CACHE_CONTROL)), ["/login"]);

  // no-store spread over everything: the worker can no longer precache its
  // fallback, versioned assets stop being cached and documents stop being
  // validated.
  const storeNothing = flagged(withRule(rules, "/(.*)", "no-store"));

  for (const path of ["/offline-fallback.html", "/", "/manifest.webmanifest", ...versioned]) {
    assert.ok(storeNothing.includes(path), `a universal no-store must be rejected at ${path}`);
  }

  // The document policy spread over everything: private surfaces become
  // public, entry points shareable and versioned assets revalidated.
  const everythingPublic = flagged(withRule(rules, "/(.*)", config.PUBLIC_DOCUMENT_CACHE_CONTROL));

  for (const path of ["/dashboard", "/dashboard/admin", "/api/build-info", "/sw.js", "/login", ...versioned]) {
    assert.ok(everythingPublic.includes(path), `a universal document policy must be rejected at ${path}`);
  }

  // A long lifetime spread over everything reaches every document again.
  const everythingPinned = flagged(withRule(rules, "/(.*)", NEXT_BUILD_ASSET_DEFAULT));

  for (const path of [...documents, "/offline-fallback.html", "/manifest.webmanifest"]) {
    assert.ok(everythingPinned.includes(path), `a universal lifetime must be rejected at ${path}`);
  }
});

// The router payload shares its URL with the document and the 304 renews the
// stored copy with its own headers: both are responses, not declarations.
test("the cache contract rejects a router payload or a 304 a cache could hand out as the document", () => {
  const varyOnPayload = "rsc, next-router-state-tree, next-router-prefetch, Accept-Encoding";
  const payload = {
    cacheControl: "public, max-age=0, s-maxage=0, must-revalidate",
    contentType: "text/x-component",
    vary: varyOnPayload,
  };

  assert.deepEqual(cachePolicyViolations("flight", payload), []);
  assert.notDeepEqual(cachePolicyViolations("flight", { ...payload, vary: "Accept-Encoding" }), []);
  assert.notDeepEqual(cachePolicyViolations("flight", { ...payload, cacheControl: NEXT_PRERENDER_DEFAULT }), []);
  assert.notDeepEqual(cachePolicyViolations("flight", { ...payload, contentType: "text/html" }), []);
  assert.notDeepEqual(cachePolicyViolations("public-document", payload), []);

  assert.deepEqual(cachePolicyViolations("revalidated", { cacheControl: payload.cacheControl }), []);
  assert.notDeepEqual(cachePolicyViolations("revalidated", { cacheControl: NEXT_PRERENDER_DEFAULT }), []);
  assert.notDeepEqual(
    cachePolicyViolations("revalidated", {}),
    [],
    "without a stated lifetime a cache may derive one of its own",
  );

  // Only `next start` can show whether a shared cache may store an entry point.
  const devStamp = { cacheControl: "no-cache, must-revalidate", contentType: "text/html" };

  assert.deepEqual(cachePolicyViolations("access-document", devStamp, "next-dev"), []);
  assert.notDeepEqual(cachePolicyViolations("access-document", devStamp, "next-start"), []);
  assert.notDeepEqual(
    cachePolicyViolations("access-document", { ...devStamp, setCookie: "name=value" }, "next-dev"),
    [],
  );
});

// A response that does not say how long it may be reused is not a response
// that may not be reused: a cache is free to derive a lifetime of its own
// (RFC 9111 §4.2.2). Only an explicit zero, an unqualified no-cache or a
// response no cache of that kind may store proves that the origin is asked.
test("the cache contract never reads an unstated or unreadable lifetime as zero", () => {
  const html = "text/html; charset=utf-8";
  const unproven: (string | undefined)[] = [
    undefined,
    "",
    "public",
    "must-revalidate",
    "public, must-revalidate",
    "private",
    "s-maxage=0",
    "max-stale=0, unknown-directive",
    "max-age=abc",
    "max-age=",
    "max-age",
    "max-age=-1",
    "max-age=0, max-age=3600",
    'no-cache="set-cookie"',
  ];

  for (const cacheControl of unproven) {
    const label = `Cache-Control: ${cacheControl ?? "<absent>"}`;

    assert.notEqual(unvalidatedReuseSeconds("private", { cacheControl }), 0, `private, ${label}`);
    assert.notDeepEqual(cachePolicyViolations("public-document", { cacheControl, contentType: html }), [], label);
    assert.notDeepEqual(cachePolicyViolations("access-document", { cacheControl, contentType: html }), [], label);
    assert.notDeepEqual(
      cachePolicyViolations("flight", { cacheControl, contentType: "text/x-component", vary: "rsc" }),
      [],
      label,
    );
    // A 304 renews the stored copy with whatever it carries. An ETag is not
    // read at all: a validator makes validation possible, not mandatory.
    assert.notDeepEqual(cachePolicyViolations("revalidated", { cacheControl }), [], label);
    assert.notDeepEqual(cachePolicyViolations("stable-asset", { cacheControl }), [], label);
    assert.notDeepEqual(cachePolicyViolations("immutable-asset", { cacheControl }), [], label);
  }

  assert.notDeepEqual(cachePolicyViolations("immutable-asset", { cacheControl: "public, immutable" }), []);

  // An Expires that cannot be read, or measured from, proves nothing either.
  for (const dated of [
    { expires: "0" },
    { expires: "not a date" },
    { expires: "Mon, 05 Oct 2026 00:00:00 GMT", date: "not a date" },
  ]) {
    assert.notDeepEqual(cachePolicyViolations("revalidated", dated), [], JSON.stringify(dated));
    assert.notDeepEqual(cachePolicyViolations("stable-asset", { cacheControl: "public", ...dated }), []);
  }

  const servedAt = "Mon, 05 Oct 2026 00:00:00 GMT";

  assert.equal(unvalidatedReuseSeconds("shared", { expires: "Mon, 05 Oct 2026 01:00:00 GMT", date: servedAt }), 3600);
  assert.equal(unvalidatedReuseSeconds("shared", { expires: "Sun, 04 Oct 2026 00:00:00 GMT", date: servedAt }), 0);

  // The shared and the private lifetime are read separately.
  assert.equal(unvalidatedReuseSeconds("shared", { cacheControl: "s-maxage=0" }), 0);
  assert.equal(unvalidatedReuseSeconds("shared", { cacheControl: "private" }), 0);
  assert.equal(unvalidatedReuseSeconds("shared", { cacheControl: 'private="set-cookie", max-age=60' }), 60);
  assert.equal(unvalidatedReuseSeconds("private", { cacheControl: "max-age=0, s-maxage=3600" }), 0);
  assert.equal(unvalidatedReuseSeconds("shared", { cacheControl: "max-age=0, s-maxage=3600" }), 3600);
  assert.equal(unvalidatedReuseSeconds("shared", { cacheControl: "max-age=0, s-maxage=1e3" }), Infinity);

  // What does prove it, and what each surface is still allowed to carry.
  for (const proven of ["no-cache", "no-cache, must-revalidate", "max-age=0", "no-store"]) {
    assert.equal(unvalidatedReuseSeconds("shared", { cacheControl: proven }), 0, proven);
    assert.equal(unvalidatedReuseSeconds("private", { cacheControl: proven }), 0, proven);
  }

  const publicPolicy = { cacheControl: "public, max-age=0, s-maxage=0, must-revalidate", contentType: html };
  const accessPolicy = { cacheControl: "private, no-cache, max-age=0, must-revalidate", contentType: html };

  assert.deepEqual(cachePolicyViolations("public-document", publicPolicy), []);
  assert.deepEqual(cachePolicyViolations("access-document", accessPolicy), []);
  assert.deepEqual(cachePolicyViolations("revalidated", { cacheControl: "no-cache, must-revalidate" }), []);
  assert.deepEqual(cachePolicyViolations("private", { cacheControl: "no-store" }), []);
  assert.notDeepEqual(cachePolicyViolations("public-document", { ...publicPolicy, cacheControl: "no-store" }), []);
  assert.notDeepEqual(cachePolicyViolations("offline-fallback", { cacheControl: "no-store", contentType: html }), []);
  assert.deepEqual(cachePolicyViolations("stable-asset", { cacheControl: "public, max-age=3600, must-revalidate" }), []);
  assert.notDeepEqual(cachePolicyViolations("public-document", { ...publicPolicy, cacheControl: "public, max-age=3600, must-revalidate" }), []);
  assert.deepEqual(cachePolicyViolations("immutable-asset", { cacheControl: NEXT_BUILD_ASSET_DEFAULT }), []);
  assert.notDeepEqual(cachePolicyViolations("public-document", { ...publicPolicy, cacheControl: NEXT_BUILD_ASSET_DEFAULT }), []);
});
