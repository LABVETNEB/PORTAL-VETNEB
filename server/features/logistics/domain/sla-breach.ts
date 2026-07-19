// Logistics · domain (reglas puras)
//
// Núcleo puro de marcado de breach de SLA: valida la entrada, resuelve los
// defaults contra un reloj inyectado, delega el marcado de instancias en una
// dependencia inyectada y, si hubo breaches, dispara un hook opcional de
// notificación. Determinístico respecto de sus dependencias, sin I/O, sin
// framework y sin persistencia.
//
// Esta lógica vivía en `server/lib/logistics/sla-breach.ts` mezclada con un
// adaptador de DB. M02b separa el núcleo puro (aquí) del adaptador con `db-*`
// (`server/features/logistics/infrastructure/sla-breach-db.ts`). El dominio no
// conoce Drizzle, `db-logistics.ts` ni ninguna persistencia: el tipo de las
// instancias marcadas es opaco (`TInstance`), de forma que el dominio sólo las
// cuenta y las reenvía sin acoplarse al schema de fila de `slaInstances`.

import type { SlaTargetType } from "../../../../drizzle/schema.ts";

export type MarkOverdueSlaInstancesParams = {
  clinicId: number;
  dueAtOrBefore: Date;
  breachedAt: Date;
  targetType?: SlaTargetType;
};

export type MarkOverdueSlaBreachesNotification<TInstance> = {
  clinicId: number;
  breachedCount: number;
  breachedInstances: TInstance[];
  dueAtOrBefore: Date;
  breachedAt: Date;
  targetType?: SlaTargetType;
};

export type MarkOverdueSlaBreachesDeps<TInstance> = {
  markOverdueActiveClinicSlaInstancesBreached: (
    params: MarkOverdueSlaInstancesParams,
  ) => Promise<TInstance[]>;
  notifySlaBreaches?: (
    notification: MarkOverdueSlaBreachesNotification<TInstance>,
  ) => Promise<void>;
  now?: () => Date;
};

export type MarkOverdueSlaBreachesInput = {
  clinicId: number;
  dueAtOrBefore?: Date;
  breachedAt?: Date;
  targetType?: SlaTargetType;
};

export type MarkOverdueSlaBreachesResult<TInstance> = {
  breachedCount: number;
  breachedInstances: TInstance[];
  dueAtOrBefore: Date;
  breachedAt: Date;
};

function assertValidDate(value: Date, fieldName: string): void {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new Error(`${fieldName} invalido`);
  }
}

function assertValidClinicId(clinicId: number): void {
  if (!Number.isInteger(clinicId) || clinicId <= 0) {
    throw new Error("clinicId debe ser un entero positivo");
  }
}

export async function markOverdueSlaBreaches<TInstance>(
  input: MarkOverdueSlaBreachesInput,
  deps: MarkOverdueSlaBreachesDeps<TInstance>,
): Promise<MarkOverdueSlaBreachesResult<TInstance>> {
  assertValidClinicId(input.clinicId);

  const now = deps.now ?? (() => new Date());
  const defaultNow = now();
  assertValidDate(defaultNow, "now");

  const dueAtOrBefore = input.dueAtOrBefore ?? defaultNow;
  const breachedAt = input.breachedAt ?? defaultNow;

  assertValidDate(dueAtOrBefore, "dueAtOrBefore");
  assertValidDate(breachedAt, "breachedAt");

  const breachedInstances =
    await deps.markOverdueActiveClinicSlaInstancesBreached({
      clinicId: input.clinicId,
      dueAtOrBefore,
      breachedAt,
      targetType: input.targetType,
    });

  if (breachedInstances.length > 0 && deps.notifySlaBreaches) {
    await deps.notifySlaBreaches({
      clinicId: input.clinicId,
      breachedCount: breachedInstances.length,
      breachedInstances,
      dueAtOrBefore,
      breachedAt,
      targetType: input.targetType,
    });
  }

  return {
    breachedCount: breachedInstances.length,
    breachedInstances,
    dueAtOrBefore,
    breachedAt,
  };
}
