import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

const HELPER_PATH = "frontend/e2e/helpers/windows-webserver-lifecycle.mjs";
const CONFIG_PATH = "frontend/playwright.config.ts";
const RUNNER_PATH = "frontend/e2e/scripts/run-cohort.mjs";

async function loadHelper() {
  return import(pathToFileURL(resolve(process.cwd(), HELPER_PATH)).href);
}

async function loadRunner() {
  return import(pathToFileURL(resolve(process.cwd(), RUNNER_PATH)).href);
}

test("Windows lifecycle creates per-run explicit ownership metadata", async () => {
  const helper = await loadHelper();
  const lifecycle = helper.createWindowsWebServerLifecycle("win32");

  assert.ok(lifecycle.ownerFile.includes("vetneb-playwright-webservers-"));
  assert.equal(lifecycle.env.VETNEB_E2E_WEBSERVER_OWNER_FILE, lifecycle.ownerFile);
  assert.equal(lifecycle.env.VETNEB_E2E_WEBSERVER_OWNER_TOKEN, lifecycle.ownerToken);
  assert.equal(helper.resolveWindowsWebServerLifecycle({ platform: "linux" }), null);
});

test("runner-created ownership is propagated and config resolution reuses it", async () => {
  const helper = await loadHelper();
  const runner = await loadRunner();
  const created = {
    ownerFile: "C:/temp/runner-owned.json",
    ownerToken: "runner-token",
    env: {
      VETNEB_E2E_WEBSERVER_OWNER_FILE: "C:/temp/runner-owned.json",
      VETNEB_E2E_WEBSERVER_OWNER_TOKEN: "runner-token",
    },
  };
  const lifecycle = helper.resolveWindowsWebServerLifecycle({
    platform: "win32",
    environment: {},
    createLifecycle: () => created,
  });
  const resolvedByConfig = helper.resolveWindowsWebServerLifecycle({
    platform: "win32",
    environment: helper.withWindowsWebServerLifecycle({ UNRELATED: "kept" }, lifecycle),
    createLifecycle: () => {
      throw new Error("config must reuse the runner lifecycle");
    },
  });
  let childEnvironment: Record<string, string> | undefined;

  const status = runner.runPlaywright(
    { specs: ["e2e/public/routes/public-routes.spec.ts"] },
    [],
    {
      lifecycle,
      environment: { UNRELATED: "kept" },
      pnpm: { executable: "pnpm", prefixArgs: [], label: "pnpm" },
      spawn: (_executable: string, _args: string[], options: { env: Record<string, string> }) => {
        childEnvironment = options.env;
        return { status: 0 };
      },
    },
  );

  assert.equal(status, 0);
  assert.deepEqual(resolvedByConfig, lifecycle);
  assert.deepEqual(childEnvironment, { UNRELATED: "kept", ...lifecycle.env });
});

test("Windows cleanup terminates only PIDs recorded by this run", async () => {
  const helper = await loadHelper();
  const directory = mkdtempSync(join(tmpdir(), "vetneb-e2e-webserver-owner-"));
  const ownerFile = join(directory, "owner.json");
  const terminated: number[] = [];

  try {
    writeFileSync(
      ownerFile,
      JSON.stringify({
        ownerToken: "this-run",
        processes: [
          { pid: 401, kind: "fixture" },
          { pid: 402, kind: "application" },
          { pid: 999, kind: "other" },
        ],
      }),
      "utf8",
    );

    const owned = helper.cleanupOwnedWindowsWebServers({
      platform: "win32",
      ownerFile,
      ownerToken: "this-run",
      killProcessTree: (pid: number) => terminated.push(pid),
    });

    assert.deepEqual(terminated, [401, 402]);
    assert.deepEqual(owned.map((process: { pid: number }) => process.pid), [401, 402]);
    assert.deepEqual(
      helper.cleanupOwnedWindowsWebServers({
        platform: "win32",
        ownerFile,
        ownerToken: "this-run",
        killProcessTree: (pid: number) => terminated.push(pid),
      }),
      [],
      "a second cleanup after globalTeardown must be a no-op",
    );
    assert.deepEqual(terminated, [401, 402]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("runner fallback uses the same ownership and preserves hygiene when cleanup fails", async () => {
  const runner = await loadRunner();
  const lifecycle = {
    ownerFile: "C:/temp/runner-owned.json",
    ownerToken: "runner-token",
    env: {
      VETNEB_E2E_WEBSERVER_OWNER_FILE: "C:/temp/runner-owned.json",
      VETNEB_E2E_WEBSERVER_OWNER_TOKEN: "runner-token",
    },
  };
  let cleanupArguments: unknown;
  let restored = false;

  await runner.finalizePlaywrightLifecycle({
    lifecycle,
    platform: "win32",
    cleanup: (arguments_: unknown) => {
      cleanupArguments = arguments_;
    },
    restore: async () => {
      restored = true;
    },
  });

  assert.deepEqual(cleanupArguments, {
    platform: "win32",
    ownerFile: lifecycle.ownerFile,
    ownerToken: lifecycle.ownerToken,
  });
  assert.equal(restored, true);

  restored = false;
  await assert.rejects(
    runner.finalizePlaywrightLifecycle({
      lifecycle,
      platform: "win32",
      cleanup: () => {
        throw new Error("taskkill access denied");
      },
      restore: async () => {
        restored = true;
      },
    }),
    /taskkill access denied/,
  );
  assert.equal(restored, true, "hygiene must run even when cleanup reports a real failure");
});

test("an already-exited owned PID is an idempotent taskkill result", async () => {
  const helper = await loadHelper();
  const missing = Object.assign(new Error("taskkill failed"), {
    stderr: 'ERROR: The process "PID 401" not found.',
  });

  assert.equal(
    helper.killWindowsProcessTree(401, () => {
      throw missing;
    }),
    false,
  );
  assert.throws(
    () => helper.killWindowsProcessTree(401, () => {
      throw new Error("Access is denied.");
    }),
    /Access is denied/,
  );
});

test("reuse and Linux cleanup never terminate a pre-existing server", async () => {
  const helper = await loadHelper();
  const directory = mkdtempSync(join(tmpdir(), "vetneb-e2e-webserver-owner-"));
  const ownerFile = join(directory, "absent-owner.json");
  const terminated: number[] = [];

  try {
    const reused = helper.cleanupOwnedWindowsWebServers({
      platform: "win32",
      ownerFile,
      ownerToken: "no-launcher-record",
      killProcessTree: (pid: number) => terminated.push(pid),
    });
    const linux = helper.cleanupOwnedWindowsWebServers({
      platform: "linux",
      ownerFile,
      ownerToken: "no-launcher-record",
      killProcessTree: (pid: number) => terminated.push(pid),
    });

    assert.deepEqual(reused, []);
    assert.deepEqual(linux, []);
    assert.deepEqual(terminated, []);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Playwright config scopes the launcher and forced cleanup to Windows", () => {
  const config = readFileSync(resolve(process.cwd(), CONFIG_PATH), "utf8");

  assert.match(
    config,
    /resolveWindowsWebServerLifecycle\(\)/,
    "the config must reuse runner ownership or create it through the platform-aware helper",
  );
  assert.match(
    config,
    /windowsWebServerLifecycle\s*\?\s*"node e2e\/helpers\/playwright-webserver-launcher\.mjs fixture"\s*:\s*"node e2e\/fixtures\/admin-populated-api-server\.mjs"/,
    "Linux must preserve the existing direct fixture command",
  );
  assert.match(
    config,
    /windowsWebServerLifecycle\s*\?\s*"node e2e\/helpers\/playwright-webserver-launcher\.mjs application"\s*:\s*applicationServerCommand/,
    "Linux must preserve the existing Next command, including the production runner",
  );
  assert.match(
    config,
    /globalTeardown:\s*"\.\/e2e\/helpers\/teardown-e2e-lifecycle\.mjs"/,
    "the lifecycle cleanup must run before Playwright tears down its shell commands",
  );
});
