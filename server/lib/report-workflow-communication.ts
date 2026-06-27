import { eq } from "drizzle-orm";

import { db } from "../db.ts";
import {
  studyTrackingCases,
  studyTrackingNotifications,
} from "../../drizzle/schema.ts";

export type ReportWorkflowCommunicationResult = {
  notificationCreated: boolean;
  notificationId: number | null;
  warning: string | null;
};

export async function createReportWorkflowNotification(input: {
  reportId: number;
  type: string;
  title: string;
  message: string;
}): Promise<ReportWorkflowCommunicationResult> {
  const trackingCases = await db
    .select()
    .from(studyTrackingCases)
    .where(eq(studyTrackingCases.reportId, input.reportId))
    .limit(1);
  const trackingCase = trackingCases[0];

  if (!trackingCase) {
    return {
      notificationCreated: false,
      notificationId: null,
      warning: "No existe seguimiento vinculado al informe; no se creó notificación interna.",
    };
  }

  const notifications = await db
    .insert(studyTrackingNotifications)
    .values({
      studyTrackingCaseId: trackingCase.id,
      clinicId: trackingCase.clinicId,
      reportId: trackingCase.reportId ?? input.reportId,
      particularTokenId: trackingCase.particularTokenId ?? null,
      type: input.type,
      title: input.title,
      message: input.message,
      isRead: false,
      readAt: null,
      createdAt: new Date(),
    })
    .returning({ id: studyTrackingNotifications.id });

  return {
    notificationCreated: true,
    notificationId: notifications[0]?.id ?? null,
    warning: null,
  };
}
