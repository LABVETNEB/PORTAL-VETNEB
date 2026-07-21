import type { LogisticsVisitLocationRepository } from "./ports/logistics-visit-location-repository.ts";

export type VisitLocationUseCases<TVisitLocation, TUpsertInput> = {
  getVisitLocation: (
    fieldVisitId: number,
    clinicId: number,
  ) => Promise<TVisitLocation | null | undefined>;
  upsertVisitLocation: (
    input: TUpsertInput,
  ) => Promise<TVisitLocation | null | undefined>;
};

// Casos de uso M15 de ubicación de visita: lectura y upsert clinic-scoped con
// inputs ya autenticados y validados por la ruta. Cada operación delega
// exactamente una vez y preserva el resultado (incluido null/undefined) y los
// errores del puerto sin transformarlos; el 404 permanece en la ruta.
export function createVisitLocationUseCases<TVisitLocation, TUpsertInput>(
  repository: LogisticsVisitLocationRepository<TVisitLocation, TUpsertInput>,
): VisitLocationUseCases<TVisitLocation, TUpsertInput> {
  return {
    getVisitLocation: (fieldVisitId, clinicId) =>
      repository.getVisitLocationForClinicVisit(fieldVisitId, clinicId),
    upsertVisitLocation: (input) =>
      repository.upsertVisitLocationForClinicVisit(input),
  };
}
