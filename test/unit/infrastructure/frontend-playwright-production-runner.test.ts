import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

type WebServerLike = {
  command?: string;
  url?: string;
  reuseExistingServer?: boolean;
  env?: Record<string, string>;
};

type PlaywrightConfigLike = {
  forbidOnly?: boolean;
  failOnFlakyTests?: boolean;
  use?: {
    trace?: unknown;
    screenshot?: unknown;
  };
  webServer?: WebServerLike | WebServerLike[];
};

let importSequence = 0;

function restoreEnvironment(
  previousCi: string | undefined,
  previousReuse: string | undefined,
  previousProductionRunner: string | undefined,
): void {
  if (previousCi === undefined) {
    delete process.env.CI;
  } else {
    process.env.CI = previousCi;
  }

  if (previousReuse === undefined) {
    delete process.env.E2E_REUSE_SERVER;
  } else {
    process.env.E2E_REUSE_SERVER = previousReuse;
  }

  if (previousProductionRunner === undefined) {
    delete process.env.VETNEB_E2E_PRODUCTION_RUNNER;
  } else {
    process.env.VETNEB_E2E_PRODUCTION_RUNNER = previousProductionRunner;
  }
}

async function loadConfig(input: {
  ci?: string;
  reuse?: string;
  productionRunner?: string;
}): Promise<PlaywrightConfigLike> {
  const previousCi = process.env.CI;
  const previousReuse = process.env.E2E_REUSE_SERVER;
  const previousProductionRunner = process.env.VETNEB_E2E_PRODUCTION_RUNNER;

  if (input.ci === undefined) {
    delete process.env.CI;
  } else {
    process.env.CI = input.ci;
  }

  if (input.reuse === undefined) {
    delete process.env.E2E_REUSE_SERVER;
  } else {
    process.env.E2E_REUSE_SERVER = input.reuse;
  }

  if (input.productionRunner === undefined) {
    delete process.env.VETNEB_E2E_PRODUCTION_RUNNER;
  } else {
    process.env.VETNEB_E2E_PRODUCTION_RUNNER = input.productionRunner;
  }

  try {
    const configUrl = pathToFileURL(
      resolve(process.cwd(), "frontend/playwright.config.ts"),
    );
    configUrl.searchParams.set("contractCase", String(importSequence++));

    const imported = await import(configUrl.href);

    return imported.default as PlaywrightConfigLike;
  } finally {
    restoreEnvironment(previousCi, previousReuse, previousProductionRunner);
  }
}

function applicationServer(config: PlaywrightConfigLike): WebServerLike {
  const servers = Array.isArray(config.webServer)
    ? config.webServer
    : config.webServer
      ? [config.webServer]
      : [];

  const server = servers.find(
    (candidate) => candidate.url === "http://127.0.0.1:3000",
  );

  assert.ok(server, "Playwright must define the Next.js application server");

  return server;
}

test("Playwright selecciona dev local y next start solo en el runner productivo explícito", async (t) => {
  await t.test("local default starts a fresh development server", async () => {
    const server = applicationServer(
      await loadConfig({}),
    );

    assert.equal(
      server.command,
      "pnpm dev --hostname 127.0.0.1",
    );
    assert.equal(server.reuseExistingServer, false);
    assert.equal(
      server.env?.NEXT_PUBLIC_API_URL,
      "http://127.0.0.1:3107",
    );
    assert.equal(
      server.env?.VETNEB_E2E_ALLOW_LOCAL_API,
      undefined,
      "local dev must never enable the production-only local API exception",
    );
    assert.equal(
      server.env?.VETNEB_E2E_DISABLE_EXTERNAL_EMBEDS,
      undefined,
      "local dev must never disable external embeds meant for CI hermeticity",
    );
  });

  // P1 (PR #1495): CI=true alone is not enough — other workflows (e.g.
  // visual-regression-manual.yml) run Playwright with CI=true but never run
  // `pnpm --dir frontend build`, so `next start` would fail there. Only
  // Frontend CI's e2e:ci step sets VETNEB_E2E_PRODUCTION_RUNNER=1.
  await t.test("generic CI (no production runner flag) still uses pnpm dev", async () => {
    const server = applicationServer(
      await loadConfig({
        ci: "true",
      }),
    );

    assert.equal(
      server.command,
      "pnpm dev --hostname 127.0.0.1",
      "CI=true alone (e.g. visual-regression-manual.yml) must not select next start",
    );
    assert.equal(
      server.env?.VETNEB_E2E_ALLOW_LOCAL_API,
      undefined,
      "generic CI must not enable the production-only local API exception",
    );
    assert.equal(
      server.env?.VETNEB_E2E_DISABLE_EXTERNAL_EMBEDS,
      undefined,
      "generic CI must not disable external embeds meant for the production runner",
    );
  });

  await t.test("Frontend CI's explicit production runner serves the existing production build", async () => {
    const server = applicationServer(
      await loadConfig({
        ci: "true",
        reuse: "1",
        productionRunner: "1",
      }),
    );

    assert.equal(
      server.command,
      "pnpm start --hostname 127.0.0.1",
    );
    assert.equal(
      server.reuseExistingServer,
      false,
      "the production runner must never reuse an existing application server",
    );
    assert.equal(
      server.env?.NEXT_PUBLIC_API_URL,
      "http://127.0.0.1:3107",
    );
    assert.equal(
      server.env?.VETNEB_E2E_ALLOW_LOCAL_API,
      "1",
      "the production runner must propagate the server-only local API exception to next start",
    );
    assert.equal(
      server.env?.VETNEB_E2E_DISABLE_EXTERNAL_EMBEDS,
      "1",
      "the production runner must propagate the server-only external embed kill switch to next start",
    );
  });

  await t.test("production runner flag without CI is not enough on its own", async () => {
    const server = applicationServer(
      await loadConfig({
        productionRunner: "1",
      }),
    );

    assert.equal(
      server.command,
      "pnpm dev --hostname 127.0.0.1",
      "the production runner flag alone (outside CI) must not select next start",
    );
    assert.equal(server.env?.VETNEB_E2E_ALLOW_LOCAL_API, undefined);
    assert.equal(server.env?.VETNEB_E2E_DISABLE_EXTERNAL_EMBEDS, undefined);
  });

  await t.test("local explicit reuse remains development-only", async () => {
    const server = applicationServer(
      await loadConfig({
        reuse: "1",
      }),
    );

    assert.equal(
      server.command,
      "pnpm dev --hostname 127.0.0.1",
    );
    assert.equal(server.reuseExistingServer, true);
    assert.equal(server.env?.VETNEB_E2E_ALLOW_LOCAL_API, undefined);
    assert.equal(server.env?.VETNEB_E2E_DISABLE_EXTERNAL_EMBEDS, undefined);
  });
});

// LIMPIEZA E2E B-2/B-4 (E2E-GLOBAL-02A): the four options that decide whether a
// green required gate is real. `forbidOnly` is CI-only so local runs keep
// `.only` as a focusing tool; the other three hold in every context.
test("Playwright cierra los falsos verdes de configuración del gate required", async (t) => {
  await t.test("local runs keep .only usable as a focusing tool", async () => {
    const config = await loadConfig({});

    assert.equal(
      config.forbidOnly,
      false,
      "forbidOnly must stay off locally so `.only` remains a development tool",
    );
  });

  await t.test("CI refuses a leaked .only instead of shrinking the suite", async () => {
    const config = await loadConfig({ ci: "true" });

    assert.equal(
      config.forbidOnly,
      true,
      "a leaked `.only` must fail the required gate, never reduce it to a green no-gate",
    );
  });

  const everyContext: ReadonlyArray<
    [string, { ci?: string; reuse?: string; productionRunner?: string }]
  > = [
    ["local", {}],
    ["generic CI", { ci: "true" }],
    [
      "Frontend CI production runner",
      { ci: "true", productionRunner: "1" },
    ],
  ];

  for (const [label, input] of everyContext) {
    await t.test(
      `${label} fails on flaky and retains failure diagnostics without retries`,
      async () => {
        const config = await loadConfig(input);

        assert.equal(
          config.failOnFlakyTests,
          true,
          "a test that only passes on retry must not be reported as a pass",
        );
        // The required gate runs with zero retries, so "on-first-retry" would
        // never produce a trace where merges are decided.
        assert.equal(
          config.use?.trace,
          "retain-on-failure",
          "a first failure must retain its trace without depending on a retry",
        );
        assert.equal(
          config.use?.screenshot,
          "only-on-failure",
          "a failure must leave a screenshot, and a pass must not",
        );
      },
    );
  }
});

const FIXTURE_PATH = "frontend/e2e/fixtures/admin-populated-api-server.mjs";

function readFixtureSource(): string {
  return readFileSync(resolve(process.cwd(), FIXTURE_PATH), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("E2E fixture serves a public /api/app-version route ahead of the admin session guard", () => {
  const source = readFixtureSource();

  const appVersionIndex = source.indexOf(
    'url.pathname === "/api/app-version"',
  );
  const adminGuardIndex = source.indexOf(
    "if (!hasPopulatedAdminSession(request)) {",
  );

  assert.ok(appVersionIndex >= 0, "fixture must implement /api/app-version");
  assert.ok(
    adminGuardIndex >= 0,
    "fixture must still gate populated admin routes behind hasPopulatedAdminSession",
  );
  assert.ok(
    appVersionIndex < adminGuardIndex,
    "/api/app-version must be handled before the admin session guard so it stays public",
  );

  assert.ok(source.includes("success: true,"));
  assert.ok(source.includes("appVersion:"));
  assert.ok(source.includes("clientMinVersion:"));
  assert.ok(source.includes("displayVersion:"));
  assert.ok(
    source.includes("forceUpdate: false,"),
    "fixture must never force the update gate during E2E",
  );
});
