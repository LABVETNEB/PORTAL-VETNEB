# Reports

M36 abre la Fase I estableciendo la frontera de dominio de Reports sin cambiar
comportamiento runtime.

## Superficie disponible

- `domain/index.ts` es la única entrada pública para consumidores externos.
- `domain/report-status.ts` conserva el catálogo y las transiciones de estado.
- `domain/report-study-types.ts` conserva el catálogo de tipos de estudio.
- `domain/reports.ts` conserva parsing, scoping y serialización segura.

## Límites de M36

El dominio sólo puede depender de archivos de su propia capa y de
`drizzle/schema.ts` mediante `import type`. Fastify, rutas, DB runtime,
repositorios, auth, sesiones, CORS, rate limits, auditoría, email, storage e I/O
permanecen fuera.

Las capas `application`, `infrastructure` y `composition` no existen todavía.
M37 será responsable del desacople de workflow communication y persistencia.

Los shims de `server/lib` se conservan temporalmente hasta el censo final de la
Fase I; ningún consumidor runtime ni test de comportamiento debe usarlos.
