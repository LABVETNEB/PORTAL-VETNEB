# Reports

M36 estableció la frontera de dominio, M37 desacopló la comunicación interna
del workflow y M38 agrega los comandos de creación/edición y transición de
estado sin cambiar las rutas.

## Superficie disponible

- `domain/index.ts` es la única entrada pública para consumidores externos.
- `domain/report-status.ts` conserva el catálogo y las transiciones de estado.
- `domain/report-study-types.ts` conserva el catálogo de tipos de estudio.
- `domain/reports.ts` conserva parsing, scoping y serialización segura.
- `application/index.ts` expone las operaciones inyectables y sus puertos.
- `infrastructure/index.ts` expone los adapters de workflow y el repository
  canónico de comandos.
- `composition/index.ts` es el entrypoint runtime de comunicación y comandos:
  `createReportWorkflowNotification`, `createOrEditReport` y
  `transitionReportStatus`.

## Dependencias entre capas

El dominio sólo puede depender de archivos de su propia capa y de
`drizzle/schema.ts` mediante `import type`. Application depende de sus puertos
y, para transiciones, del barrel canónico de domain. Infrastructure implementa
los puertos y es la única capa M38 con DB, Drizzle, tablas Reports,
transacciones y SQL de historial. Composition es el único bridge application
→ infrastructure.

`server/lib/report-workflow-communication.ts` permanece como shim temporal de
una línea. `server/db.ts` reexporta temporalmente `getReportById` y
`upsertReport` desde infrastructure. `updateReportStatus` atraviesa composition
y application, que agrega `expectedFromStatus`, antes del UPDATE compare-and-set
de infrastructure. Las rutas mantienen sus Options y dependencias actuales.

M39/M40 siguen pendientes para rutas delgadas y reads generales; M41 realizará
el closeout y retiro final de compatibilidad.
