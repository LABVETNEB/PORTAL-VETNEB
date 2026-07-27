# Reports composition

M37 conecta los adapters concretos con la factory de application e inyecta el
reloj runtime. `index.ts` exporta la operación pública
`createReportWorkflowNotification` y sus tipos compatibles.

M38 agrega `report-command-composition.ts`: instancia el repository de comandos
con `() => new Date()`, construye los casos de uso y exporta
`createOrEditReport` y `transitionReportStatus` para M39/M40. También expone el
adapter compatible `updateReportStatus`, que traduce `persisted` a la fila y
los resultados rechazados o concurrentes a `undefined`.

La composición construye sus dependencias de forma lazy, no consulta DB durante
el import, no mantiene estado mutable y no importa Fastify, rutas, auth,
auditoría, storage ni email.
