import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

const HELPER_PATH = "frontend/e2e/helpers/windows-webserver-lifecycle.mjs";
const CONFIG_PATH = "frontend/playwright.config.ts";

async function loadHelper() {
  return import(pathToFileURL(resolve(process.cwd(), HELPER_PATH)).href);
}

test("Windows lifecycle creates per-run explicit ownership metadata", async () => {
  const helper = await loadHelper();
  const lifecycle = helper.createWindowsWebServerLifecycle("win32");

  assert.ok(lifecycle.ownerFile.includes("vetneb-playwright-webservers-"));
  assert.equal(lifecycle.env.VETNEB_E2E_WEBSERVER_OWNER_FILE, lifecycle.ownerFile);
  assert.equal(lifecycle.env.VETNEB_E2E_WEBSERVER_OWNER_TOKEN, lifecycle.ownerToken);
  assert.equal(helper.createWindowsWebServerLifecycle("linux"), null);
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
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
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
    /createWindowsWebServerLifecycle\(\)/,
    "the launcher metadata must be created only by the platform-aware helper",
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
