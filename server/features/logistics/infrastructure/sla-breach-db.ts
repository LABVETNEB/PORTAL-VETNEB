// Logistics · infrastructure (adaptador de DB)
//
// Adaptador que cablea el núcleo puro de breach de SLA
// (`server/features/logistics/domain/sla-breach.ts`, consumido vía barrel) con
// la persistencia real de `server/db-logistics.ts`. Es el único lugar que conoce
// el `db-*`: carga `markOverdueActiveClinicSlaInstancesBreached` mediante un
// import dinámico (lazy) y delega en `markOverdueSlaBreaches`, sin duplicar la
// lógica de negocio.
//
// Adaptador transitorio: cuando M12 formalice el repositorio de Logistics sobre
// puertos, este archivo se reemplazará por esa infraestructura. No implica
// mover `server/db-logistics.ts` en M02b.

import {
  markOverdueSlaBreaches,
  type MarkOverdueSlaBreachesInput,
  type MarkOverdueSlaBreachesResult,
} from "../domain/index.ts";
import type { SlaInstance } from "../../../db-logistics.ts";

export type MarkOverdueSlaBreachesWithDbOptions = {
  now?: () => Date;
};

export async function markOverdueSlaBreachesWithDb(
  input: MarkOverdueSlaBreachesInput,
  options: MarkOverdueSlaBreachesWithDbOptions = {},
): Promise<MarkOverdueSlaBreachesResult<SlaInstance>> {
  const { markOverdueActiveClinicSlaInstancesBreached } = await import(
    "../../../db-logistics.ts"
  );

  return markOverdueSlaBreaches(input, {
    markOverdueActiveClinicSlaInstancesBreached,
    now: options.now,
  });
}
