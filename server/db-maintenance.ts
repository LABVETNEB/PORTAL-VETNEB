import { lte, sql } from "drizzle-orm";

import { db } from "./db.ts";
import {
  activeSessions,
  adminSessions,
  particularSessions,
} from "../drizzle/schema.ts";

export type MaintenancePurgeCandidateGroup = {
  category:
    | "expired_clinic_sessions"
    | "expired_admin_sessions"
    | "expired_particular_sessions"
    | "storage_orphans";
  label: string;
  count: number;
  supported: boolean;
  destructiveAction: string | null;
  reason?: string;
};

export type MaintenancePurgeDryRunSnapshot = {
  dryRun: true;
  generatedAt: string;
  candidates: MaintenancePurgeCandidateGroup[];
  totals: {
    candidateRecords: number;
    supportedCandidateRecords: number;
    unsupportedGroups: number;
  };
};

async function countExpiredClinicSessions(now: Date): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(activeSessions)
    .where(lte(activeSessions.expiresAt, now));

  return Number(row?.count ?? 0);
}

async function countExpiredAdminSessions(now: Date): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(adminSessions)
    .where(lte(adminSessions.expiresAt, now));

  return Number(row?.count ?? 0);
}

async function countExpiredParticularSessions(now: Date): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(particularSessions)
    .where(lte(particularSessions.expiresAt, now));

  return Number(row?.count ?? 0);
}

export async function getMaintenancePurgeDryRunSnapshot(
  now = new Date(),
): Promise<MaintenancePurgeDryRunSnapshot> {
  const [
    expiredClinicSessions,
    expiredAdminSessions,
    expiredParticularSessions,
  ] = await Promise.all([
    countExpiredClinicSessions(now),
    countExpiredAdminSessions(now),
    countExpiredParticularSessions(now),
  ]);

  const candidates: MaintenancePurgeCandidateGroup[] = [
    {
      category: "expired_clinic_sessions",
      label: "Sesiones de clínica expiradas",
      count: expiredClinicSessions,
      supported: true,
      destructiveAction: "deleteExpiredSessions",
    },
    {
      category: "expired_admin_sessions",
      label: "Sesiones admin expiradas",
      count: expiredAdminSessions,
      supported: true,
      destructiveAction: "deleteExpiredAdminSessions",
    },
    {
      category: "expired_particular_sessions",
      label: "Sesiones particulares expiradas",
      count: expiredParticularSessions,
      supported: true,
      destructiveAction: "deleteExpiredParticularSessions",
    },
    {
      category: "storage_orphans",
      label: "Archivos huérfanos en Storage",
      count: 0,
      supported: false,
      destructiveAction: null,
      reason:
        "Dry-run de Storage pendiente: falta helper seguro para listar objetos remotos antes de comparar contra referencias DB.",
    },
  ];

  const supportedCandidates = candidates.filter((item) => item.supported);
  const unsupportedGroups = candidates.filter((item) => !item.supported);

  return {
    dryRun: true,
    generatedAt: now.toISOString(),
    candidates,
    totals: {
      candidateRecords: candidates.reduce((sum, item) => sum + item.count, 0),
      supportedCandidateRecords: supportedCandidates.reduce(
        (sum, item) => sum + item.count,
        0,
      ),
      unsupportedGroups: unsupportedGroups.length,
    },
  };
}