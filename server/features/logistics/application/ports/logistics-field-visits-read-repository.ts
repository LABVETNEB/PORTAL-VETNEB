// Puerto mínimo de lectura de visitas de campo del contexto Logistics (M15),
// derivado del seam `LogisticsFieldVisitsNativeRoutesOptions`.

export type LogisticsFieldVisitsReadRepository<TFieldVisit, TListParams> = {
  listClinicFieldVisits: (params: TListParams) => Promise<TFieldVisit[]>;
};
