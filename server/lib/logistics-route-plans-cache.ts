// Shim de compatibilidad (M13, Fase C).
//
// La implementación canónica del cache de route plans de Logistics vive en
// `server/features/logistics/infrastructure/logistics-route-plans-cache.ts`
// (move byte-idéntico en M13). Este path se conserva únicamente porque
// `server/routes/logistics-route-plans.fastify.ts` sigue importándolo hasta
// que la ruta se adelgace en M14; al cerrarse ese milestone, el shim
// desaparece. No añadir lógica, imports ni exports propios aquí.

export * from "../features/logistics/infrastructure/logistics-route-plans-cache.ts";
