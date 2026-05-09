import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const API_CLIENT_PATH = "frontend/src/lib/api.ts";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("frontend API client reads admin system health from backend endpoint", () => {
  const source = read(API_CLIENT_PATH);

  assert.ok(source.includes("export async function getAdminSystemHealth("));
  assert.ok(source.includes("options?: RequestInit,"));
  assert.ok(source.includes("): Promise<SystemHealth | null>"));
  assert.ok(source.includes("return await apiFetch<SystemHealth>("));
  assert.ok(source.includes('"/api/admin/system/health",'));
  assert.ok(source.includes("options,"));
  assert.ok(source.includes('console.warn("[API] getAdminSystemHealth: endpoint no disponible");'));
  assert.ok(source.includes("return null;"));
});

test("frontend API client exposes admin maintenance purge dry run as POST", () => {
  const source = read(API_CLIENT_PATH);

  assert.ok(source.includes("export async function getAdminMaintenancePurgeDryRun("));
  assert.ok(source.includes("): Promise<MaintenancePurgeDryRunSnapshot>"));
  assert.ok(source.includes("return apiFetch<MaintenancePurgeDryRunSnapshot>("));
  assert.ok(source.includes('"/api/admin/system/maintenance/purge-dry-run",'));
  assert.ok(source.includes("...options,"));
  assert.ok(source.includes('method: "POST",'));
});

test("frontend admin system API helpers remain typed around system snapshots", () => {
  const source = read(API_CLIENT_PATH);

  assert.ok(source.includes("SystemHealth,"));
  assert.ok(source.includes("MaintenancePurgeDryRunSnapshot,"));
  assert.ok(source.includes("Promise<SystemHealth | null>"));
  assert.ok(source.includes("Promise<MaintenancePurgeDryRunSnapshot>"));
});
