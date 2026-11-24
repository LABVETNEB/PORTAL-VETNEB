import { inArray, lte, sql } from "drizzle-orm";

import { db } from "./db.ts";
import {
  activeSessions,
  adminSessions,
  particularSessions,
  reports,
} from "../drizzle/schema.ts";
import {
  buildFailedStorageOrphanInventory,
  resolveInventoryErrorName,
  runStorageOrphanInventory,
  type StorageOrphanInventoryResult,
} from "./storage-orphan-inventory.ts";

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
        "Inventario de solo lectura disponible solo bajo solicitud explicita (includeStorageOrphans); aun sin validar contra Storage real, por lo que no se cuenta ni se habilita ninguna accion.",
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
/**
 * Referencias reales de objetos de informe: reports.storage_path (unico sitio
 * de INSERT: report-command-repository). Sentencia corta por lote, sin
 * transaccion y sin conexion retenida entre llamadas.
 */
async function lookupReferencedReportPaths(
  paths: string[],
): Promise<ReadonlySet<string>> {
  if (paths.length === 0) {
    return new Set();
  }

  const rows = await db
    .select({ storagePath: reports.storagePath })
    .from(reports)
    .where(inArray(reports.storagePath, paths));

  return new Set(rows.map((row) => row.storagePath));
}

/** Nunca lanza: un fallo se informa como inventario "failed". */
export async function getStorageOrphanInventory(
  now = new Date(),
): Promise<StorageOrphanInventoryResult> {
  try {
    const { createStorageObjectListing } = await import("./lib/supabase.ts");

    return await runStorageOrphanInventory({
      listing: createStorageObjectListing(),
      lookupReferencedPaths: lookupReferencedReportPaths,
      now: () => Date.now(),
    });
  } catch (error) {
    return buildFailedStorageOrphanInventory(
      now,
      "inventory_unavailable",
      resolveInventoryErrorName(error),
    );
  }
}
