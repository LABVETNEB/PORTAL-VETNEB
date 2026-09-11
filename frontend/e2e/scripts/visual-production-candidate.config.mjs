// E2E-GLOBAL-05A — Playwright overlay for the production visual candidate.
//
// Reuses frontend/playwright.config.ts as-is (servers, runner selection,
// projects, timeouts, teardown) and only redirects snapshots and outputs into
// isolated directories outside the repository. It refuses to load unless the
// base config selected `next start`, so a candidate is never captured from
// `next dev` and never written over the canonical baselines next to the specs.

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import baseConfig from "../../playwright.config.ts";
import {
  PRODUCTION_APPLICATION_COMMAND,
  buildCandidateSnapshotTemplate,
  resolveCandidateEnvironment,
} from "./visual-production-candidate.mjs";

const FRONTEND_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const APPLICATION_URL = "http://127.0.0.1:3000";

const { candidateDir, playwrightDir } = resolveCandidateEnvironment(process.env);

const webServers = Array.isArray(baseConfig.webServer) ? baseConfig.webServer : [baseConfig.webServer];
const applicationServer = webServers.find((server) => server?.url === APPLICATION_URL);
if (applicationServer?.command !== PRODUCTION_APPLICATION_COMMAND) {
  throw new Error(
    `production visual candidate requires the base config to serve "${PRODUCTION_APPLICATION_COMMAND}", ` +
      `received: ${applicationServer?.command ?? "(no application server)"}`,
  );
}

// A project-level snapshot setting would take precedence over the redirect.
for (const project of baseConfig.projects ?? []) {
  if (project.snapshotPathTemplate || project.snapshotDir || project.expect) {
    throw new Error(`project ${project.name} overrides snapshot resolution; the candidate redirect would not apply`);
  }
}

if (typeof baseConfig.testDir !== "string" || typeof baseConfig.globalTeardown !== "string") {
  throw new Error("production visual candidate expects string testDir and globalTeardown in playwright.config.ts");
}
if (!Array.isArray(baseConfig.reporter)) {
  throw new Error("production visual candidate expects a reporter list in playwright.config.ts");
}

const snapshotPathTemplate = buildCandidateSnapshotTemplate(candidateDir);

const candidateConfig = {
  ...baseConfig,
  // The base config's relative paths resolve from its own directory.
  testDir: resolve(FRONTEND_ROOT, baseConfig.testDir),
  globalTeardown: resolve(FRONTEND_ROOT, baseConfig.globalTeardown),
  outputDir: resolve(playwrightDir, "test-results"),
  reporter: baseConfig.reporter.map((entry) =>
    entry[0] === "html" ? ["html", { ...entry[1], outputFolder: resolve(playwrightDir, "playwright-report") }] : entry,
  ),
  snapshotPathTemplate,
  expect: {
    ...baseConfig.expect,
    toHaveScreenshot: { ...baseConfig.expect?.toHaveScreenshot, pathTemplate: snapshotPathTemplate },
  },
  // The candidate tree starts empty: "all" records each capture and passes,
  // whereas the default "missing" mode would fail every test.
  updateSnapshots: "all",
  webServer: webServers.map((server) => ({ ...server, cwd: FRONTEND_ROOT })),
};

export default candidateConfig;
