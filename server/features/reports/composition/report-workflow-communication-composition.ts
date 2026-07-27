import {
  createReportWorkflowCommunication,
  type ReportWorkflowCommunicationInput,
  type ReportWorkflowCommunicationResult,
} from "../application/index.ts";
import {
  createReportWorkflowDataAdapter,
  createReportWorkflowNotificationAdapter,
} from "../infrastructure/index.ts";

const createReportWorkflowNotificationOperation =
  createReportWorkflowCommunication({
    data: createReportWorkflowDataAdapter(),
    notification: createReportWorkflowNotificationAdapter(),
    now: () => new Date(),
  });

export function createReportWorkflowNotification(
  input: ReportWorkflowCommunicationInput,
): Promise<ReportWorkflowCommunicationResult> {
  return createReportWorkflowNotificationOperation(input);
}

export type {
  ReportWorkflowCommunicationInput,
  ReportWorkflowCommunicationResult,
};
