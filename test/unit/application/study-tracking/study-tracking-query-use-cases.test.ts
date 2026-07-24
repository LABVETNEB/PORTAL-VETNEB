import assert from "node:assert/strict";
import test from "node:test";

import {
  createAdminStudyTrackingQueryUseCases,
  createClinicStudyTrackingQueryUseCases,
  createParticularStudyTrackingQueryUseCases,
} from "../../../../server/features/study-tracking/application/index.ts";

test("clinic query use cases delegan una vez con argumentos y resultados intactos", async () => {
  const trackingCase = { id: 7 };
  const notification = { id: 11 };
  const caseListResult = [trackingCase];
  const notificationListResult = [notification];
  const calls: Array<readonly unknown[]> = [];
  const useCases = createClinicStudyTrackingQueryUseCases({
    getClinicScopedStudyTrackingCase: async (id: number, clinicId: number) => {
      calls.push(["get", id, clinicId]);
      return trackingCase;
    },
    listStudyTrackingCases: async (params: { clinicId: number }) => {
      calls.push(["list-cases", params]);
      return caseListResult;
    },
    listStudyTrackingNotifications: async (params: { clinicId: number }) => {
      calls.push(["list-notifications", params]);
      return notificationListResult;
    },
  });
  const caseParams = { clinicId: 3 };
  const notificationParams = { clinicId: 3 };

  assert.equal(
    await useCases.getClinicScopedStudyTrackingCase(7, 3),
    trackingCase,
  );
  assert.equal(await useCases.listStudyTrackingCases(caseParams), caseListResult);
  assert.equal(
    await useCases.listStudyTrackingNotifications(notificationParams),
    notificationListResult,
  );
  assert.deepEqual(calls, [
    ["get", 7, 3],
    ["list-cases", caseParams],
    ["list-notifications", notificationParams],
  ]);
});

test("admin query use cases preservan scope opcional y null por identidad", async () => {
  const calls: Array<readonly unknown[]> = [];
  const listResult: Array<{ id: number }> = [];
  const useCases = createAdminStudyTrackingQueryUseCases({
    getClinicScopedStudyTrackingCase: async (id: number, clinicId: number) => {
      calls.push(["scoped", id, clinicId]);
      return undefined;
    },
    getStudyTrackingCaseById: async (id: number) => {
      calls.push(["global", id]);
      return null;
    },
    listStudyTrackingCases: async (params: { clinicId?: number }) => {
      calls.push(["cases", params]);
      return listResult;
    },
    listStudyTrackingNotifications: async (params: { clinicId?: number }) => {
      calls.push(["notifications", params]);
      return [];
    },
  });
  const params = { clinicId: undefined };

  assert.equal(await useCases.getClinicScopedStudyTrackingCase(5, 9), undefined);
  assert.equal(await useCases.getStudyTrackingCaseById(5), null);
  assert.equal(await useCases.listStudyTrackingCases(params), listResult);
  assert.deepEqual(await useCases.listStudyTrackingNotifications(params), []);
  assert.deepEqual(calls, [
    ["scoped", 5, 9],
    ["global", 5],
    ["cases", params],
    ["notifications", params],
  ]);
});

test("particular query use cases conservan token scope y propagan el error original", async () => {
  const expected = new Error("query failed");
  const params = { particularTokenId: 13 };
  const useCases = createParticularStudyTrackingQueryUseCases({
    getParticularStudyTrackingCase: async (particularTokenId: number) => ({
      particularTokenId,
    }),
    listStudyTrackingNotifications: async (
      received: { particularTokenId: number },
    ) => {
      assert.equal(received, params);
      throw expected;
    },
  });

  assert.deepEqual(await useCases.getParticularStudyTrackingCase(13), {
    particularTokenId: 13,
  });
  await assert.rejects(
    useCases.listStudyTrackingNotifications(params),
    (error) => error === expected,
  );
});
