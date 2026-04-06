import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import {
  activeSessions,
  clinicUsers,
  clinics,
  reports,
  users,
  type ActiveSession,
  type Clinic,
  type ClinicUser,
  type InsertUser,
  type Report,
} from "../drizzle/schema";
import { ENV } from "./lib/env";

const client = postgres(ENV.databaseUrl, {
  prepare: false,
  max: 10,
});

export const db = drizzle(client);

export async function getDb() {
  return db;
}

// USERS
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const values: InsertUser = {
    openId: user.openId,
    name: user.name ?? null,
    email: user.email ?? null,
    loginMethod: user.loginMethod ?? null,
    lastSignedIn: user.lastSignedIn ?? new Date(),
    role: user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user"),
  };

  await db
    .insert(users)
    .values(values)
    .onConflictDoUpdate({
      target: users.openId,
      set: {
        name: values.name,
        email: values.email,
        loginMethod: values.loginMethod,
        lastSignedIn: values.lastSignedIn,
        role: values.role,
        updatedAt: new Date(),
      },
    });
}

export async function getUserByOpenId(openId: string) {
  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);

  return result[0];
}

// CLINICS
export async function getClinicByClinicId(
  clinicId: string,
): Promise<Clinic | undefined> {
  const result = await db
    .select()
    .from(clinics)
    .where(eq(clinics.clinicId, clinicId))
    .limit(1);

  return result[0];
}

export async function upsertClinic(clinic: {
  clinicId: string;
  name: string;
  storageFolderPath?: string;
  status?: "active" | "inactive";
}): Promise<Clinic> {
  await db
    .insert(clinics)
    .values({
      clinicId: clinic.clinicId,
      name: clinic.name,
      storageFolderPath: clinic.storageFolderPath,
      status: clinic.status ?? "active",
    })
    .onConflictDoUpdate({
      target: clinics.clinicId,
      set: {
        name: clinic.name,
        storageFolderPath: clinic.storageFolderPath,
        status: clinic.status ?? "active",
        updatedAt: new Date(),
      },
    });

  const result = await db
    .select()
    .from(clinics)
    .where(eq(clinics.clinicId, clinic.clinicId))
    .limit(1);

  return result[0]!;
}

// CLINIC USERS
export async function getClinicUserByUsername(
  username: string,
): Promise<ClinicUser | undefined> {
  const result = await db
    .select()
    .from(clinicUsers)
    .where(eq(clinicUsers.username, username))
    .limit(1);

  return result[0];
}

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

export async function createClinicUser(user: {
  clinicId: number;
  username: string;
  passwordHash: string;
  authProId?: string;
}): Promise<ClinicUser> {
  const created = await db.insert(clinicUsers).values(user).returning();
  return created[0]!;
}

export async function upsertClinicUser(user: {
  clinicId: number;
  username: string;
  passwordHash: string;
  authProId?: string;
}): Promise<ClinicUser> {
  await db
    .insert(clinicUsers)
    .values(user)
    .onConflictDoUpdate({
      target: clinicUsers.username,
      set: {
        clinicId: user.clinicId,
        passwordHash: user.passwordHash,
        authProId: user.authProId,
      },
    });

  const result = await db
    .select()
    .from(clinicUsers)
    .where(eq(clinicUsers.username, user.username))
    .limit(1);

  return result[0]!;
}

// REPORTS
export async function getReportsByClinicId(
  clinicId: number,
  limit = 100,
  offset = 0,
): Promise<Report[]> {
  return await db
    .select()
    .from(reports)
    .where(eq(reports.clinicId, clinicId))
    .orderBy(desc(reports.uploadDate))
    .limit(limit)
    .offset(offset);
}

export async function searchReports(
  clinicId: number,
  query?: string,
  studyType?: string,
  limit = 100,
  offset = 0,
): Promise<Report[]> {
  const conditions = [eq(reports.clinicId, clinicId)];

  if (query?.trim()) {
    conditions.push(
      or(
        ilike(reports.patientName, `%${query}%`),
        ilike(reports.fileName, `%${query}%`),
      )!,
    );
  }

  if (studyType?.trim()) {
    conditions.push(eq(reports.studyType, studyType));
  }

  return await db
    .select()
    .from(reports)
    .where(and(...conditions))
    .orderBy(desc(reports.uploadDate))
    .limit(limit)
    .offset(offset);
}

export async function upsertReport(report: {
  clinicId: number;
  uploadDate?: Date | null;
  studyType?: string | null;
  patientName?: string | null;
  fileName?: string | null;
  storagePath: string;
  previewUrl?: string | null;
  downloadUrl?: string | null;
}): Promise<Report> {
  await db
    .insert(reports)
    .values({
      clinicId: report.clinicId,
      uploadDate: report.uploadDate ?? null,
      studyType: report.studyType ?? null,
      patientName: report.patientName ?? null,
      fileName: report.fileName ?? null,
      storagePath: report.storagePath,
      previewUrl: report.previewUrl ?? null,
      downloadUrl: report.downloadUrl ?? null,
    })
    .onConflictDoUpdate({
      target: reports.storagePath,
      set: {
        uploadDate: report.uploadDate ?? null,
        studyType: report.studyType ?? null,
        patientName: report.patientName ?? null,
        fileName: report.fileName ?? null,
        previewUrl: report.previewUrl ?? null,
        downloadUrl: report.downloadUrl ?? null,
        updatedAt: new Date(),
      },
    });

  const result = await db
    .select()
    .from(reports)
    .where(eq(reports.storagePath, report.storagePath))
    .limit(1);

  return result[0]!;
}

export async function getReportById(id: number): Promise<Report | undefined> {
  const result = await db
    .select()
    .from(reports)
    .where(eq(reports.id, id))
    .limit(1);

  return result[0];
}

export async function getStudyTypes(clinicId: number): Promise<string[]> {
  const result = await db
    .selectDistinct({
      studyType: reports.studyType,
    })
    .from(reports)
    .where(and(eq(reports.clinicId, clinicId), sql`${reports.studyType} IS NOT NULL`));

  return result
    .map((item) => item.studyType)
    .filter((value): value is string => Boolean(value));
}

// ACTIVE SESSIONS
export async function createActiveSession(session: {
  clinicUserId: number;
  token: string;
  expiresAt: Date;
}): Promise<ActiveSession> {
  const created = await db
    .insert(activeSessions)
    .values({
      clinicUserId: session.clinicUserId,
      token: session.token,
      expiresAt: session.expiresAt,
      lastAccess: new Date(),
    })
    .returning();

  return created[0]!;
}

export async function getActiveSessionByToken(
  token: string,
): Promise<ActiveSession | undefined> {
  const result = await db
    .select()
    .from(activeSessions)
    .where(eq(activeSessions.token, token))
    .limit(1);

  return result[0];
}

export async function updateSessionLastAccess(token: string): Promise<void> {
  await db
    .update(activeSessions)
    .set({
      lastAccess: new Date(),
    })
    .where(eq(activeSessions.token, token));
}

export async function deleteActiveSession(token: string): Promise<void> {
  await db.delete(activeSessions).where(eq(activeSessions.token, token));
}

export async function deleteExpiredSessions(): Promise<void> {
  await db
    .delete(activeSessions)
    .where(sql`${activeSessions.expiresAt} < NOW()`);
}