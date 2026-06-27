import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const DB_REPORT_WORKFLOW_PATH = "server/db-report-workflow.ts";
const COMMUNICATION_PATH = "server/lib/report-workflow-communication.ts";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

function functionSource(source: string, name: string): string {
  const start = source.indexOf(`export async function ${name}(`);
  assert.notEqual(start, -1, `Missing function ${name}`);
  const nextExport = source.indexOf("\nexport async function ", start + 1);
  return nextExport === -1 ? source.slice(start) : source.slice(start, nextExport);
}

test("admin report workflow stage changes create tracking notifications", () => {
  const source = read(DB_REPORT_WORKFLOW_PATH);
  const updateStage = functionSource(source, "updateAdminReportWorkflowStage");

  assert.ok(
    source.includes('import { createReportWorkflowNotification } from "./lib/report-workflow-communication.ts";'),
  );
  assert.ok(updateStage.includes("createWorkflowCommunicationSafely({"));
  assert.ok(updateStage.includes('type: "stage_changed"'));
  assert.ok(updateStage.includes('title: "Estado de informe actualizado"'));
});

test("admin report workflow special stain changes create required/resolved notifications", () => {
  const source = read(DB_REPORT_WORKFLOW_PATH);
  const updateSpecialStain = functionSource(source, "updateAdminReportSpecialStain");

  assert.ok(updateSpecialStain.includes("createWorkflowCommunicationSafely({"));
  assert.ok(
    updateSpecialStain.includes('requested ? "special_stain_required" : "special_stain_resolved"'),
  );
  assert.ok(updateSpecialStain.includes('"Se requiere tinción especial"'));
  assert.ok(updateSpecialStain.includes('"Tinción especial resuelta"'));
});

test("report workflow communication helper preserves role scope through study tracking", () => {
  const source = read(COMMUNICATION_PATH);

  assert.ok(source.includes("studyTrackingCases"));
  assert.ok(source.includes("studyTrackingNotifications"));
  assert.ok(source.includes("eq(studyTrackingCases.reportId, input.reportId)"));
  assert.ok(source.includes("clinicId: trackingCase.clinicId"));
  assert.ok(source.includes("particularTokenId: trackingCase.particularTokenId ?? null"));
  assert.ok(source.includes("notificationCreated: false"));
  assert.ok(source.includes("warning:"));
});
