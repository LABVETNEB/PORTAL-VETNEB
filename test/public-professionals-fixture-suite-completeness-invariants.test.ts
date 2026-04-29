import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = process.cwd();

type SuiteGuardrail = {
  slug: string;
  path: string;
  category: string;
  mustReference: readonly string[];
};

const SUITE_GUARDRAILS: readonly SuiteGuardrail[] = [
  {
    slug: "adoption",
    path: "test/public-professionals-fixture-adoption-invariants.test.ts",
    category: "adoption",
    mustReference: [
      "fixtures compartidos",
      "stubs locales",
      "public-professionals-fixtures",
    ],
  },
  {
    slug: "assertions-quality",
    path: "test/public-professionals-fixture-assertions-quality-invariants.test.ts",
    category: "assertion-quality",
    mustReference: ["assert.deepEqual", "assert.notEqual", "node:assert/strict"],
  },
  {
    slug: "file-scope",
    path: "test/public-professionals-fixture-file-scope-invariants.test.ts",
    category: "scope",
    mustReference: [
      "CANONICAL_FIXTURE_HELPER_PATH",
      "buildPublicProfessionalFixtureRow",
      "buildPublicProfessionalsRouteFixtureStubs",
    ],
  },
  {
    slug: "helper-boundaries",
    path: "test/public-professionals-fixture-helper-boundaries-invariants.test.ts",
    category: "boundaries",
    mustReference: [
      "clonePublicProfessionalFixtureRow",
      "runtime",
      "process.env",
    ],
  },
  {
    slug: "isolation",
    path: "test/public-professionals-fixture-isolation-invariants.test.ts",
    category: "isolation",
    mustReference: ["DEFAULT_UPDATED_AT", "assert.notEqual", "assert.deepEqual"],
  },
  {
    slug: "naming-consistency",
    path: "test/public-professionals-fixture-naming-consistency-invariants.test.ts",
    category: "naming",
    mustReference: [
      "REQUIRED_FIXTURE_GUARDRAILS",
      "REQUIRED_INTENT_TERMS",
      "naming consistency",
    ],
  },
  {
    slug: "registry",
    path: "test/public-professionals-fixture-registry-invariants.test.ts",
    category: "registry",
    mustReference: [
      "FIXTURE_GUARDRAIL_REGISTRY",
      "coverage-map",
      "suite-completeness",
    ],
  },
  {
    slug: "suite-completeness",
    path: "test/public-professionals-fixture-suite-completeness-invariants.test.ts",
    category: "suite-completeness",
    mustReference: [
      "SUITE_GUARDRAILS",
      "category-coverage",
      "cross-guardrails",
    ],
  },
  {
    slug: "base-fixtures",
    path: "test/public-professionals-fixtures-invariants.test.ts",
    category: "base-fixtures",
    mustReference: [
      "buildPublicProfessionalFixtureRow",
      "buildPublicProfessionalsRouteFixtureStubs",
      "assert.deepEqual",
    ],
  },
];

function readSource(relativePath: string): string {
  return readFileSync(resolve(REPO_ROOT, relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function extractRegistrySlugs(source: string): string[] {
  return [...source.matchAll(/slug:\s*"([^"]+)"/g)].map((match) => match[1]);
}

function extractRegistryPaths(source: string): string[] {
  return [...source.matchAll(/path:\s*"([^"]+)"/g)].map((match) => match[1]);
}

function uniqueValues(values: readonly string[]): string[] {
  return [...new Set(values)];
}

test("fixture suite completeness conserva inventario esperado de guardrails", () => {
  const slugs = SUITE_GUARDRAILS.map((guardrail) => guardrail.slug);
  const paths = SUITE_GUARDRAILS.map((guardrail) => guardrail.path);
  const categories = SUITE_GUARDRAILS.map((guardrail) => guardrail.category);

  assert.deepEqual(slugs, [
    "adoption",
    "assertions-quality",
    "file-scope",
    "helper-boundaries",
    "isolation",
    "naming-consistency",
    "registry",
    "suite-completeness",
    "base-fixtures",
  ]);

  assert.deepEqual(slugs, uniqueValues(slugs));
  assert.deepEqual(paths, uniqueValues(paths));
  assert.deepEqual(categories, uniqueValues(categories));

  for (const guardrail of SUITE_GUARDRAILS) {
    assert.match(guardrail.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.match(guardrail.category, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.equal(existsSync(resolve(REPO_ROOT, guardrail.path)), true);
  }
});

test("fixture suite completeness coincide con el registry explícito", () => {
  const registrySource = readSource(
    "test/public-professionals-fixture-registry-invariants.test.ts",
  );

  const suiteSlugs = SUITE_GUARDRAILS.map((guardrail) => guardrail.slug);
  const registrySlugs = extractRegistrySlugs(registrySource);

  const suitePaths = SUITE_GUARDRAILS.map((guardrail) => guardrail.path);
  const registryPaths = extractRegistryPaths(registrySource);

  assert.deepEqual(registrySlugs, suiteSlugs);
  assert.deepEqual(registryPaths, suitePaths);
});

test("fixture suite completeness cubre todas las dimensiones del sub-bloque", () => {
  const requiredCategories = [
    "adoption",
    "assertion-quality",
    "scope",
    "boundaries",
    "isolation",
    "naming",
    "registry",
    "suite-completeness",
    "base-fixtures",
  ];

  const actualCategories = SUITE_GUARDRAILS.map(
    (guardrail) => guardrail.category,
  );

  assert.deepEqual(actualCategories, requiredCategories);

  const categoryCoverage = new Set(actualCategories);

  for (const requiredCategory of requiredCategories) {
    assert.equal(
      categoryCoverage.has(requiredCategory),
      true,
      `fixture suite debe cubrir categoría: ${requiredCategory}`,
    );
  }
});

test("fixture suite completeness verifica referencias internas mínimas por guardrail", () => {
  for (const guardrail of SUITE_GUARDRAILS) {
    const source = readSource(guardrail.path);
    const normalizedSource = normalizeText(source);

    for (const expectedReference of guardrail.mustReference) {
      assert.ok(
        normalizedSource.includes(normalizeText(expectedReference)),
        `${guardrail.path} debe conservar referencia mínima: ${expectedReference}`,
      );
    }
  }
});

test("fixture suite completeness evita ciclos frágiles fuera del par registry-suite", () => {
  const suiteSource = readSource(
    "test/public-professionals-fixture-suite-completeness-invariants.test.ts",
  );
  const registrySource = readSource(
    "test/public-professionals-fixture-registry-invariants.test.ts",
  );

  assert.ok(
    suiteSource.includes(
      "test/public-professionals-fixture-registry-invariants.test.ts",
    ),
    "suite completeness debe referenciar registry",
  );

  assert.ok(
    registrySource.includes(
      "test/public-professionals-fixture-suite-completeness-invariants.test.ts",
    ),
    "registry debe declarar suite completeness",
  );

  for (const guardrail of SUITE_GUARDRAILS) {
    if (guardrail.slug === "registry" || guardrail.slug === "suite-completeness") {
      continue;
    }

    const source = readSource(guardrail.path);

    assert.equal(
      source.includes("public-professionals-fixture-suite-completeness"),
      false,
      `${guardrail.path} no debe depender del guardrail de cierre`,
    );

    assert.equal(
      source.includes("SUITE_GUARDRAILS"),
      false,
      `${guardrail.path} no debe depender del inventario de suite completeness`,
    );
  }
});

test("fixture suite completeness permanece local a tests y sin dependencias reales", () => {
  const source = readSource(
    "test/public-professionals-fixture-suite-completeness-invariants.test.ts",
  );
  const lines = source.split("\n");
  const importLines = lines.filter((line) => line.startsWith("import "));
  const exportLines = lines.filter((line) =>
    line.trimStart().startsWith("export "),
  );

  assert.deepEqual(importLines, [
    'import test from "node:test";',
    'import assert from "node:assert/strict";',
    'import { existsSync, readFileSync } from "node:fs";',
    'import { resolve } from "node:path";',
  ]);

  assert.deepEqual(exportLines, []);

  const forbiddenImportFragments = [
    "node:process",
    "child_process",
    "node:http",
    "node:https",
    "undici",
    "@supabase/supabase-js",
    "postgres",
    "drizzle-orm",
  ];

  for (const importLine of importLines) {
    for (const forbiddenImportFragment of forbiddenImportFragments) {
      assert.equal(
        importLine.includes(forbiddenImportFragment),
        false,
        `suite completeness no debe importar dependencia real: ${forbiddenImportFragment}`,
      );
    }
  }
});
