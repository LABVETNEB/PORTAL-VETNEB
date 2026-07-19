import type { LogisticsRoutePlansWriteRepository } from "./ports/logistics-route-plans-write-repository.ts";

export type RoutePlansWriteUseCases<TRoutePlan, TCreateInput, TUpdateInput> = {
  createRoutePlan: (
    input: TCreateInput,
  ) => Promise<TRoutePlan | null | undefined>;
  updateRoutePlan: (
    id: number,
    clinicId: number,
    input: TUpdateInput,
  ) => Promise<TRoutePlan | null | undefined>;
};

// Casos de uso de escritura de planes de ruta (M08). Cada método recibe datos
// ya autenticados, validados y clinic-scoped desde la ruta, delega exactamente
// una vez en el puerto de escritura y devuelve su resultado sin mutarlo,
// propagando los errores del puerto sin envolverlos. Cero HTTP, cero cache,
// cero auditoría, cero serialización.
export function createRoutePlansWriteUseCases<TRoutePlan, TCreateInput, TUpdateInput>(
  repository: LogisticsRoutePlansWriteRepository<TRoutePlan, TCreateInput, TUpdateInput>,
): RoutePlansWriteUseCases<TRoutePlan, TCreateInput, TUpdateInput> {
  return {
    createRoutePlan: (input) => repository.createRoutePlan(input),
    updateRoutePlan: (id, clinicId, input) =>
      repository.updateClinicScopedRoutePlan(id, clinicId, input),
  };
}
