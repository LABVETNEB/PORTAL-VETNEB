# Reports application

M37 contiene únicamente la orquestación de comunicación del workflow. La
factory `createReportWorkflowCommunication` depende de los puertos de datos y
notificación y de un reloj inyectado; no conoce Drizzle, schema, DB, Fastify ni
adapters concretos.

`index.ts` es el entrypoint de la capa. Los casos de uso generales de Reports
pertenecen a M38 y no forman parte de este inventario.
