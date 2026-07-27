# Reports composition

M37 conecta los adapters concretos con la factory de application e inyecta el
reloj runtime. `index.ts` exporta la operación pública
`createReportWorkflowNotification` y sus tipos compatibles.

M38 agrega `report-command-composition.ts`: instancia el repository de comandos
con `() => new Date()`, construye los casos de uso y exporta
`createOrEditReport` y `transitionReportStatus` para M39/M40. También expone el
adapter compatible `updateReportStatus`, que traduce `persisted` a la fila y
los resultados rechazados o concurrentes a `undefined`.

M39 agrega `report-route-composition.ts`, único bridge entre las rutas
administrativas y los defaults concretos. Resuelve auth, audit, storage,
Particular Token, Study Tracking, el comando M38 `createOrEditReport`, el read
canónico `getReportById`, la comunicación M37 y el repository workflow M39.
Una Options completamente inyectada evita cargar defaults.

M40 agrega `report-query-composition.ts`, bridge lazy para ambas rutas
clínicas. Adapta sus Options históricas a los puertos M40, conserva el fallback
`getReportById` tenant-scoped y reutiliza `transitionReportStatus` M38. La
inyección completa no carga DB, storage, audit ni auth concretos.

La composición construye sus dependencias de forma lazy, no consulta DB durante
el import, no mantiene estado mutable y no importa Fastify ni rutas.
