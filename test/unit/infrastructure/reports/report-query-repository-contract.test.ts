import assert from "node:assert/strict";
import test from "node:test";
import { readSourceFile } from "../../../helpers/tracked-source-files.ts";

const repositoryPath =
  "server/features/reports/infrastructure/report-query-repository.ts";
const source = readSourceFile(repositoryPath);

test("M40 repository es owner unico de las ocho queries", () => {
  for (const marker of [
    "findClinicScopedReportById",
    "getReportStatusHistory",
    "listReportsByClinicId",
    "countReportsByClinicId",
    "searchReports",
    "countSearchReports",
    "getReportStudyTypes",
    "getStudyTypes",
  ]) {
    assert.ok(source.includes(marker), marker);
  }

  assert.equal(source.includes("../application/"), false);
  assert.equal(source.includes("../composition/"), false);
  assert.ok(source.includes('from "drizzle-orm"'));
});

test("M40 lookup e history conservan scoping limit y orden", () => {
  for (const marker of [
    "eq(reports.id, reportId)",
    "eq(reports.clinicId, clinicId)",
    ".limit(1)",
    "eq(reportStatusHistory.reportId, reportId)",
    "desc(reportStatusHistory.createdAt)",
    "desc(reportStatusHistory.id)",
  ]) {
    assert.ok(source.includes(marker), marker);
  }
});

test("M40 list conserva filtros orden limit y offset", () => {
  for (const marker of [
    "eq(reports.clinicId, clinicId)",
    "eq(reports.currentStatus, currentStatus)",
    ".orderBy(desc(reports.createdAt))",
    ".limit(limit)",
    ".offset(offset)",
  ]) {
    assert.ok(source.includes(marker), marker);
  }
});

test("M40 search y count comparten filtros exactos", () => {
  assert.equal(source.match(/buildSearchFilters\(/g)?.length, 3);
  for (const marker of [
    "eq(reports.studyType, studyType)",
    'ilike(reports.patientName, "%" + query + "%")',
    'ilike(reports.fileName, "%" + query + "%")',
    'ilike(reports.studyType, "%" + query + "%")',
  ]) {
    assert.ok(source.includes(marker), marker);
  }
});

test("M40 counts y catalogo conservan semantica legacy", () => {
  assert.equal(source.match(/sql<string>`count\(\*\)`/g)?.length, 2);
  assert.equal(
    source.match(/Number\(result\[0\]\?\.value \?\? 0\)/g)?.length,
    2,
  );
  assert.ok(source.includes("getCanonicalReportStudyTypes()"));
  assert.equal(source.includes("selectDistinct"), false);
});
