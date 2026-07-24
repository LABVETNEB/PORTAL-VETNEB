# Study Tracking

Contexto backend abierto en M30 y expandido en M31/M32 como parte de la
Fase G.

## Estado en M32

- `domain/` contiene las reglas existentes de seguimiento de estudios y la
  coordinación pura, con persistencia inyectada, para asegurar el caso asociado
  a un token particular.
- La API pública del dominio es
  `server/features/study-tracking/domain/index.ts`.
- `application/` conserva los casos de uso M31 y agrega operaciones cohesivas
  de alto nivel para las superficies clínica y particular.
- Los únicos side effects formalizados son email de tinción especial y
  auditoría, mediante puertos. La operación clínica coordina su política y
  orden observable; la ruta sólo aporta dependencias concretas y contexto.
- `infrastructure/` contiene el repository canónico movido 1:1 desde
  `server/db-study-tracking.ts`.
- Las rutas clínica y particular ya no importan el shim de persistencia. Una
  composición feature-level mínima selecciona las operaciones canónicas sin
  agregar queries ni lógica.
- Admin y los otros cuatro consumidores runtime continúan usando el shim.
- `server/lib/study-tracking.ts` y
  `server/lib/token-study-tracking.ts` permanecen como shims temporales de una
  línea. Expiran en M35, después del censo final de Fase G.
- `server/db-study-tracking.ts` permanece como shim temporal para consumidores
  que se migrarán con las rutas de sus contextos.

M32 adelgaza únicamente `study-tracking.fastify.ts` y
`particular-study-tracking.fastify.ts`. Conserva endpoints, Options, auth,
sesiones, permisos, CORS, payloads, SQL, schema y migraciones.

`admin-study-tracking.fastify.ts` permanece byte-identical. Su migración
corresponde a M32b, que no fue iniciada. M33 y milestones posteriores también
quedan pendientes.
