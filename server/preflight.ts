import { sql } from "drizzle-orm";

import type { StartupCleanupSummary } from "./bootstrap.ts";

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

type LoggerLike = Pick<Console, "warn">;

/**
 * Ejecuta una función de limpieza de sesiones expiradas de forma resiliente.
 * Si la DB rechaza la conexión por pool exhausto (EMAXCONNSESSION),
 * loguea un warning y retorna 0 — no aborta el startup del servidor.
 * Cualquier otro error se relanza como crítico.
 */
export async function safeCleanupStep(
  fn: () => Promise<number>,
  label: string,
  logger: LoggerLike = console,
): Promise<number> {
  try {
    return await fn();
  } catch (err) {
    if (isPoolExhaustedError(err)) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(
        `[PREFLIGHT_CLEANUP_WARN] ${label}: pool exhausted, cleanup skipped (${msg.slice(0, 100)})`,
      );
      return 0;
    }

    throw err;
  }
}

export async function preflight(
  deps: { logger?: LoggerLike } = {},
): Promise<StartupCleanupSummary> {
  const [
    dbModule,
    particularModule,
    supabaseModule,
  ] = await Promise.all([
    import("./db.ts"),
    import("./db-particular.ts"),
    import("./lib/supabase.ts"),
  ]);

  const logger = deps.logger ?? console;

  await dbModule.db.execute(sql`select 1`);
  await supabaseModule.ensureStorageBucketExists();

  const [
    deletedClinicSessions,
    deletedAdminSessions,
    deletedParticularSessions,
  ] = await Promise.all([
    safeCleanupStep(dbModule.deleteExpiredSessions, "clinic_sessions", logger),
    safeCleanupStep(
      dbModule.deleteExpiredAdminSessions,
      "admin_sessions",
      logger,
    ),
    safeCleanupStep(
      particularModule.deleteExpiredParticularSessions,
      "particular_sessions",
      logger,
    ),
  ]);

  return {
    deletedClinicSessions,
    deletedAdminSessions,
    deletedParticularSessions,
  };
}
