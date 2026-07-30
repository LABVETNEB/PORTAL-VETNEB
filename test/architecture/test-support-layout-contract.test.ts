import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { listSourceFiles } from "../helpers/tracked-source-files.ts";

const REPO_ROOT = resolve(import.meta.dirname, "../..");
const TEST_ROOT = resolve(REPO_ROOT, "test");
const LEGACY_PATHS = [
  ["test/helpers", "public-professionals-fixtures.ts"].join("/"),
  ["test/unit/application/report-access", "fixtures.ts"].join("/"),
] as const;
const CANONICAL_PATHS = [
  "test/fixtures/report-access.ts",
  "test/factories/report-access.ts",
  "test/factories/public-professionals.ts",
  "test/mocks/public-professionals-route.ts",
] as const;

function read(relativePath: string): string {
  return readFileSync(resolve(REPO_ROOT, relativePath), "utf8");
}

test("layout canónico de soporte está presente y las rutas legacy ausentes", () => {
  for (const path of CANONICAL_PATHS) {
    assert.equal(existsSync(resolve(REPO_ROOT, path)), true, path);
  }

  for (const path of LEGACY_PATHS) {
    assert.equal(existsSync(resolve(REPO_ROOT, path)), false, path);
  }
});

test("ningún soporte compartido ni test ejecutable vive en test raíz", () => {
  const rootTests = listSourceFiles(TEST_ROOT, { extensions: [".test.ts"] })
    .filter((path) => !path.includes("/"));
  const sharedSupportTests = [
    "fixtures",
    "factories",
    "mocks",
    "helpers",
  ].flatMap((directory) =>
    listSourceFiles(resolve(TEST_ROOT, directory), {
      extensions: [".test.ts"],
    }),
  );

  assert.deepEqual(rootTests, []);
  assert.deepEqual(sharedSupportTests, []);
});

test("imports legacy y walkers ad hoc migrados no reaparecen", () => {
  const legacyMarkers = [
    ["helpers", "public-professionals-fixtures"].join("/"),
    ["report-access", "fixtures.ts"].join("/"),
  ];
  const importOffenders: string[] = [];

  for (const file of listSourceFiles(TEST_ROOT, { extensions: [".ts"] })) {
    const source = read(`test/${file}`);
    if (legacyMarkers.some((marker) => source.includes(marker))) {
      importOffenders.push(`test/${file}`);
    }
  }

  assert.deepEqual(importOffenders, []);

  for (const migratedCensus of [
    "test/unit/infrastructure/login-rate-limit-ux-safety.test.ts",
    "test/unit/ui/frontend/frontend-visual-consistency.test.ts",
  ]) {
    assert.equal(
      read(migratedCensus).includes("readdirSync"),
      false,
      `${migratedCensus} debe usar listSourceFiles`,
    );
  }
});
