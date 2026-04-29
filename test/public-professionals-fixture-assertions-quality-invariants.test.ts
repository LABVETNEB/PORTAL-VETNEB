import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const FIXTURE_ASSERTION_FILES = [
  "test/public-professionals-fixtures-invariants.test.ts",
  "test/public-professionals-fixture-isolation-invariants.test.ts",
  "test/public-professionals-fixture-helper-boundaries-invariants.test.ts",
  "test/public-professionals-fixture-file-scope-invariants.test.ts",
];

const STRUCTURAL_FIXTURE_FILES = [
  "test/public-professionals-fixtures-invariants.test.ts",
  "test/public-professionals-fixture-isolation-invariants.test.ts",
];

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

function countOccurrences(source: string, token: string): number {
  return source.split(token).length - 1;
}

function assertIncludesAll(
  source: string,
  snippets: string[],
  file: string,
): void {
  for (const snippet of snippets) {
    assert.ok(
      source.includes(snippet),
      `${file} debe conservar assertion fuerte: ${snippet}`,
    );
  }
}

test("guardrails de fixtures públicos usan assert strict y evitan frameworks o snapshots", () => {
  const forbiddenPatterns = [
    {
      label: "toMatchSnapshot",
      pattern: /\btoMatchSnapshot\s*\(/,
    },
    {
      label: "toThrowErrorMatchingSnapshot",
      pattern: /\btoThrowErrorMatchingSnapshot\s*\(/,
    },
    {
      label: "assert.snapshot",
      pattern: /\bassert\.snapshot\b/,
    },
    {
      label: "expect(",
      pattern: /\bexpect\s*\(/,
    },
    {
      label: "describe(",
      pattern: /\bdescribe\s*\(/,
    },
    {
      label: "it(",
      pattern: /(?:^|[^\w])it\s*\(/,
    },
    {
      label: "chai",
      pattern: /\bchai\b/,
    },
    {
      label: "vitest",
      pattern: /\bvitest\b/,
    },
    {
      label: "jest",
      pattern: /\bjest\b/,
    },
  ];

  for (const file of FIXTURE_ASSERTION_FILES) {
    const source = readSource(file);

    assert.ok(
      source.includes('import assert from "node:assert/strict";'),
      `${file} debe usar node:assert/strict`,
    );

    for (const { label, pattern } of forbiddenPatterns) {
      assert.equal(
        pattern.test(source),
        false,
        `${file} no debe usar assertion framework/snapshot frágil: ${label}`,
      );
    }
  }
});

test("fixtures públicos base mantienen contrato estructural con deepEqual explícito", () => {
  const file = "test/public-professionals-fixtures-invariants.test.ts";
  const source = readSource(file);

  assertIncludesAll(
    source,
    [
      "assert.deepEqual(row, {",
      'displayName: "Clinica Publica Fixture",',
      'updatedAt: new Date("2026-04-29T20:00:00.000Z"),',
      "assert.deepEqual(searchResult, {",
      "rows: [row],",
      "assert.deepEqual(detailResult, row);",
    ],
    file,
  );

  assert.ok(
    countOccurrences(source, "assert.deepEqual(") >= 3,
    `${file} debe conservar al menos 3 deepEqual de contrato`,
  );

  assert.ok(
    countOccurrences(source, "assert.notEqual(") >= 3,
    `${file} debe conservar assertions de identidad para clones`,
  );
});

test("fixture isolation combina identidad de objeto con igualdad estructural", () => {
  const file = "test/public-professionals-fixture-isolation-invariants.test.ts";
  const source = readSource(file);

  assertIncludesAll(
    source,
    [
      "assert.notEqual(first, second);",
      "assert.notEqual(first.updatedAt, second.updatedAt);",
      "assert.deepEqual(firstRow, searchRow);",
      "assert.deepEqual(searchResult.rows, [searchRow]);",
      "assert.deepEqual(detailBeforeMutation, detailRow);",
      "assert.deepEqual(detailAfterMutation, detailRow);",
      "assert.deepEqual(thirdDetail, detailRow);",
    ],
    file,
  );

  assert.ok(
    countOccurrences(source, "assert.notEqual(") >= 6,
    `${file} debe conservar assertions de identidad para referencias clonadas`,
  );

  assert.ok(
    countOccurrences(source, "assert.deepEqual(") >= 5,
    `${file} debe conservar assertions estructurales complementarias`,
  );
});

test("fixture assertions evitan serialización textual para comparar contratos", () => {
  const forbiddenPatterns = [
    {
      label: "JSON.stringify",
      pattern: /\bJSON\.stringify\s*\(/,
    },
    {
      label: ".toString()",
      pattern: /\.toString\s*\(/,
    },
    {
      label: "String(",
      pattern: /\bString\s*\(/,
    },
    {
      label: "assert.match(",
      pattern: /\bassert\.match\s*\(/,
    },
    {
      label: "assert.doesNotMatch(",
      pattern: /\bassert\.doesNotMatch\s*\(/,
    },
    {
      label: "assert.notDeepEqual(",
      pattern: /\bassert\.notDeepEqual\s*\(/,
    },
  ];

  for (const file of STRUCTURAL_FIXTURE_FILES) {
    const source = readSource(file);

    for (const { label, pattern } of forbiddenPatterns) {
      assert.equal(
        pattern.test(source),
        false,
        `${file} debe comparar contratos con assert.equal/deepEqual, no con ${label}`,
      );
    }
  }
});

test("assertions de clone quality validan Date por identidad y valor ISO estable", () => {
  const file = "test/public-professionals-fixture-isolation-invariants.test.ts";
  const source = readSource(file);

  assertIncludesAll(
    source,
    [
      'const DEFAULT_UPDATED_AT = "2026-04-29T20:00:00.000Z";',
      "assert.notEqual(customized.updatedAt, overrideDate);",
      "assert.equal(customized.updatedAt.toISOString(), overrideDate.toISOString());",
      "assert.equal(defaultAfterOverride.updatedAt.toISOString(), DEFAULT_UPDATED_AT);",
      "assert.equal(secondRow.updatedAt.toISOString(), DEFAULT_UPDATED_AT);",
      "assert.equal(detailAfterMutation?.updatedAt.toISOString(), DEFAULT_UPDATED_AT);",
      "assert.equal(thirdDetail?.updatedAt.toISOString(), DEFAULT_UPDATED_AT);",
    ],
    file,
  );
});

test("guardrails de file scope y helper boundaries usan deepEqual para listas de offenders", () => {
  const expectedListAssertions = new Map<string, string[]>([
    [
      "test/public-professionals-fixture-helper-boundaries-invariants.test.ts",
      [
        "assert.deepEqual(extractTypeExports(source), [",
        "assert.deepEqual(extractValueExports(source), [",
        "assert.deepEqual(\n    offenders,\n    [],",
      ],
    ],
    [
      "test/public-professionals-fixture-file-scope-invariants.test.ts",
      [
        "assert.deepEqual(\n    offenders,\n    [],",
        "assert.deepEqual(publicProfessionalHelperFiles, [",
      ],
    ],
  ]);

  for (const [file, snippets] of expectedListAssertions) {
    const source = readSource(file);
    assertIncludesAll(source, snippets, file);
  }
});
