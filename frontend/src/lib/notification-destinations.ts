import { ROUTES } from "./routes";

export type NotificationDestinationSurface = "admin" | "clinic" | "particular";

export type NotificationDestinationInput = {
  studyTrackingCaseId?: number | null;
  reportId?: number | null;
  particularTokenId?: number | null;
  type: string;
};

function isReportNotification(notification: NotificationDestinationInput): boolean {
  return notification.type.toLowerCase().includes("report");
}

export function buildNotificationDestination(
  surface: NotificationDestinationSurface,
  notification: NotificationDestinationInput,
): string {
  switch (surface) {
    case "admin":
      if (
        notification.reportId ||
        notification.particularTokenId ||
        isReportNotification(notification)
      ) {
        return `${ROUTES.dashboardAdmin}?module=admin-particular-tokens`;
      }

      return `${ROUTES.dashboardAdmin}?module=audit-log`;

    case "clinic":
      if (notification.reportId) {
        return `${ROUTES.dashboardInformes}#report-${notification.reportId}`;
      }

      if (notification.particularTokenId) {
        return `${ROUTES.dashboard}#clinic-particular-token-${notification.particularTokenId}`;
      }

      if (isReportNotification(notification)) {
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
