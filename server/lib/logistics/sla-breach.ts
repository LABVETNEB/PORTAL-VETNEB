import type {
  MarkOverdueActiveClinicSlaInstancesBreachedParams,
  SlaInstance,
} from "../../db-logistics.ts";
import type { SlaTargetType } from "../../../drizzle/schema.ts";

export type MarkOverdueSlaBreachesNotification = {
  clinicId: number;
  breachedCount: number;
  breachedInstances: SlaInstance[];
  dueAtOrBefore: Date;
  breachedAt: Date;
  targetType?: SlaTargetType;
};

export type MarkOverdueSlaBreachesDeps = {
  markOverdueActiveClinicSlaInstancesBreached: (
    params: MarkOverdueActiveClinicSlaInstancesBreachedParams,
  ) => Promise<SlaInstance[]>;
  notifySlaBreaches?: (
    notification: MarkOverdueSlaBreachesNotification,
  ) => Promise<void>;
  now?: () => Date;
};

export type MarkOverdueSlaBreachesInput = {
  clinicId: number;
  dueAtOrBefore?: Date;
  breachedAt?: Date;
  targetType?: SlaTargetType;
};

export type MarkOverdueSlaBreachesResult = {
  breachedCount: number;
  breachedInstances: SlaInstance[];
  dueAtOrBefore: Date;
  breachedAt: Date;
};

export type MarkOverdueSlaBreachesWithDbOptions = {
  now?: () => Date;
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

export async function markOverdueSlaBreaches(
  input: MarkOverdueSlaBreachesInput,
  deps: MarkOverdueSlaBreachesDeps,
): Promise<MarkOverdueSlaBreachesResult> {
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

export async function markOverdueSlaBreachesWithDb(
  input: MarkOverdueSlaBreachesInput,
  options: MarkOverdueSlaBreachesWithDbOptions = {},
): Promise<MarkOverdueSlaBreachesResult> {
  const { markOverdueActiveClinicSlaInstancesBreached } = await import(
    "../../db-logistics.ts"
  );

  return markOverdueSlaBreaches(input, {
    markOverdueActiveClinicSlaInstancesBreached,
    now: options.now,
  });
}
