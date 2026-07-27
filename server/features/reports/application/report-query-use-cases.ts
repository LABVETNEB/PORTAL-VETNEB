import { serializeSafeReport } from "../domain/index.ts";
import type {
  ReportQueryRecord,
  ReportQueryRepository,
  ReportSearchFilters,
  ReportQueryStatus,
} from "./ports/index.ts";
import type {
  TransitionReportStatusInput,
  TransitionReportStatusResult,
} from "./report-command-use-cases.ts";

type ClinicScopedResult =
  | { type: "not_found"; reportId: number }
  | { type: "found"; report: ReportQueryRecord };

type SignedPreviewResult =
  | { type: "not_found"; reportId: number }
  | { type: "found"; previewUrl: string };

type SignedDownloadResult =
  | { type: "not_found"; reportId: number }
  | { type: "found"; downloadUrl: string };

export function createReportQueryUseCases(dependencies: {
  repository: ReportQueryRepository;
  createSignedReportUrl: (storagePath: string) => Promise<string>;
  createSignedReportDownloadUrl: (
    storagePath: string,
    fileName?: string,
  ) => Promise<string>;
  transitionReportStatus: (
    input: TransitionReportStatusInput,
    clinicScopedReport: ReportQueryRecord,
  ) => Promise<TransitionReportStatusResult<ReportQueryRecord>>;
}) {
  async function findClinicScopedReport(
    reportId: number,
    clinicId: number,
  ): Promise<ClinicScopedResult> {
    const report = await dependencies.repository.findClinicScopedReportById(
      reportId,
      clinicId,
    );

    return report
      ? { type: "found", report }
      : { type: "not_found", reportId };
  }

  async function listClinicReports(input: {
    clinicId: number;
    limit: number;
    offset: number;
    currentStatus?: ReportQueryStatus;
  }) {
    const [reports, total] = await Promise.all([
      dependencies.repository.listReportsByClinicId(
        input.clinicId,
        input.limit,
        input.offset,
        input.currentStatus,
      ),
      dependencies.repository.countReportsByClinicId(
        input.clinicId,
        input.currentStatus,
      ),
    ]);

    return {
      count: reports.length,
      total,
      totalPages: input.limit > 0 ? Math.ceil(total / input.limit) : 0,
      reports: reports.map((report) => serializeSafeReport(report)),
      filters: {
        status: input.currentStatus ?? null,
      },
      pagination: {
        limit: input.limit,
        offset: input.offset,
      },
    };
  }

  async function searchClinicReports(input: {
    clinicId: number;
    query?: string;
    studyType?: string;
    currentStatus?: ReportQueryStatus;
    limit: number;
    offset: number;
  }) {
    const filters: ReportSearchFilters = {
      query: input.query,
      studyType: input.studyType,
      currentStatus: input.currentStatus,
    };
    const [reports, total] = await Promise.all([
      dependencies.repository.searchReports(
        input.clinicId,
        filters,
        input.limit,
        input.offset,
      ),
      dependencies.repository.countSearchReports(input.clinicId, filters),
    ]);

    return {
      count: reports.length,
      total,
      totalPages: input.limit > 0 ? Math.ceil(total / input.limit) : 0,
      reports: reports.map((report) => serializeSafeReport(report)),
      filters: {
        query: input.query ?? null,
        studyType: input.studyType ?? null,
        status: input.currentStatus ?? null,
      },
      pagination: {
        limit: input.limit,
        offset: input.offset,
      },
    };
  }

  async function getClinicReportHistory(
    reportId: number,
    clinicId: number,
  ) {
    const scoped = await findClinicScopedReport(reportId, clinicId);

    if (scoped.type === "not_found") {
      return scoped;
    }

    const history =
      await dependencies.repository.getReportStatusHistory(reportId);

    return {
      type: "found" as const,
      reportId,
      currentStatus: scoped.report.currentStatus,
      count: history.length,
      history,
    };
  }

  async function getClinicReportPreview(
    reportId: number,
    clinicId: number,
  ): Promise<SignedPreviewResult> {
    const scoped = await findClinicScopedReport(reportId, clinicId);

    if (scoped.type === "not_found") {
      return scoped;
    }

    return {
      type: "found",
      previewUrl: await dependencies.createSignedReportUrl(
        scoped.report.storagePath,
      ),
    };
  }

  async function getClinicReportDownload(
    reportId: number,
    clinicId: number,
  ): Promise<SignedDownloadResult> {
    const scoped = await findClinicScopedReport(reportId, clinicId);

    if (scoped.type === "not_found") {
      return scoped;
    }

    return {
      type: "found",
      downloadUrl: await dependencies.createSignedReportDownloadUrl(
        scoped.report.storagePath,
        scoped.report.fileName ?? undefined,
      ),
    };
  }

  async function transitionClinicReportStatus(input: {
    clinicId: number;
    reportId: number;
    toStatus: ReportQueryStatus;
    note: string | null;
    changedByClinicUserId?: number | null;
    changedByAdminUserId?: number | null;
  }) {
    const scoped = await findClinicScopedReport(
      input.reportId,
      input.clinicId,
    );

    if (scoped.type === "not_found") {
      return scoped;
    }

    const result = await dependencies.transitionReportStatus(
      {
        reportId: input.reportId,
        toStatus: input.toStatus,
        note: input.note,
        changedByClinicUserId: input.changedByClinicUserId,
        changedByAdminUserId: input.changedByAdminUserId,
      },
      scoped.report,
    );

    return result.type === "persisted"
      ? {
          type: result.type,
          report: serializeSafeReport(result.report),
          previousStatus: scoped.report.currentStatus,
        }
      : {
          ...result,
          previousStatus: scoped.report.currentStatus,
        };
  }

  return {
    listClinicReports,
    searchClinicReports,
    getStudyTypes: dependencies.repository.getStudyTypes,
    findClinicScopedReport,
    getClinicReportHistory,
    getClinicReportPreview,
    getClinicReportDownload,
    transitionClinicReportStatus,
  };
}
