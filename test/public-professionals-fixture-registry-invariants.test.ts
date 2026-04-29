import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
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

type FixtureGuardrailRegistryEntry = {
  path: string;
  slug: string;
  intent: string;
  protects: readonly string[];
};

const FIXTURE_GUARDRAIL_REGISTRY: readonly FixtureGuardrailRegistryEntry[] = [
  {
    path: "test/public-professionals-fixture-adoption-invariants.test.ts",
    slug: "adoption",
    intent:
      "Verifica que tests recientes adopten el helper compartido y no reintroduzcan stubs locales.",
    protects: ["shared-helper", "no-local-stubs", "recent-tests"],
  },
  {
    path: "test/public-professionals-fixture-assertions-quality-invariants.test.ts",
    slug: "assertions-quality",
    intent:
      "Verifica que los guardrails de fixtures mantengan assertions fuertes y no usen snapshots frágiles.",
    protects: ["assertions", "deep-equal", "clone-identity"],
  },
  {
    path: "test/public-professionals-fixture-file-scope-invariants.test.ts",
    slug: "file-scope",
    intent:
      "Verifica que fixtures y factories públicos se mantengan en el helper canónico y tests permitidos.",
    protects: ["file-scope", "canonical-helper", "no-duplicate-factories"],
  },
  {
    path: "test/public-professionals-fixture-helper-boundaries-invariants.test.ts",
    slug: "helper-boundaries",
    intent:
      "Verifica que el helper de fixtures conserve API mínima y no dependa de runtime, DB, storage ni env real.",
    protects: ["helper-api", "runtime-boundary", "no-real-dependencies"],
  },
  {
    path: "test/public-professionals-fixture-isolation-invariants.test.ts",
    slug: "isolation",
    intent:
      "Verifica que rows, overrides, search y detail devuelvan clones independientes sin contaminación entre llamadas.",
    protects: ["object-isolation", "date-clones", "no-cross-call-mutation"],
  },
  {
    path: "test/public-professionals-fixture-naming-consistency-invariants.test.ts",
    slug: "naming-consistency",
    intent:
      "Verifica naming canónico, intención visible y dominio explícito de guardrails de fixtures.",
    protects: ["file-naming", "test-names", "intent-terms"],
  },
  {
    path: "test/public-professionals-fixture-registry-invariants.test.ts",
    slug: "registry",
    intent:
      "Verifica que cada guardrail de fixtures públicos esté declarado en un registro explícito con intención mínima.",
    protects: ["registry", "documentation", "coverage-map"],
  },
  {
    path: "test/public-professionals-fixtures-invariants.test.ts",
    slug: "base-fixtures",
    intent:
      "Verifica defaults, overrides y stubs determinísticos del helper compartido de fixtures públicos.",
    protects: ["defaults", "overrides", "route-stubs"],
  },
];

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

function uniqueValues(values: readonly string[]): string[] {
  return [...new Set(values)];
}

test("fixture registry declara todos los guardrails públicos de profesionales", () => {
  const registeredFiles = FIXTURE_GUARDRAIL_REGISTRY.map((entry) => entry.path);
  const actualFiles = listFixtureGuardrailFiles();

  assert.deepEqual(
    registeredFiles,
    [...registeredFiles].sort(),
    "el registry debe mantenerse ordenado por path para revisiones simples",
  );

  assert.deepEqual(
    registeredFiles,
    uniqueValues(registeredFiles),
    "el registry no debe declarar archivos duplicados",
  );

  assert.deepEqual(
    registeredFiles,
    actualFiles,
    "todo guardrail public-professionals-fixture(s)-*.test.ts debe figurar en el registry",
  );
});

test("fixture registry documenta intención y protección mínima por guardrail", () => {
  for (const entry of FIXTURE_GUARDRAIL_REGISTRY) {
    assert.match(
      entry.path,
      /^test\/public-professionals-fixtures?(?:-[a-z0-9]+(?:-[a-z0-9]+)*)?-invariants\.test\.ts$/,
      `${entry.path} debe conservar path canónico de guardrail`,
    );

    assert.match(
      entry.slug,
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      `${entry.path} debe declarar slug kebab-case`,
    );

    assert.ok(
      entry.intent.length >= 80,
      `${entry.path} debe documentar intención verificable mínima`,
    );

    assert.ok(
      entry.intent.includes("Verifica"),
      `${entry.path} debe expresar una intención verificable`,
    );

    assert.ok(
      entry.protects.length >= 3,
      `${entry.path} debe declarar al menos 3 dimensiones protegidas`,
    );

    assert.deepEqual(
      entry.protects,
      uniqueValues(entry.protects),
      `${entry.path} no debe duplicar dimensiones protegidas`,
    );

    for (const protectedDimension of entry.protects) {
      assert.match(
        protectedDimension,
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        `${entry.path} protege dimensión no normalizada: ${protectedDimension}`,
      );
    }
  }
});

test("fixture registry apunta sólo a archivos existentes con node:test y assert strict", () => {
  for (const entry of FIXTURE_GUARDRAIL_REGISTRY) {
    assert.equal(
      existsSync(resolve(REPO_ROOT, entry.path)),
      true,
      `${entry.path} debe existir`,
    );

    const source = readSource(entry.path);

    assert.ok(
      source.includes('import test from "node:test";'),
      `${entry.path} debe usar node:test`,
    );

    assert.ok(
      source.includes('import assert from "node:assert/strict";'),
      `${entry.path} debe usar assert strict`,
    );
  }
});

test("fixture registry cubre las categorías conocidas del bloque de fixtures", () => {
  const registeredSlugs = FIXTURE_GUARDRAIL_REGISTRY.map(
    (entry) => entry.slug,
  );

  assert.deepEqual(registeredSlugs, [
    "adoption",
    "assertions-quality",
    "file-scope",
    "helper-boundaries",
    "isolation",
    "naming-consistency",
    "registry",
    "base-fixtures",
  ]);

  const protectedDimensions = new Set(
    FIXTURE_GUARDRAIL_REGISTRY.flatMap((entry) => entry.protects),
  );

  for (const requiredDimension of [
    "shared-helper",
    "assertions",
    "file-scope",
    "helper-api",
    "object-isolation",
    "file-naming",
    "registry",
    "defaults",
  ]) {
    assert.equal(
      protectedDimensions.has(requiredDimension),
      true,
      `registry debe cubrir dimensión requerida: ${requiredDimension}`,
    );
  }
});

test("fixture registry no usa nombres ambiguos ni temporales", () => {
  const forbiddenFragments = [
    "misc",
    "temp",
    "tmp",
    "new",
    "copy",
    "backup",
    "old",
    "wip",
    "draft",

    "stuff",
  ];

  for (const entry of FIXTURE_GUARDRAIL_REGISTRY) {
    const searchableText = [
      entry.path,
      entry.slug,
      entry.intent,
      ...entry.protects,
    ]
      .join(" ")
      .toLowerCase();

    for (const fragment of forbiddenFragments) {
      assert.equal(
        new RegExp(`\\b${fragment}\\b`).test(searchableText),
        false,
        `${entry.path} no debe usar término ambiguo o temporal: ${fragment}`,
      );
    }
  }
});

test("fixture registry permanece local a tests y no se exporta", () => {
  const source = readSource(
    "test/public-professionals-fixture-registry-invariants.test.ts",
  );

  assert.equal(
    /^\s*export\s+/m.test(source),
    false,
    "el registry de guardrails debe permanecer local al test",
  );

  assert.equal(
    /\bprocess\s*\.\s*env\b/.test(source),
    false,
    "el registry de guardrails no debe depender de env real",
  );

  assert.equal(
    /^\s*fetch\s*\(/m.test(source),
    false,
    "el registry de guardrails no debe depender de red",
  );
});
