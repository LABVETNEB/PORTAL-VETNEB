// Logistics · domain (reglas puras)
//
// Reglas puras de ventanas de tiempo de una visita de campo: valida el rango
// `[windowStart, windowEnd)` y normaliza el `timezone`. Determinística, sin I/O,
// sin framework y sin persistencia — sólo transforma la entrada en la salida.
//
// Esta lógica vivía en `server/lib/logistics/time-window.ts`. M02b la mueve al
// contexto `logistics/domain` manteniendo el comportamiento observable idéntico:
// `db-logistics.ts` la sigue invocando con el mismo nombre, ahora vía el barrel
// público del dominio.

export const DEFAULT_TIME_WINDOW_TIMEZONE = "UTC";
export const TIME_WINDOW_TIMEZONE_MAX_LENGTH = 64;

export function isValidTimeWindowRange(
  windowStart: Date,
  windowEnd: Date,
): boolean {
  return (
    windowStart instanceof Date &&
    windowEnd instanceof Date &&
    Number.isFinite(windowStart.getTime()) &&
    Number.isFinite(windowEnd.getTime()) &&
    windowStart.getTime() < windowEnd.getTime()
  );
}

export function normalizeTimeWindowTimezone(
  timezone: string | null | undefined,
): string {
  const normalized = timezone?.trim();

  if (!normalized) {
    return DEFAULT_TIME_WINDOW_TIMEZONE;
  }

  if (normalized.length > TIME_WINDOW_TIMEZONE_MAX_LENGTH) {
    return normalized.slice(0, TIME_WINDOW_TIMEZONE_MAX_LENGTH);
  }

  return normalized;
}

export function assertValidTimeWindowRange(
  windowStart: Date,
  windowEnd: Date,
): void {
  if (!isValidTimeWindowRange(windowStart, windowEnd)) {
    throw new Error("windowStart must be earlier than windowEnd");
  }
}
