import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../../", import.meta.url)));

const SESSION_COOKIE_BOUNDARIES = {
  clinic: {
    cookieEnv: "ENV.cookieName",
    sessionLookup: "getActiveSessionByToken",
    sessionDelete: "deleteActiveSession",
    clearCookieBuilder: "buildClearSessionCookie",
  },
  admin: {
    cookieEnv: "ENV.adminCookieName",
    sessionLookup: "getAdminSessionByToken",
    sessionDelete: "deleteAdminSession",
    clearCookieBuilder: "buildClearAdminSessionCookie",
  },
  particular: {
    cookieEnv: "ENV.particularCookieName",
    sessionLookup: "getParticularSessionByToken",
    sessionDelete: "deleteParticularSession",
    clearCookieBuilder: "buildClearParticularSessionCookie",
  },
} as const;

const CLINIC_SESSION_FILES = [
  "server/routes/auth.fastify.ts",
  "server/routes/clinic-audit.fastify.ts",
  "server/routes/study-tracking.fastify.ts",
] as const;

const ADMIN_SESSION_FILES = [
  "server/routes/admin-audit.fastify.ts",
  "server/routes/admin-auth.fastify.ts",
  "server/routes/admin-failed-login-alerts.fastify.ts",
  "server/routes/admin-particular-tokens.fastify.ts",
  "server/routes/admin-report-access-tokens.fastify.ts",
  "server/routes/admin-reports.fastify.ts",
  "server/routes/admin-sessions.fastify.ts",
  "server/routes/admin-study-tracking.fastify.ts",
  "server/routes/admin-system-health.fastify.ts",
  "server/routes/admin-system-maintenance.fastify.ts",
  "server/routes/admin-system-schema-health.fastify.ts",
  "server/routes/admin-users-roles.fastify.ts",
] as const;

const ADMIN_FASTIFY_AUTH_ADAPTER_FILE = "server/lib/fastify-admin-auth.ts";

// WBR-08c: clinic-audit.fastify.ts delegates cookie handling to this
// canonical adapter instead of a local implementation (mirrors admin above).
const CLINIC_FASTIFY_AUTH_ADAPTER_FILE = "server/lib/fastify-clinic-auth.ts";

const PARTICULAR_SESSION_FILES = [
  "server/routes/particular-auth.fastify.ts",
  "server/routes/particular-audit.fastify.ts",
  "server/routes/particular-study-tracking.fastify.ts",
] as const;

function listFilesRecursive(relativeDir: string): string[] {
  const rootDir = resolve(REPO_ROOT, relativeDir);
  if (!existsSync(rootDir)) {
    return [];
  }

  const files: string[] = [];
  const walk = (absoluteDir: string): void => {
    for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
      const absolute = resolve(absoluteDir, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
      } else if (entry.isFile()) {
        files.push(relative(REPO_ROOT, absolute).split(sep).join("/"));
      }
    }
  };

  walk(rootDir);
  return files;
}

// Resolve a legacy test-root path to its current canonical location, tolerating tests
// already migrated into enterprise subdirectories (TEST-ARCH-13). Prefers the exact
// path; falls back to a unique basename match under the same top-level directory.
function resolveExistingSourcePath(relativePath: string): string | undefined {
  const normalized = relativePath.split(sep).join("/");
  if (existsSync(resolve(REPO_ROOT, normalized))) {
    return normalized;
  }

  const targetName = basename(normalized);
  const topDir = normalized.split("/")[0];
  const matches = listFilesRecursive(topDir).filter(
    (candidate) => basename(candidate) === targetName,
  );

  return matches.length === 1 ? matches[0] : undefined;
}

function readSource(relativePath: string): string {
  const resolved = resolveExistingSourcePath(relativePath);
  assert.ok(resolved, `source not found for ${relativePath}`);
  return readFileSync(resolve(REPO_ROOT, resolved), "utf8");
}

function assertContains(source: string, marker: string, context: string) {
  assert.ok(source.includes(marker), `${context} must contain: ${marker}`);
}

function assertNotContains(source: string, marker: string, context: string) {
  assert.equal(source.includes(marker), false, `${context} must not contain: ${marker}`);
}

function assertCookieBoundary(
  files: readonly string[],
  requiredCookieRead: string,
  requiredCookieName: string,
  forbiddenMarkers: readonly string[],
) {
  for (const file of files) {
    const source = readSource(file);

    assertContains(source, requiredCookieRead, `${file} cookie read`);
    assertContains(source, requiredCookieName, `${file} cookie write or clear`);

    for (const forbiddenMarker of forbiddenMarkers) {
      assertNotContains(source, forbiddenMarker, `${file} cross-cookie boundary`);
    }
  }
}

function assertCookieSerializationContract(files: readonly string[]) {
  for (const file of files) {
    const source = readSource(file);

    assertContains(source, '"Path=/"', `${file} cookie path`);
    assertContains(source, '"HttpOnly"', `${file} cookie httpOnly`);
    assertContains(source, "`SameSite=${ENV.cookieSameSite}`", `${file} cookie sameSite`);
    assertContains(source, "if (ENV.cookieSecure)", `${file} cookie secure gate`);
    assertContains(source, "Max-Age=${input.maxAgeSeconds}", `${file} max age support`);
    assertContains(source, "Expires=${input.expires}", `${file} expires support`);
  }
}

test("session cookie boundary matrix documents separated auth domains", () => {
  assert.deepEqual(SESSION_COOKIE_BOUNDARIES, {
    clinic: {
      cookieEnv: "ENV.cookieName",
      sessionLookup: "getActiveSessionByToken",
      sessionDelete: "deleteActiveSession",
      clearCookieBuilder: "buildClearSessionCookie",
    },
    admin: {
      cookieEnv: "ENV.adminCookieName",
      sessionLookup: "getAdminSessionByToken",
      sessionDelete: "deleteAdminSession",
      clearCookieBuilder: "buildClearAdminSessionCookie",
    },
    particular: {
      cookieEnv: "ENV.particularCookieName",
      sessionLookup: "getParticularSessionByToken",
      sessionDelete: "deleteParticularSession",
      clearCookieBuilder: "buildClearParticularSessionCookie",
    },
  });
});

test("env keeps session cookie names separated and production policy secure", () => {
  const envSource = readSource("server/lib/env.ts");

  assertContains(envSource, 'from "../../shared/session-cookie-names.ts"', "shared cookie contract");
  assertContains(envSource, "cookieName: CLINIC_SESSION_COOKIE_NAME", "clinic cookie env");
  assertContains(envSource, "adminCookieName: ADMIN_SESSION_COOKIE_NAME", "admin cookie env");
  assertContains(envSource, "particularCookieName: resolveParticularSessionCookieName(", "particular cookie env");
  assertContains(envSource, 'cookieSecure: nodeEnv === "production"', "cookie secure env");
  assertContains(envSource, 'cookieSameSite: (nodeEnv === "production" ? "none" : "lax")', "cookie sameSite env");
});

test("session cookie serializers keep security attributes stable", () => {
  assertCookieSerializationContract([
    ...CLINIC_SESSION_FILES.filter(
      (file) =>
        file !== "server/routes/clinic-audit.fastify.ts" &&
        file !== "server/routes/study-tracking.fastify.ts",
    ),
    ADMIN_FASTIFY_AUTH_ADAPTER_FILE,
    "server/routes/admin-auth.fastify.ts",
    ...PARTICULAR_SESSION_FILES,
  ]);

  // WBR-08c: clinic-audit.fastify.ts delegates cookie serialization to the
  // canonical clinic auth adapter, which builds its clear-cookie inline
  // rather than through a shared serializeCookie(input) helper.
  const clinicAdapterSource = readSource(CLINIC_FASTIFY_AUTH_ADAPTER_FILE);
  assertContains(clinicAdapterSource, '"Path=/"', `${CLINIC_FASTIFY_AUTH_ADAPTER_FILE} cookie path`);
  assertContains(clinicAdapterSource, '"HttpOnly"', `${CLINIC_FASTIFY_AUTH_ADAPTER_FILE} cookie httpOnly`);
  assertContains(clinicAdapterSource, "`SameSite=${ENV.cookieSameSite}`", `${CLINIC_FASTIFY_AUTH_ADAPTER_FILE} cookie sameSite`);
  assertContains(clinicAdapterSource, "if (ENV.cookieSecure)", `${CLINIC_FASTIFY_AUTH_ADAPTER_FILE} cookie secure gate`);
});

test("clinic admin and particular route surfaces read only their own cookie", () => {
  for (const file of CLINIC_SESSION_FILES) {
    const source = readSource(file);

    // WBR-08c: all CLINIC_SESSION_FILES now delegate cookie reading to the
    // canonical clinic auth adapter instead of reading cookies locally.
    // auth.fastify.ts still writes the clinic (and, on unified login, the
    // admin/particular) cookies directly, so its write-side check stays
    // separate below.
    assertContains(source, "authenticateFastifyClinicUser", `${file} clinic fastify auth adapter`);
    assertNotContains(source, "cookies[ENV.adminCookieName]", `${file} cross-cookie read boundary`);
    assertNotContains(source, "cookies[ENV.particularCookieName]", `${file} cross-cookie read boundary`);

    if (file === "server/routes/auth.fastify.ts") {
      assertContains(source, "name: ENV.cookieName", `${file} cookie write`);
      continue;
    }

    assertNotContains(
      source,
      "name: ENV.adminCookieName",
      `${file} cross-cookie write boundary`,
    );
    assertNotContains(
      source,
      "name: ENV.particularCookieName",
      `${file} cross-cookie write boundary`,
    );
  }

  const clinicAdapterSourceForCookieCheck = readSource(CLINIC_FASTIFY_AUTH_ADAPTER_FILE);
  assertContains(
    clinicAdapterSourceForCookieCheck,
    "ENV.cookieName",
    `${CLINIC_FASTIFY_AUTH_ADAPTER_FILE} clinic cookie read`,
  );
  assertNotContains(
    clinicAdapterSourceForCookieCheck,
    "ENV.adminCookieName",
    `${CLINIC_FASTIFY_AUTH_ADAPTER_FILE} cross-cookie boundary`,
  );
  assertNotContains(
    clinicAdapterSourceForCookieCheck,
    "ENV.particularCookieName",
    `${CLINIC_FASTIFY_AUTH_ADAPTER_FILE} cross-cookie boundary`,
  );

  const adminAdapterSource = readSource(ADMIN_FASTIFY_AUTH_ADAPTER_FILE);

  assertContains(
    adminAdapterSource,
    "cookies[ENV.adminCookieName]",
    `${ADMIN_FASTIFY_AUTH_ADAPTER_FILE} admin cookie read`,
  );
  assertContains(
    adminAdapterSource,
    "name: ENV.adminCookieName",
    `${ADMIN_FASTIFY_AUTH_ADAPTER_FILE} admin cookie write or clear`,
  );
  assertNotContains(
    adminAdapterSource,
    "cookies[ENV.cookieName]",
    `${ADMIN_FASTIFY_AUTH_ADAPTER_FILE} cross-cookie boundary`,
  );
  assertNotContains(
    adminAdapterSource,
    "cookies[ENV.particularCookieName]",
    `${ADMIN_FASTIFY_AUTH_ADAPTER_FILE} cross-cookie boundary`,
  );
  assertNotContains(
    adminAdapterSource,
    "name: ENV.cookieName",
    `${ADMIN_FASTIFY_AUTH_ADAPTER_FILE} cross-cookie boundary`,
  );
  assertNotContains(
    adminAdapterSource,
    "name: ENV.particularCookieName",
    `${ADMIN_FASTIFY_AUTH_ADAPTER_FILE} cross-cookie boundary`,
  );

  for (const file of ADMIN_SESSION_FILES) {
    const source = readSource(file);

    assertContains(source, "authenticateFastifyAdmin", `${file} shared admin auth helper`);
    assertNotContains(source, "cookies[ENV.cookieName]", `${file} cross-cookie read boundary`);
    assertNotContains(source, "cookies[ENV.particularCookieName]", `${file} cross-cookie read boundary`);
    assertNotContains(source, "name: ENV.cookieName", `${file} cross-cookie write boundary`);
    assertNotContains(source, "name: ENV.particularCookieName", `${file} cross-cookie write boundary`);
  }

  assertCookieBoundary(
    PARTICULAR_SESSION_FILES,
    "cookies[ENV.particularCookieName]",
    "name: ENV.particularCookieName",
    ["cookies[ENV.cookieName]", "cookies[ENV.adminCookieName]", "name: ENV.cookieName", "name: ENV.adminCookieName"],
  );
});

test("session lookup hash delete and clear-cookie flows stay domain specific", () => {
  // WBR-08c: every CLINIC_SESSION_FILES entry now delegates the full
  // session lookup, hashing, expiration and clear-cookie flow (for /me,
  // /change-password, /logout, and equivalents) to the canonical adapter.
  const adapterSource = readSource(CLINIC_FASTIFY_AUTH_ADAPTER_FILE);

  assertContains(adapterSource, "hashSessionToken(token)", `${CLINIC_FASTIFY_AUTH_ADAPTER_FILE} hashes clinic session token`);
  assertContains(adapterSource, "getActiveSessionByToken", `${CLINIC_FASTIFY_AUTH_ADAPTER_FILE} clinic session lookup`);
  assertContains(adapterSource, "deleteActiveSession", `${CLINIC_FASTIFY_AUTH_ADAPTER_FILE} clinic session delete`);
  assertContains(adapterSource, "session.expiresAt", `${CLINIC_FASTIFY_AUTH_ADAPTER_FILE} clinic expiration check`);
  assertContains(adapterSource, "buildClearSessionCookie", `${CLINIC_FASTIFY_AUTH_ADAPTER_FILE} clinic clear cookie builder`);
  assertContains(
    adapterSource,
    'reply.header("set-cookie", buildClearSessionCookie())',
    `${CLINIC_FASTIFY_AUTH_ADAPTER_FILE} clinic clear cookie header`,
  );

  for (const file of CLINIC_SESSION_FILES) {
    const source = readSource(file);

    assertContains(source, "authenticateFastifyClinicUser", `${file} clinic fastify auth adapter`);
  }

  // auth.fastify.ts also clears the clinic cookie directly on logout.
  const authRoute = readSource("server/routes/auth.fastify.ts");
  assertContains(authRoute, "hashSessionToken(auth.sessionToken)", "auth.fastify.ts hashes clinic session token on logout");
  assertContains(authRoute, "deleteActiveSession", "auth.fastify.ts clinic session delete on logout");
  assertContains(authRoute, "buildClearSessionCookie", "auth.fastify.ts clinic clear cookie builder");
  assertContains(authRoute, 'reply.header("set-cookie", buildClearSessionCookie())', "auth.fastify.ts clinic clear cookie header");

  for (const file of ADMIN_SESSION_FILES) {
    const source = readSource(file);

    if (source.includes("authenticateFastifyAdmin")) {
      const adapterSource = readSource(ADMIN_FASTIFY_AUTH_ADAPTER_FILE);

      assertContains(source, "authenticateFastifyAdmin", `${file} admin fastify auth adapter`);
      assertContains(adapterSource, "getRequestAdminAuthContext", `${ADMIN_FASTIFY_AUTH_ADAPTER_FILE} request-scoped admin auth context`);
      assertContains(adapterSource, "REQUEST_ADMIN_AUTH_CONTEXT_KEY", `${ADMIN_FASTIFY_AUTH_ADAPTER_FILE} request-scoped admin auth cache key`);
      assertContains(adapterSource, "ENV.adminCookieName", `${ADMIN_FASTIFY_AUTH_ADAPTER_FILE} admin cookie env`);
      assertContains(adapterSource, "hashSessionToken(token)", `${ADMIN_FASTIFY_AUTH_ADAPTER_FILE} hashes admin session token`);
      assertContains(adapterSource, "deleteAdminSession", `${ADMIN_FASTIFY_AUTH_ADAPTER_FILE} admin session delete`);
      assertContains(adapterSource, "session.expiresAt", `${ADMIN_FASTIFY_AUTH_ADAPTER_FILE} admin expiration check`);
      assertContains(adapterSource, "buildClearAdminSessionCookie", `${ADMIN_FASTIFY_AUTH_ADAPTER_FILE} admin clear cookie builder`);
      assertContains(
        adapterSource,
        'reply.header("set-cookie", buildClearAdminSessionCookie())',
        `${ADMIN_FASTIFY_AUTH_ADAPTER_FILE} admin clear cookie header`,
      );
      continue;
    }

    assertContains(source, "hashSessionToken(token)", `${file} hashes admin session token`);
    assertContains(source, "getAdminSessionByToken", `${file} admin session lookup`);
    assertContains(source, "deleteAdminSession", `${file} admin session delete`);
    assertContains(source, "session.expiresAt", `${file} admin expiration check`);
    assertContains(source, "buildClearAdminSessionCookie", `${file} admin clear cookie builder`);
    assertContains(source, 'reply.header("set-cookie", buildClearAdminSessionCookie())', `${file} admin clear cookie header`);
  }

  for (const file of PARTICULAR_SESSION_FILES) {
    const source = readSource(file);

    assertContains(source, "hashSessionToken(token)", `${file} hashes particular session token`);
    assertContains(source, "getParticularSessionByToken", `${file} particular session lookup`);
    assertContains(source, "deleteParticularSession", `${file} particular session delete`);
    assertContains(source, "session.expiresAt", `${file} particular expiration check`);
    assertContains(source, "particularToken.isActive", `${file} particular inactive-token check`);
    assertContains(source, "buildClearParticularSessionCookie", `${file} particular clear cookie builder`);
    assertContains(source, 'reply.header("set-cookie", buildClearParticularSessionCookie())', `${file} particular clear cookie header`);
  }
});

test("login and logout routes set and clear only their own session cookie", () => {
  const clinicAuth = readSource("server/routes/auth.fastify.ts");
  const adminAuth = readSource("server/routes/admin-auth.fastify.ts");
  const particularAuth = readSource("server/routes/particular-auth.fastify.ts");

  assertContains(clinicAuth, "buildSessionCookie", "clinic login cookie builder");
  assertContains(clinicAuth, "createActiveSession", "clinic session create");
  assertContains(clinicAuth, "deleteActiveSession", "clinic session delete");
  assertContains(clinicAuth, 'reply.header("set-cookie", buildClearSessionCookie())', "clinic logout clears cookie");

  assertContains(adminAuth, "buildAdminSessionCookie", "admin login cookie builder");
  assertContains(adminAuth, "createAdminSession", "admin session create");
  assertContains(adminAuth, "deleteAdminSession", "admin session delete");
  assertContains(adminAuth, 'reply.header("set-cookie", buildClearAdminSessionCookie())', "admin logout clears cookie");

  assertContains(particularAuth, "buildParticularSessionCookie", "particular login cookie builder");
  assertContains(particularAuth, "createParticularSession", "particular session create");
  assertContains(particularAuth, "deleteParticularSession", "particular session delete");
  assertContains(particularAuth, 'reply.header("set-cookie", buildClearParticularSessionCookie())', "particular logout clears cookie");
});

test("Fastify tests remain explicit for cookie contracts", () => {
  const clinicAuthTests = readSource("test/auth.fastify.test.ts");
  const adminAuthTests = readSource("test/admin-auth.fastify.test.ts");
  const particularAuthTests = readSource("test/particular-auth.fastify.test.ts");

  assertContains(clinicAuthTests, "setCookie.includes(`${ENV.cookieName}=token-123`)", "clinic login set cookie");
  assertContains(clinicAuthTests, 'setCookie.includes("Path=/")', "clinic login cookie path");
  assertContains(clinicAuthTests, 'setCookie.includes("HttpOnly")', "clinic login cookie httpOnly");
  assertContains(clinicAuthTests, "setCookie.includes(`Max-Age=${ENV.sessionTtlHours * 60 * 60}`)", "clinic login cookie persistent max age");
  assertContains(clinicAuthTests, 'setCookie.includes("Max-Age=0"), false', "clinic login cookie not session cookie");
  assertContains(clinicAuthTests, 'setCookie.includes("Max-Age=0")', "clinic logout max age");

  assertContains(adminAuthTests, "setCookie.includes(`${ENV.adminCookieName}=admin-token-123`)", "admin login set cookie");
  assertContains(adminAuthTests, 'setCookie.includes("Path=/")', "admin login cookie path");
  assertContains(adminAuthTests, 'setCookie.includes("HttpOnly")', "admin login cookie httpOnly");
  assertContains(adminAuthTests, "setCookie.includes(`Max-Age=${ENV.sessionTtlHours * 60 * 60}`)", "admin login cookie persistent max age");
  assertContains(adminAuthTests, 'setCookie.includes("Max-Age=0"), false', "admin login cookie not session cookie");
  assertContains(adminAuthTests, 'setCookie.includes("Max-Age=0")', "admin logout max age");

  assertContains(particularAuthTests, "setCookie.includes(", "particular login set cookie");
  assertContains(particularAuthTests, "ENV.particularCookieName", "particular login uses env cookie");
  assertContains(particularAuthTests, 'setCookie.includes("Path=/")', "particular login cookie path");
  assertContains(particularAuthTests, 'setCookie.includes("HttpOnly")', "particular login cookie httpOnly");
  assertContains(particularAuthTests, "setCookie.includes(`Max-Age=${ENV.sessionTtlHours * 60 * 60}`)", "particular login cookie persistent max age");
  assertContains(particularAuthTests, 'setCookie.includes("Max-Age=0"), false', "particular login cookie not session cookie");
  assertContains(particularAuthTests, 'setCookie.includes("Max-Age=0")', "particular logout max age");
});

test("cross-domain cookie rejection and legacy cookie protection stay covered", () => {
  const auditExportTests = readSource("test/security/audit-export-boundaries.test.ts");
  const auditSeparatedTests = readSource("test/audit-separated-surfaces.test.ts");
  const crossAuthTests = readSource("test/architecture/security/security-cross-auth-surface-boundaries.test.ts");
  const clinicAuditTests = readSource("test/clinic-audit.fastify.test.ts");

  assertContains(auditExportTests, "audit exports rechazan cookies de dominios cruzados antes de listar", "audit export cross-cookie runtime test");
  assertContains(auditExportTests, "admin export rechaza cookie clinic", "admin rejects clinic cookie");
  assertContains(auditExportTests, "clinic export rechaza cookie admin", "clinic rejects admin cookie");
  assertContains(auditExportTests, "particular export rechaza cookie admin", "particular rejects admin cookie");

  assertContains(auditSeparatedTests, "cookie admin exclusiva", "admin audit exclusive cookie test");
  assertContains(auditSeparatedTests, "cookie clinic exclusiva", "clinic audit exclusive cookie test");
  assertContains(auditSeparatedTests, "cookie particular exclusiva", "particular audit exclusive cookie test");

  assertContains(crossAuthTests, "clinic route surfaces accept only clinic session cookies", "clinic cross-auth guardrail");
  assertContains(crossAuthTests, "admin route surfaces accept only admin session cookies", "admin cross-auth guardrail");
  assertContains(crossAuthTests, "particular route surfaces accept only particular session cookies", "particular cross-auth guardrail");

  assertContains(clinicAuditTests, "rechaza cookie legacy vetneb_session", "legacy clinic cookie rejection");
  assertContains(clinicAuditTests, 'setCookie.startsWith("app_session_id=;")', "clinic clear cookie env name");
  assertContains(clinicAuditTests, "Max-Age=0", "clinic clear max age runtime test");
  assertContains(clinicAuditTests, "Expires=Thu, 01 Jan 1970 00:00:00 GMT", "clinic clear expires runtime test");
});

test("session cookie guardrail source stays ascii only", () => {
  const source = readSource("test/architecture/security/security-session-cookie-boundaries.test.ts");
  const mojibakeLead = String.fromCharCode(0x00c3);
  const replacementCharacter = String.fromCharCode(0xfffd);

  assertNotContains(source, mojibakeLead, "guardrail source");
  assertNotContains(source, replacementCharacter, "guardrail source");

  for (let index = 0; index < source.length; index += 1) {
    assert.equal(
      source.charCodeAt(index) <= 0x7f,
      true,
      `guardrail source must stay ascii-only at index ${index}`,
    );
  }
});
