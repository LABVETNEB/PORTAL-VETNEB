import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { runInNewContext } from "node:vm";
import ts from "typescript";

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

// TEST-GLOBAL-03: server.command is the CONFIGURED command, which on win32 is
// the launcher. The contract is the EFFECTIVE command: the frontend script the
// direct path runs, or what the real launcher's commandFor() spawns. The
// launcher is evaluated from its own source, never re-implemented here.
const DEV_COMMAND = "next dev --hostname 127.0.0.1";
const START_COMMAND = "next start --hostname 127.0.0.1";
const LAUNCHER_PATH = "e2e/helpers/playwright-webserver-launcher.mjs";
const FIXTURE_SERVER_PATH = "e2e/fixtures/admin-populated-api-server.mjs";
const NODE_EXECUTABLE = "<node>";
const NEXT_BIN = "<next-bin>";

type RunnerEnv = Record<string, string | undefined>;

function readFrontendSource(path: string): string {
  return readFileSync(resolve(process.cwd(), "frontend", path), "utf8").replace(/\r\n/g, "\n");
}

function frontendScripts(): Record<string, unknown> {
  return JSON.parse(readFrontendSource("package.json")).scripts ?? {};
}

// Fails closed unless the launcher still routes argv kind → commandFor(kind) → spawn.
function launcherCommandFor(source: string): string {
  const file = ts.createSourceFile(LAUNCHER_PATH, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const declarations = file.statements.filter(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === "commandFor",
  );
  if (declarations.length !== 1) {
    throw new Error("launcher format not recognized: expected exactly one top-level commandFor");
  }
  const statements = file.statements.map((statement) => statement.getText(file).replace(/\s+/g, " "));
  const wiring = [
    "const [kind] = process.argv.slice(2);",
    "const command = commandFor(kind);",
    "const child = spawn(command.executable, command.args, {",
  ];
  for (const required of wiring) {
    if (!statements.some((statement) => statement.startsWith(required))) {
      throw new Error(`launcher format not recognized: missing ${required}`);
    }
  }
  return declarations[0].getText(file);
}

function runLauncher(source: string, kind: string, env: RunnerEnv): string {
  const spawned = runInNewContext(
    `${launcherCommandFor(source)}\ncommandFor(kind);`,
    {
      kind,
      process: { env: { ...env }, execPath: NODE_EXECUTABLE },
      require: {
        resolve: (id: string) => {
          if (id !== "next/dist/bin/next") throw new Error(`launcher resolved an unexpected module: ${id}`);
          return NEXT_BIN;
        },
      },
    },
    { timeout: 1_000 },
  ) as { executable?: unknown; args?: unknown };

  const args = spawned?.args;
  if (
    spawned?.executable !== NODE_EXECUTABLE ||
    !Array.isArray(args) ||
    !args.every((arg) => typeof arg === "string")
  ) {
    throw new Error(`launcher spawn not recognized: ${JSON.stringify(spawned)}`);
  }
  const [entry, ...rest] = args as string[];
  return entry === NEXT_BIN ? ["next", ...rest].join(" ") : ["node", entry, ...rest].join(" ");
}

function effectiveCommand(
  configured: string | undefined,
  env: RunnerEnv,
  launcherSource = readFrontendSource(LAUNCHER_PATH),
): string {
  const [program, target, ...rest] = (configured ?? "").split(" ");
  if (program === "pnpm") {
    const script = frontendScripts()[target];
    if (typeof script !== "string") throw new Error(`unknown frontend script in webServer command: ${configured}`);
    return [script, ...rest].join(" ");
  }
  if (program === "node" && target === LAUNCHER_PATH && rest.length === 1) {
    return runLauncher(launcherSource, rest[0], env);
  }
  if (program === "node" && target === FIXTURE_SERVER_PATH && rest.length === 0) return configured as string;
  throw new Error(`unrecognized webServer command: ${configured}`);
}

function caseEnvironment(input: { ci?: string; reuse?: string; productionRunner?: string }): RunnerEnv {
  return {
    CI: input.ci,
    E2E_REUSE_SERVER: input.reuse,
    VETNEB_E2E_PRODUCTION_RUNNER: input.productionRunner,
  };
}

// Both paths must agree on every platform: the one playwright.config.ts
// configured here, and the launcher that win32 runs.
function resolvedApplicationCommands(
  server: WebServerLike,
  input: { ci?: string; reuse?: string; productionRunner?: string },
): { configured: string; launcher: string } {
  const env = { ...caseEnvironment(input), ...server.env };
  return {
    configured: effectiveCommand(server.command, env),
    launcher: runLauncher(readFrontendSource(LAUNCHER_PATH), "application", env),
  };
}

const RUNNER_MATRIX: ReadonlyArray<{ name: string; env: RunnerEnv; expected: string }> = [
  { name: "local default", env: {}, expected: DEV_COMMAND },
  { name: "CI=true without flag", env: { CI: "true" }, expected: DEV_COMMAND },
  { name: "CI=true + flag=1", env: { CI: "true", VETNEB_E2E_PRODUCTION_RUNNER: "1" }, expected: START_COMMAND },
  { name: "flag=1 without CI", env: { VETNEB_E2E_PRODUCTION_RUNNER: "1" }, expected: DEV_COMMAND },
  { name: "local reuse", env: { E2E_REUSE_SERVER: "1" }, expected: DEV_COMMAND },
  { name: "CI=1 + flag=1", env: { CI: "1", VETNEB_E2E_PRODUCTION_RUNNER: "1" }, expected: DEV_COMMAND },
  { name: "CI=true + flag=true", env: { CI: "true", VETNEB_E2E_PRODUCTION_RUNNER: "true" }, expected: DEV_COMMAND },
  { name: "CI=true + flag=0", env: { CI: "true", VETNEB_E2E_PRODUCTION_RUNNER: "0" }, expected: DEV_COMMAND },
];

function launcherMatrixViolations(source: string): string[] {
  return RUNNER_MATRIX.flatMap(({ name, env, expected }) => {
    const actual = runLauncher(source, "application", env);
    return actual === expected ? [] : [`${name}: expected ${expected}, launcher resolved ${actual}`];
  });
}

test("Playwright selecciona dev local y next start solo en el runner productivo explícito", async (t) => {
  await t.test("local default starts a fresh development server", async () => {
    const server = applicationServer(
      await loadConfig({}),
    );

    assert.deepEqual(
      resolvedApplicationCommands(server, {}),
      { configured: DEV_COMMAND, launcher: DEV_COMMAND },
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

  // P1 (PR #1495): CI=true alone is not enough to select `next start`. A CI
  // context opts in with VETNEB_E2E_PRODUCTION_RUNNER=1 only after producing
  // the production bundle (Frontend CI's e2e:ci, E2E Completeness' e2e:full
  // and visual-regression-manual.yml's production-candidate runner); generic
  // CI without that opt-in — that workflow's `dev` runner — stays on
  // `pnpm dev`.
  await t.test("generic CI (no production runner flag) still uses pnpm dev", async () => {
    const server = applicationServer(
      await loadConfig({
        ci: "true",
      }),
    );

    assert.deepEqual(
      resolvedApplicationCommands(server, { ci: "true" }),
      { configured: DEV_COMMAND, launcher: DEV_COMMAND },
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

    assert.deepEqual(
      resolvedApplicationCommands(server, { ci: "true", reuse: "1", productionRunner: "1" }),
      { configured: START_COMMAND, launcher: START_COMMAND },
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

    assert.deepEqual(
      resolvedApplicationCommands(server, { productionRunner: "1" }),
      { configured: DEV_COMMAND, launcher: DEV_COMMAND },
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

    assert.deepEqual(
      resolvedApplicationCommands(server, { reuse: "1" }),
      { configured: DEV_COMMAND, launcher: DEV_COMMAND },
    );
    assert.equal(server.reuseExistingServer, true);
    assert.equal(server.env?.VETNEB_E2E_ALLOW_LOCAL_API, undefined);
    assert.equal(server.env?.VETNEB_E2E_DISABLE_EXTERNAL_EMBEDS, undefined);
  });

  for (const input of [
    { ci: "1", productionRunner: "1" },
    { ci: "true", productionRunner: "true" },
    { ci: "true", productionRunner: "0" },
  ]) {
    await t.test(`only the exact CI=true + flag=1 pair selects next start (CI=${input.ci}, flag=${input.productionRunner})`, async () => {
      const server = applicationServer(await loadConfig(input));

      assert.deepEqual(
        resolvedApplicationCommands(server, input),
        { configured: DEV_COMMAND, launcher: DEV_COMMAND },
      );
      assert.equal(server.env?.VETNEB_E2E_ALLOW_LOCAL_API, undefined);
      assert.equal(server.env?.VETNEB_E2E_DISABLE_EXTERNAL_EMBEDS, undefined);
    });
  }
});

test("the Win32 launcher resolves the runner matrix, the fixture and fails closed on unknown kinds", async () => {
  const launcherSource = readFrontendSource(LAUNCHER_PATH);

  assert.deepEqual(launcherMatrixViolations(launcherSource), []);
  assert.equal(runLauncher(launcherSource, "fixture", {}), `node ${FIXTURE_SERVER_PATH}`);
  assert.throws(() => runLauncher(launcherSource, "admin", {}), /Unknown webServer kind: admin/);

  const config = await loadConfig({});
  const servers = Array.isArray(config.webServer) ? config.webServer : [config.webServer];
  const fixture = servers.find((server) => server?.url === "http://127.0.0.1:3107/__e2e/health");
  assert.ok(fixture, "Playwright must define the fixture API server");
  assert.equal(effectiveCommand(fixture.command, { ...fixture.env }), `node ${FIXTURE_SERVER_PATH}`);
});

// Negative proof: in-memory mutations of the real launcher source and of the
// configured command must turn the contract red. Nothing on disk is touched.
test("the effective runner contract fails closed on launcher and configured-command mutations", () => {
  const source = readFrontendSource(LAUNCHER_PATH);
  const mutate = (from: string, to: string): string => {
    assert.ok(source.includes(from), `mutation precondition: ${from}`);
    return source.replace(from, to);
  };

  assert.ok(
    launcherMatrixViolations(mutate('isProductionRunner ? "start" : "dev"', 'isProductionRunner ? "dev" : "dev"'))
      .includes(`CI=true + flag=1: expected ${START_COMMAND}, launcher resolved ${DEV_COMMAND}`),
    "a production runner that no longer reaches next start must be red",
  );
  assert.ok(
    launcherMatrixViolations(mutate('process.env.CI === "true" && ', ""))
      .includes(`flag=1 without CI: expected ${DEV_COMMAND}, launcher resolved ${START_COMMAND}`),
    "dropping the CI condition (the pre-#1764 divergence) must be red",
  );
  assert.equal(
    launcherMatrixViolations(mutate('"--hostname", "127.0.0.1"', '"--hostname", "0.0.0.0"')).length,
    RUNNER_MATRIX.length,
    "losing --hostname 127.0.0.1 must be red for every case",
  );
  assert.throws(
    () => launcherMatrixViolations(mutate("function commandFor(", "function resolveCommand(")),
    /launcher format not recognized/,
  );
  assert.throws(
    () => launcherMatrixViolations(mutate("spawn(command.executable, command.args,", 'spawn(command.executable, ["--inspect", ...command.args],')),
    /launcher format not recognized/,
  );

  const productionEnv = { CI: "true", VETNEB_E2E_PRODUCTION_RUNNER: "1" };
  assert.equal(effectiveCommand(`node ${LAUNCHER_PATH} application`, productionEnv), START_COMMAND);
  assert.equal(effectiveCommand("pnpm start --hostname 127.0.0.1", productionEnv), START_COMMAND);
  assert.notEqual(effectiveCommand(`node ${LAUNCHER_PATH} fixture`, productionEnv), START_COMMAND);
  assert.throws(() => effectiveCommand(`node ${LAUNCHER_PATH} admin`, productionEnv), /Unknown webServer kind/);
  assert.throws(
    () => effectiveCommand("node e2e/helpers/other-webserver-launcher.mjs application", productionEnv),
    /unrecognized webServer command/,
  );
  assert.throws(() => effectiveCommand("pnpm vetneb-missing-script", productionEnv), /unknown frontend script/);
});

// LIMPIEZA E2E B-2 (E2E-GLOBAL-02A): forbidOnly is CI-only so local runs keep
// `.only` as a focusing tool while CI refuses a leaked one outright.
test("Playwright cierra el falso verde de un .only filtrado en el gate required", async (t) => {
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
});

// LIMPIEZA E2E B-4 (E2E-GLOBAL-02B): failOnFlakyTests and screenshot do not
// branch on CI/production-runner env, so one context fully covers them.
test("Playwright falla en flaky y deja screenshot de la falla", async () => {
  const config = await loadConfig({});

  assert.equal(
    config.failOnFlakyTests,
    true,
    "a test that only passes on retry must not be reported as a pass",
  );
  assert.equal(
    config.use?.screenshot,
    "only-on-failure",
    "a failure must leave a screenshot, and a pass must not",
  );
});

// trace does branch: raw traces carry cookie material verbatim, so they may
// only be written where the fail-closed sanitizer of PR #1719 guards every
// upload. The sanitizer and workflow contracts are pinned by their own tests.
test("Playwright retiene traces sólo en CI saneado", async (t) => {
  await t.test("local runs never write a raw trace", async () => {
    const config = await loadConfig({});

    assert.equal(
      config.use?.trace,
      "off",
      "no sanitizer runs locally, so a local failure must not leave a raw trace.zip",
    );
  });

  await t.test("the production runner flag outside CI still writes no trace", async () => {
    const config = await loadConfig({ productionRunner: "1" });

    assert.equal(config.use?.trace, "off");
  });

  await t.test("the required production runner retains the first failure's trace", async () => {
    const config = await loadConfig({ ci: "true", productionRunner: "1" });

    assert.equal(
      config.use?.trace,
      "retain-on-failure",
      "e2e:ci runs with zero retries, so only retain-on-failure keeps first-failure diagnostics",
    );
  });

  await t.test("other CI contexts trace only retries", async () => {
    const config = await loadConfig({ ci: "true" });

    assert.equal(
      config.use?.trace,
      "on-first-retry",
      "generic CI without the production-runner opt-in must use on-first-retry tracing",
    );
  });
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
