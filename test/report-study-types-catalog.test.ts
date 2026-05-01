import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const REPO_ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));

const CANONICAL_REPORT_STUDY_TYPES = [
  { value: "citologia", label: "Citología" },
  { value: "histopatologia", label: "Histopatología" },
  { value: "hemoparasitos", label: "Hemoparásitos" },
] as const;

const FORBIDDEN_FREE_TEXT_STUDY_TYPES = [
  "Histo",
  "Histopatologia",
  "Histopatología",
  "Citologia",
  "Citología",
  "Hemoparasitos",
  "Hemoparásitos",
];

function readSource(relativePath: string): string {
  return readFileSync(resolve(REPO_ROOT, relativePath), "utf8");
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

  return files.map((file) => file.replace(REPO_ROOT + "\\", "").replaceAll("\\", "/"));
}

function assertContains(source: string, marker: string, context: string) {
  assert.ok(source.includes(marker), `${context} debe contener: ${marker}`);
}

function assertNotContains(source: string, marker: string, context: string) {
  assert.equal(source.includes(marker), false, `${context} no debe contener: ${marker}`);
}

test("report study types tienen catálogo canónico interno y labels públicos", () => {
  const catalogPath = "server/lib/report-study-types.ts";
  const absoluteCatalogPath = resolve(REPO_ROOT, catalogPath);

  assert.equal(
    existsSync(absoluteCatalogPath),
    true,
    "debe existir server/lib/report-study-types.ts con el catálogo canónico",
  );

  const source = readSource(catalogPath);

  assertContains(source, "REPORT_STUDY_TYPES", catalogPath);
  assertContains(source, "REPORT_STUDY_TYPE_LABELS", catalogPath);
  assertContains(source, "parseReportStudyType", catalogPath);
  assertContains(source, "serializeReportStudyType", catalogPath);

  for (const studyType of CANONICAL_REPORT_STUDY_TYPES) {
    assertContains(source, `"${studyType.value}"`, catalogPath);
    assertContains(source, `"${studyType.label}"`, catalogPath);
  }
});

test("report study types bloquean valores libres o legacy como tipo interno", () => {
  const catalogPath = "server/lib/report-study-types.ts";
  const source = readSource(catalogPath);

  for (const forbidden of FORBIDDEN_FREE_TEXT_STUDY_TYPES) {
    assertNotContains(
      source,
      `"${forbidden}" as const`,
      catalogPath,
    );
    assertNotContains(
      source,
      `'${forbidden}' as const`,
      catalogPath,
    );
  }
});

test("rutas de informes usan parser canónico para upload y filtros", () => {
  const adminReportsSource = readSource("server/routes/admin-reports.fastify.ts");
  const reportsSource = readSource("server/routes/reports.fastify.ts");

  assertContains(
    adminReportsSource,
    "parseReportStudyType",
    "server/routes/admin-reports.fastify.ts",
  );
  assertContains(
    reportsSource,
    "parseReportStudyType",
    "server/routes/reports.fastify.ts",
  );

  assertNotContains(
    adminReportsSource,
    "normalizeSearchText(body.studyType)",
    "server/routes/admin-reports.fastify.ts",
  );
  assertNotContains(
    reportsSource,
    "normalizeSearchText(request.query.studyType)",
    "server/routes/reports.fastify.ts",
  );
});

test("DB expone study types desde catálogo y no desde valores libres persistidos", () => {
  const dbSource = readSource("server/db.ts");

  assertContains(dbSource, "REPORT_STUDY_TYPE_LABELS", "server/db.ts");
  assertContains(dbSource, "getReportStudyTypes", "server/db.ts");

  assertNotContains(dbSource, "selectDistinct({ studyType: reports.studyType })", "server/db.ts");
});

test("tests críticos de informes dejan de usar studyType libre o abreviado", () => {
  const criticalTestFiles = listSourceFiles("test").filter((file) =>
    [
      "test/admin-reports.fastify.test.ts",
      "test/reports.fastify.test.ts",
      "test/report-write-surface-ownership.test.ts",
      "test/reports-status.fastify.test.ts",
    ].includes(file),
  );

  assert.deepEqual(
    criticalTestFiles,
    [
      "test/admin-reports.fastify.test.ts",
      "test/report-write-surface-ownership.test.ts",
      "test/reports-status.fastify.test.ts",
      "test/reports.fastify.test.ts",
    ],
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
      `${file} debe usar al menos un studyType canónico interno`,
    );
  }
});