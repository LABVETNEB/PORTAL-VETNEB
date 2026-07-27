# Reports application

M37 contiene la orquestación de comunicación del workflow. M38 agrega
`createReportCommandUseCases`, que expone creación/edición por upsert y
transición de estado con resultados discriminados.

M39 agrega `createReportRouteService`, una factory inyectable que coordina
signed URLs, upload administrativo, Particular Token, Study Tracking,
`report_delivered`, listado y mutaciones del workflow y auditoría posterior a
los writes. Recibe el contexto de auditoría como valor opaco, modela errores
esperables con resultados discriminados y sólo captura la notificación
`report_delivered` best-effort.

M40 agrega `createReportQueryUseCases`: coordina list+count y search+count,
serializa mediante domain, modela ownership clinic-scoped con `not_found` y
garantiza que history, preview, download y transición sólo ocurran después del
lookup tenant-scoped. La transición reutiliza el resultado M38 y no captura
errores de infraestructura.

M41 expone los lookups cross-context canónicos a través de command composition:
`getReportById` delega al caso de uso y `getClinicScopedReportById` aplica
ownership en application antes de devolver el agregado completo. Ningún
consumidor obtiene estas operaciones desde `server/db.ts`.

El puerto `report-command-repository.ts` contiene sólo `findReportById`,
`createOrEditReport` y `persistReportStatusTransition`. La transición consume
`canTransitionReportStatus` desde domain y construye `expectedFromStatus` desde
el informe leído; ese valor no forma parte del input público. No conoce
Drizzle, schema, DB, Fastify, rutas ni adapters concretos y no captura errores
de persistencia.

El puerto `report-query-repository.ts` modela las queries reales con records
estructurales propios de application; no importa schema, Drizzle ni adapters.

`index.ts` es el entrypoint de la capa. La capa no importa Fastify, DB,
Drizzle, schema runtime, storage o audit concretos, auth ni adapters. Parsing
HTTP, parsing, CORS, sesión y mapping de status codes permanecen en las rutas.
