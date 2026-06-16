/**
 * auth-cookie-persistence-contract.test.ts
 *
 * Guarantees that:
 *  1. Login cookies for all three roles carry a positive Max-Age (persistent cookies).
 *  2. Logout builders clear with Max-Age=0 only.
 *  3. No frontend code uses sessionStorage/localStorage as auth source of truth.
 *     (UI theme preference files are allowlisted: vetneb-theme-mode only.)
 *  4. No frontend code triggers logout on beforeunload / unload / visibilitychange.
 *
 * These are source-level contract tests — they fail fast if the invariant is broken
 * before any runtime test executes.
 */

import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const REPO_ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));

function readSource(relativePath: string): string {
  return readFileSync(resolve(REPO_ROOT, relativePath), "utf8");
}

function collectTsFiles(dir: string): string[] {
  const results: string[] = [];

  for (const entry of readdirSync(dir)) {
    const full = `${dir}/${entry}`;
    const stat = statSync(full);

    if (stat.isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      results.push(...collectTsFiles(full));
    } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      results.push(full);
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// 1. Cookie builders use positive Max-Age on login
// ---------------------------------------------------------------------------

test("cookie persistence contract: clinic login builder encodes positive Max-Age", () => {
  const source = readSource("server/routes/auth.fastify.ts");

  assert.ok(
    source.includes("maxAgeSeconds: ENV.sessionTtlHours * 60 * 60"),
    "buildSessionCookie must pass maxAgeSeconds = sessionTtlHours * 3600",
  );
  assert.ok(
    source.includes("function buildSessionCookie"),
    "buildSessionCookie must be defined",
  );
  assert.ok(
    source.includes("function buildAdminSessionCookie"),
    "buildAdminSessionCookie must be defined (unified auth sets admin cookie)",
  );
  assert.ok(
    source.includes("function buildParticularSessionCookie"),
    "buildParticularSessionCookie must be defined (unified auth sets particular cookie)",
  );
});

test("cookie persistence contract: admin login builder encodes positive Max-Age", () => {
  const source = readSource("server/routes/admin-auth.fastify.ts");

  assert.ok(
    source.includes("maxAgeSeconds: ENV.sessionTtlHours * 60 * 60"),
    "buildAdminSessionCookie must pass maxAgeSeconds = sessionTtlHours * 3600",
  );
  assert.ok(
    source.includes("function buildAdminSessionCookie"),
    "buildAdminSessionCookie must be defined",
  );
});

test("cookie persistence contract: particular login builder encodes positive Max-Age", () => {
  const source = readSource("server/routes/particular-auth.fastify.ts");

  assert.ok(
    source.includes("maxAgeSeconds: ENV.sessionTtlHours * 60 * 60"),
    "buildParticularSessionCookie must pass maxAgeSeconds = sessionTtlHours * 3600",
  );
  assert.ok(
    source.includes("function buildParticularSessionCookie"),
    "buildParticularSessionCookie must be defined",
  );
});

// ---------------------------------------------------------------------------
// 2. Logout builders clear with Max-Age=0 and epoch Expires
// ---------------------------------------------------------------------------

test("cookie persistence contract: logout builders clear with Max-Age=0 and epoch Expires", () => {
  for (const [label, file, clearFn] of [
    ["clinic", "server/routes/auth.fastify.ts", "buildClearSessionCookie"],
    ["admin", "server/routes/admin-auth.fastify.ts", "buildClearAdminSessionCookie"],
    ["particular", "server/routes/particular-auth.fastify.ts", "buildClearParticularSessionCookie"],
  ] as const) {
    const source = readSource(file);

    assert.ok(
      source.includes(`function ${clearFn}`),
      `${label}: ${clearFn} must be defined`,
    );
    assert.ok(
      source.includes("maxAgeSeconds: 0"),
      `${label}: ${clearFn} must pass maxAgeSeconds: 0`,
    );
    assert.ok(
      source.includes('expires: "Thu, 01 Jan 1970 00:00:00 GMT"'),
      `${label}: ${clearFn} must include epoch Expires`,
    );
  }
});

// ---------------------------------------------------------------------------
// 3. Login cookie serializer emits Max-Age directive
// ---------------------------------------------------------------------------

test("cookie persistence contract: serializeCookie emits Max-Age directive", () => {
  for (const [label, file] of [
    ["clinic", "server/routes/auth.fastify.ts"],
    ["admin", "server/routes/admin-auth.fastify.ts"],
    ["particular", "server/routes/particular-auth.fastify.ts"],
  ] as const) {
    const source = readSource(file);

    assert.ok(
      source.includes("Max-Age=${input.maxAgeSeconds}"),
      `${label}: serializeCookie must emit Max-Age directive`,
    );
    assert.ok(
      source.includes('typeof input.maxAgeSeconds === "number"'),
      `${label}: serializeCookie must guard maxAgeSeconds type before emitting`,
    );
  }
});

// ---------------------------------------------------------------------------
// 4. No frontend code uses sessionStorage / localStorage as auth source
// ---------------------------------------------------------------------------

// Non-auth UI preference files allowed to persist a non-sensitive client choice
// via localStorage. Each may only touch its own allowlisted preference key(s)
// and never session/auth state.
const UI_PREFERENCE_FILES: Array<{ path: string; keyMarkers: string[] }> = [
  {
    path: "frontend/src/lib/theme.ts",
    keyMarkers: ['"vetneb-theme-mode"', "THEME_STORAGE_KEY"],
  },
  {
    path: "frontend/src/components/theme/ThemeModeToggle.tsx",
    keyMarkers: ['"vetneb-theme-mode"', "THEME_STORAGE_KEY"],
  },
  {
    path: "frontend/src/lib/dashboard-last-module.ts",
    keyMarkers: [
      "CLINIC_LAST_MODULE_STORAGE_KEY",
      "ADMIN_LAST_MODULE_STORAGE_KEY",
    ],
  },
];

function matchUiPreferenceFile(
  file: string,
): { path: string; keyMarkers: string[] } | undefined {
  const normalized = file.split("\\").join("/");
  return UI_PREFERENCE_FILES.find((allowed) =>
    normalized.endsWith(allowed.path),
  );
}

test("cookie persistence contract: frontend has no sessionStorage or localStorage auth source", () => {
  const frontendSrcDir = resolve(REPO_ROOT, "frontend/src");
  const files = collectTsFiles(frontendSrcDir);

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    const relPath = file.replace(REPO_ROOT + "/", "");

    assert.equal(
      source.includes("sessionStorage"),
      false,
      `${relPath} must not use sessionStorage`,
    );

    const uiPreference = matchUiPreferenceFile(file);
    if (uiPreference) {
      assert.ok(
        uiPreference.keyMarkers.some((marker) => source.includes(marker)),
        `${relPath} may only use localStorage for its allowlisted preference key`,
      );
      for (const forbidden of ["session", "auth", "cookie", "token"]) {
        assert.equal(
          source.toLowerCase().includes(forbidden),
          false,
          `${relPath} must not reference ${forbidden} state`,
        );
      }
      continue;
    }

    assert.equal(
      source.includes("localStorage"),
      false,
      `${relPath} must not use localStorage`,
    );
  }
});

// ---------------------------------------------------------------------------
// 5. No frontend code triggers logout on tab close events
// ---------------------------------------------------------------------------

test("cookie persistence contract: frontend has no beforeunload/unload/visibilitychange logout", () => {
  const frontendSrcDir = resolve(REPO_ROOT, "frontend/src");
  const files = collectTsFiles(frontendSrcDir);

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    const relPath = file.replace(REPO_ROOT + "/", "");

    assert.equal(
      source.includes("beforeunload"),
      false,
      `${relPath} must not register beforeunload`,
    );
    assert.equal(
      source.includes('"unload"'),
      false,
      `${relPath} must not register unload event listener`,
    );
    assert.equal(
      source.includes("'unload'"),
      false,
      `${relPath} must not register unload event listener`,
    );
    assert.equal(
      source.includes("visibilitychange"),
      false,
      `${relPath} must not register visibilitychange`,
    );
  }
});

// ---------------------------------------------------------------------------
// 6. Session validation is cookie-based (not memory-based) on page load
// ---------------------------------------------------------------------------

test("cookie persistence contract: AuthContext calls backend on mount to hydrate session", () => {
  const source = readSource("frontend/src/context/AuthContext.tsx");

  assert.ok(
    source.includes("getClinicSession"),
    "AuthContext must call getClinicSession to validate session from cookie",
  );
  assert.ok(
    source.includes("useEffect"),
    "AuthContext must use useEffect to trigger hydration on mount",
  );
  assert.ok(
    source.includes("refreshSession"),
    "AuthContext must expose refreshSession for rehydration",
  );
  assert.equal(
    source.includes("sessionStorage"),
    false,
    "AuthContext must not use sessionStorage",
  );
  assert.equal(
    source.includes("localStorage"),
    false,
    "AuthContext must not use localStorage",
  );
});

test("cookie persistence contract: ParticularesContent calls backend on mount to hydrate session", () => {
  const source = readSource("frontend/src/components/public/ParticularesContent.tsx");

  assert.ok(
    source.includes("getParticularSession"),
    "ParticularesContent must call getParticularSession to validate session from cookie",
  );
  assert.ok(
    source.includes("useEffect"),
    "ParticularesContent must use useEffect to trigger hydration on mount",
  );
  assert.equal(
    source.includes("sessionStorage"),
    false,
    "ParticularesContent must not use sessionStorage",
  );
  assert.equal(
    source.includes("localStorage"),
    false,
    "ParticularesContent must not use localStorage",
  );
});

// ---------------------------------------------------------------------------
// 7. proxy protects /dashboard/* using cookies (not memory state)
// ---------------------------------------------------------------------------

test("cookie persistence contract: Next.js proxy guards dashboard using cookie presence", () => {
  const source = readSource("frontend/src/proxy.ts");

  assert.ok(
    source.includes("request.cookies.get"),
    "middleware must read cookies from request to protect dashboard",
  );
  assert.ok(
    source.includes("app_session_id"),
    "middleware must check app_session_id for clinic dashboard",
  );
  assert.ok(
    source.includes("admin_session_id"),
    "middleware must check admin_session_id for admin dashboard",
  );
  assert.equal(
    source.includes("sessionStorage"),
    false,
    "middleware must not check sessionStorage",
  );
  assert.equal(
    source.includes("localStorage"),
    false,
    "middleware must not check localStorage",
  );
});
