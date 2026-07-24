# Study Tracking · infrastructure

Repositorio canónico de persistencia movido en M31:

- `study-tracking-repository.ts`: casos de seguimiento y notificaciones.
- `index.ts`: único barrel público de infraestructura.

El move conserva queries, filtros, orden, paginación, timestamps y resultados.
`server/db-study-tracking.ts` permanece como shim externo controlado para
`admin-particular-tokens.fastify.ts` y `particular-tokens.fastify.ts`
(Particular Access, M33), y `admin-reports.fastify.ts` (Reports, M36). Las tres
rutas propias de Study Tracking consumen infrastructure únicamente mediante la
composición feature-level.

Esta capa sólo puede depender de Drizzle, `server/db.ts`,
`drizzle/schema.ts` y `server/lib/list-pagination.ts`. No contiene Fastify,
auth, email, auditoría ni reglas de aplicación.
