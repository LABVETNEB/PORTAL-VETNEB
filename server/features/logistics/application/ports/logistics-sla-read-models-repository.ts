// Puerto mínimo de lectura de read models SLA del contexto Logistics (M16).
// Modela únicamente las tres lecturas que todavía tenían consumidores directos
// en los handlers de `server/routes/logistics-sla.fastify.ts` (`/policies`,
// `/instances`, `/summary`), derivadas del seam `LogisticsSlaNativeRoutesOptions`.
// La lectura overdue NO pertenece a este puerto: sigue en el puerto M06
// (`logistics-sla-read-repository.ts`), separada por diseño. Los genéricos
// mantienen la inferencia estricta del adapter real sin filtrar tipos concretos
// de DB ni del schema hacia application.

export type LogisticsSlaReadModelsRepository<
  TSlaPolicy,
  TSlaInstance,
  TSlaSummary,
  TListPoliciesParams,
  TListInstancesParams,
> = {
  listActiveClinicSlaPolicies: (
    params: TListPoliciesParams,
  ) => Promise<TSlaPolicy[]>;
  listClinicSlaInstances: (
    params: TListInstancesParams,
  ) => Promise<TSlaInstance[]>;
  getClinicSlaSummary: (clinicId: number) => Promise<TSlaSummary>;
};
