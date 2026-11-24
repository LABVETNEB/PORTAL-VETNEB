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
  type StorageObjectListingPort,
  type StorageOrphanInventoryResult,
  type StorageReferenceLookup,
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
export const STORAGE_ORPHAN_REFERENCE_QUERY_TIMEOUT_MS = 10_000;

export class ReferenceLookupTimeoutError extends Error {
  constructor() {
    super("reference_lookup_timeout");
    this.name = "ReferenceLookupTimeoutError";
  }
}

/** Puerto transaccional: una sola conexion, sin llamadas a Storage dentro. */
export type ReferenceLookupTransaction = {
  setLocalStatementTimeout(timeoutMs: number): Promise<void>;
  selectReferencedPaths(paths: string[]): Promise<string[]>;
};

export type ReferenceLookupRunner = <T>(
  work: (transaction: ReferenceLookupTransaction) => Promise<T>,
) => Promise<T>;

const QUERY_CANCELED_SQLSTATE = "57014";

function isQueryCanceled(error: unknown) {
  let current: unknown = error;

  for (let depth = 0; depth < 4 && current instanceof Object; depth += 1) {
    if ((current as { code?: unknown }).code === QUERY_CANCELED_SQLSTATE) {
      return true;
    }

    current = (current as { cause?: unknown }).cause;
  }

  return false;
}

/**
 * Referencias reales de objetos de informe: reports.storage_path (unico sitio
 * de INSERT: report-command-repository). Cada lote es una transaccion corta con
 * statement_timeout LOCAL (set_config(..., true)): el limite muere con la
 * transaccion y no afecta a otras solicitudes ni al pool.
 */
export function createReferencedPathLookup(
  runner: ReferenceLookupRunner,
  timeoutMs: number = STORAGE_ORPHAN_REFERENCE_QUERY_TIMEOUT_MS,
) {
  return async (paths: string[]): Promise<ReadonlySet<string>> => {
    if (paths.length === 0) {
      return new Set();
    }

    try {
      const found = await runner(async (transaction) => {
        await transaction.setLocalStatementTimeout(timeoutMs);

        return transaction.selectReferencedPaths(paths);
      });

      return new Set(found);
    } catch (error) {
      if (isQueryCanceled(error)) {
        throw new ReferenceLookupTimeoutError();
      }

      throw error;
    }
  };
}

const lookupReferencedReportPaths = createReferencedPathLookup((work) =>
  db.transaction(async (tx) =>
    work({
      setLocalStatementTimeout: async (timeoutMs) => {
        await tx.execute(
          sql`select set_config('statement_timeout', ${String(Math.trunc(timeoutMs))}, true)`,
        );
      },
      selectReferencedPaths: async (paths) => {
        const rows = await tx
          .select({ storagePath: reports.storagePath })
          .from(reports)
          .where(inArray(reports.storagePath, paths));

        return rows.map((row) => row.storagePath);
      },
    }),
  ),
);

/** Nunca lanza: un fallo se informa como inventario "failed". */
export type StorageOrphanInventoryCompositionDeps = {
  createListing?: () => Promise<StorageObjectListingPort>;
  lookupReferencedPaths?: StorageReferenceLookup;
  /** Reloj de pared (ms Unix) para el nucleo. */
  wallNow?: () => number;
  /** Reloj monotonico (ms) para duracion y deadline. */
  monotonicNow?: () => number;
};

/**
 * La duracion de un
 * fallo de composicion se mide aqui, con reloj monotonico, desde antes de
 * inicializar el adaptador; el nucleo mide la suya y no se suma a esta.
 */
export async function getStorageOrphanInventory(
  now = new Date(),
  deps: StorageOrphanInventoryCompositionDeps = {},
): Promise<StorageOrphanInventoryResult> {
  const monotonic = deps.monotonicNow ?? (() => performance.now());
  const startedAt = monotonic();

  try {
    const listing = deps.createListing
      ? await deps.createListing()
      : (await import("./lib/supabase.ts")).createStorageObjectListing();

    return await runStorageOrphanInventory({
      listing,
      lookupReferencedPaths:
        deps.lookupReferencedPaths ?? lookupReferencedReportPaths,
      ...(deps.wallNow ? { now: deps.wallNow } : {}),
      monotonicNow: monotonic,
    });
  } catch (error) {
    return buildFailedStorageOrphanInventory(
      now,
      "inventory_unavailable",
      resolveInventoryErrorName(error),
      monotonic() - startedAt,
    );
  }
}
