#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  registerOwnedWebServer,
  unregisterOwnedWebServer,
} from "./windows-webserver-lifecycle.mjs";

const FRONTEND_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);
const [kind] = process.argv.slice(2);
const ownerFile = process.env.VETNEB_E2E_WEBSERVER_OWNER_FILE;
const ownerToken = process.env.VETNEB_E2E_WEBSERVER_OWNER_TOKEN;

if (process.platform !== "win32") {
  throw new Error("The webServer launcher is Windows-only.");
}

if (!ownerFile || !ownerToken) {
  throw new Error("Missing Playwright webServer ownership metadata.");
}

function commandFor(serverKind) {
  if (serverKind === "fixture") {
    return {
      executable: process.execPath,
      args: ["e2e/fixtures/admin-populated-api-server.mjs"],
    };
  }

  if (serverKind === "application") {
    const nextBin = require.resolve("next/dist/bin/next");
    // Mirrors isProductionRunner in playwright.config.ts: the flag alone never selects next start.
    const isProductionRunner =
      process.env.CI === "true" && process.env.VETNEB_E2E_PRODUCTION_RUNNER === "1";
    const nextCommand = isProductionRunner ? "start" : "dev";
    return {
      executable: process.execPath,
      args: [nextBin, nextCommand, "--hostname", "127.0.0.1"],
    };
  }

  throw new Error(`Unknown webServer kind: ${serverKind}`);
}

const command = commandFor(kind);
const child = spawn(command.executable, command.args, {
  cwd: FRONTEND_ROOT,
  env: process.env,
  shell: false,
  stdio: "inherit",
  windowsHide: true,
});

registerOwnedWebServer({ ownerFile, ownerToken, pid: child.pid, kind });

child.once("error", (error) => {
  unregisterOwnedWebServer({ ownerFile, ownerToken, pid: child.pid });
  throw error;
});

child.once("exit", (code, signal) => {
  unregisterOwnedWebServer({ ownerFile, ownerToken, pid: child.pid });
  process.exitCode = signal ? 1 : (code ?? 1);
});
