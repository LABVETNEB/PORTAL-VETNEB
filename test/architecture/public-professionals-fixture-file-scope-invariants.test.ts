import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { listTrackedSourceFiles } from "../helpers/tracked-source-files.ts";

const REPO_ROOT = process.cwd();
const CANONICAL_FIXTURE_HELPER_PATH =
  "test/helpers/public-professionals-fixtures.ts";

function readSource(relativePath: string): string {
  return readFileSync(resolve(REPO_ROOT, relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

// Tracked-file inventory (E2E-STAB-006): the scan covers exactly the files
// git tracks, so auxiliary trees (.claude/worktrees/**, playwright-report/,
// test-results/) can never inject false offenders and no exclusion list can
// hide a tracked file.
const listSourceFiles = listTrackedSourceFiles;

function isAllowedPublicProfessionalsFixtureConsumerTest(file: string): boolean {
  const isLegacyTopLevelPublicProfessionalsTest =
    file.startsWith("test/architecture/public-professionals-") &&
    file.endsWith(".test.ts") &&
    !file.slice("test/architecture/".length).includes("/");

  const isControllerPublicProfessionalsInvariant =
    file.startsWith("test/integration/adapters/controllers/public-professionals-") &&
    file.endsWith(".test.ts") &&
    !file
      .slice("test/integration/adapters/controllers/".length)
      .includes("/");

  return (
    isLegacyTopLevelPublicProfessionalsTest ||
    isControllerPublicProfessionalsInvariant
  );
}

function expectedPublicProfessionalsFixtureImport(file: string): string | null {
  if (
    file.startsWith("test/architecture/public-professionals-") &&
    file.endsWith(".test.ts") &&
    !file.slice("test/architecture/".length).includes("/")
  ) {
    return "../helpers/public-professionals-fixtures.ts";
  }

  if (
    file.startsWith("test/integration/adapters/controllers/public-professionals-") &&
    file.endsWith(".test.ts") &&
    !file
      .slice("test/integration/adapters/controllers/".length)
      .includes("/")
  ) {
    return "../../../helpers/public-professionals-fixtures.ts";
  }

  return null;
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
      !isAllowedPublicProfessionalsFixtureConsumerTest(file)
    ) {
      offenders.push(file);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    "fixtures públicos de profesionales deben quedar limitados a test/helpers, test/architecture/public-professionals-*.test.ts y test/integration/adapters/controllers/public-professionals-*.test.ts",
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
    const expectedImportPath = expectedPublicProfessionalsFixtureImport(file);

    for (const importPath of imports) {
      if (expectedImportPath === null) {
        offenders.push(`${file}: import fuera de scope`);
        continue;
      }

      if (importPath !== expectedImportPath) {
        offenders.push(`${file}: ${importPath}`);
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    "los tests deben importar fixtures públicos con el path relativo canónico según su ubicación",
  );
});

test("guardrails de fixtures públicos de profesionales permanecen agrupados por file scope", () => {
  const fixtureGuardrailFiles = listSourceFiles("test").filter(
    (file) =>
      file.startsWith("test/architecture/public-professionals-") &&
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
      /^test\/architecture\/public-professionals-fixtures?-[a-z0-9-]+\.test\.ts$/,
      `${file} debe mantener naming test/architecture/public-professionals-fixture(s)-*.test.ts`,
    );
  }

  assert.ok(
    fixtureGuardrailFiles.includes(
      "test/architecture/public-professionals-fixtures-invariants.test.ts",
    ),
    "debe mantenerse el test base de invariantes de fixtures",
  );

  assert.ok(
    fixtureGuardrailFiles.includes(
      "test/architecture/public-professionals-fixture-adoption-invariants.test.ts",
    ),
    "debe mantenerse el test de adopción de fixtures compartidos",
  );

  assert.ok(
    fixtureGuardrailFiles.includes(
      "test/architecture/public-professionals-fixture-isolation-invariants.test.ts",
    ),
    "debe mantenerse el test de aislamiento de fixtures",
  );

  assert.ok(
    fixtureGuardrailFiles.includes(
      "test/architecture/public-professionals-fixture-helper-boundaries-invariants.test.ts",
    ),
    "debe mantenerse el test de boundaries del helper",
  );
});
