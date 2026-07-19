import type {
  ListOverdueActiveSlaInstancesInput,
  LogisticsSlaReadRepository,
} from "./ports/logistics-sla-read-repository.ts";

export type ListOverdueActiveSlaInstances<
  TSlaInstance,
  TTargetType extends string = string,
> = (
  input: ListOverdueActiveSlaInstancesInput<TTargetType>,
) => Promise<TSlaInstance[]>;

// Caso de uso M06: lista instancias SLA activas overdue de una clínica. Recibe
// datos ya autenticados, validados y clinic-scoped desde la ruta; delega
// exactamente una vez en el puerto de lectura y devuelve su resultado sin
// mutarlo, propagando los errores del puerto sin envolverlos.
export function createListOverdueActiveSlaInstances<
  TSlaInstance,
  TTargetType extends string = string,
>(
  repository: LogisticsSlaReadRepository<TSlaInstance, TTargetType>,
): ListOverdueActiveSlaInstances<TSlaInstance, TTargetType> {
  return (input) => repository.listOverdueActiveClinicSlaInstances(input);
}
