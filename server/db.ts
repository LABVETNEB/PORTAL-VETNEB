import { getReportStudyTypes as getCanonicalReportStudyTypes, REPORT_STUDY_TYPE_LABELS } from "./lib/report-study-types.ts";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { and, desc, eq, ilike, isNotNull, lt, lte, or, sql } from "drizzle-orm";
import {
  activeSessions,
  adminSessions,
  adminUsers,
  clinicUsers,
  clinics,
  loginFailedAttempts,
  loginRateLimits,
  reports,
  reportStatusHistory,
  type ClinicUserRole,
  type LoginFailedAttemptReason,
  type LoginFailedAttemptSurface,
  type ReportStatus,
} from "../drizzle/schema.ts";
import { ENV } from "./lib/env.ts";
import { normalizeClinicUserRole } from "./lib/permissions.ts";

const client = postgres(ENV.databaseUrl, {
  prepare: false,
  max: ENV.databaseMaxConnections,
});

export const pgClient = client;
export const db = drizzle(client);

export async function closeDbConnection(): Promise<void> {
  await client.end();
}

/* ========================= CLINICS ========================= */

export async function getClinicById(id: number) {
  const result = await db
    .select()
    .from(clinics)
    .where(eq(clinics.id, id))
    .limit(1);

  return result[0];
}

/* ========================= CLINIC USERS ========================= */

export async function getClinicUserById(id: number) {
  const result = await db
    .select()
    .from(clinicUsers)
    .where(eq(clinicUsers.id, id))
    .limit(1);

  return result[0];
}

export async function getClinicUserByUsername(username: string) {
  const result = await db
    .select()
    .from(clinicUsers)
    .where(eq(clinicUsers.username, username.trim()))
    .limit(1);

  return result[0];
}

export async function upsertClinicUser(user: {
  clinicId: number;
  username: string;
  passwordHash: string;
  authProId?: string | null;
  role?: ClinicUserRole;
}) {
  const now = new Date();
  const normalizedRole = normalizeClinicUserRole(user.role, "clinic_staff");

  const result = await db
    .insert(clinicUsers)
    .values({
      clinicId: user.clinicId,
      username: user.username.trim(),
      passwordHash: user.passwordHash,
      authProId: user.authProId ?? null,
      role: normalizedRole,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: clinicUsers.username,
      set: {
        clinicId: user.clinicId,
        passwordHash: user.passwordHash,
        authProId: user.authProId ?? null,
        role: normalizedRole,
        updatedAt: now,
      },
    })
    .returning();

  return result[0];
}

/* ========================= ADMIN USERS ========================= */

export async function getAdminUserById(id: number) {
  const result = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.id, id))
    .limit(1);

  return result[0];
}

export async function getAdminUserByUsername(username: string) {
  const result = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.username, username.trim()))
    .limit(1);

  return result[0];
}

/* ========================= LOGIN FAILED ATTEMPTS ========================= */

export async function recordLoginFailedAttempt(input: {
  surface: LoginFailedAttemptSurface;
  username?: string | null;
  reason: LoginFailedAttemptReason;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt?: Date;
}) {
  const result = await db
    .insert(loginFailedAttempts)
    .values({
      surface: input.surface,
      username: input.username ?? null,
      reason: input.reason,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      createdAt: input.createdAt ?? new Date(),
    })
    .returning();

  return result[0];
}

/* ========================= LOGIN RATE LIMITS ========================= */

export async function getLoginRateLimitEntry(keyHash: string) {
  const result = await db
    .select({
      count: loginRateLimits.count,
      resetAt: loginRateLimits.resetAt,
    })
    .from(loginRateLimits)
    .where(eq(loginRateLimits.keyHash, keyHash))
    .limit(1);

  return result[0];
}

export async function setLoginRateLimitEntry(input: {
  keyHash: string;
  count: number;
  resetAt: Date;
  now: Date;
}) {
  const result = await db
    .insert(loginRateLimits)
    .values({
      keyHash: input.keyHash,
      count: input.count,
      resetAt: input.resetAt,
      createdAt: input.now,
      updatedAt: input.now,
    })
    .onConflictDoUpdate({
      target: loginRateLimits.keyHash,
      set: {
        count: input.count,
        resetAt: input.resetAt,
        updatedAt: input.now,
      },
    })
    .returning({
      count: loginRateLimits.count,
      resetAt: loginRateLimits.resetAt,
    });

  return result[0];
}

export async function incrementLoginRateLimitEntry(input: {
  keyHash: string;
  count: number;
  resetAt: Date;
  now: Date;
}) {
  const result = await db
    .insert(loginRateLimits)
    .values({
      keyHash: input.keyHash,
      count: input.count,
      resetAt: input.resetAt,
      createdAt: input.now,
      updatedAt: input.now,
    })
    .onConflictDoUpdate({
      target: loginRateLimits.keyHash,
      set: {
        count: sql<number>`
          CASE
            WHEN ${loginRateLimits.resetAt} <= ${input.now} THEN ${input.count}
            ELSE ${loginRateLimits.count} + 1
          END
        `,
        resetAt: sql<Date>`
          CASE
            WHEN ${loginRateLimits.resetAt} <= ${input.now} THEN ${input.resetAt}
            ELSE ${loginRateLimits.resetAt}
          END
        `,
        updatedAt: input.now,
      },
    })
    .returning({
      count: loginRateLimits.count,
      resetAt: loginRateLimits.resetAt,
    });

  return result[0];
}

export async function deleteExpiredLoginRateLimitEntries(now: Date) {
  await db
    .delete(loginRateLimits)
    .where(lt(loginRateLimits.resetAt, now));
}

/* ========================= CLINIC SESSIONS ========================= */

export async function createActiveSession(session: {
  clinicUserId: number;
  tokenHash: string;
  expiresAt: Date;
}) {
  const result = await db
    .insert(activeSessions)
    .values({
      clinicUserId: session.clinicUserId,
      tokenHash: session.tokenHash,
      expiresAt: session.expiresAt,
      lastAccess: new Date(),
    })
    .returning();

  return result[0];
}

export async function getActiveSessionByToken(tokenHash: string) {
  const result = await db
    .select()
    .from(activeSessions)
    .where(eq(activeSessions.tokenHash, tokenHash))
    .limit(1);

  return result[0];
}

export async function updateSessionLastAccess(tokenHash: string): Promise<void> {
  await db
    .update(activeSessions)
    .set({ lastAccess: new Date() })
    .where(eq(activeSessions.tokenHash, tokenHash));
}

export async function deleteActiveSession(tokenHash: string): Promise<void> {
  await db
    .delete(activeSessions)
    .where(eq(activeSessions.tokenHash, tokenHash));
}

export async function deleteExpiredSessions(): Promise<number> {
  const now = new Date();

  const result = await db
    .delete(activeSessions)
    .where(lte(activeSessions.expiresAt, now))
    .returning({ id: activeSessions.id });

  return result.length;
}

/* ========================= ADMIN SESSIONS ========================= */

export async function createAdminSession(session: {
  adminUserId: number;
  tokenHash: string;
  expiresAt: Date;
}) {
  const result = await db
    .insert(adminSessions)
    .values({
      adminUserId: session.adminUserId,
      tokenHash: session.tokenHash,
      expiresAt: session.expiresAt,
      lastAccess: new Date(),
    })
    .returning();

  return result[0];
}

export async function getAdminSessionByToken(tokenHash: string) {
  const result = await db
    .select()
    .from(adminSessions)
    .where(eq(adminSessions.tokenHash, tokenHash))
    .limit(1);

  return result[0];
}

export async function updateAdminSessionLastAccess(
  tokenHash: string,
): Promise<void> {
  await db
    .update(adminSessions)
    .set({ lastAccess: new Date() })
    .where(eq(adminSessions.tokenHash, tokenHash));
}

export async function deleteAdminSession(tokenHash: string): Promise<void> {
  await db
    .delete(adminSessions)
    .where(eq(adminSessions.tokenHash, tokenHash));
}

export async function deleteExpiredAdminSessions(): Promise<number> {
  const now = new Date();

  const result = await db
    .delete(adminSessions)
    .where(lte(adminSessions.expiresAt, now))
    .returning({ id: adminSessions.id });

  return result.length;
}

/* ========================= REPORTS ========================= */

export async function getReportById(id: number) {
  const result = await db
    .select()
    .from(reports)
    .where(eq(reports.id, id))
    .limit(1);

  return result[0];
}

export async function getReportStatusHistory(reportId: number) {
  return db
    .select()
    .from(reportStatusHistory)
    .where(eq(reportStatusHistory.reportId, reportId))
    .orderBy(desc(reportStatusHistory.createdAt), desc(reportStatusHistory.id));
}

export async function upsertReport(input: {
  clinicId: number;
  uploadDate?: Date | null;
  studyType?: string | null;
  patientName?: string | null;
  fileName?: string | null;
  storagePath: string;
  createdByClinicUserId?: number | null;
  createdByAdminUserId?: number | null;
}) {
  const now = new Date();

  return db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(reports)
      .where(eq(reports.storagePath, input.storagePath))
      .limit(1);

    if (existing[0]) {
      const updated = await tx
        .update(reports)
        .set({
          uploadDate: input.uploadDate ?? null,
          studyType: input.studyType ?? null,
          patientName: input.patientName ?? null,
          fileName: input.fileName ?? null,
          updatedAt: now,
        })
        .where(eq(reports.id, existing[0].id))
        .returning();

      return updated[0];
    }

    const inserted = await tx
      .insert(reports)
      .values({
        clinicId: input.clinicId,
        uploadDate: input.uploadDate ?? null,
        studyType: input.studyType ?? null,
        patientName: input.patientName ?? null,
        fileName: input.fileName ?? null,
        storagePath: input.storagePath,
        previewUrl: null,
        downloadUrl: null,
        currentStatus: "uploaded",
        statusChangedAt: now,
        statusChangedByClinicUserId: input.createdByClinicUserId ?? null,
        statusChangedByAdminUserId: input.createdByAdminUserId ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const report = inserted[0];

    const initialChangedBy =
      input.createdByClinicUserId ?? input.createdByAdminUserId ?? null;
    const initialChangedByType =
      input.createdByClinicUserId != null
        ? "clinic_user"
        : input.createdByAdminUserId != null
          ? "admin_user"
          : "system";

    try {
      await tx.execute(sql`
        INSERT INTO "report_status_history" (
          "report_id",
          "status",
          "previous_status",
          "changed_by",
          "changed_by_type",
          "notes",
          "created_at",
          "from_status",
          "to_status",
          "changed_by_clinic_user_id",
          "changed_by_admin_user_id",
          "note"
        )
        VALUES (
          ${report.id},
          ${"uploaded"},
          ${null},
          ${initialChangedBy},
          ${initialChangedByType},
          ${"Informe cargado inicialmente"},
          ${now.toISOString()},
          ${null},
          ${"uploaded"},
          ${input.createdByClinicUserId ?? null},
          ${input.createdByAdminUserId ?? null},
          ${"Informe cargado inicialmente"}
        )
      `);
    } catch (error) {
      if (
        typeof error !== "object" ||
        error === null ||
        !("code" in error) ||
        error.code !== "42703"
      ) {
        throw error;
      }

      await tx.insert(reportStatusHistory).values({
        reportId: report.id,
        fromStatus: null,
        toStatus: "uploaded",
        changedByClinicUserId: input.createdByClinicUserId ?? null,
        changedByAdminUserId: input.createdByAdminUserId ?? null,
        note: "Informe cargado inicialmente",
        createdAt: now,
      });
    }

    return report;
  });
}

export async function updateReportStatus(input: {
  reportId: number;
  toStatus: ReportStatus;
  note?: string | null;
  changedByClinicUserId?: number | null;
  changedByAdminUserId?: number | null;
}) {
  const now = new Date();

  return db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(reports)
      .where(eq(reports.id, input.reportId))
      .limit(1);

    const report = existing[0];

    if (!report) {
      return undefined;
    }

    const updated = await tx
      .update(reports)
      .set({
        currentStatus: input.toStatus,
        statusChangedAt: now,
        statusChangedByClinicUserId: input.changedByClinicUserId ?? null,
        statusChangedByAdminUserId: input.changedByAdminUserId ?? null,
        updatedAt: now,
      })
      .where(eq(reports.id, input.reportId))
      .returning();

    const changedBy =
      input.changedByClinicUserId ?? input.changedByAdminUserId ?? null;
    const changedByType =
      input.changedByClinicUserId != null
        ? "clinic_user"
        : input.changedByAdminUserId != null
          ? "admin_user"
          : "system";

    try {
      await tx.execute(sql`
        INSERT INTO "report_status_history" (
          "report_id",
          "status",
          "previous_status",
          "changed_by",
          "changed_by_type",
          "notes",
          "created_at",
          "from_status",
          "to_status",
          "changed_by_clinic_user_id",
          "changed_by_admin_user_id",
          "note"
        )
        VALUES (
          ${report.id},
          ${input.toStatus},
          ${report.currentStatus},
          ${changedBy},
          ${changedByType},
          ${input.note ?? null},
          ${now.toISOString()},
          ${report.currentStatus},
          ${input.toStatus},
          ${input.changedByClinicUserId ?? null},
          ${input.changedByAdminUserId ?? null},
          ${input.note ?? null}
        )
      `);
    } catch (error) {
      if (
        typeof error !== "object" ||
        error === null ||
        !("code" in error) ||
        error.code !== "42703"
      ) {
        throw error;
      }

      await tx.insert(reportStatusHistory).values({
        reportId: report.id,
        fromStatus: report.currentStatus,
        toStatus: input.toStatus,
        changedByClinicUserId: input.changedByClinicUserId ?? null,
        changedByAdminUserId: input.changedByAdminUserId ?? null,
        note: input.note ?? null,
        createdAt: now,
      });
    }

    return updated[0];
  });
}

export async function getReportsByClinicId(
  clinicId: number,
  limit = 50,
  offset = 0,
  currentStatus?: ReportStatus,
) {
  const filters = [eq(reports.clinicId, clinicId)];

  if (currentStatus) {
    filters.push(eq(reports.currentStatus, currentStatus));
  }

  return db
    .select()
    .from(reports)
    .where(and(...filters))
    .orderBy(desc(reports.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function searchReports(
  clinicId: number,
  query?: string,
  studyType?: string,
  limit = 50,
  offset = 0,
  currentStatus?: ReportStatus,
) {
  const filters = [eq(reports.clinicId, clinicId)];

  if (studyType) {
    filters.push(eq(reports.studyType, studyType));
  }

  if (currentStatus) {
    filters.push(eq(reports.currentStatus, currentStatus));
  }

  if (query) {
    filters.push(
      or(
        ilike(reports.patientName, "%" + query + "%"),
        ilike(reports.fileName, "%" + query + "%"),
        ilike(reports.studyType, "%" + query + "%"),
      )!,
    );
  }

  return db
    .select()
    .from(reports)
    .where(and(...filters))
    .orderBy(desc(reports.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getReportStudyTypes(_clinicId: number) {
  void REPORT_STUDY_TYPE_LABELS;
  return getCanonicalReportStudyTypes();
}

export const getStudyTypes = getReportStudyTypes;
