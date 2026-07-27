import {
  createReportCommandUseCases,
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

export function createOrEditReport(input: CreateOrEditReportInput) {
  return createRuntimeReportCommandUseCases().createOrEditReport(input);
}

export function transitionReportStatus(
  input: TransitionReportStatusInput,
) {
  return createRuntimeReportCommandUseCases().transitionReportStatus(input);
}

export async function updateReportStatus(
  input: TransitionReportStatusInput,
) {
  const result = await transitionReportStatus(input);
  return result.type === "persisted" ? result.report : undefined;
}
