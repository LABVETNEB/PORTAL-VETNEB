# Study Tracking

Bounded context backend cerrado en M35 después de M30, M31, M32 y M32b.

## Arquitectura final

- `domain/` contiene las reglas existentes de seguimiento de estudios y la
  coordinación pura, con persistencia inyectada, para asegurar el caso asociado
  a un token particular.
- La API pública del dominio es
  `server/features/study-tracking/domain/index.ts`.
- `application/` conserva los casos de uso M31, agrega operaciones cohesivas
  por realm y expone la operación token-scoped consumida por Particular Access.
- Los únicos side effects formalizados son email de tinción especial y
  auditoría, mediante puertos. La operación clínica coordina su política y
  orden observable; la ruta sólo aporta dependencias concretas y contexto.
- `infrastructure/` contiene el repository canónico movido 1:1 desde
  `server/db-study-tracking.ts`.
- Las rutas clínica, particular y admin ya no importan el shim de persistencia.
  Una composición feature-level mínima selecciona las operaciones canónicas
  sin agregar queries ni lógica.
- `server/lib/study-tracking.ts` y
  `server/lib/token-study-tracking.ts` fueron retirados en M35: el censo
  textual y AST confirmó cero consumidores ejecutables.
- `server/db-study-tracking.ts` permanece como shim externo controlado de una
  línea. Las tres rutas propias no lo consumen y, tras M33, su allowlist
  residual exacta
  es:

| Consumidor | Owner | Retiro |
| --- | --- | --- |
| `server/routes/admin-reports.fastify.ts` | Reports | M36 |

M32 adelgazó únicamente `study-tracking.fastify.ts` y
`particular-study-tracking.fastify.ts`. M32b adelgaza exclusivamente
`admin-study-tracking.fastify.ts`: conserva transporte y delega coordinación de
casos, notificaciones, email y auditoría a
`createAdminStudyTrackingOperations`. Endpoints, Options, autoridad admin,
filtro clinic-scoped opcional, CORS, payloads, SQL, schema y migraciones no
cambian.

M30, M31, M32, M32b y M35 están cerrados. M33 retiró los dos consumidores de
Particular Access mediante composition y el barrel application canónico. No se
afirma RLS; Reports continúa pendiente para M36.
