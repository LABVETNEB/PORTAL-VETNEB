// Adaptador de persistencia de route events (M16). Expone, por composición
// mínima sobre el DB canónico de su propia capa (`./db-logistics.ts`, intacto:
// mismas queries, scoping por clínica, transacciones y semántica
// null/undefined), únicamente las operaciones que
// `server/routes/logistics-route-events.fastify.ts` consume realmente, junto
// con los tipos de I/O de esas operaciones. La factory retorna referencias
// directas a las funciones canónicas: sin envolver resultados, sin alterar
// signatures, null/undefined ni errores. Implementa estructuralmente los
// puertos de application (append + tres lecturas); esta capa no importa
// `application` (la dirección de dependencia no se invierte).

import {
  createRouteEvent,
  listClinicRouteEvents,
  listIncrementalClinicRouteEvents,
  listRouteEventsForClinicRoutePlan,
} from "./db-logistics.ts";

export type {
  CreateRouteEventInput,
  ListRouteEventsParams,
  RouteEvent,
} from "./db-logistics.ts";

export function createLogisticsRouteEventsDbAdapter() {
  return {
    createRouteEvent,
    listClinicRouteEvents,
    listRouteEventsForClinicRoutePlan,
    listIncrementalClinicRouteEvents,
  };
}
