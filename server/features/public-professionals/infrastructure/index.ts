// Public Professionals · infrastructure (barrel público)
//
// Superficie pública del contexto `public-professionals/infrastructure`:
// re-exporta el mapping puro (normalización, evaluación de publicación y armado
// de respuesta) y el repository (persistencia y consultas sobre el motor real)
// sin agregar lógica. Es el punto de entrada canónico que consume el shim legacy
// `server/db-public-professionals.ts` durante M22.
//
// - M22 · `public-professionals-mapping.ts` (lógica pura de mapping/evaluación).
// - M22 · `public-professionals-repository.ts` (Drizzle + pgClient.unsafe + SQL
//          de elegibilidad por histopatología).

export * from "./public-professionals-mapping.ts";
export * from "./public-professionals-repository.ts";
