// Adaptador de persistencia de field visits (M15). Expone, por composición
// mínima sobre el DB canónico de su propia capa (`./db-logistics.ts`, intacto:
// mismas queries, scoping por clínica, transacciones y semántica
// null/undefined), únicamente las operaciones que
// `server/routes/logistics-field-visits.fastify.ts` consume realmente, junto
// con los tipos de I/O de esas operaciones. La factory retorna referencias
// directas a las funciones canónicas: sin envolver resultados, sin alterar
// signatures, null/undefined ni errores. Implementa estructuralmente los
// puertos de application (read/create/update/location/time-windows); esta capa
// no importa `application` (la dirección de dependencia no se invierte).

import {
  createFieldVisit,
  createTimeWindowForClinicVisit,
  getVisitLocationForClinicVisit,
  listClinicFieldVisits,
  listTimeWindowsForClinicVisit,
  updateClinicScopedFieldVisit,
  upsertVisitLocationForClinicVisit,
} from "./db-logistics.ts";

export type {
  CreateFieldVisitInput,
  CreateTimeWindowInput,
  FieldVisit,
  ListFieldVisitsParams,
  TimeWindow,
  UpdateFieldVisitInput,
  UpsertVisitLocationInput,
  VisitLocation,
} from "./db-logistics.ts";

export function createLogisticsFieldVisitsDbAdapter() {
  return {
    createFieldVisit,
    listClinicFieldVisits,
    updateClinicScopedFieldVisit,
    getVisitLocationForClinicVisit,
    upsertVisitLocationForClinicVisit,
    createTimeWindowForClinicVisit,
    listTimeWindowsForClinicVisit,
  };
}
