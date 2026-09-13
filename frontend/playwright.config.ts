import { defineConfig, devices } from "@playwright/test";

// Server ownership: Playwright is the single orchestrator of both processes
// (fixture API on 3107 and the Next.js application on 3000) and owns readiness
// and teardown.
// - Local runs use next dev and start fresh by default so they cannot silently
//   reuse stale public environment values or cached CSS.
// - Local reuse remains an explicit development-only optimization.
const isCi = process.env.CI === "true";
const reuseExistingServer =
  !isCi && process.env.E2E_REUSE_SERVER === "1";

// P1 (PR #1495): CI=true alone is not a safe signal for "a production bundle
// exists". Other workflows (e.g. visual-regression-manual.yml) run Playwright
// with CI=true but never `pnpm --dir frontend build`, so `next start` would
// fail there. Only Frontend CI's e2e:ci step sets this explicitly, right
// after building. Every other CI=true context keeps using `next dev`.
const isProductionRunner =
  isCi && process.env.VETNEB_E2E_PRODUCTION_RUNNER === "1";
const applicationServerCommand = isProductionRunner
  ? "pnpm start --hostname 127.0.0.1"
  : "pnpm dev --hostname 127.0.0.1";

// Server-only, non-NEXT_PUBLIC_ flags that unlock the two production-only
// exceptions e2e:ci needs to run hermetically against the real `next start`
// bundle: the local-fixture API origin (frontend/src/lib/api.ts) and the
// external Google Maps embed kill switch (frontend/src/components/layout/Footer.tsx).
// Production-runner-only by construction — no other CI context runs `next start`.
const applicationServerEnv: Record<string, string> = {
  NEXT_PUBLIC_API_URL: "http://127.0.0.1:3107",
  ...(isProductionRunner
    ? {
        VETNEB_E2E_ALLOW_LOCAL_API: "1",
        VETNEB_E2E_DISABLE_EXTERNAL_EMBEDS: "1",
      }
    : {}),
};

// Hung-run guard: the layered CI suites finish in single-digit minutes and a
// warm full local run takes ~4 minutes, so 30 minutes is generous headroom
// (cold install + first dev compile included) while still terminating a hung
// run with a non-zero exit and killing both webServers. Override per run with
// E2E_GLOBAL_TIMEOUT_MS when a special workload legitimately needs more.
const globalTimeout = Number(process.env.E2E_GLOBAL_TIMEOUT_MS) || 30 * 60_000;

export default defineConfig({
  testDir: "./e2e",
  globalTeardown: "./e2e/helpers/restore-next-env-hygiene.mjs",
  timeout: 30_000,
  globalTimeout,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: true,
  // LIMPIEZA E2E B-2 (E2E-GLOBAL-02A): a single leaked `.only` shrinks the
  // required gate to a green no-gate, and a test that only passes on retry is
  // not a pass. Local runs keep `.only` as a focusing tool; CI refuses it.
  forbidOnly: isCi,
  failOnFlakyTests: true,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3000",
    // B-4 (E2E-GLOBAL-02A) is INTENTIONALLY NOT closed here. "retain-on-failure"
    // (vs. today's "on-first-retry", inert under the required gate's zero
    // retries) was audited on PR #1715: Playwright's trace format records
    // Cookie/Set-Cookie headers and addCookies() call parameters verbatim
    // (confirmed empirically against the pinned Playwright version), and 43 of
    // the 64 e2e:ci-cohort specs seed real production cookie names
    // (app_session_id/admin_session_id) via addCookies(). frontend-ci.yml
    // already uploads frontend/test-results/ on failure, so a retained trace
    // would ship session-cookie material as a PR-attached CI artifact —
    // AGENTS.md §9 forbids cookies/session IDs in any artifact produced by the
    // work, without a synthetic-value exception. No trace option can suppress
    // just the cookie/header fields while keeping the rest, and no in-repo
    // sanitizer exists. Closing B-4 needs a trace-sanitization step, which
    // touches .github/workflows/frontend-ci.yml (R2) — out of E2E-GLOBAL-02A's
    // config-only scope. Track as the E2E-GLOBAL-02A-trace follow-up.
    trace: "on-first-retry",
    // screenshot is NOT part of the blocked surface: it captures rendered
    // pixels only, and no CI spec renders a cookie/session value on-screen
    // (verified: no `document.cookie`/session-value render path exists in
    // frontend/src or frontend/e2e). Safe to ship with B-2 today.
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "node e2e/fixtures/admin-populated-api-server.mjs",
      url: "http://127.0.0.1:3107/__e2e/health",
      reuseExistingServer,
      timeout: 30_000,
    },
    {
      command: applicationServerCommand,
      env: applicationServerEnv,
      url: "http://127.0.0.1:3000",
      reuseExistingServer,
      timeout: 120_000,
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
