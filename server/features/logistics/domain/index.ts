// Logistics · domain (barrel público)
//
// Superficie pública del contexto `logistics/domain`: re-exporta los helpers
// puros existentes sin agregar lógica ni cambiar su comportamiento. ARCH-8
// consolida los exports de `route-plan-field-visits.ts` (ARCH-5) y
// `pagination.ts` (ARCH-7) en un único punto de entrada para que el resto del
// backend consuma el dominio sin conocer sus archivos internos.

export { normalizeGenerateHeuristicFieldVisitIds } from "./route-plan-field-visits.ts";

export {
  LOGISTICS_DEFAULT_LIMIT,
  LOGISTICS_MAX_LIMIT,
  normalizeLogisticsLimit,
  normalizeLogisticsOffset,
} from "./pagination.ts";
