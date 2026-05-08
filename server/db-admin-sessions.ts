import { desc, eq } from "drizzle-orm";

import { db } from "./db.ts";
import {
  activeSessions,
  adminSessions,
  particularSessions,
} from "../drizzle/schema";

export type AdminSessionType = "admin" | "clinic" | "particular";
export type AdminSessionStatus = "active" | "expired";

export type AdminSessionSummary = {
  sessionType: AdminSessionType;
  sessionId: number;
  actorType: "admin_user" | "clinic_user" | "particular_token";
  actorId: number;
  createdAt: string;
  lastAccess: string | null;
  expiresAt: string | null;
  status: AdminSessionStatus;
};

export type AdminSessionsQuery = {
  sessionType?: AdminSessionType;
  status?: AdminSessionStatus;
  limit?: number;
  offset?: number;
};

export type AdminSessionsSnapshot = {
  success: true;
  sessions: AdminSessionSummary[];
  total: number;
  limit: number;
  offset: number;
};

function normalizeLimit(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 50;
  }

  return Math.min(Math.max(Math.trunc(value), 1), 100);
}

function normalizeOffset(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(Math.trunc(value), 0);
}

function toIsoDate(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function getSessionStatus(
  expiresAt: Date | null | undefined,
  now: Date,
): AdminSessionStatus {
  return expiresAt && expiresAt.getTime() <= now.getTime()
    ? "expired"
    : "active";
}

function sortSessionsDesc(
  a: AdminSessionSummary,
  b: AdminSessionSummary,
) {
  return Date.parse(b.createdAt) - Date.parse(a.createdAt);
}

export async function getAdminSessionsSnapshot(
  params: AdminSessionsQuery = {},
  now = new Date(),
): Promise<AdminSessionsSnapshot> {
  const limit = normalizeLimit(params.limit);
  const offset = normalizeOffset(params.offset);
  const fetchLimit = limit + offset;

  const includeAdmin =
    params.sessionType === undefined || params.sessionType === "admin";
  const includeClinic =
    params.sessionType === undefined || params.sessionType === "clinic";
  const includeParticular =
    params.sessionType === undefined || params.sessionType === "particular";

  const [adminRows, clinicRows, particularRows] = await Promise.all([
    includeAdmin
      ? db
          .select({
            sessionId: adminSessions.id,
            actorId: adminSessions.adminUserId,
            createdAt: adminSessions.createdAt,
            lastAccess: adminSessions.lastAccess,
            expiresAt: adminSessions.expiresAt,
          })
          .from(adminSessions)
          .orderBy(desc(adminSessions.createdAt))
          .limit(fetchLimit)
      : Promise.resolve([]),
    includeClinic
      ? db
          .select({
            sessionId: activeSessions.id,
            actorId: activeSessions.clinicUserId,
            createdAt: activeSessions.createdAt,
            lastAccess: activeSessions.lastAccess,
            expiresAt: activeSessions.expiresAt,
          })
          .from(activeSessions)
          .orderBy(desc(activeSessions.createdAt))
          .limit(fetchLimit)
      : Promise.resolve([]),
    includeParticular
      ? db
          .select({
            sessionId: particularSessions.id,
            actorId: particularSessions.particularTokenId,
            createdAt: particularSessions.createdAt,
            lastAccess: particularSessions.lastAccess,
            expiresAt: particularSessions.expiresAt,
          })
          .from(particularSessions)
          .orderBy(desc(particularSessions.createdAt))
          .limit(fetchLimit)
      : Promise.resolve([]),
  ]);

  const sessions: AdminSessionSummary[] = [
    ...adminRows.map((row) => ({
      sessionType: "admin" as const,
      sessionId: row.sessionId,
      actorType: "admin_user" as const,
      actorId: row.actorId,
      createdAt: row.createdAt.toISOString(),
      lastAccess: toIsoDate(row.lastAccess),
      expiresAt: toIsoDate(row.expiresAt),
      status: getSessionStatus(row.expiresAt, now),
    })),
    ...clinicRows.map((row) => ({
      sessionType: "clinic" as const,
      sessionId: row.sessionId,
      actorType: "clinic_user" as const,
      actorId: row.actorId,
      createdAt: row.createdAt.toISOString(),
      lastAccess: toIsoDate(row.lastAccess),
      expiresAt: toIsoDate(row.expiresAt),
      status: getSessionStatus(row.expiresAt, now),
    })),
    ...particularRows.map((row) => ({
      sessionType: "particular" as const,
      sessionId: row.sessionId,
      actorType: "particular_token" as const,
      actorId: row.actorId,
      createdAt: row.createdAt.toISOString(),
      lastAccess: toIsoDate(row.lastAccess),
      expiresAt: toIsoDate(row.expiresAt),
      status: getSessionStatus(row.expiresAt, now),
    })),
  ]
    .filter((session) =>
      params.status ? session.status === params.status : true,
    )
    .sort(sortSessionsDesc);

  return {
    success: true,
    sessions: sessions.slice(offset, offset + limit),
    total: sessions.length,
    limit,
    offset,
  };
}
export type AdminSessionRevocationTarget = {
  sessionType: AdminSessionType;
  sessionId: number;
};

export type AdminSessionRevocationResult = AdminSessionSummary & {
  revokedAt: string;
};

function buildAdminSessionSummary(input: {
  sessionType: AdminSessionType;
  sessionId: number;
  actorType: AdminSessionSummary["actorType"];
  actorId: number;
  createdAt: Date;
  lastAccess: Date | null;
  expiresAt: Date | null;
  now: Date;
}): AdminSessionSummary {
  return {
    sessionType: input.sessionType,
    sessionId: input.sessionId,
    actorType: input.actorType,
    actorId: input.actorId,
    createdAt: input.createdAt.toISOString(),
    lastAccess: toIsoDate(input.lastAccess),
    expiresAt: toIsoDate(input.expiresAt),
    status: getSessionStatus(input.expiresAt, input.now),
  };
}

export async function revokeAdminSessionById(
  target: AdminSessionRevocationTarget,
  now = new Date(),
): Promise<AdminSessionRevocationResult | null> {
  if (target.sessionType === "admin") {
    const result = await db
      .delete(adminSessions)
      .where(eq(adminSessions.id, target.sessionId))
      .returning({
        sessionId: adminSessions.id,
        actorId: adminSessions.adminUserId,
        createdAt: adminSessions.createdAt,
        lastAccess: adminSessions.lastAccess,
        expiresAt: adminSessions.expiresAt,
      });

    const row = result[0];

    if (!row) return null;

    return {
      ...buildAdminSessionSummary({
        sessionType: "admin",
        sessionId: row.sessionId,
        actorType: "admin_user",
        actorId: row.actorId,
        createdAt: row.createdAt,
        lastAccess: row.lastAccess,
        expiresAt: row.expiresAt,
        now,
      }),
      revokedAt: now.toISOString(),
    };
  }

  if (target.sessionType === "clinic") {
    const result = await db
      .delete(activeSessions)
      .where(eq(activeSessions.id, target.sessionId))
      .returning({
        sessionId: activeSessions.id,
        actorId: activeSessions.clinicUserId,
        createdAt: activeSessions.createdAt,
        lastAccess: activeSessions.lastAccess,
        expiresAt: activeSessions.expiresAt,
      });

    const row = result[0];

    if (!row) return null;

    return {
      ...buildAdminSessionSummary({
        sessionType: "clinic",
        sessionId: row.sessionId,
        actorType: "clinic_user",
        actorId: row.actorId,
        createdAt: row.createdAt,
        lastAccess: row.lastAccess,
        expiresAt: row.expiresAt,
        now,
      }),
      revokedAt: now.toISOString(),
    };
  }

  const result = await db
    .delete(particularSessions)
    .where(eq(particularSessions.id, target.sessionId))
    .returning({
      sessionId: particularSessions.id,
      actorId: particularSessions.particularTokenId,
      createdAt: particularSessions.createdAt,
      lastAccess: particularSessions.lastAccess,
      expiresAt: particularSessions.expiresAt,
    });

  const row = result[0];

  if (!row) return null;

  return {
    ...buildAdminSessionSummary({
      sessionType: "particular",
      sessionId: row.sessionId,
      actorType: "particular_token",
      actorId: row.actorId,
      createdAt: row.createdAt,
      lastAccess: row.lastAccess,
      expiresAt: row.expiresAt,
      now,
    }),
    revokedAt: now.toISOString(),
  };
}