import {
  createReportCommandUseCases,
  findClinicScopedReportById as findClinicScopedReportByIdUseCase,
  type CreateOrEditReportInput,
  type TransitionReportStatusInput,
} from "../application/index.ts";
import { createReportCommandRepository } from "../infrastructure/index.ts";

function createRuntimeReportCommandUseCases() {
  return createReportCommandUseCases(
    createReportCommandRepository({
      now: () => new Date(),
    }),
  );
}

export async function getReportById(reportId: number) {
  return (await createRuntimeReportCommandUseCases().findReportById(reportId)) ??
    null;
}

export function getClinicScopedReportById(
  reportId: number,
  clinicId: number,
) {
  return findClinicScopedReportByIdUseCase(
    createReportCommandRepository({
      now: () => new Date(),
    }),
    reportId,
    clinicId,
  );
}

export function createOrEditReport(input: CreateOrEditReportInput) {
  return createRuntimeReportCommandUseCases().createOrEditReport(input);
}

export function transitionReportStatus(
  input: TransitionReportStatusInput,
) {
  return createRuntimeReportCommandUseCases().transitionReportStatus(input);
}
