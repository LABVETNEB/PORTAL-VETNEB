# Reports

M36 estableció la frontera de dominio, M37 desacopló la comunicación interna
del workflow, M38 agregó los comandos de creación/edición y transición de
estado, y M39 adelgaza las rutas administrativas de Reports.

## Superficie disponible

- `domain/index.ts` es la única entrada pública para consumidores externos.
- `domain/report-status.ts` conserva el catálogo y las transiciones de estado.
- `domain/report-study-types.ts` conserva el catálogo de tipos de estudio.
- `domain/reports.ts` conserva parsing, scoping y serialización segura.
- `application/index.ts` expone las operaciones inyectables, sus puertos y
  `createReportRouteService`.
- `infrastructure/index.ts` expone los adapters de workflow, el repository
  canónico de comandos y el repository administrativo de workflow.
- `composition/index.ts` es el único bridge runtime para comunicación,
  comandos y rutas administrativas.

## Dependencias entre capas

El dominio sólo puede depender de archivos de su propia capa y de
`drizzle/schema.ts` mediante `import type`. Application depende de sus puertos
y, para transiciones, del barrel canónico de domain. Infrastructure implementa
los puertos y concentra DB, Drizzle, tablas Reports, transacciones, SQL de
historial y persistencia del workflow. Composition es el único bridge
application → infrastructure y carga defaults concretos de forma lazy.

`server/lib/report-workflow-communication.ts` y
`server/db-report-workflow.ts` permanecen como shims temporales hasta M41.
`server/db.ts` reexporta temporalmente `getReportById` y
`upsertReport` desde infrastructure. `updateReportStatus` atraviesa composition
y application, que agrega `expectedFromStatus`, antes del UPDATE compare-and-set
de infrastructure. Las rutas administrativas conservan Options y contratos
HTTP, pero delegan storage, persistencia, tracking, comunicación y auditoría a
`report-route-service.ts`.

M40 permanece pendiente para reads generales; M41 realizará el closeout y
retiro final de compatibilidad.
