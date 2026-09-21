import { defineConfig, devices } from "@playwright/test";
import { resolveWindowsWebServerLifecycle } from "./e2e/helpers/windows-webserver-lifecycle.mjs";

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
// exists". A context serves `next start` only when it built the bundle first
// and opted in with this flag: Frontend CI (e2e:ci), E2E Completeness
// (e2e:full) and visual-regression-manual.yml's production-candidate runner,
// which sets both through e2e/scripts/visual-production-candidate.mjs. A
// CI=true context without that opt-in — today that workflow's `dev` runner —
// never runs `pnpm --dir frontend build`, so it keeps using `next dev`.
const isProductionRunner =
  isCi && process.env.VETNEB_E2E_PRODUCTION_RUNNER === "1";
const applicationServerCommand = isProductionRunner
  ? "pnpm start --hostname 127.0.0.1"
  : "pnpm dev --hostname 127.0.0.1";
const windowsWebServerLifecycle = resolveWindowsWebServerLifecycle();
if (windowsWebServerLifecycle) {
  process.env.VETNEB_E2E_WEBSERVER_OWNER_FILE = windowsWebServerLifecycle.ownerFile;
  process.env.VETNEB_E2E_WEBSERVER_OWNER_TOKEN = windowsWebServerLifecycle.ownerToken;
}
const fixtureServerCommand = windowsWebServerLifecycle
  ? "node e2e/helpers/playwright-webserver-launcher.mjs fixture"
  : "node e2e/fixtures/admin-populated-api-server.mjs";
const configuredApplicationServerCommand = windowsWebServerLifecycle
  ? "node e2e/helpers/playwright-webserver-launcher.mjs application"
  : applicationServerCommand;

// Server-only, non-NEXT_PUBLIC_ flags that unlock the two production-only
// exceptions the production runner needs to run hermetically against the real
// `next start` bundle: the local-fixture API origin (frontend/src/lib/api.ts)
// and the external Google Maps embed kill switch (frontend/src/components/layout/Footer.tsx).
// Gated on isProductionRunner by construction, so they reach only the contexts
// that built that bundle and never a `next dev` run.
const applicationServerEnv: Record<string, string> = {
  NEXT_PUBLIC_API_URL: "http://127.0.0.1:3107",
  ...(windowsWebServerLifecycle?.env ?? {}),
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
  globalTeardown: "./e2e/helpers/teardown-e2e-lifecycle.mjs",
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
    // B-4 (E2E-GLOBAL-02B): raw traces record Cookie/Set-Cookie headers and
    // addCookies() parameters verbatim, so they only exist where every upload
    // crosses the fail-closed sanitizer boundary of PR #1719 (AGENTS.md §9).
    // - Local: off. No sanitizer runs there.
    // - Production runner (e2e:ci and e2e:full alike): retain-on-failure, so
    //   the first failure keeps its trace. isProductionRunner decides this
    //   branch on its own, so E2E Completeness passing --retries=2 does not
    //   move e2e:full to on-first-retry — and retain-on-failure already avoids
    //   the per-test recording that pushed the full catalog past its budget.
    // - Other CI (CI=true without the production-runner opt-in): on-first-retry.
    trace: !isCi
      ? "off"
      : isProductionRunner
        ? "retain-on-failure"
        : "on-first-retry",
    // screenshot is NOT part of the blocked surface: it captures rendered
    // pixels only, and no CI spec renders a cookie/session value on-screen
    // (verified: no `document.cookie`/session-value render path exists in
    // frontend/src or frontend/e2e). Safe to ship with B-2 today.
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: fixtureServerCommand,
      env: windowsWebServerLifecycle?.env,
      url: "http://127.0.0.1:3107/__e2e/health",
      reuseExistingServer,
      timeout: 30_000,
    },
    {
      command: configuredApplicationServerCommand,
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
