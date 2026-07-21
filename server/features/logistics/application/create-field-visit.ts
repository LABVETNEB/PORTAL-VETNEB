import type { LogisticsFieldVisitCreateRepository } from "./ports/logistics-field-visit-create-repository.ts";

export type CreateFieldVisit<TFieldVisit, TCreateInput> = (
  input: TCreateInput,
) => Promise<TFieldVisit | null | undefined>;

// Caso de uso M15: crea una visita de campo con el input completo ya
// autenticado, clinic-scoped y validado por la ruta. Delega una vez y preserva
// el resultado (incluido null/undefined) y los errores del puerto sin
// transformarlos; el 500 sobre resultado ausente permanece en la ruta.
export function createCreateFieldVisit<TFieldVisit, TCreateInput>(
  repository: LogisticsFieldVisitCreateRepository<TFieldVisit, TCreateInput>,
): CreateFieldVisit<TFieldVisit, TCreateInput> {
  return (input) => repository.createFieldVisit(input);
}
