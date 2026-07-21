// Shim de compatibilidad temporal (M21).
//
// La regla de dominio de elegibilidad del banco de profesionales se materializó
// en `server/features/public-professionals/domain/` (M21). Este path legacy se
// conserva SÓLO por compatibilidad temporal requerida por el programa de
// modularización backend: re-exporta la superficie pública completa desde el
// barrel canónico, sin lógica propia.
//
// - No tiene consumidores runtime después de M21 (el único consumidor,
//   `server/db-public-professionals.ts`, ya importa el barrel canónico).
// - Expira en M24, tras el censo final de Fase E.

export * from "../features/public-professionals/domain/index.ts";
