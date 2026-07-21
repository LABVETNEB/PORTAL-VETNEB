// Barrel público de la capa application de Logistics. Expone únicamente la
// superficie ya materializada (M06-M10, M14, M15 y M16); sin exports
// preventivos para milestones futuros.

export {
  createListOverdueActiveSlaInstances,
  type ListOverdueActiveSlaInstances,
} from "./list-overdue-active-sla-instances.ts";
export type {
  ListOverdueActiveSlaInstancesInput,
  LogisticsSlaReadRepository,
} from "./ports/logistics-sla-read-repository.ts";

export {
  createSlaReadUseCases,
  type SlaReadUseCases,
} from "./sla-read-use-cases.ts";
export type { LogisticsSlaReadModelsRepository } from "./ports/logistics-sla-read-models-repository.ts";

export {
  createRoutePlansReadUseCases,
  type RoutePlansReadUseCases,
} from "./route-plans-read-use-cases.ts";
export type { LogisticsRoutePlansReadRepository } from "./ports/logistics-route-plans-read-repository.ts";

export {
  createGenerateHeuristicRoutePlan,
  type GenerateHeuristicRoutePlan,
} from "./generate-heuristic-route-plan.ts";
export type { LogisticsRoutePlanGenerator } from "./ports/logistics-route-plan-generator.ts";

export {
  createRoutePlansWriteUseCases,
  type RoutePlansWriteUseCases,
} from "./route-plans-write-use-cases.ts";
export type { LogisticsRoutePlansWriteRepository } from "./ports/logistics-route-plans-write-repository.ts";

export {
  createRouteStopsWriteUseCases,
  type RouteStopsWriteUseCases,
} from "./route-stops-write-use-cases.ts";
export type { LogisticsRouteStopsWriteRepository } from "./ports/logistics-route-stops-write-repository.ts";

export {
  createCancelRoutePlan,
  type CancelRoutePlan,
} from "./cancel-route-plan.ts";
export type { LogisticsRoutePlanCancelRepository } from "./ports/logistics-route-plan-cancel-repository.ts";

export {
  createUpdateFieldVisit,
  type UpdateFieldVisit,
} from "./update-field-visit.ts";
export type { LogisticsFieldVisitUpdateRepository } from "./ports/logistics-field-visit-update-repository.ts";

export {
  createListFieldVisits,
  type ListFieldVisits,
} from "./list-field-visits.ts";
export type { LogisticsFieldVisitsReadRepository } from "./ports/logistics-field-visits-read-repository.ts";

export {
  createCreateFieldVisit,
  type CreateFieldVisit,
} from "./create-field-visit.ts";
export type { LogisticsFieldVisitCreateRepository } from "./ports/logistics-field-visit-create-repository.ts";

export {
  createVisitLocationUseCases,
  type VisitLocationUseCases,
} from "./visit-location-use-cases.ts";
export type { LogisticsVisitLocationRepository } from "./ports/logistics-visit-location-repository.ts";

export {
  createTimeWindowUseCases,
  type TimeWindowUseCases,
} from "./time-window-use-cases.ts";
export type { LogisticsTimeWindowsRepository } from "./ports/logistics-time-windows-repository.ts";

export {
  createCreateRouteEvent,
  type CreateRouteEvent,
} from "./create-route-event.ts";
export type { LogisticsRouteEventWriteRepository } from "./ports/logistics-route-event-write-repository.ts";

export {
  createRouteEventsReadUseCases,
  type RouteEventsReadUseCases,
} from "./route-events-read-use-cases.ts";
export type { LogisticsRouteEventsReadRepository } from "./ports/logistics-route-events-read-repository.ts";

export {
  createRoutePlansCacheUseCases,
  type RoutePlanMetricsCacheKeyInput,
  type RoutePlanMetricsCacheReadResult,
  type RoutePlansCacheReadResult,
  type RoutePlansCacheUseCases,
  type RoutePlansListCacheKeyInput,
} from "./route-plans-cache-use-cases.ts";
export type { LogisticsRoutePlansCacheRepository } from "./ports/logistics-route-plans-cache-repository.ts";
