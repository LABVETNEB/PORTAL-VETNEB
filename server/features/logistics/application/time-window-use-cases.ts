import type { LogisticsTimeWindowsRepository } from "./ports/logistics-time-windows-repository.ts";

export type TimeWindowUseCases<TTimeWindow, TCreateInput> = {
  listTimeWindows: (
    fieldVisitId: number,
    clinicId: number,
  ) => Promise<TTimeWindow[]>;
  createTimeWindow: (
    input: TCreateInput,
  ) => Promise<TTimeWindow | null | undefined>;
};

// Casos de uso M15 de ventanas horarias: listado y creación clinic-scoped con
// inputs ya autenticados y validados por la ruta. Cada operación delega
// exactamente una vez y preserva el resultado (incluido null/undefined) y los
// errores del puerto sin transformarlos; el 404 permanece en la ruta.
export function createTimeWindowUseCases<TTimeWindow, TCreateInput>(
  repository: LogisticsTimeWindowsRepository<TTimeWindow, TCreateInput>,
): TimeWindowUseCases<TTimeWindow, TCreateInput> {
  return {
    listTimeWindows: (fieldVisitId, clinicId) =>
      repository.listTimeWindowsForClinicVisit(fieldVisitId, clinicId),
    createTimeWindow: (input) =>
      repository.createTimeWindowForClinicVisit(input),
  };
}
