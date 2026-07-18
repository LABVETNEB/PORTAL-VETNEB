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
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
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
