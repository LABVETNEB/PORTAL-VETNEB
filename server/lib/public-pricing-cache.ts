// Shim de compatibilidad temporal (M18, Fase D).
//
// El cache canónico de precios públicos se movió byte-idéntico a
// `server/features/pricing/infrastructure/public-pricing-cache.ts` (módulo
// in-memory puro, cero imports, TTL de 5 minutos). Este archivo re-exporta su
// superficie pública para preservar a los consumidores legacy (ruta public,
// ruta admin y contratos globales) hasta que M19 los reapunte. El `export *`
// mantiene la MISMA instancia de módulo, por lo que el estado module-level del
// cache sigue siendo un único singleton compartido. No agregar imports ni
// lógica: sólo el re-export de abajo.
export * from "../features/pricing/infrastructure/public-pricing-cache.ts";
