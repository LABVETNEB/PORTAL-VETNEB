import { db } from "../../../db.ts";
import { studyTrackingNotifications } from "../../../../drizzle/schema.ts";
import type { ReportWorkflowNotificationPort } from "../application/ports/index.ts";

export function createReportWorkflowNotificationAdapter(): ReportWorkflowNotificationPort {
  return {
    async createNotification(input) {
      const notifications = await db
        .insert(studyTrackingNotifications)
        .values({
          studyTrackingCaseId: input.studyTrackingCaseId,
          clinicId: input.clinicId,
          reportId: input.reportId,
          particularTokenId: input.particularTokenId,
          type: input.type,
          title: input.title,
          message: input.message,
          isRead: input.isRead,
          readAt: input.readAt,
          createdAt: input.createdAt,
        })
        .returning({ id: studyTrackingNotifications.id });

      return notifications[0]?.id ?? null;
    },
  };
}
