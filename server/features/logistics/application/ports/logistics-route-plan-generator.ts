// Puerto mínimo de generación heurística de planes de ruta del contexto
// Logistics (M07). Una sola operación semántica, derivada del seam
// `LogisticsRoutePlansNativeRoutesOptions`. `TInput`/`TResult` quedan opacos
// para application: la validación de entrada y el mapeo de rechazo/error viven
// en la ruta; la persistencia y el cálculo concreto, en infrastructure.

export type LogisticsRoutePlanGenerator<TInput, TResult> = {
  generateHeuristicRoutePlan: (input: TInput) => Promise<TResult>;
};
