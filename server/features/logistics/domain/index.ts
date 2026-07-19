// Logistics · domain (barrel público)
//
// Superficie pública del contexto `logistics/domain`: re-exporta los helpers y
// tipos puros existentes sin agregar lógica ni cambiar su comportamiento. Es el
// único punto de entrada que el resto del backend debe consumir; nadie fuera de
// `domain/` importa sus archivos internos (garantizado por
// `logistics-domain-boundary-guard`).
//
// - ARCH-5 · `route-plan-field-visits.ts`
// - ARCH-7 · `pagination.ts`
// - M02b   · `time-window.ts` y el núcleo puro `sla-breach.ts`
// - M03    · `route-planning.ts` (heurística pura de planificación de rutas)
//
// El adaptador de DB de SLA (`markOverdueSlaBreachesWithDb`) NO se re-exporta
// aquí: vive en `../infrastructure/sla-breach-db.ts` porque conoce `db-*`.

export { normalizeGenerateHeuristicFieldVisitIds } from "./route-plan-field-visits.ts";

export {
  LOGISTICS_DEFAULT_LIMIT,
  LOGISTICS_MAX_LIMIT,
  normalizeLogisticsLimit,
  normalizeLogisticsOffset,
} from "./pagination.ts";

export {
  DEFAULT_TIME_WINDOW_TIMEZONE,
  TIME_WINDOW_TIMEZONE_MAX_LENGTH,
  assertValidTimeWindowRange,
  isValidTimeWindowRange,
  normalizeTimeWindowTimezone,
} from "./time-window.ts";

export { markOverdueSlaBreaches } from "./sla-breach.ts";
export type {
  MarkOverdueSlaBreachesDeps,
  MarkOverdueSlaBreachesInput,
  MarkOverdueSlaBreachesNotification,
  MarkOverdueSlaBreachesResult,
  MarkOverdueSlaInstancesParams,
} from "./sla-breach.ts";

export { buildHeuristicRoutePlan, calculateHaversineKm } from "./route-planning.ts";
export type {
  BuildHeuristicRoutePlanOptions,
  HeuristicRoutePlanResult,
  PlannedRouteStop,
  RoutePlanningObjective,
  RoutePlanningPoint,
  RoutePlanningTimeWindow,
  RoutePlanningVisit,
} from "./route-planning.ts";
