import type {
  ReportWorkflowDataPort,
  ReportWorkflowNotificationPort,
} from "./ports/index.ts";

export type ReportWorkflowCommunicationInput = {
  reportId: number;
  type: string;
  title: string;
  message: string;
};

export type ReportWorkflowCommunicationResult = {
  notificationCreated: boolean;
  notificationId: number | null;
  warning: string | null;
};

export function createReportWorkflowCommunication(dependencies: {
  data: ReportWorkflowDataPort;
  notification: ReportWorkflowNotificationPort;
  now: () => Date;
}) {
  return async function createReportWorkflowNotification(
    input: ReportWorkflowCommunicationInput,
  ): Promise<ReportWorkflowCommunicationResult> {
    const trackingContext =
      await dependencies.data.findTrackingContextByReportId(input.reportId);

    if (!trackingContext) {
      return {
        notificationCreated: false,
        notificationId: null,
        warning:
          "No existe seguimiento vinculado al informe; no se creó notificación interna.",
      };
    }

    const notificationId = await dependencies.notification.createNotification({
      studyTrackingCaseId: trackingContext.studyTrackingCaseId,
      clinicId: trackingContext.clinicId,
      reportId: trackingContext.reportId ?? input.reportId,
      particularTokenId: trackingContext.particularTokenId ?? null,
      type: input.type,
      title: input.title,
      message: input.message,
      isRead: false,
      readAt: null,
      createdAt: dependencies.now(),
    });

    return {
      notificationCreated: true,
      notificationId,
      warning: null,
    };
  };
}
