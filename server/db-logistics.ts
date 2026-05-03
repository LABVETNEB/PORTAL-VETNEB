import { and, asc, desc, eq, gt } from "drizzle-orm";
import { db } from "./db";
import {
  fieldVisits,
  routeEvents,
  routePlans,
  routeStops,
  timeWindows,
  visitLocations,
  type FieldVisitSourceType,
  type FieldVisitStatus,
  type RouteEventPayload,
  type RouteEventSource,
  type RouteEventType,
  type RoutePlanCreatedByType,
  type RoutePlanObjective,
  type RoutePlanningMode,
  type RoutePlanStatus,
  type RouteStopStatus,
  type VisitLocationGeoQuality,
} from "../drizzle/schema";
import {
  assertValidTimeWindowRange,
  normalizeTimeWindowTimezone,
} from "./lib/logistics/time-window.ts";

export const LOGISTICS_DEFAULT_LIMIT = 50;
export const LOGISTICS_MAX_LIMIT = 100;

export type FieldVisit = typeof fieldVisits.$inferSelect;
export type NewFieldVisit = typeof fieldVisits.$inferInsert;
export type VisitLocation = typeof visitLocations.$inferSelect;
export type NewVisitLocation = typeof visitLocations.$inferInsert;
export type TimeWindow = typeof timeWindows.$inferSelect;
export type NewTimeWindow = typeof timeWindows.$inferInsert;
export type RoutePlan = typeof routePlans.$inferSelect;
export type NewRoutePlan = typeof routePlans.$inferInsert;
export type RouteStop = typeof routeStops.$inferSelect;
export type NewRouteStop = typeof routeStops.$inferInsert;
export type RouteEvent = typeof routeEvents.$inferSelect;
export type NewRouteEvent = typeof routeEvents.$inferInsert;

export type CreateFieldVisitInput = {
  clinicId: number;
  sourceType?: FieldVisitSourceType;
  sourceId?: number | null;
  status?: FieldVisitStatus;
  priority?: number;
  criticality?: string | null;
  serviceDurationMin?: number;
  notes?: string | null;
};

export type UpdateFieldVisitInput = Partial<
  Omit<
    CreateFieldVisitInput,
    "clinicId"
  >
>;

export type ListFieldVisitsParams = {
  clinicId: number;
  status?: FieldVisitStatus;
  sourceType?: FieldVisitSourceType;
  sourceId?: number;
  limit?: number;
  offset?: number;
};

export type UpsertVisitLocationInput = {
  fieldVisitId: number;
  clinicId: number;
  addressRaw: string;
  addressNormalized?: string | null;
  locality?: string | null;
  country?: string | null;
  lat?: number | null;
  lng?: number | null;
  geoQuality?: VisitLocationGeoQuality;
  geocodeSource?: string | null;
};

export type CreateTimeWindowInput = {
  fieldVisitId: number;
  clinicId: number;
  windowStart: Date;
  windowEnd: Date;
  timezone?: string | null;
  isHard?: boolean;
};

export type CreateRoutePlanInput = {
  clinicId: number;
  serviceDate: Date;
  status?: RoutePlanStatus;
  planningMode?: RoutePlanningMode;
  objective?: RoutePlanObjective;
  totalPlannedKm?: number;
  totalPlannedMin?: number;
  createdByType?: RoutePlanCreatedByType;
  createdById?: number | null;
};

export type UpdateRoutePlanInput = Partial<
  Omit<
    CreateRoutePlanInput,
    "clinicId" | "createdByType" | "createdById"
  >
>;

export type ListRoutePlansParams = {
  clinicId: number;
  status?: RoutePlanStatus;
  planningMode?: RoutePlanningMode;
  objective?: RoutePlanObjective;
  limit?: number;
  offset?: number;
};

export type CreateRouteStopInput = {
  routePlanId: number;
  clinicId: number;
  fieldVisitId: number;
  sequence: number;
  etaStart?: Date | null;
  etaEnd?: Date | null;
  plannedKmFromPrev?: number;
  plannedMinFromPrev?: number;
  status?: RouteStopStatus;
};

export type UpdateRouteStopInput = Partial<
  Omit<
    CreateRouteStopInput,
    "routePlanId" | "clinicId" | "fieldVisitId"
  > & {
    actualArrival: Date | null;
    actualDeparture: Date | null;
    actualKmFromPrev: number | null;
  }
>;

export type CreateRouteEventInput = {
  clinicId: number;
  routePlanId?: number | null;
  routeStopId?: number | null;
  eventType: RouteEventType;
  eventTime?: Date;
  payload?: RouteEventPayload | null;
  lat?: number | null;
  lng?: number | null;
  source?: RouteEventSource;
};

export type ListRouteEventsParams = {
  clinicId: number;
  routePlanId?: number;
  routeStopId?: number;
  eventType?: RouteEventType;
  afterId?: number;
  limit?: number;
  offset?: number;
};

export const ROUTE_PLAN_LIFECYCLE_ACTIONS = [
  "release",
  "start",
  "complete",
  "cancel",
] as const;

export type RoutePlanLifecycleAction =
  (typeof ROUTE_PLAN_LIFECYCLE_ACTIONS)[number];

export type RoutePlanLifecycleTransition = {
  from: RoutePlanStatus[];
  to: RoutePlanStatus;
};

export const ROUTE_PLAN_LIFECYCLE_TRANSITIONS: Record<
  RoutePlanLifecycleAction,
  RoutePlanLifecycleTransition
> = {
  release: {
    from: ["draft", "planned"],
    to: "released",
  },
  start: {
    from: ["released"],
    to: "in_progress",
  },
  complete: {
    from: ["in_progress"],
    to: "completed",
  },
  cancel: {
    from: ["draft", "planned", "released", "in_progress"],
    to: "canceled",
  },
};

export type RoutePlanLifecycleTransitionResult =
  | {
      routePlan: RoutePlan;
      reason?: undefined;
    }
  | {
      routePlan?: undefined;
      reason: "not_found" | "invalid_transition";
      currentStatus?: RoutePlanStatus;
    };

export function normalizeLogisticsLimit(
  value: number | null | undefined,
  defaultLimit = LOGISTICS_DEFAULT_LIMIT,
  maxLimit = LOGISTICS_MAX_LIMIT,
): number {
  if (!Number.isInteger(value) || value == null || value <= 0) {
    return defaultLimit;
  }

  return Math.min(value, maxLimit);
}

export function normalizeLogisticsOffset(
  value: number | null | undefined,
): number {
  if (!Number.isInteger(value) || value == null || value < 0) {
    return 0;
  }

  return value;
}

export async function createFieldVisit(
  input: CreateFieldVisitInput,
): Promise<FieldVisit | undefined> {
  const now = new Date();

  const result = await db
    .insert(fieldVisits)
    .values({
      clinicId: input.clinicId,
      sourceType: input.sourceType ?? "manual",
      sourceId: input.sourceId ?? null,
      status: input.status ?? "pending",
      priority: input.priority ?? 0,
      criticality: input.criticality ?? null,
      serviceDurationMin: input.serviceDurationMin ?? 0,
      notes: input.notes ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return result[0];
}

export async function getFieldVisitById(
  id: number,
): Promise<FieldVisit | undefined> {
  const result = await db
    .select()
    .from(fieldVisits)
    .where(eq(fieldVisits.id, id))
    .limit(1);

  return result[0];
}

export async function getClinicScopedFieldVisit(
  id: number,
  clinicId: number,
): Promise<FieldVisit | undefined> {
  const result = await db
    .select()
    .from(fieldVisits)
    .where(
      and(
        eq(fieldVisits.id, id),
        eq(fieldVisits.clinicId, clinicId),
      ),
    )
    .limit(1);

  return result[0];
}

export async function listClinicFieldVisits(
  params: ListFieldVisitsParams,
): Promise<FieldVisit[]> {
  const filters = [eq(fieldVisits.clinicId, params.clinicId)];
  const limit = normalizeLogisticsLimit(params.limit);
  const offset = normalizeLogisticsOffset(params.offset);

  if (params.status) {
    filters.push(eq(fieldVisits.status, params.status));
  }

  if (params.sourceType) {
    filters.push(eq(fieldVisits.sourceType, params.sourceType));
  }

  if (typeof params.sourceId === "number") {
    filters.push(eq(fieldVisits.sourceId, params.sourceId));
  }

  return db
    .select()
    .from(fieldVisits)
    .where(and(...filters))
    .orderBy(desc(fieldVisits.createdAt), desc(fieldVisits.id))
    .limit(limit)
    .offset(offset);
}

export async function updateClinicScopedFieldVisit(
  id: number,
  clinicId: number,
  input: UpdateFieldVisitInput,
): Promise<FieldVisit | undefined> {
  const result = await db
    .update(fieldVisits)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(fieldVisits.id, id),
        eq(fieldVisits.clinicId, clinicId),
      ),
    )
    .returning();

  return result[0];
}

export async function upsertVisitLocationForClinicVisit(
  input: UpsertVisitLocationInput,
): Promise<VisitLocation | undefined> {
  const now = new Date();

  return db.transaction(async (tx) => {
    const visit = await tx
      .select()
      .from(fieldVisits)
      .where(
        and(
          eq(fieldVisits.id, input.fieldVisitId),
          eq(fieldVisits.clinicId, input.clinicId),
        ),
      )
      .limit(1);

    if (!visit[0]) {
      return undefined;
    }

    const existing = await tx
      .select()
      .from(visitLocations)
      .where(eq(visitLocations.fieldVisitId, input.fieldVisitId))
      .limit(1);

    if (existing[0]) {
      const updated = await tx
        .update(visitLocations)
        .set({
          addressRaw: input.addressRaw,
          addressNormalized: input.addressNormalized ?? null,
          locality: input.locality ?? null,
          country: input.country ?? null,
          lat: input.lat ?? null,
          lng: input.lng ?? null,
          geoQuality: input.geoQuality ?? "missing",
          geocodeSource: input.geocodeSource ?? null,
          updatedAt: now,
        })
        .where(eq(visitLocations.id, existing[0].id))
        .returning();

      return updated[0];
    }

    const inserted = await tx
      .insert(visitLocations)
      .values({
        fieldVisitId: input.fieldVisitId,
        addressRaw: input.addressRaw,
        addressNormalized: input.addressNormalized ?? null,
        locality: input.locality ?? null,
        country: input.country ?? null,
        lat: input.lat ?? null,
        lng: input.lng ?? null,
        geoQuality: input.geoQuality ?? "missing",
        geocodeSource: input.geocodeSource ?? null,
        updatedAt: now,
      })
      .returning();

    return inserted[0];
  });
}

export async function getVisitLocationForClinicVisit(
  fieldVisitId: number,
  clinicId: number,
): Promise<VisitLocation | undefined> {
  const result = await db
    .select({ location: visitLocations })
    .from(visitLocations)
    .innerJoin(
      fieldVisits,
      eq(visitLocations.fieldVisitId, fieldVisits.id),
    )
    .where(
      and(
        eq(visitLocations.fieldVisitId, fieldVisitId),
        eq(fieldVisits.clinicId, clinicId),
      ),
    )
    .limit(1);

  return result[0]?.location;
}

export async function createTimeWindowForClinicVisit(
  input: CreateTimeWindowInput,
): Promise<TimeWindow | undefined> {
  assertValidTimeWindowRange(input.windowStart, input.windowEnd);

  const now = new Date();

  return db.transaction(async (tx) => {
    const visit = await tx
      .select()
      .from(fieldVisits)
      .where(
        and(
          eq(fieldVisits.id, input.fieldVisitId),
          eq(fieldVisits.clinicId, input.clinicId),
        ),
      )
      .limit(1);

    if (!visit[0]) {
      return undefined;
    }

    const result = await tx
      .insert(timeWindows)
      .values({
        fieldVisitId: input.fieldVisitId,
        windowStart: input.windowStart,
        windowEnd: input.windowEnd,
        timezone: normalizeTimeWindowTimezone(input.timezone),
        isHard: input.isHard ?? true,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return result[0];
  });
}

export async function listTimeWindowsForClinicVisit(
  fieldVisitId: number,
  clinicId: number,
): Promise<TimeWindow[]> {
  const result = await db
    .select({ timeWindow: timeWindows })
    .from(timeWindows)
    .innerJoin(
      fieldVisits,
      eq(timeWindows.fieldVisitId, fieldVisits.id),
    )
    .where(
      and(
        eq(timeWindows.fieldVisitId, fieldVisitId),
        eq(fieldVisits.clinicId, clinicId),
      ),
    )
    .orderBy(timeWindows.windowStart, timeWindows.id);

  return result.map((row) => row.timeWindow);
}


export async function createRoutePlan(
  input: CreateRoutePlanInput,
): Promise<RoutePlan | undefined> {
  const now = new Date();

  const result = await db
    .insert(routePlans)
    .values({
      clinicId: input.clinicId,
      serviceDate: input.serviceDate,
      status: input.status ?? "draft",
      planningMode: input.planningMode ?? "manual",
      objective: input.objective ?? "distance",
      totalPlannedKm: input.totalPlannedKm ?? 0,
      totalPlannedMin: input.totalPlannedMin ?? 0,
      createdByType: input.createdByType ?? "system",
      createdById: input.createdById ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return result[0];
}

export async function getClinicScopedRoutePlan(
  id: number,
  clinicId: number,
): Promise<RoutePlan | undefined> {
  const result = await db
    .select()
    .from(routePlans)
    .where(
      and(
        eq(routePlans.id, id),
        eq(routePlans.clinicId, clinicId),
      ),
    )
    .limit(1);

  return result[0];
}

export async function listClinicRoutePlans(
  params: ListRoutePlansParams,
): Promise<RoutePlan[]> {
  const filters = [eq(routePlans.clinicId, params.clinicId)];
  const limit = normalizeLogisticsLimit(params.limit);
  const offset = normalizeLogisticsOffset(params.offset);

  if (params.status) {
    filters.push(eq(routePlans.status, params.status));
  }

  if (params.planningMode) {
    filters.push(eq(routePlans.planningMode, params.planningMode));
  }

  if (params.objective) {
    filters.push(eq(routePlans.objective, params.objective));
  }

  return db
    .select()
    .from(routePlans)
    .where(and(...filters))
    .orderBy(desc(routePlans.serviceDate), desc(routePlans.id))
    .limit(limit)
    .offset(offset);
}

export async function updateClinicScopedRoutePlan(
  id: number,
  clinicId: number,
  input: UpdateRoutePlanInput,
): Promise<RoutePlan | undefined> {
  const result = await db
    .update(routePlans)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(routePlans.id, id),
        eq(routePlans.clinicId, clinicId),
      ),
    )
    .returning();

  return result[0];
}

export async function createRouteStopForClinicRoutePlan(
  input: CreateRouteStopInput,
): Promise<RouteStop | undefined> {
  const now = new Date();

  return db.transaction(async (tx) => {
    const routePlan = await tx
      .select()
      .from(routePlans)
      .where(
        and(
          eq(routePlans.id, input.routePlanId),
          eq(routePlans.clinicId, input.clinicId),
        ),
      )
      .limit(1);

    if (!routePlan[0]) {
      return undefined;
    }

    const fieldVisit = await tx
      .select()
      .from(fieldVisits)
      .where(
        and(
          eq(fieldVisits.id, input.fieldVisitId),
          eq(fieldVisits.clinicId, input.clinicId),
        ),
      )
      .limit(1);

    if (!fieldVisit[0]) {
      return undefined;
    }

    const result = await tx
      .insert(routeStops)
      .values({
        routePlanId: input.routePlanId,
        fieldVisitId: input.fieldVisitId,
        sequence: input.sequence,
        etaStart: input.etaStart ?? null,
        etaEnd: input.etaEnd ?? null,
        plannedKmFromPrev: input.plannedKmFromPrev ?? 0,
        plannedMinFromPrev: input.plannedMinFromPrev ?? 0,
        status: input.status ?? "pending",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return result[0];
  });
}

export async function listRouteStopsForClinicRoutePlan(
  routePlanId: number,
  clinicId: number,
): Promise<RouteStop[]> {
  const result = await db
    .select({ routeStop: routeStops })
    .from(routeStops)
    .innerJoin(
      routePlans,
      eq(routeStops.routePlanId, routePlans.id),
    )
    .where(
      and(
        eq(routeStops.routePlanId, routePlanId),
        eq(routePlans.clinicId, clinicId),
      ),
    )
    .orderBy(routeStops.sequence, routeStops.id);

  return result.map((row) => row.routeStop);
}

export async function updateClinicScopedRouteStop(
  id: number,
  clinicId: number,
  input: UpdateRouteStopInput,
): Promise<RouteStop | undefined> {
  return db.transaction(async (tx) => {
    const existing = await tx
      .select({ routeStop: routeStops })
      .from(routeStops)
      .innerJoin(
        routePlans,
        eq(routeStops.routePlanId, routePlans.id),
      )
      .where(
        and(
          eq(routeStops.id, id),
          eq(routePlans.clinicId, clinicId),
        ),
      )
      .limit(1);

    if (!existing[0]) {
      return undefined;
    }

    const result = await tx
      .update(routeStops)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(routeStops.id, id))
      .returning();

    return result[0];
  });
}



export async function transitionClinicScopedRoutePlanStatus(
  id: number,
  clinicId: number,
  action: RoutePlanLifecycleAction,
): Promise<RoutePlanLifecycleTransitionResult> {
  const transition = ROUTE_PLAN_LIFECYCLE_TRANSITIONS[action];

  return db.transaction(async (tx) => {
    const current = await tx
      .select()
      .from(routePlans)
      .where(
        and(
          eq(routePlans.id, id),
          eq(routePlans.clinicId, clinicId),
        ),
      )
      .limit(1);

    const routePlan = current[0];

    if (!routePlan) {
      return {
        reason: "not_found",
      };
    }

    if (!transition.from.includes(routePlan.status)) {
      return {
        reason: "invalid_transition",
        currentStatus: routePlan.status,
      };
    }

    const updated = await tx
      .update(routePlans)
      .set({
        status: transition.to,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(routePlans.id, id),
          eq(routePlans.clinicId, clinicId),
          eq(routePlans.status, routePlan.status),
        ),
      )
      .returning();

    const updatedRoutePlan = updated[0];

    if (!updatedRoutePlan) {
      return {
        reason: "invalid_transition",
        currentStatus: routePlan.status,
      };
    }

    return {
      routePlan: updatedRoutePlan,
    };
  });
}


export async function createRouteEvent(
  input: CreateRouteEventInput,
): Promise<RouteEvent | undefined> {
  const now = new Date();

  return db.transaction(async (tx) => {
    if (typeof input.routePlanId === "number") {
      const routePlan = await tx
        .select()
        .from(routePlans)
        .where(
          and(
            eq(routePlans.id, input.routePlanId),
            eq(routePlans.clinicId, input.clinicId),
          ),
        )
        .limit(1);

      if (!routePlan[0]) {
        return undefined;
      }
    }

    if (typeof input.routeStopId === "number") {
      const routeStop = await tx
        .select({ routeStop: routeStops })
        .from(routeStops)
        .innerJoin(
          routePlans,
          eq(routeStops.routePlanId, routePlans.id),
        )
        .where(
          and(
            eq(routeStops.id, input.routeStopId),
            eq(routePlans.clinicId, input.clinicId),
          ),
        )
        .limit(1);

      if (!routeStop[0]) {
        return undefined;
      }
    }

    const result = await tx
      .insert(routeEvents)
      .values({
        clinicId: input.clinicId,
        routePlanId: input.routePlanId ?? null,
        routeStopId: input.routeStopId ?? null,
        eventType: input.eventType,
        eventTime: input.eventTime ?? now,
        payload: input.payload ?? null,
        lat: input.lat ?? null,
        lng: input.lng ?? null,
        source: input.source ?? "system",
        createdAt: now,
      })
      .returning();

    return result[0];
  });
}

export async function listClinicRouteEvents(
  params: ListRouteEventsParams,
): Promise<RouteEvent[]> {
  const filters = [eq(routeEvents.clinicId, params.clinicId)];
  const limit = normalizeLogisticsLimit(params.limit);
  const offset = normalizeLogisticsOffset(params.offset);

  if (typeof params.routePlanId === "number") {
    filters.push(eq(routeEvents.routePlanId, params.routePlanId));
  }

  if (typeof params.routeStopId === "number") {
    filters.push(eq(routeEvents.routeStopId, params.routeStopId));
  }

  if (params.eventType) {
    filters.push(eq(routeEvents.eventType, params.eventType));
  }

  if (typeof params.afterId === "number") {
    filters.push(gt(routeEvents.id, params.afterId));
  }

  return db
    .select()
    .from(routeEvents)
    .where(and(...filters))
    .orderBy(asc(routeEvents.id))
    .limit(limit)
    .offset(offset);
}

export async function listRouteEventsForClinicRoutePlan(
  routePlanId: number,
  clinicId: number,
  params: Omit<ListRouteEventsParams, "clinicId" | "routePlanId"> = {},
): Promise<RouteEvent[]> {
  const routePlan = await getClinicScopedRoutePlan(routePlanId, clinicId);

  if (!routePlan) {
    return [];
  }

  return listClinicRouteEvents({
    ...params,
    clinicId,
    routePlanId,
  });
}

export async function listIncrementalClinicRouteEvents(
  clinicId: number,
  afterId: number,
  limit?: number,
): Promise<RouteEvent[]> {
  return listClinicRouteEvents({
    clinicId,
    afterId,
    limit,
    offset: 0,
  });
}
