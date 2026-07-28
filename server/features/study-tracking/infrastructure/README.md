# Study Tracking · infrastructure

Repositorio canónico de persistencia movido en M31:

- `study-tracking-repository.ts`: casos de seguimiento y notificaciones.
- `index.ts`: único barrel público de infraestructura.

El move conserva queries, filtros, orden, paginación, timestamps y resultados.
M35 conservó `server/db-study-tracking.ts` como shim externo temporal; M44 lo
retiró después de confirmar cero consumidores residuales. Las rutas propias de
Study Tracking consumen infrastructure únicamente mediante composición
feature-level y Reports conserva su composición canónica. Auth no fue
reorganizado y no hubo cambios funcionales.

Esta capa sólo puede depender de Drizzle, `server/db.ts`,
`drizzle/schema.ts` y `server/lib/list-pagination.ts`. No contiene Fastify,
auth, email, auditoría ni reglas de aplicación.
