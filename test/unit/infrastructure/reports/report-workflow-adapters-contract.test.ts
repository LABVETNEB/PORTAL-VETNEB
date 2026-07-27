import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const DATA_ADAPTER =
  "server/features/reports/infrastructure/report-workflow-data-adapter.ts";
const NOTIFICATION_ADAPTER =
  "server/features/reports/infrastructure/report-workflow-notification-adapter.ts";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8").replace(/\r\n/g, "\n");
}

test("data adapter preserva consulta y mapping minimo de Study Tracking", () => {
  const source = read(DATA_ADAPTER);

  for (const marker of [
    ".select()",
    ".from(studyTrackingCases)",
    ".where(eq(studyTrackingCases.reportId, reportId))",
    ".limit(1)",
    "const trackingCase = trackingCases[0]",
    "studyTrackingCaseId: trackingCase.id",
    "clinicId: trackingCase.clinicId",
    "reportId: trackingCase.reportId ?? null",
    "particularTokenId: trackingCase.particularTokenId ?? null",
  ]) {
    assert.ok(source.includes(marker), marker);
  }

  for (const forbidden of [".insert(", ".update(", ".delete(", "console.", "audit", "email"]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});

test("notification adapter preserva tabla values y returning exactos", () => {
  const source = read(NOTIFICATION_ADAPTER);

  for (const marker of [
    ".insert(studyTrackingNotifications)",
    "studyTrackingCaseId: input.studyTrackingCaseId",
    "clinicId: input.clinicId",
    "reportId: input.reportId",
    "particularTokenId: input.particularTokenId",
    "type: input.type",
    "title: input.title",
    "message: input.message",
    "isRead: input.isRead",
    "readAt: input.readAt",
    "createdAt: input.createdAt",
    ".returning({ id: studyTrackingNotifications.id })",
    "notifications[0]?.id ?? null",
  ]) {
    assert.ok(source.includes(marker), marker);
  }

  for (const forbidden of ["console.", "audit", "email", ".select(", ".update(", ".delete("]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});
