import type { LogisticsRouteEventWriteRepository } from "./ports/logistics-route-event-write-repository.ts";

export type CreateRouteEvent<TRouteEvent, TCreateInput> = (
  input: TCreateInput,
) => Promise<TRouteEvent | null | undefined>;

// Caso de uso M10: registra (append) un evento de ruta con el input completo ya
// autenticado, validado y clinic-scoped por la ruta. Delega exactamente una vez
// y devuelve el resultado del puerto sin mutarlo (incluyendo null/undefined),
// propagando sus errores sin envolverlos. Cero HTTP, cero auditoría, cero
// serialización: el orden append → writeAuditLog permanece en la ruta.
export function createCreateRouteEvent<TRouteEvent, TCreateInput>(
  repository: LogisticsRouteEventWriteRepository<TRouteEvent, TCreateInput>,
): CreateRouteEvent<TRouteEvent, TCreateInput> {
  return (input) => repository.createRouteEvent(input);
}
