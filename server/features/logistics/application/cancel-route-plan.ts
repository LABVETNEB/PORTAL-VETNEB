import type { LogisticsRoutePlanCancelRepository } from "./ports/logistics-route-plan-cancel-repository.ts";

export type CancelRoutePlan<TResult> = (
  id: number,
  clinicId: number,
) => Promise<TResult>;

// Caso de uso M08: cancela un plan de ruta clinic-scoped. Recibe id y clinicId
// ya autenticados, validados y clinic-scoped desde la ruta, delega exactamente
// una vez en el puerto de cancelación y devuelve su resultado (éxito o rechazo
// del dominio) sin mutarlo, propagando los errores del puerto sin envolverlos.
// El mapeo de rechazo/error, la auditoría, la cache y la serialización quedan en
// la ruta.
export function createCancelRoutePlan<TResult>(
  repository: LogisticsRoutePlanCancelRepository<TResult>,
): CancelRoutePlan<TResult> {
  return (id, clinicId) => repository.cancelClinicScopedRoutePlan(id, clinicId);
}
