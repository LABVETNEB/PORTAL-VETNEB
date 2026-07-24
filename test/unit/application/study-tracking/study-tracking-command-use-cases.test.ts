import assert from "node:assert/strict";
import test from "node:test";

import {
  createAdminStudyTrackingCommandUseCases,
  createClinicStudyTrackingCommandUseCases,
  createParticularStudyTrackingCommandUseCases,
} from "../../../../server/features/study-tracking/application/index.ts";

test("clinic command use cases delegan exactamente una vez por operación", async () => {
  const trackingCase = { id: 17 };
  const notification = { id: 23 };
  const readAllResult = { updatedCount: 2 };
  const calls: Array<readonly unknown[]> = [];
  const useCases = createClinicStudyTrackingCommandUseCases({
    createStudyTrackingCase: async (input: { clinicId: number }) => {
      calls.push(["create-case", input]);
      return trackingCase;
    },
    updateStudyTrackingCase: async (id: number, input: { notes: string }) => {
      calls.push(["update-case", id, input]);
      return trackingCase;
    },
    createStudyTrackingNotification: async (input: { type: string }) => {
      calls.push(["create-notification", input]);
      return notification;
    },
    markStudyTrackingNotificationReadScoped: async (
      params: { id: number; clinicId: number },
    ) => {
      calls.push(["mark-read", params]);
      return notification;
    },
    markAllStudyTrackingNotificationsReadScoped: async (
      params: { clinicId: number },
    ) => {
      calls.push(["mark-all", params]);
      return readAllResult;
    },
  });
  const createInput = { clinicId: 3 };
  const updateInput = { notes: "sin cambios" };
  const notificationInput = { type: "stage_changed" };
  const markParams = { id: 23, clinicId: 3 };
  const markAllParams = { clinicId: 3 };

  assert.equal(await useCases.createStudyTrackingCase(createInput), trackingCase);
  assert.equal(
    await useCases.updateStudyTrackingCase(17, updateInput),
    trackingCase,
  );
  assert.equal(
    await useCases.createStudyTrackingNotification(notificationInput),
    notification,
  );
  assert.equal(
    await useCases.markStudyTrackingNotificationReadScoped(markParams),
    notification,
  );
  assert.equal(
    await useCases.markAllStudyTrackingNotificationsReadScoped(markAllParams),
    readAllResult,
  );
  assert.deepEqual(calls, [
    ["create-case", createInput],
    ["update-case", 17, updateInput],
    ["create-notification", notificationInput],
    ["mark-read", markParams],
    ["mark-all", markAllParams],
  ]);
});

test("admin command use cases preservan undefined, null y el resultado por identidad", async () => {
  const notification = { id: 29 };
  const readAllResult = { updatedCount: 0 };
  const calls: Array<readonly unknown[]> = [];
  const useCases = createAdminStudyTrackingCommandUseCases({
    createStudyTrackingCase: async (input: { clinicId: number }) => {
      calls.push(["create", input]);
      return { id: 31 };
    },
    updateStudyTrackingCase: async (id: number, input: { notes?: string }) => {
      calls.push(["update", id, input]);
      return null;
    },
    createStudyTrackingNotification: async (input: { type: string }) => {
      calls.push(["notification", input]);
      return notification;
    },
    markStudyTrackingNotificationRead: async (id: number) => {
      calls.push(["mark", id]);
      return undefined;
    },
    markAllStudyTrackingNotificationsRead: async (
      params?: { clinicId?: number },
    ) => {
      calls.push(["mark-all", params]);
      return readAllResult;
    },
  });

  assert.deepEqual(
    await useCases.createStudyTrackingCase({ clinicId: 5 }),
    { id: 31 },
  );
  assert.equal(await useCases.updateStudyTrackingCase(31, {}), null);
  assert.equal(
    await useCases.createStudyTrackingNotification({ type: "update" }),
    notification,
  );
  assert.equal(await useCases.markStudyTrackingNotificationRead(29), undefined);
  assert.equal(
    await useCases.markAllStudyTrackingNotificationsRead(),
    readAllResult,
  );
  assert.deepEqual(calls, [
    ["create", { clinicId: 5 }],
    ["update", 31, {}],
    ["notification", { type: "update" }],
    ["mark", 29],
    ["mark-all", undefined],
  ]);
});

test("particular command use cases conservan scope y propagan errores sin envolver", async () => {
  const expected = new Error("write failed");
  const markParams = { id: 41, particularTokenId: 13 };
  const markAllParams = { particularTokenId: 13 };
  const useCases = createParticularStudyTrackingCommandUseCases({
    markStudyTrackingNotificationReadScoped: async (
      params: { id: number; particularTokenId: number },
    ) => {
      assert.equal(params, markParams);
      return { id: params.id };
    },
    markAllStudyTrackingNotificationsReadScoped: async (
      params: { particularTokenId: number },
    ) => {
      assert.equal(params, markAllParams);
      throw expected;
    },
  });

  assert.deepEqual(
    await useCases.markStudyTrackingNotificationReadScoped(markParams),
    { id: 41 },
  );
  await assert.rejects(
    useCases.markAllStudyTrackingNotificationsReadScoped(markAllParams),
    (error) => error === expected,
  );
});
