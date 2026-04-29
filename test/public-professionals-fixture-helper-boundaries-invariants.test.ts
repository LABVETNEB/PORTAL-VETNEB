import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

const REPO_ROOT = process.cwd();
const FIXTURE_HELPER_PATH = "test/helpers/public-professionals-fixtures.ts";

function readSource(relativePath: string): string {
  return readFileSync(resolve(REPO_ROOT, relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

function listSourceFiles(
  directory: string,
  excludedDirectories = new Set([
    ".git",
    "coverage",
    "dist",
    "node_modules",
    ".next",
    ".turbo",
  ]),
): string[] {
  const absoluteDirectory = resolve(REPO_ROOT, directory);
  const entries = readdirSync(absoluteDirectory);
  const files: string[] = [];

  for (const entry of entries) {
    if (excludedDirectories.has(entry)) {
      continue;
    }

    const absolutePath = join(absoluteDirectory, entry);
    const stats = statSync(absolutePath);

    if (stats.isDirectory()) {
      files.push(...listSourceFiles(relative(REPO_ROOT, absolutePath)));
      continue;
    }

    if (!stats.isFile()) {
      continue;
    }

    if (/\.(cjs|cts|js|mjs|mts|ts)$/.test(entry)) {
      files.push(relative(REPO_ROOT, absolutePath).split(sep).join("/"));
    }
  }

  return files.sort();
}

function extractValueExports(source: string): string[] {
  return [
    ...source.matchAll(
      /^export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z0-9_]+)/gm,
    ),
  ].map((match) => match[1]);
}

function extractTypeExports(source: string): string[] {
  return [
    ...source.matchAll(
      /^export\s+(?:type|interface)\s+([A-Za-z0-9_]+)/gm,
    ),
  ].map((match) => match[1]);
}

test("public professionals fixture helper mantiene API exportada mínima", () => {
  const source = readSource(FIXTURE_HELPER_PATH);

  assert.deepEqual(extractTypeExports(source), [
    "PublicProfessionalFixtureRow",
    "PublicProfessionalsRouteFixtureStubs",
  ]);

  assert.deepEqual(extractValueExports(source), [
    "buildPublicProfessionalFixtureRow",
    "buildPublicProfessionalsRouteFixtureStubs",
  ]);

  assert.equal(
    source.includes("export function clonePublicProfessionalFixtureRow"),
    false,
    "clonePublicProfessionalFixtureRow debe permanecer interno",
  );

  assert.equal(
    source.includes("export { clonePublicProfessionalFixtureRow"),
    false,
    "clonePublicProfessionalFixtureRow no debe exportarse por barrel local",
  );
});

test("runtime no importa fixtures compartidos de tests de profesionales públicos", () => {
  const sourceFiles = listSourceFiles(".");
  const runtimeFiles = sourceFiles.filter((file) => !file.startsWith("test/"));
  const offenders: string[] = [];

  for (const file of runtimeFiles) {
    const source = readSource(file);

    if (
      source.includes("test/helpers/public-professionals-fixtures") ||
      source.includes("helpers/public-professionals-fixtures") ||
      source.includes("public-professionals-fixtures.ts")
    ) {
      offenders.push(file);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    "runtime no debe depender de fixtures ubicados bajo test/helpers",
  );
});

test("fixture helper de profesionales públicos no introduce DB storage ni env reales", () => {
  const source = readSource(FIXTURE_HELPER_PATH);

  for (const forbiddenToken of [
    "process.env",
    "DATABASE_URL",
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "createClient",
    "postgres(",
    "drizzle(",
    ".storage",
    "supabase.storage",
    "readFileSync",
    "writeFileSync",
    "fetch(",
  ]) {
    assert.equal(
      source.includes(forbiddenToken),
      false,
      `fixture helper no debe usar dependencia real: ${forbiddenToken}`,
    );
  }

  assert.equal(
    /from\s+["'](?:node:fs|fs)["']/.test(source),
    false,
    "fixture helper no debe leer archivos",
  );
});

test("fixtures compartidos de profesionales públicos sólo se importan desde tests", () => {
  const sourceFiles = listSourceFiles(".");
  const offenders: string[] = [];

  for (const file of sourceFiles) {
    const source = readSource(file);
    const importsFixtureHelper =
      source.includes("public-professionals-fixtures.ts") ||
      source.includes("public-professionals-fixtures");

    if (!importsFixtureHelper) {
      continue;
    }

    if (file === FIXTURE_HELPER_PATH) {
      continue;
    }

    if (!file.startsWith("test/") || !file.endsWith(".test.ts")) {
      offenders.push(file);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    "el helper compartido debe quedar restringido a tests .test.ts",
  );
});
