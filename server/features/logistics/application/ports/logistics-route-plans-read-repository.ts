// Puerto mínimo de lectura de planes de ruta del contexto Logistics (M07).
// Modela únicamente las operaciones de lectura consumidas por los casos de uso
// de lectura (list, detalle, stops, metrics) y se deriva del seam
// `LogisticsRoutePlansNativeRoutesOptions`
// (server/routes/logistics-route-plans.fastify.ts). Los genéricos mantienen la
// inferencia estricta del adapter real sin filtrar tipos concretos de DB ni del
// schema hacia application.

export type LogisticsRoutePlansReadRepository<
  TRoutePlan,
  TRouteStop,
  TListParams,
> = {
  listClinicRoutePlans: (params: TListParams) => Promise<TRoutePlan[]>;
  getClinicScopedRoutePlan: (
    id: number,
    clinicId: number,
  ) => Promise<TRoutePlan | null | undefined>;
  listRouteStopsForClinicRoutePlan: (
    routePlanId: number,
    clinicId: number,
  ) => Promise<TRouteStop[]>;
};
