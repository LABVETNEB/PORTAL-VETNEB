// Puerto mínimo de ventanas horarias del contexto Logistics (M15), derivado
// del seam `LogisticsFieldVisitsNativeRoutesOptions`. Las dos operaciones son
// clinic-scoped: el listado recibe el clinicId autenticado y la creación lo
// recibe dentro del input ya construido por la ruta.

export type LogisticsTimeWindowsRepository<TTimeWindow, TCreateInput> = {
  listTimeWindowsForClinicVisit: (
    fieldVisitId: number,
    clinicId: number,
  ) => Promise<TTimeWindow[]>;
  createTimeWindowForClinicVisit: (
    input: TCreateInput,
  ) => Promise<TTimeWindow | null | undefined>;
};
