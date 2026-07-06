// Logistics · domain (reglas puras)
//
// Regla de dominio de planificación de rutas: normalizar la lista de visitas de
// campo con la que se genera un plan heurístico. Determinística, sin I/O, sin
// framework y sin persistencia — sólo transforma la entrada en la salida.
//
// Esta lógica vivía de forma implícita dentro de la capa de persistencia
// (`server/db-logistics.ts`). ARCH-5 la extrae al contexto `logistics/domain`
// manteniendo el comportamiento observable idéntico: `generateHeuristicRoutePlan`
// la sigue invocando con el mismo nombre, ahora vía import interno.

/**
 * Normaliza los ids de visitas de campo para la planificación heurística de
 * rutas: descarta valores que no sean enteros positivos y elimina duplicados,
 * preservando el orden de primera aparición.
 *
 * @param ids Lista cruda de ids de visitas de campo.
 * @returns Lista saneada de ids únicos, en orden de primera aparición.
 */
export function normalizeGenerateHeuristicFieldVisitIds(
  ids: number[],
): number[] {
  const result: number[] = [];
  const seen = new Set<number>();

  for (const id of ids) {
    if (!Number.isInteger(id) || id <= 0 || seen.has(id)) {
      continue;
    }

    seen.add(id);
    result.push(id);
  }

  return result;
}
