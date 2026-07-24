# Study Tracking

Contexto backend abierto en M30 y expandido en M31 como parte de la Fase G.

## Estado en M31

- `domain/` contiene las reglas existentes de seguimiento de estudios y la
  coordinación pura, con persistencia inyectada, para asegurar el caso asociado
  a un token particular.
- La API pública del dominio es
  `server/features/study-tracking/domain/index.ts`.
- `application/` contiene casos de uso de consulta y comando separados por
  superficie clínica, admin y particular.
- Los únicos side effects formalizados son email de tinción especial y
  auditoría, mediante puertos; las rutas conservan la política y el orden
  observable actuales.
- `infrastructure/` contiene el repository canónico movido 1:1 desde
  `server/db-study-tracking.ts`.
- Los seis consumidores runtime del dominio importan exclusivamente su barrel.
- `server/lib/study-tracking.ts` y
  `server/lib/token-study-tracking.ts` permanecen como shims temporales de una
  línea. Expiran en M35, después del censo final de Fase G.
- `server/db-study-tracking.ts` permanece como shim temporal para consumidores
  que se migrarán con las rutas de sus contextos.

M31 no adelgaza handlers ni cambia endpoints, auth, sesiones, permisos, CORS,
payloads, SQL, schema o migraciones. M32 y M32b son los siguientes milestones
de rutas thin de Study Tracking.
