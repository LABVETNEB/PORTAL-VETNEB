export type ReportWorkflowTrackingContext = {
  studyTrackingCaseId: number;
  clinicId: number;
  reportId: number | null;
  particularTokenId: number | null;
};

export type ReportWorkflowDataPort = {
  findTrackingContextByReportId: (
    reportId: number,
  ) => Promise<ReportWorkflowTrackingContext | null>;
};
