import { canTransitionReportStatus } from "../domain/index.ts";
import type {
  CreateOrEditReportInput,
  PersistReportStatusTransitionInput,
  ReportCommandRecord,
  ReportCommandRepository,
  ReportCommandStatus,
} from "./ports/index.ts";

export type TransitionReportStatusInput = Omit<
  PersistReportStatusTransitionInput,
  "expectedFromStatus"
>;

export type TransitionReportStatusResult<
  TReport extends ReportCommandRecord = ReportCommandRecord,
> =
  | { type: "not_found"; reportId: number }
  | {
      type: "same_status";
      currentStatus: ReportCommandStatus;
      requestedStatus: ReportCommandStatus;
    }
  | {
      type: "transition_not_allowed";
      currentStatus: ReportCommandStatus;
      requestedStatus: ReportCommandStatus;
    }
  | { type: "concurrent_not_found"; reportId: number }
  | { type: "persisted"; report: TReport };

export async function findClinicScopedReportById<
  TReport extends ReportCommandRecord & { clinicId: number },
>(
  repository: Pick<ReportCommandRepository<TReport>, "findReportById">,
  reportId: number,
  clinicId: number,
): Promise<TReport | null> {
  const report = await repository.findReportById(reportId);
  return report?.clinicId === clinicId ? report : null;
}

export function createReportCommandUseCases<
  TReport extends ReportCommandRecord,
>(repository: ReportCommandRepository<TReport>) {
  return {
    findReportById(reportId: number): Promise<TReport | null | undefined> {
      return repository.findReportById(reportId);
    },

    createOrEditReport(input: CreateOrEditReportInput): Promise<TReport> {
      return repository.createOrEditReport(input);
    },

    async transitionReportStatus(
      input: TransitionReportStatusInput,
    ): Promise<TransitionReportStatusResult<TReport>> {
      const report = await repository.findReportById(input.reportId);

      if (!report) {
        return { type: "not_found", reportId: input.reportId };
      }

      if (report.currentStatus === input.toStatus) {
        return {
          type: "same_status",
          currentStatus: report.currentStatus,
          requestedStatus: input.toStatus,
        };
      }

      if (!canTransitionReportStatus(report.currentStatus, input.toStatus)) {
        return {
          type: "transition_not_allowed",
          currentStatus: report.currentStatus,
          requestedStatus: input.toStatus,
        };
      }

      const updated =
        await repository.persistReportStatusTransition({
          ...input,
          expectedFromStatus: report.currentStatus,
        });

      if (!updated) {
        return { type: "concurrent_not_found", reportId: input.reportId };
      }

      return { type: "persisted", report: updated };
    },
  };
}
