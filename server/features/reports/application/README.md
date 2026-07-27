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

El puerto `report-command-repository.ts` contiene sólo `findReportById`,
`createOrEditReport` y `persistReportStatusTransition`. La transición consume
`canTransitionReportStatus` desde domain y construye `expectedFromStatus` desde
el informe leído; ese valor no forma parte del input público. No conoce
Drizzle, schema, DB, Fastify, rutas ni adapters concretos y no captura errores
de persistencia.

`index.ts` es el entrypoint de la capa. La capa no importa Fastify, DB,
Drizzle, schema runtime, storage o audit concretos, auth ni adapters. Parsing
HTTP, serialización final, CORS, sesión y mapping de status codes permanecen en
las rutas. Reads generales permanecen fuera de M39.
