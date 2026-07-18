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
  webServer?: WebServerLike | WebServerLike[];
};

let importSequence = 0;

function restoreEnvironment(
  previousCi: string | undefined,
  previousReuse: string | undefined,
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
}

async function loadConfig(input: {
  ci?: string;
  reuse?: string;
}): Promise<PlaywrightConfigLike> {
  const previousCi = process.env.CI;
  const previousReuse = process.env.E2E_REUSE_SERVER;

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

  try {
    const configUrl = pathToFileURL(
      resolve(process.cwd(), "frontend/playwright.config.ts"),
    );
    configUrl.searchParams.set("contractCase", String(importSequence++));

    const imported = await import(configUrl.href);

    return imported.default as PlaywrightConfigLike;
  } finally {
    restoreEnvironment(previousCi, previousReuse);
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

test("Playwright selecciona dev local y next start en CI", async (t) => {
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

  await t.test("CI serves the existing production build", async () => {
    const server = applicationServer(
      await loadConfig({
        ci: "true",
        reuse: "1",
      }),
    );

    assert.equal(
      server.command,
      "pnpm start --hostname 127.0.0.1",
    );
    assert.equal(
      server.reuseExistingServer,
      false,
      "CI must never reuse an existing application server",
    );
    assert.equal(
      server.env?.NEXT_PUBLIC_API_URL,
      "http://127.0.0.1:3107",
    );
    assert.equal(
      server.env?.VETNEB_E2E_ALLOW_LOCAL_API,
      "1",
      "CI must propagate the server-only local API exception to next start",
    );
    assert.equal(
      server.env?.VETNEB_E2E_DISABLE_EXTERNAL_EMBEDS,
      "1",
      "CI must propagate the server-only external embed kill switch to next start",
    );
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
