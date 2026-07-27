export type ReportQueryStatus =
  | "uploaded"
  | "processing"
  | "ready"
  | "delivered";

export type ReportQueryRecord = {
  id: number;
  clinicId: number;
  clinicName?: string | null;
  patientName: string | null;
  studyType: string | null;
  currentStatus: ReportQueryStatus;
  uploadDate: Date | null;
  fileName: string | null;
  storagePath: string;
  createdAt: Date;
  updatedAt: Date;
  statusChangedAt: Date;
};

export type ReportSearchFilters = {
  query?: string;
  studyType?: string;
  currentStatus?: ReportQueryStatus;
};

export type ReportQueryRepository = {
  findClinicScopedReportById: (
    reportId: number,
    clinicId: number,
  ) => Promise<ReportQueryRecord | null | undefined>;
  listReportsByClinicId: (
    clinicId: number,
    limit: number,
    offset: number,
    currentStatus?: ReportQueryStatus,
  ) => Promise<ReportQueryRecord[]>;
  countReportsByClinicId: (
    clinicId: number,
    currentStatus?: ReportQueryStatus,
  ) => Promise<number>;
  searchReports: (
    clinicId: number,
    filters: ReportSearchFilters,
    limit: number,
    offset: number,
  ) => Promise<ReportQueryRecord[]>;
  countSearchReports: (
    clinicId: number,
    filters: ReportSearchFilters,
  ) => Promise<number>;
  getReportStatusHistory: (
    reportId: number,
  ) => Promise<unknown[]>;
  getStudyTypes: (clinicId: number) => Promise<string[]>;
};
