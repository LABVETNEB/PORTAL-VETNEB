# Particular Access

Frontera canónica para la administración global y la gestión clinic-scoped de
tokens particulares.

- `domain/`: reglas puras de ownership y token.
- `application/`: operaciones por autoridad y puertos mínimos.
- `infrastructure/`: repository Drizzle trasladado 1:1.
- `particular-access-route-composition.ts`: único seam de las rutas propias a
  infraestructura y a la composición canónica de Study Tracking.

`server/db-particular.ts` queda como shim de compatibilidad controlado. Owner:
Particular Access. Retiro futuro: milestone de Auth/consumidores externos aún
no planificado; M34 y M35b no forman parte de este cierre.
`server/routes/admin-reports.fastify.ts` permanece allowlisted hasta M36.
