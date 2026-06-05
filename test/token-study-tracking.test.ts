import test from "node:test";
import assert from "node:assert/strict";

import type { StudyTrackingCase } from "../drizzle/schema.ts";
import { calculateEstimatedDeliveryAt } from "../server/lib/study-tracking.ts";
import { ensureStudyTrackingCaseForToken } from "../server/lib/token-study-tracking.ts";

function createStudyTrackingCaseFixture(
  input: Omit<StudyTrackingCase, "id" | "createdAt" | "updatedAt">,
): StudyTrackingCase {
  return {
    id: 11,
    createdAt: new Date("2026-01-05T12:00:00.000Z"),
    updatedAt: new Date("2026-01-05T12:00:00.000Z"),
    ...input,
  } as StudyTrackingCase;
}

test("ensureStudyTrackingCaseForToken no usa Fecha de envío como base SLA", async () => {
  const now = new Date("2026-01-05T00:00:00.000Z");
  const createCalls: Array<
    Omit<StudyTrackingCase, "id" | "createdAt" | "updatedAt">
  > = [];

  const token = {
    id: 7,
    clinicId: 3,
    reportId: null,
    shippingDate: new Date("2026-01-02T00:00:00.000Z"),
    extractionDate: new Date("2026-01-01T00:00:00.000Z"),
    detailsLesion: "Lesión nodular pequeña",
    createdByAdminId: 1,
    createdByClinicUserId: null,
  };

  const created = await ensureStudyTrackingCaseForToken(
    {
      getParticularStudyTrackingCase: async () => null,
      getStudyTrackingCaseByReportId: async () => null,
      createStudyTrackingCase: async (input) => {
        createCalls.push(input);
        return createStudyTrackingCaseFixture(input);
      },
      updateStudyTrackingCase: async () => null,
    },
    {
      token,
      now,
    },
  );

  assert.equal(createCalls.length, 1);
  assert.equal(createCalls[0].receptionAt.toISOString(), now.toISOString());
  assert.notEqual(
    createCalls[0].receptionAt.toISOString(),
    token.shippingDate.toISOString(),
  );
  assert.equal(
    createCalls[0].estimatedDeliveryAt.toISOString(),
    calculateEstimatedDeliveryAt(now).toISOString(),
  );
  assert.equal(created.receptionAt.toISOString(), now.toISOString());
});
