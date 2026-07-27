# Reports infrastructure

M37 implementa aquí los dos puertos de workflow communication. El adapter de
datos consulta el contexto de Study Tracking por `reportId`; el adapter de
notificación inserta una notificación interna y devuelve su ID o `null`.

M38 agrega `report-command-repository.ts`, implementación canónica única de
`getReportById`, upsert y persistencia de transición. Conserva las dos
transacciones, el SQL dual de historial y el fallback exclusivo PostgreSQL
`42703`; la transición usa compare-and-set por ID y `expectedFromStatus`, y
sólo crea historial después de un `returning()` exitoso. Acepta DB y reloj
inyectables para pruebas deterministas.

Esta capa es la única superficie M38 que importa DB, Drizzle, schema y tablas
Reports para comandos. No contiene email, auditoría, auth, storage ni
transporte HTTP. `server/db.ts` sólo reexporta compatibilidad temporal.
