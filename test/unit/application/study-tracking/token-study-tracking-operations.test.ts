import assert from "node:assert/strict";
import test from "node:test";

import type {
  ParticularToken,
  StudyTrackingCase,
} from "../../../../drizzle/schema.ts";
import { createTokenStudyTrackingOperations } from "../../../../server/features/study-tracking/application/index.ts";

const token = {
  id: 31,
  clinicId: 7,
  reportId: null,
  detailsLesion: null,
  createdByAdminId: null,
  createdByClinicUserId: 19,
} as ParticularToken;

const trackingCase = {
  id: 41,
  clinicId: 7,
  reportId: null,
  particularTokenId: 31,
  currentStage: "reception",
} as StudyTrackingCase;

test("createTokenStudyTrackingOperations delega el token sin alterar scope", async () => {
  const calls: number[] = [];
  const operations = createTokenStudyTrackingOperations({
    getParticularStudyTrackingCase: async (tokenId) => {
      calls.push(tokenId);
      return trackingCase;
    },
    getStudyTrackingCaseByReportId: async () => null,
    createStudyTrackingCase: async () => trackingCase,
    updateStudyTrackingCase: async () => trackingCase,
  });

  assert.equal(
    await operations.ensureTrackingForToken({ token }),
    trackingCase,
  );
  assert.deepEqual(calls, [31]);
});

test("createTokenStudyTrackingOperations preserva identidad del error", async () => {
  const expected = new Error("tracking repository failed");
  const operations = createTokenStudyTrackingOperations({
    getParticularStudyTrackingCase: async () => {
      throw expected;
    },
    getStudyTrackingCaseByReportId: async () => null,
    createStudyTrackingCase: async () => trackingCase,
    updateStudyTrackingCase: async () => trackingCase,
  });

  await assert.rejects(
    operations.ensureTrackingForToken({ token }),
    (error) => error === expected,
  );
});
