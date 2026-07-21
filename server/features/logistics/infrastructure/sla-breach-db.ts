// Logistics · infrastructure (adaptador de DB)
//
// Adaptador que cablea el núcleo puro de breach de SLA
// (`server/features/logistics/domain/sla-breach.ts`, consumido vía barrel) con
// la persistencia real del contexto. Carga
// `markOverdueActiveClinicSlaInstancesBreached` mediante un import dinámico
// (lazy) y delega en `markOverdueSlaBreaches`, sin duplicar la lógica de
// negocio.
//
// Desde M12 la persistencia canónica vive en esta misma capa
// (`./db-logistics.ts`): el adaptador ya no consume el shim raíz
// `server/db-logistics.ts`.

import {
  markOverdueSlaBreaches,
  type MarkOverdueSlaBreachesInput,
  type MarkOverdueSlaBreachesResult,
} from "../domain/index.ts";
import type { SlaInstance } from "./db-logistics.ts";

export type MarkOverdueSlaBreachesWithDbOptions = {
  now?: () => Date;
};

export async function markOverdueSlaBreachesWithDb(
  input: MarkOverdueSlaBreachesInput,
  options: MarkOverdueSlaBreachesWithDbOptions = {},
): Promise<MarkOverdueSlaBreachesResult<SlaInstance>> {
  const { markOverdueActiveClinicSlaInstancesBreached } = await import(
    "./db-logistics.ts"
  );

  return markOverdueSlaBreaches(input, {
    markOverdueActiveClinicSlaInstancesBreached,
    now: options.now,
  });
}
