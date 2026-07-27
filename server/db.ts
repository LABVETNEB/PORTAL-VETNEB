import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, lt, lte, or, sql } from "drizzle-orm";
import {
  activeSessions,
  adminSessions,
  adminUsers,
  clinicUsers,
  clinics,
  loginFailedAttempts,
  loginRateLimits,
  type ClinicUserRole,
  type LoginFailedAttemptReason,
  type LoginFailedAttemptSurface,
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

function normalizeLoginIdentifierForLookup(identifier: string) {
  const trimmedIdentifier = identifier.trim();
  const normalizedEmail = trimmedIdentifier.toLowerCase();
  const canMatchEmail = normalizedEmail.includes("@");

  return {
    trimmedIdentifier,
    normalizedEmail,
    canMatchEmail,
  };
}

export async function getClinicUserByIdentifier(identifier: string) {
  const { trimmedIdentifier, normalizedEmail, canMatchEmail } =
    normalizeLoginIdentifierForLookup(identifier);

  if (!trimmedIdentifier) {
    return undefined;
  }

  const whereClauses = [eq(clinicUsers.username, trimmedIdentifier)];

  if (canMatchEmail) {
    whereClauses.push(
      sql`lower(trim(${clinics.contactEmail})) = ${normalizedEmail}`,
    );
  }

  const result = await db
    .select({
      id: clinicUsers.id,
      clinicId: clinicUsers.clinicId,
      username: clinicUsers.username,
      passwordHash: clinicUsers.passwordHash,
      authProId: clinicUsers.authProId,
      role: clinicUsers.role,
    })
    .from(clinicUsers)
    .leftJoin(clinics, eq(clinicUsers.clinicId, clinics.id))
    .where(or(...whereClauses)!)
    .orderBy(
      sql`CASE WHEN ${clinicUsers.username} = ${trimmedIdentifier} THEN 0 ELSE 1 END`,
      clinicUsers.id,
    )
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

export async function getAdminUserByIdentifier(identifier: string) {
  const { trimmedIdentifier, normalizedEmail, canMatchEmail } =
    normalizeLoginIdentifierForLookup(identifier);

  if (!trimmedIdentifier) {
    return undefined;
  }

  const whereClauses = [eq(adminUsers.username, trimmedIdentifier)];

  if (canMatchEmail) {
    whereClauses.push(
      sql`lower(trim(${adminUsers.email})) = ${normalizedEmail}`,
    );
  }

  const result = await db
    .select()
    .from(adminUsers)
    .where(or(...whereClauses)!)
    .orderBy(
      sql`CASE WHEN ${adminUsers.username} = ${trimmedIdentifier} THEN 0 ELSE 1 END`,
      adminUsers.id,
    )
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
  metadata?: {
    surface: string;
    identifierHash: string;
    ipHash: string;
    keyVersion: string;
  };
}) {
  const result = await db
    .insert(loginRateLimits)
    .values({
      keyHash: input.keyHash,
      surface: input.metadata?.surface ?? null,
      identifierHash: input.metadata?.identifierHash ?? null,
      ipHash: input.metadata?.ipHash ?? null,
      keyVersion: input.metadata?.keyVersion ?? null,
      count: input.count,
      resetAt: input.resetAt,
      createdAt: input.now,
      updatedAt: input.now,
    })
    .onConflictDoUpdate({
      target: loginRateLimits.keyHash,
      set: {
        surface: input.metadata?.surface ?? null,
        identifierHash: input.metadata?.identifierHash ?? null,
        ipHash: input.metadata?.ipHash ?? null,
        keyVersion: input.metadata?.keyVersion ?? null,
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
  metadata?: {
    surface: string;
    identifierHash: string;
    ipHash: string;
    keyVersion: string;
  };
}) {
  const result = await db
    .insert(loginRateLimits)
    .values({
      keyHash: input.keyHash,
      surface: input.metadata?.surface ?? null,
      identifierHash: input.metadata?.identifierHash ?? null,
      ipHash: input.metadata?.ipHash ?? null,
      keyVersion: input.metadata?.keyVersion ?? null,
      count: input.count,
      resetAt: input.resetAt,
      createdAt: input.now,
      updatedAt: input.now,
    })
    .onConflictDoUpdate({
      target: loginRateLimits.keyHash,
      set: {
        surface: input.metadata?.surface ?? null,
        identifierHash: input.metadata?.identifierHash ?? null,
        ipHash: input.metadata?.ipHash ?? null,
        keyVersion: input.metadata?.keyVersion ?? null,
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

export async function deleteLoginRateLimitEntry(keyHash: string): Promise<void> {
  await db
    .delete(loginRateLimits)
    .where(eq(loginRateLimits.keyHash, keyHash));
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

export type AdminSessionWithUserRecord = {
  session: {
    id: number;
    adminUserId: number;
    tokenHash: string;
    lastAccess: Date | null;
    expiresAt: Date | null;
    createdAt: Date;
  };
  adminUser: {
    id: number;
    username: string;
  } | null;
};

export async function getAdminSessionWithUser(
  tokenHash: string,
): Promise<AdminSessionWithUserRecord | null> {
  const result = await db
    .select({
      session: {
        id: adminSessions.id,
        adminUserId: adminSessions.adminUserId,
        tokenHash: adminSessions.tokenHash,
        lastAccess: adminSessions.lastAccess,
        expiresAt: adminSessions.expiresAt,
        createdAt: adminSessions.createdAt,
      },
      adminUser: {
        id: adminUsers.id,
        username: adminUsers.username,
      },
    })
    .from(adminSessions)
    .leftJoin(adminUsers, eq(adminSessions.adminUserId, adminUsers.id))
    .where(eq(adminSessions.tokenHash, tokenHash))
    .limit(1);

  return result[0] ?? null;
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
