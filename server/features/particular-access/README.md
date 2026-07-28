# Particular Access

Frontera canónica para la administración global y la gestión clinic-scoped de
tokens particulares.

- `domain/`: reglas puras de ownership y token.
- `application/`: operaciones por autoridad y puertos mínimos.
- `infrastructure/`: repository Drizzle trasladado 1:1.
- `particular-access-route-composition.ts`: único seam de las rutas propias a
  infraestructura y a la composición canónica de Study Tracking.

M33 introdujo `server/db-particular.ts` como compatibilidad temporal. M44
retiró ese shim y realineó sus ocho consumidores externos al barrel canónico
`server/features/particular-access/infrastructure/index.ts`:

- `server/middlewares/particular-auth.ts`;
- `server/preflight.ts`;
- `server/routes/admin-study-tracking.fastify.ts`;
- `server/routes/auth.fastify.ts`;
- `server/routes/particular-audit.fastify.ts`;
- `server/routes/particular-auth.fastify.ts`;
- `server/routes/particular-study-tracking.fastify.ts`;
- `server/routes/study-tracking.fastify.ts`.

Las rutas propias continúan llegando a infrastructure mediante
`particular-access-route-composition.ts`; Reports conserva su composición
canónica. M44 no reorganizó Auth ni cambió comportamiento funcional, lazy
loading, sesiones, cookies, rate limits, auditoría o contratos HTTP.
