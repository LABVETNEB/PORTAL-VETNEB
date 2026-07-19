import type { LogisticsRouteStopsWriteRepository } from "./ports/logistics-route-stops-write-repository.ts";

export type RouteStopsWriteUseCases<TRouteStop, TCreateInput, TUpdateInput> = {
  createRouteStop: (
    input: TCreateInput,
  ) => Promise<TRouteStop | null | undefined>;
  updateRouteStop: (
    id: number,
    clinicId: number,
    input: TUpdateInput,
  ) => Promise<TRouteStop | null | undefined>;
};

// Casos de uso de escritura de paradas de ruta (M08). Cada método recibe datos
// ya autenticados, validados y clinic-scoped desde la ruta, delega exactamente
// una vez en el puerto de escritura y devuelve su resultado sin mutarlo,
// propagando los errores del puerto sin envolverlos. Cero HTTP, cero cache,
// cero serialización.
export function createRouteStopsWriteUseCases<TRouteStop, TCreateInput, TUpdateInput>(
  repository: LogisticsRouteStopsWriteRepository<TRouteStop, TCreateInput, TUpdateInput>,
): RouteStopsWriteUseCases<TRouteStop, TCreateInput, TUpdateInput> {
  return {
    createRouteStop: (input) =>
      repository.createRouteStopForClinicRoutePlan(input),
    updateRouteStop: (id, clinicId, input) =>
      repository.updateClinicScopedRouteStop(id, clinicId, input),
  };
}
