import type { LogisticsSlaReadModelsRepository } from "./ports/logistics-sla-read-models-repository.ts";

export type SlaReadUseCases<
  TSlaPolicy,
  TSlaInstance,
  TSlaSummary,
  TListPoliciesParams,
  TListInstancesParams,
> = {
  listActivePolicies: (params: TListPoliciesParams) => Promise<TSlaPolicy[]>;
  listInstances: (params: TListInstancesParams) => Promise<TSlaInstance[]>;
  getSummary: (clinicId: number) => Promise<TSlaSummary>;
};

// Casos de uso de lectura SLA (M16): políticas activas, instancias y summary
// clinic-scoped. Cada método recibe datos ya autenticados, validados y
// clinic-scoped desde la ruta, delega exactamente una vez en el puerto de read
// models y devuelve su resultado por identidad, sin mutarlo ni aplicar
// defaults, propagando los errores del puerto sin envolverlos. La lectura
// overdue queda fuera: la sirve el caso de uso M06. Cero HTTP, cero paginación,
// cero serialización.
export function createSlaReadUseCases<
  TSlaPolicy,
  TSlaInstance,
  TSlaSummary,
  TListPoliciesParams,
  TListInstancesParams,
>(
  repository: LogisticsSlaReadModelsRepository<
    TSlaPolicy,
    TSlaInstance,
    TSlaSummary,
    TListPoliciesParams,
    TListInstancesParams
  >,
): SlaReadUseCases<
  TSlaPolicy,
  TSlaInstance,
  TSlaSummary,
  TListPoliciesParams,
  TListInstancesParams
> {
  return {
    listActivePolicies: (params) =>
      repository.listActiveClinicSlaPolicies(params),
    listInstances: (params) => repository.listClinicSlaInstances(params),
    getSummary: (clinicId) => repository.getClinicSlaSummary(clinicId),
  };
}
