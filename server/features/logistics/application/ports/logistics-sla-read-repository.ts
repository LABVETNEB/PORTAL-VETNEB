// Puerto mínimo de lectura SLA del contexto Logistics (M06). Modela únicamente
// la operación consumida por el caso de uso overdue y se deriva del seam
// `LogisticsSlaNativeRoutesOptions` (server/routes/logistics-sla.fastify.ts).
// Los genéricos mantienen la inferencia estricta del adapter real sin filtrar
// tipos concretos de DB ni del schema hacia application.

export type ListOverdueActiveSlaInstancesInput<
  TTargetType extends string = string,
> = {
  clinicId: number;
  dueAtOrBefore: Date;
  targetType?: TTargetType;
  limit?: number;
  offset?: number;
};

export type LogisticsSlaReadRepository<
  TSlaInstance,
  TTargetType extends string = string,
> = {
  listOverdueActiveClinicSlaInstances: (
    input: ListOverdueActiveSlaInstancesInput<TTargetType>,
  ) => Promise<TSlaInstance[]>;
};
