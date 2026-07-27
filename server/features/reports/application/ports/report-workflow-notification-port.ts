export type CreateReportWorkflowNotificationInput = {
  studyTrackingCaseId: number;
  clinicId: number;
  reportId: number;
  particularTokenId: number | null;
  type: string;
  title: string;
  message: string;
  isRead: false;
  readAt: null;
  createdAt: Date;
};

export type ReportWorkflowNotificationPort = {
  createNotification: (
    input: CreateReportWorkflowNotificationInput,
  ) => Promise<number | null>;
};
