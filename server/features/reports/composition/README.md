# Reports composition

M37 conecta los adapters concretos con la factory de application e inyecta el
reloj runtime. `index.ts` exporta la operación pública
`createReportWorkflowNotification` y sus tipos compatibles.

La composición no consulta DB durante el import y no mantiene estado mutable.
