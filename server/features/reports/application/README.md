# Reports application

M37 contiene la orquestación de comunicación del workflow. M38 agrega
`createReportCommandUseCases`, que expone creación/edición por upsert y
transición de estado con resultados discriminados.

El puerto `report-command-repository.ts` contiene sólo `findReportById`,
`createOrEditReport` y `persistReportStatusTransition`. La transición consume
`canTransitionReportStatus` desde domain y construye `expectedFromStatus` desde
el informe leído; ese valor no forma parte del input público. No conoce
Drizzle, schema, DB, Fastify, rutas ni adapters concretos y no captura errores
de persistencia.

`index.ts` es el entrypoint de la capa. Reads generales, autorización,
auditoría, storage y side effects de rutas quedan fuera de M38.
