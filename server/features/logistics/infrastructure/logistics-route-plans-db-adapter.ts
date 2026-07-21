// Adaptador de persistencia de planes de ruta (M14). Expone, por composición
// mínima sobre el DB canónico de su propia capa (`./db-logistics.ts`, intacto:
// mismas queries, scoping por clínica, transacciones y uniones discriminadas),
// únicamente las operaciones que `server/routes/logistics-route-plans.fastify.ts`
// consume realmente, junto con los tipos de I/O de esas operaciones. La factory
// retorna referencias directas a las funciones canónicas: sin envolver
// resultados, sin alterar signatures, null/undefined ni errores. Implementa
// estructuralmente los puertos de application (read/write/stops/cancel/
// generator); esta capa no importa `application` (la dirección de dependencia
// no se invierte).

import {
  createRoutePlan,
  createRouteStopForClinicRoutePlan,
  generateHeuristicRoutePlan,
  getClinicScopedRoutePlan,
  listClinicRoutePlans,
  listRouteStopsForClinicRoutePlan,
  transitionClinicScopedRoutePlanStatus,
  updateClinicScopedRoutePlan,
  updateClinicScopedRouteStop,
} from "./db-logistics.ts";

export type {
  CreateRoutePlanInput,
  CreateRouteStopInput,
  GenerateHeuristicRoutePlanInput,
  GenerateHeuristicRoutePlanResult,
  ListRoutePlansParams,
  RoutePlan,
  RoutePlanLifecycleAction,
  RoutePlanLifecycleTransitionResult,
  RouteStop,
  UpdateRoutePlanInput,
  UpdateRouteStopInput,
} from "./db-logistics.ts";

export function createLogisticsRoutePlansDbAdapter() {
  return {
    createRoutePlan,
    getClinicScopedRoutePlan,
    listClinicRoutePlans,
    updateClinicScopedRoutePlan,
    createRouteStopForClinicRoutePlan,
    listRouteStopsForClinicRoutePlan,
    updateClinicScopedRouteStop,
    transitionClinicScopedRoutePlanStatus,
    generateHeuristicRoutePlan,
  };
}
