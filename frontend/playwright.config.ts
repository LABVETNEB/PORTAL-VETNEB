import { defineConfig, devices } from "@playwright/test";

// Server ownership: Playwright is the single orchestrator of both processes
// (fixture API on 3107, Next.js dev on 3000) and is responsible for their
// readiness and teardown.
// - CI always starts fresh servers (reuseExistingServer=false).
// - Local runs also start fresh servers by default so no run silently reuses
//   a stale dev server (wrong NEXT_PUBLIC_API_URL, stale .next CSS). Reuse is
//   an explicit opt-in for fast iteration: E2E_REUSE_SERVER=1.
const reuseExistingServer =
  !process.env.CI && process.env.E2E_REUSE_SERVER === "1";

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
      command: "pnpm dev --hostname 127.0.0.1",
      env: {
        NEXT_PUBLIC_API_URL: "http://127.0.0.1:3107",
      },
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
