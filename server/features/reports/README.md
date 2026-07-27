# Reports

M36 estableció la frontera de dominio, M37 desacopló la comunicación interna
del workflow, M38 agregó los comandos de creación/edición y transición de
estado, M39 adelgazó las rutas administrativas y M40 materializa queries y
adelgaza las rutas clínicas.

## Superficie disponible

- `domain/index.ts` es la única entrada pública para consumidores externos.
- `domain/report-status.ts` conserva el catálogo y las transiciones de estado.
- `domain/report-study-types.ts` conserva el catálogo de tipos de estudio.
- `domain/reports.ts` conserva parsing, scoping y serialización segura.
- `application/index.ts` expone las operaciones inyectables, sus puertos y
  los casos de uso de commands, queries y rutas administrativas.
- `infrastructure/index.ts` expone los adapters de workflow, el repository
  canónico de comandos, el repository de queries y el repository
  administrativo de workflow.
- `composition/index.ts` es el único bridge runtime para comunicación,
  comandos y rutas administrativas y clínicas.

## Dependencias entre capas

El dominio sólo puede depender de archivos de su propia capa y de
`drizzle/schema.ts` mediante `import type`. Application depende de sus puertos
y, para transiciones, del barrel canónico de domain. Infrastructure implementa
los puertos y concentra DB, Drizzle, tablas Reports, transacciones, SQL de
historial y persistencia del workflow. Composition es el único bridge
application → infrastructure y carga defaults concretos de forma lazy.

`server/lib/report-workflow-communication.ts` y
`server/db-report-workflow.ts` permanecen como shims temporales hasta M41.
`server/db.ts` reexporta temporalmente commands y las ocho queries M40 desde
infrastructure. `updateReportStatus` atraviesa composition y application, que
agrega `expectedFromStatus`, antes del UPDATE compare-and-set. Las rutas
administrativas y clínicas conservan Options y contratos HTTP; las clínicas
delegan listado, búsqueda, catálogo, ownership, historial, signed URLs y
transición a `report-query-use-cases.ts`.

M41 realizará el closeout y retiro final de compatibilidad.
