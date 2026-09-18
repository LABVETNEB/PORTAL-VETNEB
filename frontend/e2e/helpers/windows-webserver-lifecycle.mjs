import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const OWNER_FILE_PREFIX = "vetneb-playwright-webservers-";

export function createWindowsWebServerLifecycle(platform = process.platform) {
  if (platform !== "win32") return null;

  const ownerToken = randomUUID();
  const ownerFile = join(tmpdir(), `${OWNER_FILE_PREFIX}${ownerToken}.json`);

  return {
    ownerFile,
    ownerToken,
    env: {
      VETNEB_E2E_WEBSERVER_OWNER_FILE: ownerFile,
      VETNEB_E2E_WEBSERVER_OWNER_TOKEN: ownerToken,
    },
  };
}

function readOwnership(ownerFile) {
  if (!existsSync(ownerFile)) return null;
  return JSON.parse(readFileSync(ownerFile, "utf8"));
}

function writeOwnership(ownerFile, ownership) {
  writeFileSync(ownerFile, `${JSON.stringify(ownership)}\n`, "utf8");
}

function isOwnedProcess(process) {
  return (
    typeof process?.pid === "number" &&
    Number.isInteger(process.pid) &&
    process.pid > 0 &&
    (process.kind === "fixture" || process.kind === "application")
  );
}

export function registerOwnedWebServer({ ownerFile, ownerToken, pid, kind }) {
  const existing = readOwnership(ownerFile);
  if (existing && existing.ownerToken !== ownerToken) {
    throw new Error("Refusing to replace a webServer ownership record from another run.");
  }

  const processes = (existing?.processes ?? []).filter(
    (process) => isOwnedProcess(process) && process.pid !== pid,
  );
  processes.push({ pid, kind });
  writeOwnership(ownerFile, { ownerToken, processes });
}

export function unregisterOwnedWebServer({ ownerFile, ownerToken, pid }) {
  const existing = readOwnership(ownerFile);
  if (!existing || existing.ownerToken !== ownerToken) return;

  const processes = (existing.processes ?? []).filter(
    (process) => isOwnedProcess(process) && process.pid !== pid,
  );
  if (processes.length === 0) {
    rmSync(ownerFile, { force: true });
    return;
  }
  writeOwnership(ownerFile, { ownerToken, processes });
}

export function ownedWebServerProcesses({ ownerFile, ownerToken }) {
  const ownership = readOwnership(ownerFile);
  if (!ownership || ownership.ownerToken !== ownerToken) return [];
  return (ownership.processes ?? []).filter(isOwnedProcess);
}

export function killWindowsProcessTree(pid, execFile = execFileSync) {
  execFile("taskkill", ["/PID", String(pid), "/T", "/F"], {
    stdio: "ignore",
    windowsHide: true,
  });
}

export function cleanupOwnedWindowsWebServers({
  platform = process.platform,
  ownerFile,
  ownerToken,
  killProcessTree = killWindowsProcessTree,
  removeOwnershipFile = (path) => rmSync(path, { force: true }),
}) {
  if (platform !== "win32" || !ownerFile || !ownerToken) return [];

  const ownedProcesses = ownedWebServerProcesses({ ownerFile, ownerToken });
  try {
    for (const process of ownedProcesses) {
      killProcessTree(process.pid);
    }
  } finally {
    removeOwnershipFile(ownerFile);
  }
  return ownedProcesses;
}
