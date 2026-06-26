import { ROUTES } from "./routes";

export type NotificationDestinationSurface = "admin" | "clinic" | "particular";

export type NotificationDestinationInput = {
  studyTrackingCaseId?: number | null;
  reportId?: number | null;
  particularTokenId?: number | null;
  type: string;
};

const TRACKING_NOTIFICATION_TYPES = new Set([
  "stage_changed",
  "special_stain_required",
  "special_stain_resolved",
  "report_delivered",
  "study_tracking_case_created",
  "study_tracking_case_updated",
]);

function getNotificationType(notification: NotificationDestinationInput): string {
  return notification.type.trim().toLowerCase();
}

function isReportNotification(notification: NotificationDestinationInput): boolean {
  return getNotificationType(notification).includes("report");
}

function isTrackingNotification(notification: NotificationDestinationInput): boolean {
  return (
    TRACKING_NOTIFICATION_TYPES.has(getNotificationType(notification)) ||
    Boolean(notification.studyTrackingCaseId)
  );
}

export function buildNotificationDestination(
  surface: NotificationDestinationSurface,
  notification: NotificationDestinationInput,
): string {
  switch (surface) {
    case "admin":
      if (isTrackingNotification(notification) || notification.reportId) {
        return `${ROUTES.dashboardAdmin}?module=admin-report-upload${
          notification.reportId ? `#report-${notification.reportId}` : ""
        }`;
      }

      if (notification.particularTokenId) {
        return `${ROUTES.dashboardAdmin}?module=admin-particular-tokens#admin-particular-token-${notification.particularTokenId}`;
      }

      if (isReportNotification(notification)) {
        return `${ROUTES.dashboardAdmin}?module=admin-report-upload`;
      }

      return `${ROUTES.dashboardAdmin}?module=audit-log`;

    case "clinic":
      if (notification.reportId) {
        return `${ROUTES.dashboardInformes}#report-${notification.reportId}`;
      }

      if (notification.particularTokenId) {
        return `${ROUTES.dashboard}#clinic-particular-token-${notification.particularTokenId}`;
      }

      if (isTrackingNotification(notification) || isReportNotification(notification)) {
        return ROUTES.dashboardInformes;
      }

      return ROUTES.dashboard;

    case "particular":
      if (notification.reportId) {
        return `${ROUTES.particulares}#particular-report`;
      }

      if (notification.particularTokenId || notification.studyTrackingCaseId) {
        return `${ROUTES.particulares}#particular-study-tracking`;
      }

      return ROUTES.particulares;
  }
}
