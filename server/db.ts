import { and, desc, eq, ilike, isNotNull, lte, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import {
  activeSessions,
  clinicUsers,
  clinics,
  reports,
  type ActiveSession,
  type Clinic,
  type ClinicUser,
  type Report,
} from "../drizzle/schema";
import { ENV } from "./lib/env";

const client = postgres(ENV.databaseUrl, {
  prepare: false,
});

export const db = drizzle(client);

export async function closeDbConnection(): Promise<void> {
  await client.end();
}

/* =========================
   CLINICS
========================= */

export async function getClinicById(id: number): Promise<Clinic | undefined> {
  const result = await db.select().from(clinics).where(eq(clinics.id, id)).limit(1);
  return result[0];
}

/* =========================
   USERS
========================= */

export async function getClinicUserById(
  id: number,
): Promise<ClinicUser | undefined> {
  const result = await db
    .select()
    .from(clinicUsers)
    .where(eq(clinicUsers.id, id))
    .limit(1);

  return result[0];
}

export async function getClinicUserByUsername(
  username: string,
): Promise<ClinicUser | undefined> {
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
}): Promise<ClinicUser> {
  const now = new Date();

  const result = await db
    .insert(clinicUsers)
    .values({
      clinicId: user.clinicId,
      username: user.username.trim(),
      passwordHash: user.passwordHash,
      authProId: user.authProId ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: clinicUsers.username,
      set: {
        clinicId: user.clinicId,
        passwordHash: user.passwordHash,
        authProId: user.authProId ?? null,
        updatedAt: now,
      },
    })
    .returning();

  return result[0];
}

/* =========================
   SESSIONS
========================= */

export async function createActiveSession(session: {
  clinicUserId: number;
  tokenHash: string;
  expiresAt: Date;
}): Promise<ActiveSession> {
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

export async function getActiveSessionByToken(
  tokenHash: string,
): Promise<ActiveSession | undefined> {
  const result = await db
    .select()
    .from(activeSessions)
    .where(eq(activeSessions.tokenHash, tokenHash))
    .limit(1);

  return result[0];
}

export async function updateSessionLastAccess(
  tokenHash: string,
): Promise<void> {
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

/* =========================
   REPORTS
========================= */

export async function getReportById(id: number): Promise<Report | undefined> {
  const result = await db.select().from(reports).where(eq(reports.id, id)).limit(1);
  return result[0];
}

export async function upsertReport(input: {
  clinicId: number;
  uploadDate?: Date | null;
  studyType?: string | null;
  patientName?: string | null;
  fileName?: string | null;
  storagePath: string;
}): Promise<Report> {
  const now = new Date();

  const result = await db
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
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: reports.storagePath,
      set: {
        uploadDate: input.uploadDate ?? null,
        studyType: input.studyType ?? null,
        patientName: input.patientName ?? null,
        fileName: input.fileName ?? null,
        updatedAt: now,
      },
    })
    .returning();

  return result[0];
}

export async function getReportsByClinicId(
  clinicId: number,
  limit = 50,
  offset = 0,
): Promise<Report[]> {
  return db
    .select()
    .from(reports)
    .where(eq(reports.clinicId, clinicId))
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
): Promise<Report[]> {
  const filters = [eq(reports.clinicId, clinicId)];

  if (studyType) {
    filters.push(eq(reports.studyType, studyType));
  }

  if (query) {
    filters.push(
      or(
        ilike(reports.patientName, `%${query}%`),
        ilike(reports.fileName, `%${query}%`),
        ilike(reports.studyType, `%${query}%`),
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

export async function getStudyTypes(clinicId: number): Promise<string[]> {
  const result = await db
    .selectDistinct({ studyType: reports.studyType })
    .from(reports)
    .where(and(eq(reports.clinicId, clinicId), isNotNull(reports.studyType)));

  return result
    .map((r) => r.studyType)
    .filter((v): v is string => !!v);
}