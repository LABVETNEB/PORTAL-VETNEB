// Puerto mínimo de cancelación de plan de ruta del contexto Logistics (M08).
// Una sola operación semántica ("cancelar un plan de ruta clinic-scoped"),
// derivada del seam `LogisticsRoutePlansNativeRoutesOptions`
// (`transitionClinicScopedRoutePlanStatus` con action "cancel"). `TResult` queda
// opaco para application: el mapeo de rechazo/error, la auditoría, la cache y la
// serialización viven en la ruta. Sólo cubre `cancel`: release/start/complete
// permanecen fuera del scope de M08.

export type LogisticsRoutePlanCancelRepository<TResult> = {
  cancelClinicScopedRoutePlan: (
    id: number,
    clinicId: number,
  ) => Promise<TResult>;
};
