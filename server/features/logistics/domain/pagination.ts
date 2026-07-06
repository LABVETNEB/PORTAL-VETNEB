// Logistics · domain (reglas puras)
//
// Regla de dominio de paginación: acotar los parámetros `limit`/`offset` con los
// que se listan recursos de Logistics (visitas de campo, eventos de ruta,
// instancias de SLA). Determinística, sin I/O, sin framework y sin persistencia
// — sólo transforma la entrada en la salida.
//
// Esta lógica vivía de forma implícita dentro de la capa de persistencia
// (`server/db-logistics.ts`). ARCH-7 la extrae al contexto `logistics/domain`
// manteniendo el comportamiento observable idéntico: `db-logistics.ts` la sigue
// invocando con el mismo nombre, ahora vía import interno.

export const LOGISTICS_DEFAULT_LIMIT = 50;
export const LOGISTICS_MAX_LIMIT = 100;

/**
 * Normaliza el `limit` de un listado de Logistics: si no es un entero positivo
 * usa el valor por defecto, y en cualquier caso lo acota al máximo permitido.
 *
 * @param value Límite crudo solicitado.
 * @param defaultLimit Límite por defecto cuando `value` no es válido.
 * @param maxLimit Límite máximo permitido.
 * @returns Límite saneado, entre 1 y `maxLimit`.
 */
export function normalizeLogisticsLimit(
  value: number | null | undefined,
  defaultLimit = LOGISTICS_DEFAULT_LIMIT,
  maxLimit = LOGISTICS_MAX_LIMIT,
): number {
  if (!Number.isInteger(value) || value == null || value <= 0) {
    return defaultLimit;
  }

  return Math.min(value, maxLimit);
}

/**
 * Normaliza el `offset` de un listado de Logistics: descarta valores que no
 * sean enteros no negativos y los reemplaza por `0`.
 *
 * @param value Offset crudo solicitado.
 * @returns Offset saneado, siempre `>= 0`.
 */
export function normalizeLogisticsOffset(
  value: number | null | undefined,
): number {
  if (!Number.isInteger(value) || value == null || value < 0) {
    return 0;
  }

  return value;
}
