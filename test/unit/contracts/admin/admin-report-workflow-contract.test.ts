import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("report workflow schema y migración amplían reports sin tabla paralela", () => {
  const schema = read("drizzle/schema.ts");
  const migration = read("drizzle/migrations/0027_report_workflow.sql");
  const journal = read("drizzle/migrations/meta/_journal.json");

  assert.ok(schema.includes("export const REPORT_WORKFLOW_STAGES = ["));
  assert.ok(schema.includes('workflowStage: text("workflow_stage")'));
  assert.ok(schema.includes('specialStainRequested: boolean("special_stain_requested")'));
  assert.ok(schema.includes('specialStainAt: timestamp("special_stain_at"'));
  assert.ok(schema.includes('workflowUpdatedAt: timestamp("workflow_updated_at"'));
  assert.ok(migration.includes('ALTER TABLE "reports"'));
  assert.equal(migration.includes("admin_reports"), false);
  assert.ok(migration.includes('ADD COLUMN IF NOT EXISTS "workflow_stage"'));
  assert.ok(migration.includes("'sample_received'"));
  assert.ok(migration.includes('"special_stain_requested" boolean NOT NULL DEFAULT false'));
  assert.ok(journal.includes('"tag":  "0027_report_workflow"'));
});

test("workflow admin se registra en Fastify sobre la superficie global reports", () => {
  const app = read("server/fastify-app.ts");
  const route = read("server/routes/admin-report-workflow.fastify.ts");
  const database = read(
    "server/features/reports/infrastructure/db-report-workflow.ts",
  );
  const service = read(
    "server/features/reports/application/report-route-service.ts",
  );

  assert.ok(app.includes("adminReportWorkflowNativeRoutes"));
  assert.ok(app.includes('prefix: "/api/admin/report-workflow"'));
  assert.ok(route.includes('app.get<{ Querystring: WorkflowQuery }>("/",'));
  assert.ok(route.includes('"/:id/stage"'));
  assert.ok(route.includes('"/:id/special-stain"'));
  assert.ok(route.includes("REPORT_WORKFLOW_STAGES"));
  assert.ok(route.includes("createAdminReportWorkflowRouteComposition"));
  assert.ok(service.includes("workflowStageChanged"));
  assert.ok(service.includes("specialStainChanged"));
  assert.equal(route.includes("particularToken"), false);
  assert.ok(database.includes(".from(reports)"));
  assert.equal(database.includes("studyTracking"), false);
  assert.equal(database.includes("particularToken"), false);
});
