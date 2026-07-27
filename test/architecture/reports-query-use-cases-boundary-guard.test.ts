import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = process.cwd();
const application =
  "server/features/reports/application/report-query-use-cases.ts";
const port =
  "server/features/reports/application/ports/report-query-repository.ts";
const repository =
  "server/features/reports/infrastructure/report-query-repository.ts";
const composition =
  "server/features/reports/composition/report-query-composition.ts";
const readsRoute = "server/routes/reports.fastify.ts";
const statusRoute = "server/routes/reports-status.fastify.ts";

function read(path: string) {
  return readFileSync(resolve(root, path), "utf8").replace(/\r\n/g, "\n");
}

function tsFiles(directory: string): string[] {
  return readdirSync(resolve(root, directory), {
    recursive: true,
    withFileTypes: true,
  })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
    .map((entry) =>
      resolve(entry.parentPath, entry.name)
        .slice(resolve(root).length + 1)
        .replaceAll("\\", "/"),
    );
}

test("M40 materializa inventario productivo exacto", () => {
  for (const path of [application, port, repository, composition]) {
    assert.equal(existsSync(resolve(root, path)), true, path);
  }

  assert.deepEqual(
    tsFiles("server/features/reports/application").sort(),
    [
      "server/features/reports/application/index.ts",
      "server/features/reports/application/ports/index.ts",
      "server/features/reports/application/ports/report-command-repository.ts",
      "server/features/reports/application/ports/report-query-repository.ts",
      "server/features/reports/application/ports/report-workflow-data-port.ts",
      "server/features/reports/application/ports/report-workflow-notification-port.ts",
      "server/features/reports/application/report-command-use-cases.ts",
      "server/features/reports/application/report-query-use-cases.ts",
      "server/features/reports/application/report-route-service.ts",
      "server/features/reports/application/report-workflow-communication.ts",
    ],
  );
});

test("M40 application aplica default deny de framework y persistencia", () => {
  const source = read(application);

  for (const forbidden of [
    "fastify",
    "drizzle-orm",
    "../db.ts",
    "supabase",
    "reply.code",
    ".select(",
    ".insert(",
    ".update(",
    ".transaction(",
    "console.",
    "catch (",
  ]) {
    assert.equal(source.toLowerCase().includes(forbidden), false, forbidden);
  }

  assert.ok(source.includes("serializeSafeReport"));
  assert.ok(source.includes("type: \"not_found\""));
});

test("M40 composition es bridge lazy unico y rutas quedan thin", () => {
  const bridge = read(composition);
  const reads = read(readsRoute);
  const status = read(statusRoute);

  for (const marker of [
    'import("../../../db.ts")',
    'import("../../../lib/supabase.ts")',
    'import("../infrastructure/report-query-repository.ts")',
    'import("./report-command-composition.ts")',
    "createReportQueryUseCases",
    "createReportCommandUseCases",
  ]) {
    assert.ok(bridge.includes(marker), marker);
  }

  for (const source of [reads, status]) {
    for (const forbidden of [
      "../db.ts",
      "drizzle-orm",
      "../lib/supabase.ts",
      "Promise.all(",
      "canTransitionReportStatus(",
      "serializeSafeReport(",
    ]) {
      assert.equal(source.includes(forbidden), false, forbidden);
    }
  }
});

test("M40 db.ts conserva solo reexports compatibility de queries", () => {
  const db = read("server/db.ts");
  const reportsSection = db.slice(
    db.indexOf("/* ========================= REPORTS"),
  );

  for (const name of [
    "getClinicScopedReportById",
    "getReportStatusHistory",
    "getReportsByClinicId",
    "countReportsByClinicId",
    "searchReports",
    "countSearchReports",
    "getReportStudyTypes",
    "getStudyTypes",
  ]) {
    assert.match(db, new RegExp(`\\b${name}\\b`), name);
    assert.equal(
      reportsSection.includes(`function ${name}`),
      false,
      name,
    );
  }

  assert.equal(reportsSection.includes(".select("), false);
  assert.equal(reportsSection.includes("count(*)"), false);
});

test("M40 conserva doble registro /api/reports en orden reads status", () => {
  const app = read("server/fastify-app.ts");
  const registrations = Array.from(
    app.matchAll(
      /app\.register\(\s*(reportsNativeRoutes|reportsStatusNativeRoutes),\s*\{\s*prefix:\s*"([^"]+)"/g,
    ),
    (match) => [match[1], match[2]],
  );

  assert.deepEqual(registrations, [
    ["reportsNativeRoutes", "/api/reports"],
    ["reportsStatusNativeRoutes", "/api/reports"],
  ]);
});

test("M40 preserva Options endpoints shims y mantiene M41 ausente", () => {
  const reads = read(readsRoute);
  const status = read(statusRoute);

  for (const marker of [
    "export type ReportsNativeRoutesOptions",
    'app.options("/", optionsHandler);',
    'app.options("/search", optionsHandler);',
    'app.options("/study-types", optionsHandler);',
    'app.options("/:reportId/history", optionsHandler);',
    'app.options("/:reportId/preview-url", optionsHandler);',
    'app.options("/:reportId/download-url", optionsHandler);',
    '}>("/", async',
    '}>("/search", async',
    '}>("/study-types", async',
    '}>("/:reportId/history", async',
    '}>("/:reportId/preview-url", async',
    '}>("/:reportId/download-url", async',
  ]) {
    assert.ok(reads.includes(marker), marker);
  }
  for (const marker of [
    "export type ReportsStatusNativeRoutesOptions",
    'app.options("/:reportId/status", optionsHandler);',
    '}>("/:reportId/status", async',
  ]) {
    assert.ok(status.includes(marker), marker);
  }
  for (const shim of [
    "server/db-report-workflow.ts",
    "server/lib/report-workflow-communication.ts",
    "server/lib/report-status.ts",
    "server/lib/report-study-types.ts",
    "server/lib/reports.ts",
  ]) {
    assert.equal(existsSync(resolve(root, shim)), true, shim);
  }
  assert.equal(existsSync(resolve(root, "docs/implementation/m41-reports-closeout.md")), false);
});
