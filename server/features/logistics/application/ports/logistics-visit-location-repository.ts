// Puerto mínimo de ubicación de visita del contexto Logistics (M15), derivado
// del seam `LogisticsFieldVisitsNativeRoutesOptions`. Las dos operaciones son
// clinic-scoped: la lectura recibe el clinicId autenticado y el upsert lo
// recibe dentro del input ya construido por la ruta.

export type LogisticsVisitLocationRepository<TVisitLocation, TUpsertInput> = {
  getVisitLocationForClinicVisit: (
    fieldVisitId: number,
    clinicId: number,
  ) => Promise<TVisitLocation | null | undefined>;
  upsertVisitLocationForClinicVisit: (
    input: TUpsertInput,
  ) => Promise<TVisitLocation | null | undefined>;
};
