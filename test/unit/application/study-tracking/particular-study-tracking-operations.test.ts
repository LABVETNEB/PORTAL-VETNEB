import assert from "node:assert/strict";
import test from "node:test";

import { createParticularStudyTrackingOperations } from "../../../../server/features/study-tracking/application/index.ts";

test("particular operations derivan todo el scope del token autenticado", async () => {
  const trackingCase = { id: 7 };
  const notification = { id: 11 };
  const notifications = [notification];
  const readAllResult = { updatedCount: 2 };
  const calls: Array<readonly unknown[]> = [];
  const operations = createParticularStudyTrackingOperations({
    queryRepository: {
      getParticularStudyTrackingCase: async (particularTokenId: number) => {
        calls.push(["get-case", particularTokenId]);
        return trackingCase;
      },
      listStudyTrackingNotifications: async (params: {
        particularTokenId: number;
        unreadOnly: boolean;
        limit: number;
        offset: number;
      }) => {
        calls.push(["list-notifications", params]);
        return notifications;
      },
    },
    commandRepository: {
      markStudyTrackingNotificationReadScoped: async (params: {
        id: number;
        particularTokenId: number;
      }) => {
        calls.push(["mark-read", params]);
        return notification;
      },
      markAllStudyTrackingNotificationsReadScoped: async (params: {
        particularTokenId: number;
      }) => {
        calls.push(["mark-all", params]);
        return readAllResult;
      },
    },
  });
  const listInput = {
    particularTokenId: 13,
    unreadOnly: true,
    limit: 25,
    offset: 5,
  };
  const markInput = {
    particularTokenId: 13,
    notificationId: 11,
  };

  assert.equal(
    await operations.getParticularStudyTrackingForToken(13),
    trackingCase,
  );
  assert.equal(
    await operations.listParticularStudyTrackingNotifications(listInput),
    notifications,
  );
  assert.equal(
    await operations.acknowledgeParticularStudyTrackingNotification(markInput),
    notification,
  );
  assert.equal(
    await operations.acknowledgeAllParticularStudyTrackingNotifications(13),
    readAllResult,
  );
  assert.deepEqual(listInput, {
    particularTokenId: 13,
    unreadOnly: true,
    limit: 25,
    offset: 5,
  });
  assert.deepEqual(markInput, {
    particularTokenId: 13,
    notificationId: 11,
  });
  assert.deepEqual(calls, [
    ["get-case", 13],
    ["list-notifications", listInput],
    ["mark-read", { id: 11, particularTokenId: 13 }],
    ["mark-all", { particularTokenId: 13 }],
  ]);
});

test("particular operations preservan null, undefined, vacíos y el error original", async () => {
  const expected = new Error("particular repository failed");
  const emptyNotifications: Array<{ id: number }> = [];
  const operations = createParticularStudyTrackingOperations({
    queryRepository: {
      getParticularStudyTrackingCase: async () => null,
      listStudyTrackingNotifications: async () => emptyNotifications,
    },
    commandRepository: {
      markStudyTrackingNotificationReadScoped: async () => undefined,
      markAllStudyTrackingNotificationsReadScoped: async () => {
        throw expected;
      },
    },
  });

  assert.equal(
    await operations.getParticularStudyTrackingForToken(17),
    null,
  );
  assert.equal(
    await operations.listParticularStudyTrackingNotifications({
      particularTokenId: 17,
      unreadOnly: false,
      limit: 50,
      offset: 0,
    }),
    emptyNotifications,
  );
  assert.equal(
    await operations.acknowledgeParticularStudyTrackingNotification({
      particularTokenId: 17,
      notificationId: 19,
    }),
    undefined,
  );
  await assert.rejects(
    operations.acknowledgeAllParticularStudyTrackingNotifications(17),
    (error) => error === expected,
  );
});
