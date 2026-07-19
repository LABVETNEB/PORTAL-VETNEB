import type { LogisticsRoutePlanGenerator } from "./ports/logistics-route-plan-generator.ts";

export type GenerateHeuristicRoutePlan<TInput, TResult> = (
  input: TInput,
) => Promise<TResult>;

// Caso de uso M07: genera un plan de ruta heurístico. Recibe un input ya
// autenticado y validado desde la ruta, delega exactamente una vez en el puerto
// generador y devuelve su resultado (éxito o rechazo del dominio) sin mutarlo,
// propagando los errores del generador sin envolverlos. El timing, la
// invalidación de cache y la serialización permanecen en la ruta.
export function createGenerateHeuristicRoutePlan<TInput, TResult>(
  generator: LogisticsRoutePlanGenerator<TInput, TResult>,
): GenerateHeuristicRoutePlan<TInput, TResult> {
  return (input) => generator.generateHeuristicRoutePlan(input);
}
