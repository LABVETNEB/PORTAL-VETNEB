// Compatibility shim · Logistics (M12)
//
// La implementación real de la persistencia de Logistics vive ahora en
// `server/features/logistics/infrastructure/db-logistics.ts` (move completo,
// transacciones intactas). Este archivo es un shim de compatibilidad temporal:
// no contiene lógica, queries, transacciones, Drizzle, schema ni acceso a `db`.
//
// Se conserva porque las rutas legacy `server/routes/logistics-*.fastify.ts`
// siguen importando `../db-logistics.ts` (estática y dinámicamente) hasta que
// M14–M16 las conviertan en thin routes. Al cerrar esa secuencia, el shim
// desaparece y los consumidores pasan a la implementación canónica.
//
// No agregar aquí exports propios, defaults ni lógica: cualquier cambio de
// superficie pertenece al archivo canónico.

export * from "./features/logistics/infrastructure/db-logistics.ts";
