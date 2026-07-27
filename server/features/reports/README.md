# Reports

M36 estableció la frontera de dominio y M37 desacopla la comunicación interna
del workflow sin cambiar comportamiento runtime.

## Superficie disponible

- `domain/index.ts` es la única entrada pública para consumidores externos.
- `domain/report-status.ts` conserva el catálogo y las transiciones de estado.
- `domain/report-study-types.ts` conserva el catálogo de tipos de estudio.
- `domain/reports.ts` conserva parsing, scoping y serialización segura.
- `application/index.ts` expone la operación inyectable y sus dos puertos.
- `infrastructure/index.ts` expone los adapters de datos y notificación.
- `composition/index.ts` es el entrypoint runtime de
  `createReportWorkflowNotification`.

## Dependencias entre capas

El dominio sólo puede depender de archivos de su propia capa y de
`drizzle/schema.ts` mediante `import type`. Application sólo depende de sus
puertos. Infrastructure implementa esos puertos y es la única capa M37 con DB,
Drizzle, schema y tablas de Study Tracking. Composition es el único bridge
application → infrastructure.

`server/lib/report-workflow-communication.ts` permanece como shim temporal de
una línea hasta M41. Ningún consumidor runtime ni test de comportamiento debe
usarlo.

M38–M41 siguen pendientes: M38 contiene los casos de uso generales de Reports,
M39/M40 las rutas delgadas y M41 el closeout y retiro final de shims.
