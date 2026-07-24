# Study Tracking · domain

Fuente canónica de las reglas de dominio movidas en M30:

- `study-tracking.ts`: schemas Zod, normalización, etapas, fechas hábiles,
  timestamps, notificación de tinción especial y serialización.
- `token-study-tracking.ts`: `ensureStudyTrackingCaseForToken`, conservando las
  cuatro dependencias de persistencia inyectadas.
- `index.ts`: único barrel público para consumidores externos.

Dependencias permitidas: `zod`, archivos internos de esta capa y
`drizzle/schema.ts` sólo mediante `import type`. Se prohíben Fastify, rutas,
persistencia concreta, entorno, auth, sesiones, CORS, auditoría, email, Supabase,
filesystem, red y efectos laterales.

El contrato se verifica en
`test/architecture/study-tracking-domain-boundary-guard.test.ts`.
