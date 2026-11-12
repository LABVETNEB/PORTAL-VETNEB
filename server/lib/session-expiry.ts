import { SESSION_LAST_ACCESS_UPDATE_INTERVAL_MS } from "./session-last-access.ts";

export const SESSION_MAX_TTL_HOURS = 24;
export const ADMIN_SESSION_IDLE_TIMEOUT_DEFAULT_MINUTES = 30;
export const ADMIN_SESSION_IDLE_TIMEOUT_MIN_MINUTES = 5;
export const ADMIN_SESSION_IDLE_TIMEOUT_MAX_MINUTES = SESSION_MAX_TTL_HOURS * 60;
export const SESSION_CLOCK_SKEW_TOLERANCE_MS = 5 * 60 * 1000;

function toValidTimeMs(value: Date | null | undefined) {
  if (!(value instanceof Date)) {
    return null;
  }

  const time = value.getTime();

  return Number.isFinite(time) ? time : null;
}

/**
 * Fail-closed: una sesión sin `expiresAt` válido se trata como vencida.
 * El límite exacto (`expiresAt === now`) también está vencido.
 */
export function isSessionExpired(
  expiresAt: Date | null | undefined,
  nowMs: number,
) {
  const expiresAtMs = toValidTimeMs(expiresAt);

  return expiresAtMs === null || expiresAtMs <= nowMs;
}

/**
 * Inactividad administrativa medida contra `lastAccess`.
 * - `lastAccess` ausente o inválido: inactiva (fail-closed).
 * - Futuro dentro de la tolerancia de reloj: actividad en curso.
 * - Futuro más allá de la tolerancia: inválida (fail-closed).
 * - Inactividad igual al umbral: inactiva.
 */
export function isSessionIdle(
  lastAccess: Date | null | undefined,
  nowMs: number,
  idleTimeoutMs: number,
) {
  const lastAccessMs = toValidTimeMs(lastAccess);

  if (lastAccessMs === null) {
    return true;
  }

  const idleMs = nowMs - lastAccessMs;

  if (idleMs < 0) {
    return -idleMs > SESSION_CLOCK_SKEW_TOLERANCE_MS;
  }

  return idleMs >= idleTimeoutMs;
}

/**
 * `lastAccess` sólo se persiste cada cierto intervalo, así que la inactividad
 * medida sobrestima la real en hasta ese intervalo. Para admin se acota a un
 * décimo del umbral (máx. el intervalo general de 10 min).
 */
export function getAdminSessionLastAccessRefreshIntervalMs(
  idleTimeoutMs: number,
) {
  return Math.min(
    SESSION_LAST_ACCESS_UPDATE_INTERVAL_MS,
    Math.max(1, Math.floor(idleTimeoutMs / 10)),
  );
}
