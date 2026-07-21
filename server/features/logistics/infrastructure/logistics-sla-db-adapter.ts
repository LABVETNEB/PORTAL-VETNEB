// Adaptador de persistencia de SLA (M16). Expone, por composición mínima sobre
// el DB canónico de su propia capa (`./db-logistics.ts`, intacto: mismas
// queries, scoping por clínica y semántica null/undefined), únicamente las
// operaciones que `server/routes/logistics-sla.fastify.ts` consume realmente,
// junto con los tipos de I/O de esas operaciones. La factory retorna
// referencias directas a las funciones canónicas: sin envolver resultados, sin
// alterar signatures, null/undefined ni errores. La cuarta operación
// (`listOverdueActiveClinicSlaInstances`) sigue perteneciendo al caso de uso
// M06; aquí sólo se re-expone como referencia directa para la carga default de
// la ruta. Esta capa no importa `application` (la dirección de dependencia no
// se invierte).

import {
  getClinicSlaSummary,
  listActiveClinicSlaPolicies,
  listClinicSlaInstances,
  listOverdueActiveClinicSlaInstances,
} from "./db-logistics.ts";

export type {
  ClinicSlaSummary,
  ListActiveClinicSlaPoliciesParams,
  ListClinicSlaInstancesParams,
  ListOverdueActiveClinicSlaInstancesParams,
  SlaInstance,
  SlaPolicy,
} from "./db-logistics.ts";

export function createLogisticsSlaDbAdapter() {
  return {
    listActiveClinicSlaPolicies,
    listClinicSlaInstances,
    listOverdueActiveClinicSlaInstances,
    getClinicSlaSummary,
  };
}
