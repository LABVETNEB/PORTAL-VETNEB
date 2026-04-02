import { eq, and, desc, like, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  clinics,
  clinicUsers,
  reports,
  activeSessions,
  type Clinic,
  type ClinicUser,
  type Report,
  type ActiveSession,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ============================================
// CLÍNICAS
// ============================================

export async function getClinicByClinicId(
  clinicId: string,
): Promise<Clinic | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(clinics)
    .where(eq(clinics.clinicId, clinicId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function upsertClinic(clinic: {
  clinicId: string;
  name: string;
  driveFolderId?: string;
  status?: "active" | "inactive";
}): Promise<Clinic> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getClinicByClinicId(clinic.clinicId);

  if (existing) {
    const updated = await db
      .update(clinics)
      .set({
        name: clinic.name,
        driveFolderId: clinic.driveFolderId,
        status: clinic.status || "active",
        updatedAt: new Date(),
      })
      .where(eq(clinics.clinicId, clinic.clinicId));

    return (await getClinicByClinicId(clinic.clinicId))!;
  } else {
    await db.insert(clinics).values({
      clinicId: clinic.clinicId,
      name: clinic.name,
      driveFolderId: clinic.driveFolderId,
      status: clinic.status || "active",
    });

    return (await getClinicByClinicId(clinic.clinicId))!;
  }
}

// ============================================
// USUARIOS DE CLÍNICAS
// ============================================

export async function getClinicUserByUsername(
  username: string,
): Promise<ClinicUser | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(clinicUsers)
    .where(eq(clinicUsers.username, username))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getClinicUserById(
  id: number,
): Promise<ClinicUser | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(clinicUsers)
    .where(eq(clinicUsers.id, id))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function createClinicUser(user: {
  clinicId: number;
  username: string;
  passwordHash: string;
  authProId?: string;
}): Promise<ClinicUser> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(clinicUsers).values(user);
  return (await getClinicUserById(Number(result[0].insertId)))!;
}

export async function upsertClinicUser(user: {
  clinicId: number;
  username: string;
  passwordHash: string;
  authProId?: string;
}): Promise<ClinicUser> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getClinicUserByUsername(user.username);

  if (existing) {
    await db
      .update(clinicUsers)
      .set({
        passwordHash: user.passwordHash,
        authProId: user.authProId,
      })
      .where(eq(clinicUsers.id, existing.id));

    return (await getClinicUserById(existing.id))!;
  } else {
    return await createClinicUser(user);
  }
}

// ============================================
// INFORMES
// ============================================

export async function getReportsByClinicId(
  clinicId: number,
  limit = 100,
  offset = 0,
): Promise<Report[]> {
  const db = await getDb();
  if (!db) return [];

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
  query: string,
  studyType?: string,
  limit = 100,
  offset = 0,
): Promise<Report[]> {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(reports.clinicId, clinicId)];

  if (query) {
    conditions.push(
      sql`MATCH(${reports.patientName}) AGAINST(${query} IN BOOLEAN MODE) OR ${reports.fileName} LIKE ${`%${query}%`}`,
    );
  }

  if (studyType) {
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
  uploadDate?: Date;
  studyType?: string;
  patientName?: string;
  fileName?: string;
  driveFileId?: string;
  previewUrl?: string;
  downloadUrl?: string;
}): Promise<Report> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  if (!report.driveFileId) {
    throw new Error("driveFileId is required for upsert");
  }

  const existing = await db
    .select()
    .from(reports)
    .where(eq(reports.driveFileId, report.driveFileId))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(reports)
      .set({
        uploadDate: report.uploadDate,
        studyType: report.studyType,
        patientName: report.patientName,
        fileName: report.fileName,
        previewUrl: report.previewUrl,
        downloadUrl: report.downloadUrl,
        updatedAt: new Date(),
      })
      .where(eq(reports.driveFileId, report.driveFileId));

    const updated = await db
      .select()
      .from(reports)
      .where(eq(reports.driveFileId, report.driveFileId))
      .limit(1);

    return updated[0]!;
  } else {
    await db.insert(reports).values(report);

    const created = await db
      .select()
      .from(reports)
      .where(eq(reports.driveFileId, report.driveFileId))
      .limit(1);

    return created[0]!;
  }
}

export async function getReportById(id: number): Promise<Report | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(reports)
    .where(eq(reports.id, id))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ============================================
// SESIONES ACTIVAS
// ============================================

export async function createActiveSession(session: {
  clinicUserId: number;
  token: string;
  expiresAt: Date;
}): Promise<ActiveSession> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(activeSessions).values({
    clinicUserId: session.clinicUserId,
    token: session.token,
    expiresAt: session.expiresAt,
    lastAccess: new Date(),
  });

  const result = await db
    .select()
    .from(activeSessions)
    .where(eq(activeSessions.token, session.token))
    .limit(1);

  return result[0]!;
}

export async function getActiveSessionByToken(
  token: string,
): Promise<ActiveSession | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(activeSessions)
    .where(eq(activeSessions.token, token))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function updateSessionLastAccess(token: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db
    .update(activeSessions)
    .set({ lastAccess: new Date() })
    .where(eq(activeSessions.token, token));
}

export async function deleteActiveSession(token: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.delete(activeSessions).where(eq(activeSessions.token, token));
}

export async function cleanupExpiredSessions(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.delete(activeSessions).where(sql`expires_at < NOW()`);
}

export async function getStudyTypes(clinicId: number): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];

  const result = await db
    .selectDistinct({ studyType: reports.studyType })
    .from(reports)
    .where(
      and(
        eq(reports.clinicId, clinicId),
        sql`${reports.studyType} IS NOT NULL`,
      ),
    );

  return result.map((r) => r.studyType).filter(Boolean) as string[];
}
