import test from "node:test";
import assert from "node:assert/strict";
import { join, relative, resolve } from "node:path";
import { readSourceFile as read, listSourceFiles } from "../../../helpers/tracked-source-files.ts";

const appRoot = resolve(process.cwd(), "frontend/src/app");
const apiClientPath = "frontend/src/lib/api.ts";

function listFiles(directory: string): string[] {
  return listSourceFiles(directory, { extensions: [".tsx"] }).map((file) =>
    join(directory, file),
  );
}

test("frontend app pages do not import mock data directly", () => {
  const offenders = listFiles(appRoot).flatMap((filePath) => {
    const source = read(relative(process.cwd(), filePath));
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

test("frontend API client does not use mock-data fallbacks", () => {
  const source = read(apiClientPath);

  assert.ok(
    !source.includes('from "@/lib/mock-data"'),
    `${apiClientPath} must not import mock-data fallback datasets`,
  );

  assert.ok(
    !source.includes("MOCK_"),
    `${apiClientPath} must not reference mock datasets`,
  );

  assert.ok(
    !source.includes("getFallbackDashboardStats"),
    `${apiClientPath} must not reintroduce unused dashboard stats fallback`,
  );

  assert.ok(
    !source.includes("MOCK_DASHBOARD_STATS"),
    `${apiClientPath} must not import unused dashboard stats mock`,
  );
});



