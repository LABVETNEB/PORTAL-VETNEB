import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = process.cwd();

function read(path: string): string {
  return readFileSync(resolve(root, path), "utf8").replace(/\r\n/g, "\n");
}

function walk(directory: string): string[] {
  return readdirSync(resolve(root, directory), { withFileTypes: true }).flatMap(
    (entry) => {
      const path = `${directory}/${entry.name}`;
      return entry.isDirectory() ? walk(path) : [path];
    },
  );
}

test("server/db.ts retira exports Reports sin duplicar persistencia M38", () => {
  const source = read("server/db.ts");

  assert.equal(source.includes("features/reports"), false);
  assert.equal(source.includes("/* ========================= REPORTS"), false);
  for (const name of [
    "getReportById",
    "upsertReport",
    "updateReportStatus",
  ]) {
    assert.doesNotMatch(source, new RegExp(`\\b${name}\\b`), name);
  }
});

test("infrastructure es owner único de transacciones y SQL M38", () => {
  const source = read(
    "server/features/reports/infrastructure/report-command-repository.ts",
  );

  assert.equal(source.match(/database\.transaction\(/g)?.length, 2);
  assert.equal(
    source.match(/INSERT INTO "report_status_history"/g)?.length,
    1,
  );
  assert.ok(source.includes("export function createReportCommandRepository"));
  assert.equal(source.includes("export function getReportById"), false);
  assert.equal(source.includes("export function upsertReport"), false);
  assert.equal(source.includes("export function updateReportStatus"), false);
  assert.equal(source.includes("../application/"), false);
  assert.equal(source.includes("../composition/"), false);
});

test("transition persistence usa expectedFromStatus y CAS antes del historial", () => {
  const source = read(
    "server/features/reports/infrastructure/report-command-repository.ts",
  );

  for (const marker of [
    "report.currentStatus !== input.expectedFromStatus",
    "and(",
    "eq(reports.id, input.reportId)",
    "eq(reports.currentStatus, input.expectedFromStatus)",
    "const updatedReport = updated[0]",
    "if (!updatedReport)",
    "fromStatus: input.expectedFromStatus",
  ]) {
    assert.ok(source.includes(marker), marker);
  }
  assert.ok(
    source.indexOf("if (!updatedReport)") <
      source.lastIndexOf("await insertCompatibleReportStatusHistory"),
  );
});

test("rutas conservan Options y consumen composition canónica", () => {
  const admin = read("server/routes/admin-reports.fastify.ts");
  const status = read("server/routes/reports-status.fastify.ts");
  const reads = read("server/routes/reports.fastify.ts");

  for (const marker of [
    "export type AdminReportsNativeRoutesOptions",
    "createAdminReportsRouteComposition",
    "composition.service.uploadAdminReport({",
  ]) {
    assert.ok(admin.includes(marker), marker);
  }
  for (const marker of [
    "export type ReportsStatusNativeRoutesOptions",
    "createClinicReportStatusRouteComposition",
    "transitionClinicReportStatus({",
  ]) {
    assert.ok(status.includes(marker), marker);
  }
  assert.ok(reads.includes("createClinicReportsRouteComposition"));
  assert.equal(admin.includes("../db.ts"), false);
  assert.equal(status.includes("../db.ts"), false);
});

test("composition canónica atraviesa application sin queries", () => {
  const composition = read(
    "server/features/reports/composition/report-command-composition.ts",
  );

  for (const marker of [
    "export async function getReportById",
    ".findReportById(reportId)",
    "export function transitionReportStatus",
  ]) {
    assert.ok(composition.includes(marker), marker);
  }
  assert.equal(
    composition.includes("export async function updateReportStatus"),
    false,
  );

  const files = [
    ...walk("server/features/reports/application"),
    ...walk("server/features/reports/composition"),
  ].filter((path) => path.endsWith(".ts"));

  for (const path of files) {
    const source = read(path);
    for (const forbidden of [
      ".select(",
      ".insert(",
      ".update(",
      ".transaction(",
      "drizzle-orm",
      "reportStatusHistory",
    ]) {
      assert.equal(source.includes(forbidden), false, `${path}: ${forbidden}`);
    }
  }

  for (const present of [
    "server/features/reports/application/report-route-service.ts",
    "server/features/reports/composition/report-route-composition.ts",
  ]) {
    assert.equal(existsSync(resolve(root, present)), true, present);
  }
  assert.equal(
    existsSync(
      resolve(
        root,
        "server/features/reports/application/report-query-use-cases.ts",
      ),
    ),
    true,
  );
});
