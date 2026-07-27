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

M39 mueve la implementación de `server/db-report-workflow.ts` a
`db-report-workflow.ts`. Conserva selección, joins, serialización ISO,
paginación 20/21, orden, updates y reload. La factory
`createDbReportWorkflowRepository` recibe la operación M37 de comunicación;
cada mutación ejecuta update → reload → comunicación best-effort → return sin
consultar Study Tracking directamente.

M40 agrega `report-query-repository.ts`, owner único de lookup clinic-scoped,
historial, listado, búsqueda, counts y catálogo. Conserva filtros tenant,
orden, paginación, `ilike`, `count(*)` y conversión numérica legacy. El
catálogo delega al domain canónico y no consulta DB.

Esta capa es la única superficie de Reports que importa DB, Drizzle, schema y
tablas para comandos, queries y workflow. No importa composition ni contiene
auditoría, auth, storage o transporte HTTP. `server/db.ts` y
`server/db-report-workflow.ts` sólo preservan compatibilidad temporal.
