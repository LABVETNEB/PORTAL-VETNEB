import assert from "node:assert/strict";
import test from "node:test";

import { createStudyTrackingSideEffectUseCases } from "../../../../server/features/study-tracking/application/index.ts";

test("side-effect use cases delegan email y auditoría por sus puertos reales", async () => {
  const emailInput = { trackingCaseId: 7 };
  const auditRequest = { method: "POST" };
  const auditInput = { event: "study_tracking.case.created" };
  const emailResult = { sent: true };
  const calls: Array<readonly unknown[]> = [];
  const useCases = createStudyTrackingSideEffectUseCases({
    notification: {
      sendSpecialStainRequiredEmail: async (input: typeof emailInput) => {
        calls.push(["email", input]);
        return emailResult;
      },
    },
    audit: {
      writeAuditLog: async (
        request: typeof auditRequest,
        input: typeof auditInput,
      ) => {
        calls.push(["audit", request, input]);
      },
    },
  });

  assert.equal(
    await useCases.sendSpecialStainRequiredEmail(emailInput),
    emailResult,
  );
  assert.equal(
    await useCases.writeAuditLog(auditRequest, auditInput),
    undefined,
  );
  assert.deepEqual(calls, [
    ["email", emailInput],
    ["audit", auditRequest, auditInput],
  ]);
});

test("side-effect use cases propagan el error original sin retry ni fallback", async () => {
  const expected = new Error("smtp failed");
  const useCases = createStudyTrackingSideEffectUseCases({
    notification: {
      sendSpecialStainRequiredEmail: async (_input: { id: number }) => {
        throw expected;
      },
    },
    audit: {
      writeAuditLog: async (_request: unknown, _input: { event: string }) => {},
    },
  });

  await assert.rejects(
    useCases.sendSpecialStainRequiredEmail({ id: 5 }),
    (error) => error === expected,
  );
});
