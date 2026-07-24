# Study Tracking

Contexto backend abierto en M30 como inicio de la Fase G.

## Estado en M30

- `domain/` contiene las reglas existentes de seguimiento de estudios y la
  coordinación pura, con persistencia inyectada, para asegurar el caso asociado
  a un token particular.
- La API pública del dominio es
  `server/features/study-tracking/domain/index.ts`.
- Los seis consumidores runtime importan exclusivamente ese barrel.
- `server/lib/study-tracking.ts` y
  `server/lib/token-study-tracking.ts` permanecen como shims temporales de una
  línea. Expiran en M35, después del censo final de Fase G.

M30 no crea capas `application/` ni `infrastructure/`, ni mueve persistencia,
rutas, email o auditoría. M31 es el siguiente milestone.
