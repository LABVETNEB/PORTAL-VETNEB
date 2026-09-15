import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

// ─────────────────────────────────────────────────────────────────────────────
// E2E-GLOBAL-07 (LIMPIEZA E2E P2-1/P2-5, R-11/R-17) — single source of truth
// for E2E session setup and the app origin.
//
// `frontend/e2e/helpers/session.ts` owns the session cookie names, their
// synthetic values (the `default` and `populated` profiles) and the origin
// they are scoped to, derived from the effective Playwright `use.baseURL`.
// This guard keeps it that way: a new `addCookies()` call, a hardcoded app
// origin or a synthetic session literal anywhere else under frontend/e2e fails.
//
// Deliberate exceptions, each pinned to its exact occurrence count so it
// cannot grow silently:
// - the hermetic fixture API is the server-side end of the same contract: it
//   must recognise the populated values, and its health payload reports the
//   app origin as data;
// - the E2E-GLOBAL-03 raw contract specs send hand-written `Cookie:` headers on
//   purpose — the cookie NAME/VALUE binding is what they assert;
// - two app-origin literals are data or runner config, not session setup.
//
// The walk is filesystem-based, not `git ls-files`, so an unstaged new spec is
// caught before it is ever committed.
// ─────────────────────────────────────────────────────────────────────────────

const TEST_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(TEST_FILE), "..", "..");

const E2E_ROOT = "frontend/e2e";
const SESSION_HELPER = "frontend/e2e/helpers/session.ts";
const FIXTURE_API = "frontend/e2e/fixtures/admin-populated-api-server.mjs";
const FORBIDDEN_ROLE_SPEC = "frontend/e2e/platform/auth/session-boundary-forbidden-role.spec.ts";
const EXPIRED_SESSION_SPEC =
  "frontend/e2e/platform/auth/dashboard-session-boundary-unauthorized.spec.ts";

const EXCLUDED_DIRECTORIES = new Set(["node_modules", "test-results", "playwright-report"]);
const SOURCE_EXTENSIONS = [".ts", ".mts", ".cts", ".js", ".mjs", ".cjs"];

type Rule = {
  readonly id: string;
  readonly pattern: RegExp;
  /** Exact occurrence count per allowed path; every other path must have 0. */
  readonly allowed: Readonly<Record<string, number>>;
  /** Paths outside the rule entirely (the server-side end of the contract). */
  readonly exempt: readonly string[];
};

const RULES: readonly Rule[] = [
  {
    id: "session-setup-addCookies",
    pattern: /\baddCookies\s*\(/g,
    allowed: { [SESSION_HELPER]: 1 },
    exempt: [],
  },
  {
    id: "hardcoded-app-origin",
    pattern: /\b(?:127\.0\.0\.1|localhost):3000\b/g,
    allowed: {
      // Mocked /api/admin/system-health payload rendered by the stress baseline.
      "frontend/e2e/regression/visual/visual-regression-stress.spec.ts": 1,
      // Production-candidate runner config: the application server URL itself.
      "frontend/e2e/scripts/visual-production-candidate.config.mjs": 1,
    },
    exempt: [FIXTURE_API],
  },
  {
    id: "synthetic-session-value",
    pattern: /\be2e_(?:test|populated|boundary)_\w*session\b/g,
    allowed: {
      [SESSION_HELPER]: 5,
      // Raw contract: 3 BOUNDARY_* declarations, 1 comment naming the old
      // cross-cookie bug, 1 unrecognized-session probe.
      [FORBIDDEN_ROLE_SPEC]: 5,
      // Raw contract: the BOUNDARY_EXPIRED_CLINIC_SESSION declaration.
      [EXPIRED_SESSION_SPEC]: 1,
    },
    exempt: [FIXTURE_API],
  },
  {
    id: "session-cookie-name",
    pattern: /\b(?:admin_session_id|app_session_id|particular_session_id)\b/g,
    allowed: {
      [SESSION_HELPER]: 3,
      // Raw `Cookie:` headers, test titles and comments of the name-binding contract.
      [FORBIDDEN_ROLE_SPEC]: 13,
      // Raw `Cookie:` header of the fixture-level expiry probe.
      [EXPIRED_SESSION_SPEC]: 1,
    },
    exempt: [FIXTURE_API],
  },
];

function toRepoPath(absolutePath: string): string {
  return relative(REPO_ROOT, absolutePath).split(sep).join("/");
}

function listE2eSources(): Map<string, string> {
  const sources = new Map<string, string>();

  function visit(directory: string): void {
    for (const item of readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = join(directory, item.name);
      if (item.isDirectory()) {
        if (!EXCLUDED_DIRECTORIES.has(item.name)) visit(absolutePath);
        continue;
      }
      if (!item.isFile() || !SOURCE_EXTENSIONS.some((ext) => item.name.endsWith(ext))) continue;
      sources.set(toRepoPath(absolutePath), readFileSync(absolutePath, "utf8"));
    }
  }

  visit(resolve(REPO_ROOT, E2E_ROOT));
  return new Map([...sources].sort(([a], [b]) => a.localeCompare(b)));
}

function countMatches(source: string, pattern: RegExp): number {
  return [...source.matchAll(new RegExp(pattern.source, pattern.flags))].length;
}

/** Every `rule path: found N, allowed M` breach, in deterministic order. */
function findViolations(sources: ReadonlyMap<string, string>): string[] {
  const violations: string[] = [];

  for (const rule of RULES) {
    for (const [path, source] of sources) {
      if (rule.exempt.includes(path)) continue;
      const found = countMatches(source, rule.pattern);
      const allowed = rule.allowed[path] ?? 0;
      if (found !== allowed) {
        violations.push(`${rule.id} ${path}: found ${found}, allowed ${allowed}`);
      }
    }
    for (const path of Object.keys(rule.allowed)) {
      if (!sources.has(path)) violations.push(`${rule.id} ${path}: allowlisted path is missing`);
    }
  }

  return violations;
}

test("session setup, app origin and synthetic session literals live only in helpers/session.ts", () => {
  const sources = listE2eSources();

  assert.ok(sources.has(SESSION_HELPER), `${SESSION_HELPER} must exist`);
  assert.deepEqual(
    findViolations(sources),
    [],
    "use setAdminSession/setClinicSession/setParticularSession/setSession or addAppCookies " +
      "from frontend/e2e/helpers/session.ts instead of addCookies(), a hardcoded app origin " +
      "or a session cookie literal",
  );
});

test("the app origin is derived from the effective Playwright baseURL, not redeclared", () => {
  const helper = readFileSync(resolve(REPO_ROOT, SESSION_HELPER), "utf8");
  const config = readFileSync(resolve(REPO_ROOT, "frontend/playwright.config.ts"), "utf8");

  assert.ok(helper.includes("test.info().project.use"), "origin must come from the project use options");
  assert.ok(helper.includes("new URL(baseURL).origin"), "cookies must be scoped to the baseURL origin");
  assert.match(config, /^\s+baseURL: "http:\/\/[^"]+",$/m, "playwright.config.ts must declare use.baseURL");
});

test("the populated profile matches the values the hermetic fixture API serves data for", () => {
  const helper = readFileSync(resolve(REPO_ROOT, SESSION_HELPER), "utf8");
  const fixture = readFileSync(resolve(REPO_ROOT, FIXTURE_API), "utf8");

  for (const role of ["ADMIN", "CLINIC"] as const) {
    const declared = fixture.match(new RegExp(`^const POPULATED_${role}_SESSION = "([^"]+)";$`, "m"));
    assert.ok(declared, `${FIXTURE_API} must declare POPULATED_${role}_SESSION`);
    assert.equal(
      countMatches(helper, new RegExp(`populated: "${declared[1]}"`, "g")),
      1,
      `${SESSION_HELPER} populated ${role.toLowerCase()} value must equal the fixture's`,
    );
  }
});

test("the guard rejects each regression it exists to prevent, in memory", () => {
  const baseline = listE2eSources();
  const probePath = "frontend/e2e/clinic/shell/e2e-global-07-probe.spec.ts";
  const regressions: ReadonlyArray<readonly [string, string]> = [
    ["session-setup-addCookies", 'await page.context().addCookies([sessionCookie("clinic", "default")]);'],
    ["hardcoded-app-origin", 'await page.goto("http://127.0.0.1:3000/dashboard");'],
    ["synthetic-session-value", 'const COOKIE = "e2e_populated_clinic_session";'],
    ["session-cookie-name", 'const NAME = "app_session_id";'],
  ];

  for (const [ruleId, line] of regressions) {
    const mutated = new Map(baseline);
    mutated.set(probePath, `import { test } from "@playwright/test";\n${line}\n`);
    assert.deepEqual(
      findViolations(mutated).filter((violation) => violation.includes(probePath)),
      [`${ruleId} ${probePath}: found 1, allowed 0`],
      `${ruleId} must reject: ${line}`,
    );
  }

  const grownException = new Map(baseline);
  grownException.set(FORBIDDEN_ROLE_SPEC, `${baseline.get(FORBIDDEN_ROLE_SPEC)}\n// app_session_id\n`);
  assert.deepEqual(
    findViolations(grownException).filter((violation) => violation.includes(FORBIDDEN_ROLE_SPEC)),
    [`session-cookie-name ${FORBIDDEN_ROLE_SPEC}: found 14, allowed 13`],
    "an allowlisted raw contract spec cannot grow its exception silently",
  );
});
