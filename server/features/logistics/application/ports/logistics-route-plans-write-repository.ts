// Puerto mínimo de escritura de planes de ruta del contexto Logistics (M08).
// Modela únicamente create/update de planes, consumidos por los casos de uso de
// escritura, y se deriva del seam `LogisticsRoutePlansNativeRoutesOptions`
// (server/routes/logistics-route-plans.fastify.ts). Los genéricos mantienen la
// inferencia estricta del adapter real sin filtrar tipos concretos de DB ni del
// schema hacia application.

export type LogisticsRoutePlansWriteRepository<
  TRoutePlan,
  TCreateInput,
  TUpdateInput,
> = {
  createRoutePlan: (
    input: TCreateInput,
  ) => Promise<TRoutePlan | null | undefined>;
  updateClinicScopedRoutePlan: (
    id: number,
    clinicId: number,
    input: TUpdateInput,
  ) => Promise<TRoutePlan | null | undefined>;
};
