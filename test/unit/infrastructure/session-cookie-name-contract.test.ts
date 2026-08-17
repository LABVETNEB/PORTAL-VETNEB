import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ADMIN_SESSION_COOKIE_NAME,
  CLINIC_SESSION_COOKIE_NAME,
  DEFAULT_PARTICULAR_SESSION_COOKIE_NAME,
  FIXED_SESSION_COOKIE_NAMES,
} from "../../../shared/session-cookie-names.ts";
import { resolveParticularSessionCookieName } from "../../../server/lib/session-cookie-names.ts";

// ─────────────────────────────────────────────────────────────────────────────
// A04 · R2 · Session cookie name contract.
//
// Closes the two defects the A04 baseline surfaced, without widening the runtime
// change further than the boundary requires:
//
//   R2-A  `server/lib/env.ts` accepted three independent optional cookie names
//         with no rejection of repeated values, so two boundaries could be
//         configured onto the same cookie.
//   R2-B  `frontend/src/proxy.ts` hardcoded the clinic and admin literals while
//         the backend read them from ENV, so the two sides agreed only by
//         coincidence and a backend rename desynchronized the proxy boundary.
//
// Clinic and admin cross the backend/proxy border, so their names are a fixed
// shared contract. Particular never reaches the proxy, so it stays configurable
// and existing deployments keep their override — but the resolver rejects any
// value that collides with a fixed boundary, so no configuration can collapse
// the three boundaries.
// ─────────────────────────────────────────────────────────────────────────────

const TEST_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(TEST_FILE), "..", "..", "..");

const LINE_BREAK = String.fromCharCode(10);

const SHARED_CONTRACT_PATH = "shared/session-cookie-names.ts";
const RESOLVER_PATH = "server/lib/session-cookie-names.ts";
const ENV_PATH = "server/lib/env.ts";
const PROXY_PATH = "frontend/src/proxy.ts";

function readSource(repoRelativePath: string): string {
  const absolute = resolve(REPO_ROOT, repoRelativePath);
  assert.ok(existsSync(absolute), `source not found: ${repoRelativePath}`);
  return readFileSync(absolute, "utf8").replace(/\r\n/g, "\n");
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

// ─── T1-T3 · the fixed contract ──────────────────────────────────────────────

test("T1 the clinic boundary name is fixed by contract", () => {
  assert.equal(CLINIC_SESSION_COOKIE_NAME, "app_session_id");
  assert.ok(CLINIC_SESSION_COOKIE_NAME.trim().length > 0);
});

test("T2 the admin boundary name is fixed by contract", () => {
  assert.equal(ADMIN_SESSION_COOKIE_NAME, "admin_session_id");
  assert.ok(ADMIN_SESSION_COOKIE_NAME.trim().length > 0);
});

test("T3 the two fixed boundaries are distinct by construction", () => {
  assert.notEqual(CLINIC_SESSION_COOKIE_NAME, ADMIN_SESSION_COOKIE_NAME);
  assert.equal(
    new Set(FIXED_SESSION_COOKIE_NAMES).size,
    FIXED_SESSION_COOKIE_NAMES.length,
    "fixed boundaries must not share a cookie name",
  );
});

// ─── T4-T7 · particular stays configurable, collisions rejected ──────────────

test("T4 particular falls back to its default when unset or blank", () => {
  assert.equal(
    resolveParticularSessionCookieName(undefined),
    DEFAULT_PARTICULAR_SESSION_COOKIE_NAME,
  );
  assert.equal(
    resolveParticularSessionCookieName(""),
    DEFAULT_PARTICULAR_SESSION_COOKIE_NAME,
  );
  assert.equal(
    resolveParticularSessionCookieName("   "),
    DEFAULT_PARTICULAR_SESSION_COOKIE_NAME,
  );
  assert.notEqual(
    DEFAULT_PARTICULAR_SESSION_COOKIE_NAME,
    CLINIC_SESSION_COOKIE_NAME,
  );
  assert.notEqual(
    DEFAULT_PARTICULAR_SESSION_COOKIE_NAME,
    ADMIN_SESSION_COOKIE_NAME,
  );
});

test("T5 a valid particular override is preserved", () => {
  assert.equal(
    resolveParticularSessionCookieName("legacy_particular_session"),
    "legacy_particular_session",
    "an existing deployment must keep its historical override",
  );
  assert.equal(
    resolveParticularSessionCookieName("  padded_particular_session  "),
    "padded_particular_session",
    "trimming must match the environment schema preprocessing",
  );
});

test("T6 a particular override colliding with clinic is rejected", () => {
  assert.throws(
    () => resolveParticularSessionCookieName(CLINIC_SESSION_COOKIE_NAME),
    /PARTICULAR_COOKIE_NAME no puede ser "app_session_id".*clinic/s,
  );
});

test("T7 a particular override colliding with admin is rejected", () => {
  assert.throws(
    () => resolveParticularSessionCookieName(ADMIN_SESSION_COOKIE_NAME),
    /PARTICULAR_COOKIE_NAME no puede ser "admin_session_id".*admin/s,
  );

  // Padding must not smuggle a collision past the check.
  assert.throws(
    () => resolveParticularSessionCookieName(`  ${ADMIN_SESSION_COOKIE_NAME} `),
    /PARTICULAR_COOKIE_NAME no puede ser/,
  );
});

// ─── T8-T11 · single source of truth for the border-crossing boundaries ──────

test("T8 the backend clinic cookie comes from the shared contract", () => {
  const env = stripComments(readSource(ENV_PATH));

  assert.ok(
    env.includes('from "../../shared/session-cookie-names.ts"'),
    `${ENV_PATH} must import the shared contract`,
  );
  assert.ok(
    env.includes("cookieName: CLINIC_SESSION_COOKIE_NAME"),
    `${ENV_PATH} clinic cookie must come from the contract`,
  );
});

test("T9 the backend admin cookie comes from the shared contract", () => {
  const env = stripComments(readSource(ENV_PATH));

  assert.ok(
    env.includes("adminCookieName: ADMIN_SESSION_COOKIE_NAME"),
    `${ENV_PATH} admin cookie must come from the contract`,
  );
});

test("T10 the proxy clinic boundary comes from the shared contract", () => {
  const proxy = stripComments(readSource(PROXY_PATH));

  assert.ok(
    proxy.includes('from "../../shared/session-cookie-names"'),
    `${PROXY_PATH} must import the shared contract`,
  );
  assert.ok(
    proxy.includes(": CLINIC_SESSION_COOKIE_NAME"),
    `${PROXY_PATH} clinic boundary must come from the contract`,
  );
});

test("T11 the proxy admin boundary comes from the shared contract", () => {
  const proxy = stripComments(readSource(PROXY_PATH));

  assert.ok(
    proxy.includes("? ADMIN_SESSION_COOKIE_NAME"),
    `${PROXY_PATH} admin boundary must come from the contract`,
  );
});

// ─── T12-T14 · no runtime override and no second literal owner ───────────────

test("T12 clinic and admin are no longer runtime-configurable", () => {
  const env = stripComments(readSource(ENV_PATH));

  // Distinguish the ENV VAR from the contract symbol: CLINIC_SESSION_COOKIE_NAME
  // legitimately contains "COOKIE_NAME". The env var only ever appears as a schema
  // key or as a rawEnv access, so those two forms are what must be gone.
  for (const removed of ["COOKIE_NAME", "ADMIN_COOKIE_NAME"]) {
    assert.equal(
      env.includes("rawEnv." + removed),
      false,
      `${ENV_PATH} must not read the removed env var "${removed}"`,
    );

    const declaresSchemaKey = env
      .split(LINE_BREAK)
      .some((line) => line.trim().startsWith(removed + ":"));

    assert.equal(
      declaresSchemaKey,
      false,
      `${ENV_PATH} must not declare "${removed}" in the environment schema`,
    );
  }
});

test("T13 the particular override stays supported by the backend", () => {
  const env = stripComments(readSource(ENV_PATH));

  assert.ok(
    env.includes("PARTICULAR_COOKIE_NAME"),
    `${ENV_PATH} must keep accepting PARTICULAR_COOKIE_NAME`,
  );
  assert.ok(
    env.includes("particularCookieName: resolveParticularSessionCookieName("),
    `${ENV_PATH} must resolve particular through the guarded resolver`,
  );
  assert.ok(
    env.includes("rawEnv.PARTICULAR_COOKIE_NAME"),
    `${ENV_PATH} must feed the override into the resolver`,
  );

  const envExample = readSource(".env.example");
  assert.ok(
    envExample.includes("PARTICULAR_COOKIE_NAME"),
    ".env.example must keep documenting the supported particular override",
  );
  for (const removed of ["COOKIE_NAME=app_session_id", "ADMIN_COOKIE_NAME="]) {
    assert.equal(
      envExample.includes(removed),
      false,
      `.env.example must not advertise "${removed}" as configurable`,
    );
  }
});

test("T14 no owner reintroduces an independent clinic or admin literal", () => {
  for (const path of [ENV_PATH, PROXY_PATH]) {
    const source = stripComments(readSource(path));

    for (const name of FIXED_SESSION_COOKIE_NAMES) {
      assert.equal(
        source.includes(`"${name}"`),
        false,
        `${path} must not restate the literal "${name}"; it is owned by ${SHARED_CONTRACT_PATH}`,
      );
    }
  }
});

test("T14b the shared contract stays dependency-free and client-safe", () => {
  const contract = stripComments(readSource(SHARED_CONTRACT_PATH));

  assert.equal(
    /\bimport\b/.test(contract),
    false,
    `${SHARED_CONTRACT_PATH} must not import anything; it is bundled by both builds`,
  );
  for (const forbidden of ["process.env", "node:", "require(", "dotenv"]) {
    assert.equal(
      contract.includes(forbidden),
      false,
      `${SHARED_CONTRACT_PATH} must not reference ${forbidden}`,
    );
  }

  // The particular resolver is backend-only and must not leak into the proxy bundle.
  const proxy = stripComments(readSource(PROXY_PATH));
  assert.equal(
    proxy.includes("resolveParticularSessionCookieName"),
    false,
    `${PROXY_PATH} must not import backend-only particular resolution`,
  );
  assert.equal(
    stripComments(readSource(RESOLVER_PATH)).includes("process.env"),
    false,
    `${RESOLVER_PATH} must stay a pure function over its argument`,
  );
});

// ─── T15 · the proxy boundary is unchanged and fail-closed ───────────────────

test("T15 the proxy keeps its redirect and refuses any boundary fallback", () => {
  const proxy = stripComments(readSource(PROXY_PATH));

  assert.ok(proxy.includes('const LOGIN_PATH = "/login"'), "login path pinned");
  assert.ok(
    proxy.includes("return NextResponse.redirect(loginUrl)"),
    "a missing session must redirect",
  );
  assert.ok(
    proxy.includes('loginUrl.searchParams.set("next", nextPath)'),
    "the redirect must preserve the requested path",
  );
  assert.ok(
    proxy.includes("ADMIN_DASHBOARD_PATH_PREFIX"),
    "the admin boundary must be selected by path",
  );
  assert.ok(
    proxy.includes("request.cookies.get(requiredCookieName)?.value"),
    "the proxy must check exactly the required boundary cookie",
  );

  assert.equal(
    /ADMIN_SESSION_COOKIE_NAME\s*\|\||\|\|\s*ADMIN_SESSION_COOKIE_NAME/.test(proxy),
    false,
    "the admin boundary must not fall back to another cookie",
  );
  assert.equal(
    /CLINIC_SESSION_COOKIE_NAME\s*\|\||\|\|\s*CLINIC_SESSION_COOKIE_NAME/.test(proxy),
    false,
    "the clinic boundary must not fall back to another cookie",
  );
  assert.equal(
    proxy.includes(DEFAULT_PARTICULAR_SESSION_COOKIE_NAME),
    false,
    "the particular boundary does not participate in the dashboard proxy",
  );
});
