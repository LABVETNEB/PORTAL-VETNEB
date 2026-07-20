import type { LogisticsRouteEventsReadRepository } from "./ports/logistics-route-events-read-repository.ts";

export type RouteEventsReadUseCases<
  TRouteEvent,
  TListParams,
  TRoutePlanListParams,
> = {
  listRouteEvents: (params: TListParams) => Promise<TRouteEvent[]>;
  listRoutePlanEvents: (
    routePlanId: number,
    clinicId: number,
    params?: TRoutePlanListParams,
  ) => Promise<TRouteEvent[]>;
  pollRouteEvents: (
    clinicId: number,
    afterId: number,
    limit?: number,
  ) => Promise<TRouteEvent[]>;
};

// Casos de uso de lectura de eventos de ruta (M10). Cada método recibe datos ya
// autenticados, validados y clinic-scoped desde la ruta, delega exactamente una
// vez en el puerto de lectura y devuelve su resultado por identidad, sin
// mutarlo ni aplicar defaults, propagando los errores del puerto sin
// envolverlos. Cero HTTP, cero paginación, cero serialización.
export function createRouteEventsReadUseCases<
  TRouteEvent,
  TListParams,
  TRoutePlanListParams,
>(
  repository: LogisticsRouteEventsReadRepository<
    TRouteEvent,
    TListParams,
    TRoutePlanListParams
  >,
): RouteEventsReadUseCases<TRouteEvent, TListParams, TRoutePlanListParams> {
  return {
    listRouteEvents: (params) => repository.listClinicRouteEvents(params),
    listRoutePlanEvents: (routePlanId, clinicId, params) =>
      repository.listRouteEventsForClinicRoutePlan(
        routePlanId,
        clinicId,
        params,
      ),
    pollRouteEvents: (clinicId, afterId, limit) =>
      repository.listIncrementalClinicRouteEvents(clinicId, afterId, limit),
  };
}
