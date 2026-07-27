import assert from "node:assert/strict";
import test from "node:test";

import {
  createReportWorkflowCommunication,
  type CreateReportWorkflowNotificationInput,
  type ReportWorkflowDataPort,
  type ReportWorkflowNotificationPort,
} from "../../../../server/features/reports/application/index.ts";

const NOW = new Date("2026-07-27T12:34:56.000Z");

function createPorts(input: {
  context?: Awaited<
    ReturnType<ReportWorkflowDataPort["findTrackingContextByReportId"]>
  >;
  notificationId?: number | null;
}) {
  const dataCalls: number[] = [];
  const notificationCalls: CreateReportWorkflowNotificationInput[] = [];
  const data: ReportWorkflowDataPort = {
    async findTrackingContextByReportId(reportId) {
      dataCalls.push(reportId);
      return input.context ?? null;
    },
  };
  const notification: ReportWorkflowNotificationPort = {
    async createNotification(notificationInput) {
      notificationCalls.push(notificationInput);
      return input.notificationId ?? null;
    },
  };

  return { data, notification, dataCalls, notificationCalls };
}

test("sin tracking context omite notification y devuelve el warning exacto", async () => {
  const ports = createPorts({ context: null });
  const operation = createReportWorkflowCommunication({
    data: ports.data,
    notification: ports.notification,
    now: () => NOW,
  });

  const result = await operation({
    reportId: 41,
    type: "stage_changed",
    title: "Estado",
    message: "Mensaje",
  });

  assert.deepEqual(ports.dataCalls, [41]);
  assert.deepEqual(ports.notificationCalls, []);
  assert.deepEqual(result, {
    notificationCreated: false,
    notificationId: null,
    warning:
      "No existe seguimiento vinculado al informe; no se creó notificación interna.",
  });
});

test("mapea el tracking context completo y usa fallback al reportId de entrada", async () => {
  const ports = createPorts({
    context: {
      studyTrackingCaseId: 12,
      clinicId: 23,
      reportId: null,
      particularTokenId: null,
    },
    notificationId: 99,
  });
  const operation = createReportWorkflowCommunication({
    data: ports.data,
    notification: ports.notification,
    now: () => NOW,
  });

  const result = await operation({
    reportId: 41,
    type: "stage_changed",
    title: "Estado actualizado",
    message: "El informe cambió.",
  });

  assert.deepEqual(ports.dataCalls, [41]);
  assert.deepEqual(ports.notificationCalls, [
    {
      studyTrackingCaseId: 12,
      clinicId: 23,
      reportId: 41,
      particularTokenId: null,
      type: "stage_changed",
      title: "Estado actualizado",
      message: "El informe cambió.",
      isRead: false,
      readAt: null,
      createdAt: NOW,
    },
  ]);
  assert.deepEqual(result, {
    notificationCreated: true,
    notificationId: 99,
    warning: null,
  });
});

test("prefiere el reportId propio del tracking context", async () => {
  const ports = createPorts({
    context: {
      studyTrackingCaseId: 12,
      clinicId: 23,
      reportId: 77,
      particularTokenId: 88,
    },
    notificationId: 99,
  });
  const operation = createReportWorkflowCommunication({
    data: ports.data,
    notification: ports.notification,
    now: () => NOW,
  });

  await operation({
    reportId: 41,
    type: "stage_changed",
    title: "Estado",
    message: "Mensaje",
  });

  assert.equal(ports.notificationCalls[0]?.reportId, 77);
  assert.equal(ports.notificationCalls[0]?.particularTokenId, 88);
});

test("notification port null mantiene notificationCreated true", async () => {
  const ports = createPorts({
    context: {
      studyTrackingCaseId: 12,
      clinicId: 23,
      reportId: 41,
      particularTokenId: null,
    },
    notificationId: null,
  });
  const operation = createReportWorkflowCommunication({
    data: ports.data,
    notification: ports.notification,
    now: () => NOW,
  });

  const result = await operation({
    reportId: 41,
    type: "stage_changed",
    title: "Estado",
    message: "Mensaje",
  });

  assert.deepEqual(result, {
    notificationCreated: true,
    notificationId: null,
    warning: null,
  });
});

test("propaga el error del data port", async () => {
  const expected = new Error("data failed");
  const operation = createReportWorkflowCommunication({
    data: {
      findTrackingContextByReportId: async () => {
        throw expected;
      },
    },
    notification: {
      createNotification: async () => 1,
    },
    now: () => NOW,
  });

  await assert.rejects(
    operation({
      reportId: 41,
      type: "stage_changed",
      title: "Estado",
      message: "Mensaje",
    }),
    (error) => error === expected,
  );
});

test("propaga el error del notification port", async () => {
  const expected = new Error("notification failed");
  const operation = createReportWorkflowCommunication({
    data: {
      findTrackingContextByReportId: async () => ({
        studyTrackingCaseId: 12,
        clinicId: 23,
        reportId: 41,
        particularTokenId: null,
      }),
    },
    notification: {
      createNotification: async () => {
        throw expected;
      },
    },
    now: () => NOW,
  });

  await assert.rejects(
    operation({
      reportId: 41,
      type: "stage_changed",
      title: "Estado",
      message: "Mensaje",
    }),
    (error) => error === expected,
  );
});
