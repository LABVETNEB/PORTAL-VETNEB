import type { LogisticsRoutePlansReadRepository } from "./ports/logistics-route-plans-read-repository.ts";

export type RoutePlansReadUseCases<TRoutePlan, TRouteStop, TListParams> = {
  listRoutePlans: (params: TListParams) => Promise<TRoutePlan[]>;
  getRoutePlan: (
    id: number,
    clinicId: number,
  ) => Promise<TRoutePlan | null | undefined>;
  listRoutePlanStops: (
    routePlanId: number,
    clinicId: number,
  ) => Promise<TRouteStop[]>;
};

// Casos de uso de lectura de planes de ruta (M07). Cada método recibe datos ya
// autenticados, validados y clinic-scoped desde la ruta, delega exactamente una
// vez en el puerto de lectura y devuelve su resultado sin mutarlo, propagando
// los errores del puerto sin envolverlos. Cero HTTP, cero cache, cero
// serialización.
export function createRoutePlansReadUseCases<TRoutePlan, TRouteStop, TListParams>(
  repository: LogisticsRoutePlansReadRepository<TRoutePlan, TRouteStop, TListParams>,
): RoutePlansReadUseCases<TRoutePlan, TRouteStop, TListParams> {
  return {
    listRoutePlans: (params) => repository.listClinicRoutePlans(params),
    getRoutePlan: (id, clinicId) =>
      repository.getClinicScopedRoutePlan(id, clinicId),
    listRoutePlanStops: (routePlanId, clinicId) =>
      repository.listRouteStopsForClinicRoutePlan(routePlanId, clinicId),
  };
}
