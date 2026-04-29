import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

const REPO_ROOT = process.cwd();

const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".next",
  ".turbo",
  "coverage",
  "dist",
  "node_modules",
]);

const REQUIRED_FIXTURE_GUARDRAILS = [
  "test/public-professionals-fixtures-invariants.test.ts",
  "test/public-professionals-fixture-adoption-invariants.test.ts",
  "test/public-professionals-fixture-isolation-invariants.test.ts",
  "test/public-professionals-fixture-helper-boundaries-invariants.test.ts",
  "test/public-professionals-fixture-file-scope-invariants.test.ts",
  "test/public-professionals-fixture-assertions-quality-invariants.test.ts",
];

const REQUIRED_INTENT_TERMS = new Map<string, string[]>([
  [
    "test/public-professionals-fixtures-invariants.test.ts",
    ["defaults", "overrides", "stubs"],
  ],
  [
    "test/public-professionals-fixture-adoption-invariants.test.ts",
    ["fixtures compartidos", "stubs locales", "helper"],
  ],
  [
    "test/public-professionals-fixture-isolation-invariants.test.ts",
    ["independientes", "clona", "clones"],
  ],
  [
    "test/public-professionals-fixture-helper-boundaries-invariants.test.ts",
    ["helper", "runtime", "db storage"],
  ],
  [
    "test/public-professionals-fixture-file-scope-invariants.test.ts",
    ["file scope", "helper canonico", "factories locales"],
  ],
  [
    "test/public-professionals-fixture-assertions-quality-invariants.test.ts",
    ["assertions", "deepEqual", "clone quality"],
  ],
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

function listFixtureGuardrailFiles(): string[] {
  return listSourceFiles("test").filter(
    (file) =>
      file.startsWith("test/public-professionals-fixture") &&
      file.endsWith(".test.ts"),
  );
}

function extractTestNames(source: string): string[] {
  return [...source.matchAll(/\btest\s*\(\s*"([^"]+)"/g)].map(
    (match) => match[1],
  );
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

test("fixture guardrail files mantienen naming canónico y ordenado", () => {
  const fixtureGuardrailFiles = listFixtureGuardrailFiles();

  assert.deepEqual(
    fixtureGuardrailFiles,
    [...fixtureGuardrailFiles].sort(),
    "los guardrails de fixtures deben quedar ordenados alfabéticamente por path",
  );

  for (const requiredFile of REQUIRED_FIXTURE_GUARDRAILS) {
    assert.ok(
      fixtureGuardrailFiles.includes(requiredFile),
      `falta guardrail requerido: ${requiredFile}`,
    );
  }

  for (const file of fixtureGuardrailFiles) {
    assert.match(
      file,
      /^test\/public-professionals-fixtures?-[a-z0-9]+(?:-[a-z0-9]+)*\.test\.ts$/,
      `${file} debe usar naming public-professionals-fixture(s)-kebab-case.test.ts`,
    );

    assert.equal(
      file.includes("_"),
      false,
      `${file} no debe usar snake_case`,
    );

    assert.equal(
      /[A-Z]/.test(file),
      false,
      `${file} no debe usar mayúsculas`,
    );
  }
});

test("fixture guardrail files usan sufijo semántico invariants", () => {
  for (const file of listFixtureGuardrailFiles()) {
    assert.match(
      file,
      /-invariants\.test\.ts$/,
      `${file} debe terminar en -invariants.test.ts`,
    );

    assert.equal(
      file.endsWith("-test.test.ts"),
      false,
      `${file} no debe usar sufijo redundante -test.test.ts`,
    );

    assert.equal(
      file.includes("-invariant-"),
      false,
      `${file} debe usar invariants como sufijo final, no en el medio`,
    );
  }
});

test("fixture guardrail names evitan términos ambiguos o temporales", () => {
  const forbiddenNameFragments = [
    "-misc-",
    "-temp-",
    "-tmp-",
    "-new-",
    "-copy-",
    "-backup-",
    "-old-",
    "-wip-",
    "-draft-",
    "-todo-",
    "-fix-",
    "-stuff-",
  ];

  for (const file of listFixtureGuardrailFiles()) {
    for (const fragment of forbiddenNameFragments) {
      assert.equal(
        file.includes(fragment),
        false,
        `${file} no debe usar naming ambiguo o temporal: ${fragment}`,
      );
    }
  }
});

test("cada guardrail de fixtures declara intención en sus nombres de tests", () => {
  for (const [file, requiredTerms] of REQUIRED_INTENT_TERMS) {
    const source = readSource(file);
    const testNames = extractTestNames(source);
    const normalizedNames = normalizeText(testNames.join("\n"));

    assert.ok(testNames.length > 0, `${file} debe declarar tests explícitos`);

    for (const requiredTerm of requiredTerms) {
      assert.ok(
        normalizedNames.includes(normalizeText(requiredTerm)),
        `${file} debe conservar intención visible en test names: ${requiredTerm}`,
      );
    }
  }
});

test("test names de fixtures públicos mantienen dominio explícito", () => {
  const requiredDomainTerms = [
    "public professionals",
    "profesionales publicos",
    "fixtures",
    "fixture",
    "guardrail",
    "guardrails",
    "helper",
    "route surface",
    "tests recientes",
    "imports",
    "factories",
    "assertions",
    "clone quality",
    "naming consistency",
  ];

  for (const file of listFixtureGuardrailFiles()) {
    const testNames = extractTestNames(readSource(file));

    for (const testName of testNames) {
      const normalizedTestName = normalizeText(testName);

      assert.ok(
        requiredDomainTerms.some((term) =>
          normalizedTestName.includes(normalizeText(term)),
        ),
        `${file} tiene test name con dominio ambiguo: ${testName}`,
      );

      assert.equal(
        /\b(misc|temp|tmp|new|copy|backup|old|wip|draft|todo|stuff)\b/.test(
          normalizedTestName,
        ),
        false,
        `${file} tiene test name temporal o ambiguo: ${testName}`,
      );
    }
  }
});

test("naming consistency no permite nuevos guardrails fixture fuera del dominio public professionals", () => {
  const offenders: string[] = [];

  for (const file of listSourceFiles("test")) {
    if (!file.includes("fixture")) {
      continue;
    }

    if (file.startsWith("test/helpers/")) {
      continue;
    }

    if (!file.endsWith(".test.ts")) {
      continue;
    }

    if (!file.startsWith("test/public-professionals-fixture")) {
      offenders.push(file);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    "los guardrails de fixtures nuevos deben declarar dominio public-professionals-fixture(s)",
  );
});
