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
    supabaseModule,
  ] = await Promise.all([
    import("./db.ts"),
    import("./features/particular-access/infrastructure/index.ts"),
    import("./lib/supabase.ts"),
  ]);

  await dbModule.db.execute(sql`select 1`);
  await supabaseModule.ensureStorageBucketExists();

  const [
    deletedClinicSessions,
    deletedAdminSessions,
    deletedParticularSessions,
  ] = await Promise.all([
    safeCleanupStep(dbModule.deleteExpiredSessions, "clinic_sessions"),
    safeCleanupStep(dbModule.deleteExpiredAdminSessions, "admin_sessions"),
    safeCleanupStep(
      particularModule.deleteExpiredParticularSessions,
      "particular_sessions",
    ),
  ]);

  return {
    deletedClinicSessions,
    deletedAdminSessions,
    deletedParticularSessions,
  };
}
