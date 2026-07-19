// Puerto mínimo de actualización de visitas de campo del contexto Logistics
// (M09), derivado del seam `LogisticsFieldVisitsNativeRoutesOptions`.

export type LogisticsFieldVisitUpdateRepository<TFieldVisit, TUpdateInput> = {
  updateClinicScopedFieldVisit: (
    id: number,
    clinicId: number,
    input: TUpdateInput,
  ) => Promise<TFieldVisit | null | undefined>;
};
