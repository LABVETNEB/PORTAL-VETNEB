import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { listTrackedSourceFiles } from "../helpers/tracked-source-files.ts";

const REPO_ROOT = resolve(import.meta.dirname, "../..");
const CANONICAL_SUPPORT_PATHS = [
  "test/factories/public-professionals.ts",
  "test/mocks/public-professionals-route.ts",
] as const;

function readSource(relativePath: string): string {
  return readFileSync(resolve(REPO_ROOT, relativePath), "utf8");
}

function definesSupportSymbol(source: string, symbol: string): boolean {
  const escapedSymbol = symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  return new RegExp(
    [
      `^\\s*(?:export\\s+)?(?:async\\s+)?function\\s+${escapedSymbol}\\s*\\(`,
      `^\\s*(?:export\\s+)?(?:const|let|var)\\s+${escapedSymbol}\\b[^=]*=`,
    ].join("|"),
    "m",
  ).test(source);
}

test("soporte de profesionales públicos vive en factories y mocks canónicos", () => {
  for (const path of CANONICAL_SUPPORT_PATHS) {
    assert.ok(readSource(path).length > 0, `${path} debe existir`);
  }
});

test("fixtures públicos no reintroducen definiciones canónicas fuera de sus archivos", () => {
  const definitions = [
    {
      name: "buildPublicProfessionalFixtureRow",
      owner: CANONICAL_SUPPORT_PATHS[0],
    },
    {
      name: "buildPublicProfessionalsRouteFixtureStubs",
      owner: CANONICAL_SUPPORT_PATHS[1],
    },
  ];
  const offenders: string[] = [];

  for (const file of listTrackedSourceFiles("test")) {
    const source = readSource(file);

    for (const definition of definitions) {
      if (
        file !== definition.owner &&
        definesSupportSymbol(source, definition.name)
      ) {
        offenders.push(`${file}: ${definition.name}`);
      }
    }
  }

  assert.deepEqual(offenders, []);
});

test("fixtures públicos detectan formas alternativas de factories duplicadas", () => {
  for (const source of [
    "function buildPublicProfessionalFixtureRow() {}",
    "export async function  buildPublicProfessionalFixtureRow () {}",
    "const buildPublicProfessionalFixtureRow = () => ({});",
    "export const buildPublicProfessionalFixtureRow = () => ({});",
    "let buildPublicProfessionalFixtureRow: unknown = null;",
    "var buildPublicProfessionalFixtureRow = function () {};",
  ]) {
    assert.equal(
      definesSupportSymbol(source, "buildPublicProfessionalFixtureRow"),
      true,
      source,
    );
  }

  assert.equal(
    definesSupportSymbol(
      "const buildDifferentPublicProfessionalFixtureRow = () => ({});",
      "buildPublicProfessionalFixtureRow",
    ),
    false,
  );
});

test("fixtures públicos se importan desde paths canónicos", () => {
  const offenders: string[] = [];
  const legacyStem = ["public-professionals", "fixtures"].join("-");

  for (const file of listTrackedSourceFiles("test")) {
    if (CANONICAL_SUPPORT_PATHS.includes(file as never)) {
      continue;
    }

    const source = readSource(file);
    for (const match of source.matchAll(/from\s+["']([^"']+)["']/g)) {
      const importPath = match[1];
      const referencesSharedSupport =
        importPath.includes(legacyStem) ||
        importPath.includes("factories/public-professionals") ||
        importPath.includes("mocks/public-professionals-route");

      if (!referencesSharedSupport) {
        continue;
      }

      if (
        !importPath.includes("factories/public-professionals") &&
        !importPath.includes("mocks/public-professionals-route")
      ) {
        offenders.push(`${file}: ${importPath}`);
      }
    }
  }

  assert.deepEqual(offenders, []);
});
