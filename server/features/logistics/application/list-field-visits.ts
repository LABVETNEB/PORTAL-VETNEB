import type { LogisticsFieldVisitsReadRepository } from "./ports/logistics-field-visits-read-repository.ts";

export type ListFieldVisits<TFieldVisit, TListParams> = (
  params: TListParams,
) => Promise<TFieldVisit[]>;

// Caso de uso M15: lista visitas de campo con params ya autenticados,
// clinic-scoped y validados por la ruta. Delega una vez y preserva el
// resultado y los errores del puerto sin transformarlos.
export function createListFieldVisits<TFieldVisit, TListParams>(
  repository: LogisticsFieldVisitsReadRepository<TFieldVisit, TListParams>,
): ListFieldVisits<TFieldVisit, TListParams> {
  return (params) => repository.listClinicFieldVisits(params);
}
