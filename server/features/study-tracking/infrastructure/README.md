# Study Tracking · infrastructure

Repositorio canónico de persistencia movido en M31:

- `study-tracking-repository.ts`: casos de seguimiento y notificaciones.
- `index.ts`: único barrel público de infraestructura.

El move conserva queries, filtros, orden, paginación, timestamps y resultados.
`server/db-study-tracking.ts` permanece como shim temporal para consumidores que
se migrarán junto con sus rutas en M32, M32b, M33, M34 y M36.

Esta capa sólo puede depender de Drizzle, `server/db.ts`,
`drizzle/schema.ts` y `server/lib/list-pagination.ts`. No contiene Fastify,
auth, email, auditoría ni reglas de aplicación.
