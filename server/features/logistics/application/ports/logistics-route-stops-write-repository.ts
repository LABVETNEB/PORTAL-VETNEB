// Puerto mínimo de escritura de paradas de ruta del contexto Logistics (M08).
// Modela únicamente create/update de stops, consumidos por los casos de uso de
// escritura, y se deriva del seam `LogisticsRoutePlansNativeRoutesOptions`. Los
// genéricos mantienen la inferencia estricta del adapter real sin filtrar tipos
// concretos de DB ni del schema hacia application.

export type LogisticsRouteStopsWriteRepository<
  TRouteStop,
  TCreateInput,
  TUpdateInput,
> = {
  createRouteStopForClinicRoutePlan: (
    input: TCreateInput,
  ) => Promise<TRouteStop | null | undefined>;
  updateClinicScopedRouteStop: (
    id: number,
    clinicId: number,
    input: TUpdateInput,
  ) => Promise<TRouteStop | null | undefined>;
};
