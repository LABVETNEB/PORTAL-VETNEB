import { and, desc, eq } from "drizzle-orm";
import { db } from "./db";
import {
  fieldVisits,
  timeWindows,
  visitLocations,
  type FieldVisitSourceType,
  type FieldVisitStatus,
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
