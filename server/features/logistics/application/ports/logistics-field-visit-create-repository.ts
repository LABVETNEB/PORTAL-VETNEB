// Puerto mínimo de creación de visitas de campo del contexto Logistics (M15),
// derivado del seam `LogisticsFieldVisitsNativeRoutesOptions`.

export type LogisticsFieldVisitCreateRepository<TFieldVisit, TCreateInput> = {
  createFieldVisit: (
    input: TCreateInput,
  ) => Promise<TFieldVisit | null | undefined>;
};
