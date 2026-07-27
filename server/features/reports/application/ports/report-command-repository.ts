export type ReportCommandStatus =
  | "uploaded"
  | "processing"
  | "ready"
  | "delivered";

export type ReportCommandRecord = {
  id: number;
  currentStatus: ReportCommandStatus;
};

export type CreateOrEditReportInput = {
  clinicId: number;
  uploadDate?: Date | null;
  studyType?: string | null;
  patientName?: string | null;
  fileName?: string | null;
  storagePath: string;
  createdByClinicUserId?: number | null;
  createdByAdminUserId?: number | null;
};

export type PersistReportStatusTransitionInput = {
  reportId: number;
  expectedFromStatus: ReportCommandStatus;
  toStatus: ReportCommandStatus;
  note?: string | null;
  changedByClinicUserId?: number | null;
  changedByAdminUserId?: number | null;
};

export type ReportCommandRepository<
  TReport extends ReportCommandRecord = ReportCommandRecord,
> = {
  findReportById: (reportId: number) => Promise<TReport | null | undefined>;
  createOrEditReport: (input: CreateOrEditReportInput) => Promise<TReport>;
  persistReportStatusTransition: (
    input: PersistReportStatusTransitionInput,
  ) => Promise<TReport | null | undefined>;
};
