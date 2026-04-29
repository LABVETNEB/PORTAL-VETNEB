import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

const REPO_ROOT = process.cwd();
const CANONICAL_FIXTURE_HELPER_PATH =
  "test/helpers/public-professionals-fixtures.ts";

const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".next",
  ".turbo",
  "coverage",
  "dist",
  "node_modules",
]);

function toRepoPath(path: string): string {
  return path.split(sep).join("/");
}

function readSource(relativePath: string): string {
  return readFileSync(resolve(REPO_ROOT, relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

function listSourceFiles(directory: string): string[] {
  const absoluteDirectory = resolve(REPO_ROOT, directory);
  const entries = readdirSync(absoluteDirectory);
  const files: string[] = [];

  for (const entry of entries) {
    if (IGNORED_DIRECTORIES.has(entry)) {
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
      files.push(toRepoPath(relative(REPO_ROOT, absolutePath)));
    }
  }

  return files.sort();
}

function isTopLevelPublicProfessionalsTest(file: string): boolean {
  return (
    file.startsWith("test/public-professionals-") &&
    file.endsWith(".test.ts") &&
    !file.slice("test/".length).includes("/")
  );
}

function referencesPublicProfessionalsFixtureHelper(source: string): boolean {
  return (
    source.includes("public-professionals-fixtures") ||
    source.includes("PublicProfessionalFixtureRow") ||
    source.includes("PublicProfessionalsRouteFixtureStubs") ||
    source.includes("buildPublicProfessionalFixtureRow") ||
    source.includes("buildPublicProfessionalsRouteFixtureStubs")
  );
}

function definesFactory(source: string, factoryName: string): boolean {
  const escapedName = factoryName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  return new RegExp(
    [
      `^\\s*(?:export\\s+)?(?:async\\s+)?function\\s+${escapedName}\\b`,
      `^\\s*(?:export\\s+)?(?:const|let|var)\\s+${escapedName}\\b`,
      `^\\s*(?:export\\s+)?${escapedName}\\s*=`,
    ].join("|"),
    "m",
  ).test(source);
}

function helperImports(source: string): string[] {
  return [
    ...source.matchAll(
      /from\s+["']([^"']*public-professionals-fixtures(?:\.ts)?)["']/g,
    ),
  ].map((match) => match[1]);
}

test("fixtures públicos de profesionales sólo se referencian desde helper canónico o tests public-professionals", () => {
  const offenders: string[] = [];

  for (const file of listSourceFiles(".")) {
    if (file === CANONICAL_FIXTURE_HELPER_PATH) {
      continue;
    }

    const source = readSource(file);

    if (
      referencesPublicProfessionalsFixtureHelper(source) &&
      !isTopLevelPublicProfessionalsTest(file)
    ) {
      offenders.push(file);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    "fixtures públicos de profesionales deben quedar limitados a test/helpers y test/public-professionals-*.test.ts",
  );
});

test("no existen helpers alternativos de fixtures públicos de profesionales", () => {
  const helperFiles = listSourceFiles("test/helpers");
  const publicProfessionalHelperFiles = helperFiles.filter(
    (file) =>
      file.includes("public-professional") ||
      file.includes("public-professionals") ||
      file.includes("professional-fixture") ||
      file.includes("professionals-fixture"),
  );

  assert.deepEqual(publicProfessionalHelperFiles, [
    CANONICAL_FIXTURE_HELPER_PATH,
  ]);
});

test("no se reintroducen factories locales con nombres canónicos fuera del helper", () => {
  const canonicalFactoryNames = [
    "buildPublicProfessionalFixtureRow",
    "buildPublicProfessionalsRouteFixtureStubs",
    "clonePublicProfessionalFixtureRow",
  ];
  const offenders: string[] = [];

  for (const file of listSourceFiles(".")) {
    if (file === CANONICAL_FIXTURE_HELPER_PATH) {
      continue;
    }

    const source = readSource(file);

    for (const factoryName of canonicalFactoryNames) {
      if (definesFactory(source, factoryName)) {
        offenders.push(`${file}: ${factoryName}`);
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    "las factories canónicas deben definirse únicamente en el helper compartido",
  );
});

test("imports del helper de fixtures públicos usan path relativo canónico", () => {
  const offenders: string[] = [];

  for (const file of listSourceFiles(".")) {
    if (file === CANONICAL_FIXTURE_HELPER_PATH) {
      continue;
    }

    const source = readSource(file);
    const imports = helperImports(source);

    for (const importPath of imports) {
      if (!isTopLevelPublicProfessionalsTest(file)) {
        offenders.push(`${file}: import fuera de scope`);
        continue;
      }

      if (importPath !== "./helpers/public-professionals-fixtures.ts") {
        offenders.push(`${file}: ${importPath}`);
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    "los tests top-level deben importar fixtures públicos con ./helpers/public-professionals-fixtures.ts",
  );
});

test("guardrails de fixtures públicos de profesionales permanecen agrupados por file scope", () => {
  const fixtureGuardrailFiles = listSourceFiles("test").filter(
    (file) =>
      file.startsWith("test/public-professionals-") &&
      file.includes("fixture") &&
      file.endsWith(".test.ts"),
  );

  assert.ok(
    fixtureGuardrailFiles.length >= 5,
    "deben existir guardrails explícitos para fixtures públicos",
  );

  for (const file of fixtureGuardrailFiles) {
    assert.match(
      file,
      /^test\/public-professionals-fixtures?-[a-z0-9-]+\.test\.ts$/,
      `${file} debe mantener naming public-professionals-fixture(s)-*.test.ts`,
    );
  }

  assert.ok(
    fixtureGuardrailFiles.includes(
      "test/public-professionals-fixtures-invariants.test.ts",
    ),
    "debe mantenerse el test base de invariantes de fixtures",
  );

  assert.ok(
    fixtureGuardrailFiles.includes(
      "test/public-professionals-fixture-adoption-invariants.test.ts",
    ),
    "debe mantenerse el test de adopción de fixtures compartidos",
  );

  assert.ok(
    fixtureGuardrailFiles.includes(
      "test/public-professionals-fixture-isolation-invariants.test.ts",
    ),
    "debe mantenerse el test de aislamiento de fixtures",
  );

  assert.ok(
    fixtureGuardrailFiles.includes(
      "test/public-professionals-fixture-helper-boundaries-invariants.test.ts",
    ),
    "debe mantenerse el test de boundaries del helper",
  );
});
