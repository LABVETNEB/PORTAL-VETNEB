// Shim de compatibilidad temporal (M18, Fase D).
//
// La implementación canónica de la persistencia de Pricing se movió a
// `server/features/pricing/infrastructure/db-pricing.ts` (move completo, sin
// reorganizar funciones ni reparticionar; sólo cambiaron los specifiers que
// exige la nueva profundidad). Este archivo re-exporta la superficie pública
// exacta para no romper a los consumidores legacy (rutas admin/public) hasta
// que M19 los reapunte y adelgace. No agregar imports, funciones, lógica ni
// exports duplicados: sólo el re-export de abajo.
export * from "./features/pricing/infrastructure/db-pricing.ts";
