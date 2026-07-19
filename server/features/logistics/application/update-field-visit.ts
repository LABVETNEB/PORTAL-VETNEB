import type { LogisticsFieldVisitUpdateRepository } from "./ports/logistics-field-visit-update-repository.ts";

export type UpdateFieldVisit<TFieldVisit, TUpdateInput> = (
  id: number,
  clinicId: number,
  input: TUpdateInput,
) => Promise<TFieldVisit | null | undefined>;

// Caso de uso M09: actualiza una visita clinic-scoped con el input completo ya
// autenticado y validado por la ruta. Delega una vez y preserva el resultado y
// los errores del puerto sin interpretar campos ni estados.
export function createUpdateFieldVisit<TFieldVisit, TUpdateInput>(
  repository: LogisticsFieldVisitUpdateRepository<TFieldVisit, TUpdateInput>,
): UpdateFieldVisit<TFieldVisit, TUpdateInput> {
  return (id, clinicId, input) =>
    repository.updateClinicScopedFieldVisit(id, clinicId, input);
}
