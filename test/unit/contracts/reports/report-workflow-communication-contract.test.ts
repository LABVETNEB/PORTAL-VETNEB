import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

const root = process.cwd();
const application =
  "server/features/reports/application/report-workflow-communication.ts";
const dataPort =
  "server/features/reports/application/ports/report-workflow-data-port.ts";
const notificationPort =
  "server/features/reports/application/ports/report-workflow-notification-port.ts";
const dataAdapter =
  "server/features/reports/infrastructure/report-workflow-data-adapter.ts";
const notificationAdapter =
  "server/features/reports/infrastructure/report-workflow-notification-adapter.ts";
const composition =
  "server/features/reports/composition/report-workflow-communication-composition.ts";
const compositionIndex = "server/features/reports/composition/index.ts";
const shim = "server/lib/report-workflow-communication.ts";
const workflow =
  "server/features/reports/infrastructure/db-report-workflow.ts";

function read(path: string): string {
  return readFileSync(resolve(root, path), "utf8")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n");
}

function imports(path: string): string[] {
  const source = ts.createSourceFile(
    path,
    read(path),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const result: string[] = [];

  source.forEachChild((node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      result.push(node.moduleSpecifier.text);
    }
  });

  return result;
}

function resolveImport(path: string, specifier: string): string {
  if (!specifier.startsWith(".")) {
    return specifier;
  }
  return relative(root, resolve(root, dirname(path), specifier)).replaceAll("\\", "/");
}

test("M37 expone application puertos adapters composition y shim canonicos", () => {
  for (const path of [
    application,
    dataPort,
    notificationPort,
    dataAdapter,
    notificationAdapter,
    composition,
    compositionIndex,
    shim,
    workflow,
  ]) {
    assert.equal(existsSync(resolve(root, path)), true, path);
  }

  assert.equal(
    read(shim).trim(),
    'export * from "../features/reports/composition/index.ts";',
  );
  assert.equal(read(shim).trim().split("\n").length, 1);
});

test("application conserva resultado missing tracking mapping y propagacion", () => {
  const source = read(application);

  for (const marker of [
    "export type ReportWorkflowCommunicationResult",
    "notificationCreated: boolean",
    "notificationId: number | null",
    "warning: string | null",
    "createReportWorkflowCommunication",
    "findTrackingContextByReportId(input.reportId)",
    "notificationCreated: false",
    "No existe seguimiento vinculado al informe; no se creó notificación interna.",
    "studyTrackingCaseId: trackingContext.studyTrackingCaseId",
    "clinicId: trackingContext.clinicId",
    "reportId: trackingContext.reportId ?? input.reportId",
    "particularTokenId: trackingContext.particularTokenId ?? null",
    "isRead: false",
    "readAt: null",
    "createdAt: dependencies.now()",
    "notificationCreated: true",
  ]) {
    assert.ok(source.includes(marker), marker);
  }

  assert.equal(/\b(?:try|catch)\b/.test(source), false);
  for (const forbidden of ["drizzle", "schema.ts", "db.ts", "fastify", "infrastructure"]) {
    assert.equal(source.toLowerCase().includes(forbidden), false, forbidden);
  }
});

test("adapters son los unicos owners M37 de DB Drizzle schema y tablas", () => {
  const dataSource = read(dataAdapter);
  const notificationSource = read(notificationAdapter);

  assert.ok(dataSource.includes('from "drizzle-orm"'));
  assert.ok(dataSource.includes('from "../../../db.ts"'));
  assert.ok(dataSource.includes("studyTrackingCases"));
  assert.ok(notificationSource.includes('from "../../../db.ts"'));
  assert.ok(notificationSource.includes("studyTrackingNotifications"));

  for (const path of [application, dataPort, notificationPort, composition]) {
    const source = read(path).toLowerCase();
    for (const forbidden of ["drizzle", "schema.ts", "db.ts", "studytrackingcases", "studytrackingnotifications"]) {
      assert.equal(source.includes(forbidden), false, `${path}: ${forbidden}`);
    }
  }
});

test("composition cablea exactamente ambos puertos y reloj", () => {
  const source = read(composition);

  for (const marker of [
    "createReportWorkflowDataAdapter()",
    "createReportWorkflowNotificationAdapter()",
    "createReportWorkflowCommunication({",
    "now: () => new Date()",
    "export function createReportWorkflowNotification(",
  ]) {
    assert.ok(source.includes(marker), marker);
  }
});

test("db workflow recibe comunicación M37 y preserva stage special stain y best effort", () => {
  const source = read(workflow);

  assert.ok(source.includes("createDbReportWorkflowRepository"));
  assert.ok(source.includes("dependencies.createReportWorkflowNotification"));
  assert.equal(source.includes("../composition"), false);
  assert.ok(source.includes("createWorkflowCommunicationSafely({"));
  assert.ok(source.includes('type: "stage_changed"'));
  assert.ok(source.includes('title: "Estado de informe actualizado"'));
  assert.ok(
    source.includes(
      'requested ? "special_stain_required" : "special_stain_resolved"',
    ),
  );
  assert.ok(source.includes("if (!result.notificationCreated)"));
  assert.ok(source.includes("} catch (error) {"));
  assert.ok(source.includes('errorName: error instanceof Error ? error.name : "unknown_error"'));
  assert.equal(source.includes("error.message"), false);
  assert.equal(source.includes("error.stack"), false);
});

test("ningun consumidor runtime o test de comportamiento importa el shim", () => {
  const violations: string[] = [];

  for (const base of ["server", "test"]) {
    const pending = [resolve(root, base)];
    while (pending.length > 0) {
      const directory = pending.pop()!;
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const absolute = resolve(directory, entry.name);
        if (entry.isDirectory()) {
          pending.push(absolute);
        } else if (entry.isFile() && entry.name.endsWith(".ts")) {
          const path = relative(root, absolute).replaceAll("\\", "/");
          if (path === shim || path === "test/architecture/reports-workflow-ports-boundary-guard.test.ts") {
            continue;
          }
          for (const specifier of imports(path)) {
            if (resolveImport(path, specifier) === shim) {
              violations.push(`${path}: ${specifier}`);
            }
          }
        }
      }
    }
  }

  assert.deepEqual(violations, []);
});
