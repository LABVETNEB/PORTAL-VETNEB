# Global Search — bounded context

Búsqueda transversal de registros para el superbuscador del dashboard
(Clínica y Administrador). Fase 1: motor, contrato y API; la UI es la Fase 2.

- `domain/` — gramática de consulta compartida (`q`, `kinds`, `status`,
  `studyType`, `from`, `to`, `limit`, `offset`), escape de comodines LIKE,
  ranking determinista y fusión sin duplicados. Sin I/O.
- `application/` — casos de uso clínica/admin y puertos. El puerto de clínica
  exige `clinicId` como argumento: no existe firma para una búsqueda de clínica
  sin tenant.
- `infrastructure/` — consultas Drizzle parametrizadas, insensibles a tildes y
  mayúsculas (`immutable_unaccent`, migración 0007), con proyección explícita y
  ventana `limit + 1` (sin COUNT).

Rutas: `GET /api/search` (sesión `app_session_id`, tenant = `auth.clinicId`) y
`GET /api/admin/search` (sesión `admin_session_id`, `clinicId` sólo acota).

Sin dependencias cross-feature (guard M45). Campos buscables, exclusiones y
riesgos: [`docs/implementation/global-search-phase-1-engine.md`](../../../docs/implementation/global-search-phase-1-engine.md).
