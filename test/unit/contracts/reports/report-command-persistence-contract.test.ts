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

test("server/db.ts conserva exports compatibles sin duplicar persistencia M38", () => {
  const source = read("server/db.ts");
  const reportsSection = source.slice(
    source.indexOf("/* ========================= REPORTS"),
  );

  assert.ok(
    source.includes(
      'from "./features/reports/infrastructure/index.ts";',
    ),
  );
  assert.ok(
    source.includes(
      'from "./features/reports/composition/index.ts";',
    ),
  );
  for (const name of ["getReportById", "upsertReport"]) {
    assert.match(
      source,
      new RegExp(`export \\{[\\s\\S]*?\\b${name}\\b[\\s\\S]*?\\} from`),
    );
    assert.equal(
      reportsSection.includes(`export async function ${name}`),
      false,
      name,
    );
  }
  assert.match(
    source,
    /export \{\s*updateReportStatus,\s*\} from "\.\/features\/reports\/composition\/index\.ts";/,
  );
  assert.equal(
    reportsSection.includes("export async function updateReportStatus"),
    false,
  );
  assert.equal(reportsSection.includes(".transaction("), false);
  assert.equal(
    reportsSection.includes('INSERT INTO "report_status_history"'),
    false,
  );
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
  assert.ok(source.includes("export function getReportById"));
  assert.ok(source.includes("export function upsertReport"));
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

test("rutas conservan Options y exports compatibility previos", () => {
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
    "const db = await import(\"../db.ts\")",
    "getClinicScopedReportById: db.getClinicScopedReportById",
    "updateReportStatus: db.updateReportStatus",
    "const updated = await deps.updateReportStatus({",
  ]) {
    assert.ok(status.includes(marker), marker);
  }
  assert.ok(reads.includes("getReportStatusHistory: db.getReportStatusHistory"));
  assert.equal(admin.includes("../db.ts"), false);
  assert.equal(status.includes("report-command-composition"), false);
});

test("compatibility update atraviesa composition y application sin queries", () => {
  const composition = read(
    "server/features/reports/composition/report-command-composition.ts",
  );

  for (const marker of [
    "export function transitionReportStatus",
    "export async function updateReportStatus",
    "const result = await transitionReportStatus(input)",
    'result.type === "persisted" ? result.report : undefined',
  ]) {
    assert.ok(composition.includes(marker), marker);
  }

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
    false,
  );
});
