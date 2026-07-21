// Puerto mínimo de cache de planes de ruta del contexto Logistics (M14).
// Modela únicamente las operaciones de cache realmente consumidas por el caso
// de uso de read-through e invalidación (snapshot de listado, snapshot de
// métricas e invalidaciones por clínica/plan), derivadas de los call-sites
// reales de `server/routes/logistics-route-plans.fastify.ts` medidos en la
// auditoría R0 de M14. Los genéricos mantienen el snapshot opaco: application
// no conoce la forma del body HTTP cacheado ni tipos de DB/schema.
//
// La implementación vive en infrastructure
// (`logistics-route-plans-cache-adapter.ts`, sobre el cache canónico de M13);
// TTL, claves y expiración lazy son responsabilidad del adaptador y del caso
// de uso, nunca de este contrato.

export type LogisticsRoutePlansCacheRepository<TListSnapshot, TMetricsSnapshot> = {
  getRoutePlansListSnapshot: (key: string, now: number) => TListSnapshot | null;
  setRoutePlansListSnapshot: (
    key: string,
    snapshot: TListSnapshot,
    now: number,
  ) => void;
  clearRoutePlansListByClinic: (clinicId: number) => void;
  getRoutePlanMetricsSnapshot: (key: string, now: number) => TMetricsSnapshot | null;
  setRoutePlanMetricsSnapshot: (
    key: string,
    snapshot: TMetricsSnapshot,
    now: number,
  ) => void;
  clearRoutePlanMetricsByPlan: (clinicId: number, routePlanId: number) => void;
};
