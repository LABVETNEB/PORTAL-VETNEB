import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  REPORT_STUDY_TYPES,
  REPORT_STUDY_TYPE_LABELS,
  getReportStudyTypes,
  isReportStudyType,
  parseReportStudyType,
  serializeReportStudyType,
} from "../../../../server/features/reports/domain/index.ts";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../../../", import.meta.url)));
const CANONICAL_CATALOG_PATH =
  "server/features/reports/domain/report-study-types.ts";
const DOMAIN_BARREL_PATH = "server/features/reports/domain/index.ts";
const LEGACY_CATALOG_SHIM_PATH = "server/lib/report-study-types.ts";

const CANONICAL_REPORT_STUDY_TYPES = [
  { value: "citologia", label: "Citolog\u00eda" },
  { value: "histopatologia", label: "Histopatolog\u00eda" },
  { value: "hemoparasitos", label: "Hemopar\u00e1sitos" },
] as const;

const FORBIDDEN_FREE_TEXT_STUDY_TYPES = [
  "Histo",
  "Histopatologia",
  "Histopatolog\u00eda",
  "Citologia",
  "Citolog\u00eda",
  "Hemoparasitos",
  "Hemopar\u00e1sitos",
];

const CATALOG_CONSUMERS = [
  {
    path: "server/features/reports/composition/report-route-composition.ts",
    specifier: "../domain/index.ts",
    markers: ["parseReportStudyType"],
  },
  {
    path: "server/routes/reports.fastify.ts",
    specifier: "../features/reports/domain/index.ts",
    markers: ["parseReportStudyType(request.query.studyType)"],
  },
  {
    path: "server/db.ts",
    specifier: "./features/reports/domain/index.ts",
    markers: [
      "REPORT_STUDY_TYPE_LABELS",
      "getReportStudyTypes as getCanonicalReportStudyTypes",
    ],
  },
] as const;

const CRITICAL_REPORT_TESTS = [
  {
    path: "test/integration/adapters/controllers/admin-reports.fastify.test.ts",
    contract: "admin upload accepts only canonical studyType values",
  },
  {
    path: "test/integration/adapters/controllers/reports-status.fastify.test.ts",
    contract: "status fixtures retain a canonical report studyType",
  },
  {
    path: "test/integration/adapters/controllers/reports.fastify.test.ts",
    contract: "clinic filters and responses use canonical studyType values",
  },
  {
    path: "test/security/report-write-surface-ownership.test.ts",
    contract: "the only report write surface uses canonical studyType values",
  },
] as const;

function readSource(relativePath: string): string {
  return readFileSync(resolve(REPO_ROOT, relativePath), "utf8")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n");
}

function listSourceFiles(relativeDir: string): string[] {
  const root = resolve(REPO_ROOT, relativeDir);
  const files: string[] = [];

  function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      const fullPath = resolve(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        walk(fullPath);
        continue;
      }

      if (fullPath.endsWith(".ts")) {
        files.push(fullPath);
      }
    }
  }

  walk(root);

  return files.map((file) => relative(REPO_ROOT, file).replaceAll("\\", "/"));
}

function assertContains(source: string, marker: string, context: string) {
  assert.ok(source.includes(marker), `${context} debe contener: ${marker}`);
}

function assertNotContains(source: string, marker: string, context: string) {
  assert.equal(source.includes(marker), false, `${context} no debe contener: ${marker}`);
}

test("report study types have canonical internal catalog and public labels", () => {
  assert.equal(
    existsSync(resolve(REPO_ROOT, CANONICAL_CATALOG_PATH)),
    true,
    `${CANONICAL_CATALOG_PATH} must exist with canonical catalog`,
  );

  const source = readSource(CANONICAL_CATALOG_PATH);

  for (const exportName of [
    "REPORT_STUDY_TYPES",
    "ReportStudyType",
    "REPORT_STUDY_TYPE_LABELS",
    "isReportStudyType",
    "getReportStudyTypes",
    "serializeReportStudyType",
    "parseReportStudyType",
  ]) {
    assertContains(source, exportName, CANONICAL_CATALOG_PATH);
  }

  for (const studyType of CANONICAL_REPORT_STUDY_TYPES) {
    assertContains(source, `"${studyType.value}"`, CANONICAL_CATALOG_PATH);
    assertContains(source, `"${studyType.label}"`, CANONICAL_CATALOG_PATH);
  }

  assert.deepEqual(REPORT_STUDY_TYPES, [
    "citologia",
    "histopatologia",
    "hemoparasitos",
  ]);
  assert.deepEqual(getReportStudyTypes(), [...REPORT_STUDY_TYPES]);
  assert.deepEqual(REPORT_STUDY_TYPE_LABELS, {
    citologia: "Citolog\u00eda",
    histopatologia: "Histopatolog\u00eda",
    hemoparasitos: "Hemopar\u00e1sitos",
  });
});

test("report study types block free-text or legacy values as internal types", () => {
  const source = readSource(CANONICAL_CATALOG_PATH);

  for (const forbidden of FORBIDDEN_FREE_TEXT_STUDY_TYPES) {
    assertNotContains(
      source,
      `"${forbidden}" as const`,
      CANONICAL_CATALOG_PATH,
    );
    assertNotContains(
      source,
      `'${forbidden}' as const`,
      CANONICAL_CATALOG_PATH,
    );
    assert.equal(isReportStudyType(forbidden), false, forbidden);
  }
});

test("report study type parser serializer and 400 details stay exact", () => {
  assert.equal(parseReportStudyType(null), null);
  assert.equal(parseReportStudyType(undefined), null);
  assert.equal(parseReportStudyType("   "), null);
  assert.equal(parseReportStudyType(" histopatologia "), "histopatologia");
  assert.deepEqual(serializeReportStudyType("citologia"), {
    value: "citologia",
    label: "Citolog\u00eda",
  });
  assert.equal(serializeReportStudyType("Histopatologia"), null);

  for (const invalidValue of ["Histopatologia", "free text", 42]) {
    assert.throws(
      () => parseReportStudyType(invalidValue),
      (error: unknown) => {
        const catalogError = error as Error & {
          statusCode?: number;
          details?: { allowedValues?: readonly string[] };
        };

        assert.equal(catalogError.message, "Tipo de estudio inv\u00e1lido");
        assert.equal(catalogError.statusCode, 400);
        assert.deepEqual(catalogError.details?.allowedValues, REPORT_STUDY_TYPES);
        return true;
      },
    );
  }
});

test("report routes use canonical parser for upload and filters", () => {
  for (const consumer of CATALOG_CONSUMERS) {
    const source = readSource(consumer.path);

    assertContains(source, consumer.specifier, consumer.path);
    assertNotContains(source, LEGACY_CATALOG_SHIM_PATH, consumer.path);
    assertNotContains(source, "../lib/report-study-types.ts", consumer.path);
    assertNotContains(source, "./lib/report-study-types.ts", consumer.path);

    for (const marker of consumer.markers) {
      assertContains(source, marker, consumer.path);
    }
  }

  const adminReportsSource = readSource(
    "server/features/reports/application/report-route-service.ts",
  );
  const reportsSource = readSource(CATALOG_CONSUMERS[1].path);
  const dbSource = readSource(CATALOG_CONSUMERS[2].path);

  assertContains(
    adminReportsSource,
    "dependencies.parseReportStudyType(input.studyType)",
    "server/features/reports/application/report-route-service.ts",
  );
  assertNotContains(
    adminReportsSource,
    "dependencies.normalizeSearchText(input.studyType)",
    "server/features/reports/application/report-route-service.ts",
  );
  assertNotContains(reportsSource, "normalizeSearchText(request.query.studyType)", CATALOG_CONSUMERS[1].path);
  assertNotContains(dbSource, "selectDistinct({ studyType: reports.studyType })", CATALOG_CONSUMERS[2].path);
});

test("DB exposes study types from catalog and not persisted free-text values", () => {
  const dbSource = readSource("server/db.ts");

  assertContains(dbSource, "./features/reports/domain/index.ts", "server/db.ts");
  assertContains(dbSource, "REPORT_STUDY_TYPE_LABELS", "server/db.ts");
  assertContains(dbSource, "getReportStudyTypes", "server/db.ts");
  assertNotContains(dbSource, "./lib/report-study-types.ts", "server/db.ts");
  assertNotContains(dbSource, "selectDistinct({ studyType: reports.studyType })", "server/db.ts");
});

test("legacy catalog path remains an exact one-line shim", () => {
  assert.equal(existsSync(resolve(REPO_ROOT, LEGACY_CATALOG_SHIM_PATH)), true);
  assert.equal(
    readSource(LEGACY_CATALOG_SHIM_PATH).trim(),
    'export * from "../features/reports/domain/index.ts";',
  );
});

test("catalog contract is path-aware and anchored to the canonical module", () => {
  const barrel = readSource(DOMAIN_BARREL_PATH);

  assertContains(
    barrel,
    'export * from "./report-study-types.ts";',
    DOMAIN_BARREL_PATH,
  );
  assert.equal(
    resolve(REPO_ROOT, CANONICAL_CATALOG_PATH),
    resolve(REPO_ROOT, "server/features/reports/domain/report-study-types.ts"),
  );
});

test("critical report tests stop using free-text or abbreviated studyType", () => {
  const discoveredTestFiles = listSourceFiles("test");
  const criticalTestFiles = CRITICAL_REPORT_TESTS.map(({ path, contract }) => {
    const resolvedPath = relative(
      REPO_ROOT,
      resolve(REPO_ROOT, path),
    ).replaceAll("\\", "/");

    assert.ok(contract.length >= 50, `${path} must document its contract`);
    assert.equal(
      discoveredTestFiles.includes(resolvedPath),
      true,
      `${path} must resolve under the current test taxonomy`,
    );

    return resolvedPath;
  });

  assert.deepEqual(
    criticalTestFiles,
    CRITICAL_REPORT_TESTS.map(({ path }) => path),
  );

  for (const file of criticalTestFiles) {
    const source = readSource(file);

    for (const forbidden of FORBIDDEN_FREE_TEXT_STUDY_TYPES) {
      assertNotContains(source, `"${forbidden}"`, file);
      assertNotContains(source, `'${forbidden}'`, file);
    }

    assert.ok(
      CANONICAL_REPORT_STUDY_TYPES.some((studyType) =>
        source.includes(`"${studyType.value}"`),
      ),
      `${file} must use at least one canonical internal studyType`,
    );
  }
});
