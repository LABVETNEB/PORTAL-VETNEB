# Report Access

Frontera canónica del contexto token access para compartir informes.

- `domain/`: lifecycle, disponibilidad, ownership y clinic scope.
- `application/`: operaciones admin, clinic y public con puertos mínimos.
- `infrastructure/`: repository Drizzle con las siete operaciones históricas.
- `composition/`: seam explícito entre rutas e infraestructura.

No pertenece al módulo Reports. `server/db-report-access.ts` fue retirado y las
rutas conservan auth, trusted-origin, CORS, rate limits y mapping HTTP.
M35b y Reports Phase I no forman parte de M34.
