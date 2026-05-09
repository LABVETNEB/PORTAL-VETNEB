import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const appRoot = resolve(process.cwd(), "frontend/src/app");
const apiClientPath = "frontend/src/lib/api.ts";

function listFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      return listFiles(fullPath);
    }

    return entry.isFile() && fullPath.endsWith(".tsx") ? [fullPath] : [];
  });
}

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

test("frontend app pages do not import mock data directly", () => {
  const offenders = listFiles(appRoot).flatMap((filePath) => {
    const source = readFileSync(filePath, "utf8");
    const relativePath = relative(process.cwd(), filePath).replace(/\\/g, "/");

    return [
      '@/lib/mock-data',
      'MOCK_',
      'Mock data',
      'Modo demo',
    ]
      .filter((pattern) => source.includes(pattern))
      .map((pattern) => `${relativePath}: ${pattern}`);
  });

  assert.deepEqual(offenders, []);
});

test("frontend API client keeps remaining mock fallbacks centralized", () => {
  const source = read(apiClientPath);

  assert.ok(
    source.includes('from "@/lib/mock-data"'),
    `${apiClientPath} should own centralized mock-data fallback imports`,
  );

  for (const expected of [
    "MOCK_REPORTS",
    "MOCK_AUDIT_ENTRIES",
  ]) {
    assert.ok(source.includes(expected), `${apiClientPath} missing ${expected}`);
  }

  assert.ok(
    !source.includes("getFallbackDashboardStats"),
    `${apiClientPath} must not reintroduce unused dashboard stats fallback`,
  );

  assert.ok(
    !source.includes("MOCK_DASHBOARD_STATS"),
    `${apiClientPath} must not import unused dashboard stats mock`,
  );
});

