import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

// ─────────────────────────────────────────────────────────────────────────────
// A04 · Dashboard security invariants baseline.
//
// The global audit (§11, §5) *observed* that the dashboard keeps admin and
// clinic sessions separated, materializes no credential in the DOM and carries
// no sensitive `data-*` lexeme. Observation is not a contract: this guard turns
// those properties into executable, fail-closed evidence against current source.
//
// Scope is the A04 scope: the 15 normative modules and the dashboard surface
// trees that contain them, plus the frontend auth boundary they depend on.
// Backend session separation is already frozen elsewhere and is NOT restated
// here (test/architecture/security/security-session-cookie-boundaries.test.ts,
// global-auth-boundary-contract.test.ts); this guard covers the dashboard side.
// ─────────────────────────────────────────────────────────────────────────────

const TEST_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(TEST_FILE), "..", "..", "..", "..");

const sourceCache = new Map<string, string>();

/** Repo source with CRLF normalized so markers match on Windows and Linux. */
function readSource(repoRelativePath: string): string {
  const cached = sourceCache.get(repoRelativePath);
  if (cached !== undefined) {
    return cached;
  }

  const absolute = resolve(REPO_ROOT, repoRelativePath);
  assert.ok(existsSync(absolute), `source not found: ${repoRelativePath}`);

  const source = readFileSync(absolute, "utf8").replace(/\r\n/g, "\n");
  sourceCache.set(repoRelativePath, source);
  return source;
}

/**
 * Prose is not behaviour. A file that merely NAMES `document.cookie` in a
 * comment must not fail the guard, and a comment must not be able to satisfy a
 * positive anchor either.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

function collectSourceFiles(relativeDir: string): string[] {
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
      } else if (/\.tsx?$/.test(entry.name)) {
        files.push(relative(REPO_ROOT, absolute).split(sep).join("/"));
      }
    }
  };

  walk(rootDir);
  return files.sort();
}

// ─────────────────────────────────────────────────────────────────────────────
// Normative scope
// ─────────────────────────────────────────────────────────────────────────────

const A03_MATRIX_PATH =
  "frontend/e2e/helpers/dashboard-adaptive-limit-matrix.ts";

/** The dashboard surface trees that physically contain the 15 modules. */
const DASHBOARD_SURFACE_TREES = [
  "frontend/src/app/dashboard",
  "frontend/src/components/dashboard",
  "frontend/src/features/dashboard",
] as const;

/** The frontend auth boundary the dashboard depends on. */
const AUTH_CONTEXT_PATH = "frontend/src/context/AuthContext.tsx";
const API_CLIENT_PATH = "frontend/src/lib/api.ts";
const DASHBOARD_PROXY_PATH = "frontend/src/proxy.ts";
const AUTH_USER_TYPES_PATH = "frontend/src/types/index.ts";

/**
 * The 15 normative `moduleId` (§20.1) mapped to the files that physically own
 * their surface. Two modules render mutually exclusive desktop and mobile
 * presentations, so the 15 modules resolve to 17 owners. Same physical census
 * as A07: the module surface is where a credential would leak into the DOM.
 */
const A04_OWNERS_BY_MODULE_ID: Readonly<Record<string, readonly string[]>> =
  Object.freeze({
    "admin-audit-log": ["frontend/src/app/dashboard/admin/AdminAuditCard.tsx"],
    "admin-report-upload": [
      "frontend/src/app/dashboard/admin/AdminReportsCard.tsx",
    ],
    "admin-particular-tokens": [
      "frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx",
    ],
    "admin-clinics": [
      "frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx",
    ],
    "admin-users-roles": [
      "frontend/src/app/dashboard/admin/AdminUsersRolesReadOnlyCard.tsx",
    ],
    "admin-sessions": [
      "frontend/src/app/dashboard/admin/AdminSessionsReadOnlyCard.tsx",
    ],
    "admin-failed-login-alerts": [
      "frontend/src/app/dashboard/admin/AdminFailedLoginAlertsReadOnlyCard.tsx",
    ],
    "admin-pricing": [
      "frontend/src/app/dashboard/admin/AdminPricingEditorCard.tsx",
      "frontend/src/app/dashboard/admin/AdminMobilePricingModule.tsx",
    ],
    "informes-reports-list": [
      "frontend/src/app/dashboard/informes/InformesReportsList.tsx",
    ],
    "admin-maintenance": [
      "frontend/src/app/dashboard/admin/AdminMaintenanceDryRunCard.tsx",
      "frontend/src/app/dashboard/admin/AdminMobileMaintenanceModule.tsx",
    ],
    "clinic-informes-summary": [
      "frontend/src/app/dashboard/ClinicInformesWorkspaceSummary.tsx",
    ],
    "clinic-logistica-summary": [
      "frontend/src/app/dashboard/ClinicLogisticaWorkspaceSummary.tsx",
    ],
    "clinic-particular-tokens": [
      "frontend/src/components/dashboard/ClinicParticularTokensCard.tsx",
    ],
    "logistics-recent-list": [
      "frontend/src/app/dashboard/logistica/LogisticsRecentListCanvas.tsx",
    ],
    "logistics-bounded-canvas": [
      "frontend/src/app/dashboard/logistica/LogisticsBoundedCanvas.tsx",
    ],
  });

const A04_DECLARED_OWNERS = Object.values(A04_OWNERS_BY_MODULE_ID).flat();

/**
 * Read from the A03 registry rather than restated here: a second hand-written
 * copy of the 15 ids would drift silently, which is the failure this contract
 * exists to catch.
 */
function readA03ModuleIds(): string[] {
  const literal = readSource(A03_MATRIX_PATH).match(
    /export const A03_MODULE_IDS = \[([\s\S]*?)\] as const;/,
  );

  assert.ok(
    literal,
    `${A03_MATRIX_PATH}: the canonical A03 registry literal must stay identifiable`,
  );
  return [...literal[1].matchAll(/"([^"]+)"/g)].map(([, id]) => id);
}

/**
 * All dashboard surface files, discovered. Discovery makes the surface scans
 * apply to files that do not exist yet; it does NOT prove completeness, which
 * is why the 15-module census above is declared and cross-checked (A07 lesson).
 */
const DASHBOARD_SURFACE_FILES = DASHBOARD_SURFACE_TREES.flatMap(
  collectSourceFiles,
);

// ─────────────────────────────────────────────────────────────────────────────
// Sensitive lexemes
//
// Authentication credentials, not domain vocabulary. The product legitimately
// owns "particular tokens" as an entity: `tokenLast4`, `tokenId` and
// `tokenStatus` are non-secret metadata and must stay permitted. What may never
// name a DOM attribute is the material that authenticates a request.
//
// The list is the auth-credential subset of the `security:public-surface`
// normative list (scripts/security/audit-public-devtools-surface.mjs). PII
// stems (email/phone/dni) stay covered there and are not restated here.
//
// English stems only, deliberately: the repo's approved convention renames
// sensitive surfaces to a non-sensitive stem (`data-admin-sesiones-*`, PR-SRV-1)
// precisely to satisfy that guard. Adding the Spanish stem here would invalidate
// an approved naming decision and force a runtime rename outside A04 scope.
// ─────────────────────────────────────────────────────────────────────────────

const SENSITIVE_DATA_ATTRIBUTE_STEMS = [
  "password",
  "passwd",
  "secret",
  "credential",
  "authorization",
  "bearer",
  "cookie",
  "jwt",
  "session-token",
  "session_token",
  "session-id",
  "session_id",
  "access-token",
  "access_token",
  "refresh-token",
  "refresh_token",
  "auth-token",
  "auth_token",
  "api-key",
  "api_key",
  "apikey",
  "private-key",
  "private_key",
] as const;

/** Client-side persistence of an authentication credential. */
const CLIENT_CREDENTIAL_STORAGE_MARKERS = [
  "document.cookie",
  "localStorage",
  "sessionStorage",
  "indexedDB",
  "window.name",
] as const;

/** Manual serialization of a credential into a request. */
const MANUAL_CREDENTIAL_HEADER_MARKERS = ["Authorization", "Bearer "] as const;

// ─────────────────────────────────────────────────────────────────────────────
// 1 · Fail-closed coverage of the 15 normative modules
// ─────────────────────────────────────────────────────────────────────────────

test("A04 covers the canonical A03 registry exactly", () => {
  const registryIds = readA03ModuleIds();
  const censusIds = Object.keys(A04_OWNERS_BY_MODULE_ID);

  assert.equal(
    registryIds.length,
    15,
    "A03 declares exactly 15 normative modules",
  );
  assert.equal(
    new Set(registryIds).size,
    registryIds.length,
    "the A03 registry carries no duplicate moduleId",
  );
  assert.equal(
    new Set(censusIds).size,
    censusIds.length,
    "the A04 census carries no duplicate moduleId",
  );
  assert.deepEqual(
    censusIds,
    registryIds,
    "the A04 security census must cover the 15 canonical moduleId, in canonical order",
  );
});

test("every normative module resolves to an existing owner inside the audited trees", () => {
  assert.equal(
    A04_DECLARED_OWNERS.length,
    17,
    "the 15 normative modules resolve to exactly 17 physical owners",
  );
  assert.equal(
    new Set(A04_DECLARED_OWNERS).size,
    A04_DECLARED_OWNERS.length,
    "an owner file may not be claimed by two modules",
  );

  for (const [moduleId, owners] of Object.entries(A04_OWNERS_BY_MODULE_ID)) {
    for (const path of owners) {
      assert.ok(
        existsSync(resolve(REPO_ROOT, path)),
        `${moduleId}: declared owner "${path}" does not exist`,
      );
      assert.ok(
        DASHBOARD_SURFACE_FILES.includes(path),
        `${moduleId}: "${path}" must live inside an audited dashboard tree`,
      );
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2 · No sensitive `data-*` lexeme on the dashboard surface
// ─────────────────────────────────────────────────────────────────────────────

test("no dashboard data-* attribute names an authentication credential", () => {
  assert.ok(
    DASHBOARD_SURFACE_FILES.length >= 100,
    "the dashboard surface scan must not silently collapse to an empty set",
  );

  for (const path of DASHBOARD_SURFACE_FILES) {
    const source = stripComments(readSource(path));

    for (const [, name] of source.matchAll(/\bdata-([a-zA-Z0-9:_-]+)\s*=/g)) {
      const normalized = name.toLowerCase();

      for (const stem of SENSITIVE_DATA_ATTRIBUTE_STEMS) {
        assert.equal(
          normalized.includes(stem),
          false,
          `${path}: data-${name} names sensitive material ("${stem}")`,
        );
      }
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3 · No client-side credential storage and no manual cookie read
// ─────────────────────────────────────────────────────────────────────────────

test("no dashboard surface reads cookies or persists credentials client-side", () => {
  for (const path of DASHBOARD_SURFACE_FILES) {
    const source = stripComments(readSource(path));

    for (const marker of CLIENT_CREDENTIAL_STORAGE_MARKERS) {
      assert.equal(
        source.includes(marker),
        false,
        `${path}: dashboard surfaces must not use ${marker}; the session is an HttpOnly cookie`,
      );
    }
  }
});

test("no dashboard surface serializes a credential into a request header", () => {
  for (const path of DASHBOARD_SURFACE_FILES) {
    const source = stripComments(readSource(path));

    for (const marker of MANUAL_CREDENTIAL_HEADER_MARKERS) {
      assert.equal(
        source.includes(marker),
        false,
        `${path}: dashboard surfaces must not build an ${marker.trim()} header`,
      );
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4 · The frontend auth contract holds no raw credential
// ─────────────────────────────────────────────────────────────────────────────

test("the authenticated user contract carries no credential material", () => {
  const types = readSource(AUTH_USER_TYPES_PATH);
  const block = types.match(/export type AuthUser = \{([\s\S]*?)\};/);

  assert.ok(block, `${AUTH_USER_TYPES_PATH}: AuthUser must stay identifiable`);

  for (const field of ["password", "token", "hash", "secret", "session"]) {
    assert.equal(
      new RegExp(`\\b${field}`, "i").test(block[1]),
      false,
      `AuthUser must not expose "${field}" to the browser`,
    );
  }
});

test("the auth context never materializes the session value", () => {
  const source = stripComments(readSource(AUTH_CONTEXT_PATH));

  for (const marker of CLIENT_CREDENTIAL_STORAGE_MARKERS) {
    assert.equal(
      source.includes(marker),
      false,
      `${AUTH_CONTEXT_PATH}: must not use ${marker}`,
    );
  }

  for (const marker of MANUAL_CREDENTIAL_HEADER_MARKERS) {
    assert.equal(
      source.includes(marker),
      false,
      `${AUTH_CONTEXT_PATH}: must not build an ${marker.trim()} header`,
    );
  }
});

test("authenticated calls travel by cookie, never by a hand-built credential", () => {
  const source = readSource(API_CLIENT_PATH);

  assert.ok(
    source.includes('credentials: options.credentials ?? "include"'),
    `${API_CLIENT_PATH}: authenticated calls must rely on the HttpOnly session cookie`,
  );
  assert.equal(
    stripComments(source).includes("document.cookie"),
    false,
    `${API_CLIENT_PATH}: the client must never read the session cookie`,
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 5 · Session separation at the dashboard boundary
// ─────────────────────────────────────────────────────────────────────────────

test("the dashboard boundary keeps admin and clinic sessions separated", () => {
  const proxy = readSource(DASHBOARD_PROXY_PATH);

  // A04 R2: the proxy no longer owns the literals. Both boundaries come from the
  // fixed shared contract, so the anchor is consumption of that contract and the
  // absence of an independent second copy. Distinctness itself is proven over the
  // contract in test/unit/infrastructure/session-cookie-name-contract.test.ts.
  assert.ok(
    proxy.includes('from "../../shared/session-cookie-names"'),
    `${DASHBOARD_PROXY_PATH}: must consume the shared session cookie contract`,
  );
  assert.ok(
    proxy.includes("CLINIC_SESSION_COOKIE_NAME"),
    `${DASHBOARD_PROXY_PATH}: clinic boundary must come from the contract`,
  );
  assert.ok(
    proxy.includes("ADMIN_SESSION_COOKIE_NAME"),
    `${DASHBOARD_PROXY_PATH}: admin boundary must come from the contract`,
  );

  for (const literal of ["app_session_id", "admin_session_id"]) {
    assert.equal(
      proxy.includes(`"${literal}"`),
      false,
      `${DASHBOARD_PROXY_PATH}: must not restate the literal "${literal}"`,
    );
  }

  assert.ok(
    proxy.includes("ADMIN_DASHBOARD_PATH_PREFIX"),
    `${DASHBOARD_PROXY_PATH}: the admin boundary must be selected by path`,
  );
  assert.ok(
    proxy.includes("return NextResponse.redirect(loginUrl)"),
    `${DASHBOARD_PROXY_PATH}: a missing session must not reveal the dashboard`,
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 6 · Collections expose token metadata, never the token
// ─────────────────────────────────────────────────────────────────────────────

test("particular token collections expose only the last four characters", () => {
  const source = readSource(API_CLIENT_PATH);
  const block = source.match(
    /export type AdminParticularTokenSummary = \{([\s\S]*?)\};/,
  );

  assert.ok(
    block,
    `${API_CLIENT_PATH}: AdminParticularTokenSummary must stay identifiable`,
  );
  assert.ok(
    block[1].includes("tokenLast4: string;"),
    "the token collection must carry the last-four metadata",
  );
  assert.equal(
    /^\s*token\s*\??\s*:/m.test(block[1]),
    false,
    "the token collection must never carry the raw token",
  );
});

test("the sessions module exposes row identifiers, never session material", () => {
  const path = A04_OWNERS_BY_MODULE_ID["admin-sessions"][0];
  const source = stripComments(readSource(path));

  for (const marker of ["tokenHash", "sessionToken", "session.token"]) {
    assert.equal(
      source.includes(marker),
      false,
      `${path}: the sessions module must not render ${marker}`,
    );
  }
});
