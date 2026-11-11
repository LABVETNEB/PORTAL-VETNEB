import { sql } from "drizzle-orm";

import type { StartupCleanupSummary } from "./bootstrap.ts";
import { logWarn, serializeError } from "./lib/logger.ts";

const POOL_EXHAUSTED_PATTERNS = [
  "max clients reached",
  "EMAXCONN",
  "too many connections",
  "remaining connection slots are reserved",
];

export function isPoolExhaustedError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return POOL_EXHAUSTED_PATTERNS.some((pattern) => msg.includes(pattern));
}

/** PostgreSQL `undefined_table` (42P01), as thrown by postgres-js or wrapped by Drizzle. */
export function isUndefinedTableError(err: unknown): boolean {
  const codeOf = (value: unknown) =>
    typeof value === "object" && value !== null ? (value as { code?: unknown }).code : undefined;
  const cause = typeof err === "object" && err !== null ? (err as { cause?: unknown }).cause : undefined;
  return codeOf(err) === "42P01" || codeOf(cause) === "42P01";
}

/**
 * Ejecuta una función de limpieza de sesiones expiradas de forma resiliente.
 * Si la DB rechaza la conexión por pool exhausto (EMAXCONNSESSION),
 * loguea un warning estructurado y retorna 0 — no aborta el startup del
 * servidor. Cualquier otro error se relanza como crítico.
 */
export async function safeCleanupStep(
  fn: () => Promise<number>,
  label: string,
): Promise<number> {
  try {
    return await fn();
  } catch (err) {
    if (isPoolExhaustedError(err)) {
      logWarn("PREFLIGHT_CLEANUP_WARN", {
        label,
        errorName: serializeError(err).name,
      });
      return 0;
    }

    throw err;
  }
}

export async function preflight(): Promise<StartupCleanupSummary> {
  const [
    dbModule,
    particularModule,
    searchModule,
    supabaseModule,
  ] = await Promise.all([
    import("./db.ts"),
    import("./features/particular-access/infrastructure/index.ts"),
    import("./features/global-search/infrastructure/index.ts"),
    import("./lib/supabase.ts"),
  ]);

  await dbModule.db.execute(sql`select 1`);
  await supabaseModule.ensureStorageBucketExists();

  const [
    deletedClinicSessions,
    deletedAdminSessions,
    deletedParticularSessions,
    deletedGlobalSearchStates,
  ] = await Promise.all([
    safeCleanupStep(dbModule.deleteExpiredSessions, "clinic_sessions"),
    safeCleanupStep(dbModule.deleteExpiredAdminSessions, "admin_sessions"),
    safeCleanupStep(
      particularModule.deleteExpiredParticularSessions,
      "particular_sessions",
    ),
    safeCleanupStep(async () => {
      try {
        return await searchModule.deleteExpiredGlobalSearchStates();
      } catch (err) {
        // The table arrives with migration 0031: a server that starts before it
        // is applied must not fail its startup over a cleanup of a feature table.
        if (isUndefinedTableError(err)) {
          logWarn("PREFLIGHT_CLEANUP_WARN", { label: "global_search_states", reason: "table_missing" });
          return 0;
        }
        throw err;
      }
    }, "global_search_states"),
  ]);

  return {
    deletedClinicSessions,
    deletedAdminSessions,
    deletedParticularSessions,
    deletedGlobalSearchStates,
  };
}
