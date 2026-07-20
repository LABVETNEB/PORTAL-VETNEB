// Puerto mínimo de lectura de eventos de ruta del contexto Logistics (M10).
// Modela las tres lecturas consumidas por los handlers `GET /`, `GET /poll` y
// `GET /route-plans/:routePlanId`, derivadas del seam
// `LogisticsRouteEventsNativeRoutesOptions`
// (server/routes/logistics-route-events.fastify.ts). Los genéricos mantienen la
// inferencia estricta del adapter real sin filtrar tipos concretos de DB ni del
// schema hacia application.

export type LogisticsRouteEventsReadRepository<
  TRouteEvent,
  TListParams,
  TRoutePlanListParams,
> = {
  listClinicRouteEvents: (params: TListParams) => Promise<TRouteEvent[]>;
  listRouteEventsForClinicRoutePlan: (
    routePlanId: number,
    clinicId: number,
    params?: TRoutePlanListParams,
  ) => Promise<TRouteEvent[]>;
  listIncrementalClinicRouteEvents: (
    clinicId: number,
    afterId: number,
    limit?: number,
  ) => Promise<TRouteEvent[]>;
};
