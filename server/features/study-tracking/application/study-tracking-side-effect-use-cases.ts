import type { StudyTrackingAuditPort } from "./ports/study-tracking-audit-port.ts";
import type { StudyTrackingNotificationPort } from "./ports/study-tracking-notification-port.ts";

export function createStudyTrackingSideEffectUseCases<
  TNotificationInput,
  TNotificationResult,
  TAuditRequest,
  TAuditInput,
>(ports: {
  notification: StudyTrackingNotificationPort<
    TNotificationInput,
    TNotificationResult
  >;
  audit: StudyTrackingAuditPort<TAuditRequest, TAuditInput>;
}) {
  return {
    sendSpecialStainRequiredEmail: (input: TNotificationInput) =>
      ports.notification.sendSpecialStainRequiredEmail(input),
    writeAuditLog: (request: TAuditRequest, input: TAuditInput) =>
      ports.audit.writeAuditLog(request, input),
  };
}
