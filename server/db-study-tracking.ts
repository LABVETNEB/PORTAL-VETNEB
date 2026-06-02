import { and, desc, eq } from "drizzle-orm";
import { db } from "./db.ts";
import {
  studyTrackingCases,
  studyTrackingNotifications,
  type NewStudyTrackingCase,
  type NewStudyTrackingNotification,
} from "../drizzle/schema.ts";

type NotificationScope = {
  clinicId?: number;
  particularTokenId?: number;
};

function buildStudyTrackingNotificationScopeFilters(scope: NotificationScope) {
  const scopeFilters = [];

  if (typeof scope.clinicId === "number") {
    scopeFilters.push(eq(studyTrackingNotifications.clinicId, scope.clinicId));
  }

  if (typeof scope.particularTokenId === "number") {
    scopeFilters.push(
      eq(studyTrackingNotifications.particularTokenId, scope.particularTokenId),
    );
  }

  if (scopeFilters.length === 0) {
    throw new Error(
      "markStudyTrackingNotificationReadScoped requires clinicId or particularTokenId",
    );
  }

  return scopeFilters;
}

export async function createStudyTrackingCase(
  input: Omit<NewStudyTrackingCase, "id" | "createdAt" | "updatedAt">,
) {
  const now = new Date();

  const result = await db
    .insert(studyTrackingCases)
    .values({
      ...input,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return result[0];
}

export async function getStudyTrackingCaseById(id: number) {
  const result = await db
    .select()
    .from(studyTrackingCases)
    .where(eq(studyTrackingCases.id, id))
    .limit(1);

  return result[0];
}

export async function getClinicScopedStudyTrackingCase(
  id: number,
  clinicId: number,
) {
  const result = await db
    .select()
    .from(studyTrackingCases)
    .where(
      and(
        eq(studyTrackingCases.id, id),
        eq(studyTrackingCases.clinicId, clinicId),
      ),
    )
    .limit(1);

  return result[0];
}

export async function getParticularStudyTrackingCase(particularTokenId: number) {
  const result = await db
    .select()
    .from(studyTrackingCases)
    .where(eq(studyTrackingCases.particularTokenId, particularTokenId))
    .limit(1);

  return result[0];
}

export async function getStudyTrackingCaseByReportId(reportId: number) {
  const result = await db
    .select()
    .from(studyTrackingCases)
    .where(eq(studyTrackingCases.reportId, reportId))
    .limit(1);

  return result[0];
}

export async function listStudyTrackingCases(params?: {
  clinicId?: number;
  reportId?: number;
  particularTokenId?: number;
  limit?: number;
  offset?: number;
}) {
  const limit = params?.limit ?? 50;
  const offset = params?.offset ?? 0;
  const filters = [];

  if (typeof params?.clinicId === "number") {
    filters.push(eq(studyTrackingCases.clinicId, params.clinicId));
  }

  if (typeof params?.reportId === "number") {
    filters.push(eq(studyTrackingCases.reportId, params.reportId));
  }

  if (typeof params?.particularTokenId === "number") {
    filters.push(eq(studyTrackingCases.particularTokenId, params.particularTokenId));
  }

  if (filters.length > 0) {
    return db
      .select()
      .from(studyTrackingCases)
      .where(and(...filters))
      .orderBy(desc(studyTrackingCases.createdAt))
      .limit(limit)
      .offset(offset);
  }

  return db
    .select()
    .from(studyTrackingCases)
    .orderBy(desc(studyTrackingCases.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function updateStudyTrackingCase(
  id: number,
  input: Partial<Omit<NewStudyTrackingCase, "id" | "createdAt" | "updatedAt">>,
) {
  const result = await db
    .update(studyTrackingCases)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(eq(studyTrackingCases.id, id))
    .returning();

  return result[0];
}

export async function createStudyTrackingNotification(
  input: Omit<NewStudyTrackingNotification, "id" | "createdAt">,
) {
  const result = await db
    .insert(studyTrackingNotifications)
    .values({
      ...input,
      createdAt: new Date(),
    })
    .returning();

  return result[0];
}

export async function listStudyTrackingNotifications(params?: {
  clinicId?: number;
  particularTokenId?: number;
  studyTrackingCaseId?: number;
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
}) {
  const limit = params?.limit ?? 50;
  const offset = params?.offset ?? 0;
  const filters = [];

  if (typeof params?.clinicId === "number") {
    filters.push(eq(studyTrackingNotifications.clinicId, params.clinicId));
  }

  if (typeof params?.particularTokenId === "number") {
    filters.push(
      eq(studyTrackingNotifications.particularTokenId, params.particularTokenId),
    );
  }

  if (typeof params?.studyTrackingCaseId === "number") {
    filters.push(
      eq(studyTrackingNotifications.studyTrackingCaseId, params.studyTrackingCaseId),
    );
  }

  if (params?.unreadOnly) {
    filters.push(eq(studyTrackingNotifications.isRead, false));
  }

  if (filters.length > 0) {
    return db
      .select()
      .from(studyTrackingNotifications)
      .where(and(...filters))
      .orderBy(desc(studyTrackingNotifications.createdAt))
      .limit(limit)
      .offset(offset);
  }

  return db
    .select()
    .from(studyTrackingNotifications)
    .orderBy(desc(studyTrackingNotifications.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function markStudyTrackingNotificationRead(id: number) {
  const now = new Date();
  const result = await db
    .update(studyTrackingNotifications)
    .set({
      isRead: true,
      readAt: now,
    })
    .where(eq(studyTrackingNotifications.id, id))
    .returning();

  return result[0];
}

export async function markAllStudyTrackingNotificationsRead(params?: {
  clinicId?: number;
}) {
  const filters = [eq(studyTrackingNotifications.isRead, false)];

  if (typeof params?.clinicId === "number") {
    filters.push(eq(studyTrackingNotifications.clinicId, params.clinicId));
  }

  const updated = await db
    .update(studyTrackingNotifications)
    .set({
      isRead: true,
      readAt: new Date(),
    })
    .where(and(...filters))
    .returning({ id: studyTrackingNotifications.id });

  return {
    updatedCount: updated.length,
  };
}

export async function markStudyTrackingNotificationReadScoped(params: {
  id: number;
  clinicId?: number;
  particularTokenId?: number;
}) {
  const scopeFilters = buildStudyTrackingNotificationScopeFilters(params);
  const now = new Date();
  const result = await db
    .update(studyTrackingNotifications)
    .set({
      isRead: true,
      readAt: now,
    })
    .where(and(eq(studyTrackingNotifications.id, params.id), ...scopeFilters))
    .returning();

  return result[0];
}

export async function markAllStudyTrackingNotificationsReadScoped(params: {
  clinicId?: number;
  particularTokenId?: number;
}) {
  const scopeFilters = buildStudyTrackingNotificationScopeFilters(params);
  const updated = await db
    .update(studyTrackingNotifications)
    .set({
      isRead: true,
      readAt: new Date(),
    })
    .where(and(eq(studyTrackingNotifications.isRead, false), ...scopeFilters))
    .returning({ id: studyTrackingNotifications.id });

  return {
    updatedCount: updated.length,
  };
}
