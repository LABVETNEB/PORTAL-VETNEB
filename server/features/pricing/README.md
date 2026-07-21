# Pricing — bounded context

> **Tipo:** Frontera de módulo del contexto Pricing. Establecida en **M18
> (Fase D)** como shell mínimo con **código real** en `infrastructure/`.
> **Origen:** [ARCH-1](../../../docs/audit/repository-domain-architecture-audit.md) · [ARCH-2](../../../docs/architecture/backend-boundary-adr.md) · [ARCH-3](../../../docs/architecture/shared-lib-boundary-inventory.md) · [programa](../../../docs/audit/backend-enterprise-modularization-program-audit.md).
> **ID:** **M18 (Fase D: infraestructura de persistencia y cache en `infrastructure/`)**.
>
> **Estado:** M18 **implementado / pendiente de merge**. **Fase D — no cerrada.**
> **M19 (thin rutas admin+public) — no iniciado.**

Este directorio es la **frontera** del contexto Pricing. A diferencia de
Logistics, **Pricing no tiene reglas de dominio** [CONFIRMED: `db-pricing.ts` es
CRUD + `serializePricingItem` + guard de patch]; por eso el módulo no fabrica una
capa `domain/` ni `application/` (hacerlo sería inventar estructura para código
inexistente — prohibido por la restricción 13 del programa).

- **`infrastructure/`** — **persistencia canónica** del contexto
  (`db-pricing.ts`, movida completa desde `server/db-pricing.ts` en M18) y el
  **cache canónico** de precios públicos (`public-pricing-cache.ts`, move
  byte-idéntico desde `server/lib/public-pricing-cache.ts`). Ver
  [`infrastructure/README.md`](infrastructure/README.md).

## Shims de compatibilidad (temporales, hasta M19)

M18 **no adelgaza las rutas**. Los paths legacy quedan como **shims mínimos**
(un único `export *` hacia el canónico) para no romper a los consumidores que
todavía los importan:

- `server/db-pricing.ts` → `infrastructure/db-pricing.ts`.
- `server/lib/public-pricing-cache.ts` → `infrastructure/public-pricing-cache.ts`.

`server/routes/admin-pricing.fastify.ts` y `server/routes/public-pricing.fastify.ts`
siguen consumiendo los shims sin cambios (byte-idénticas en M18). **M19** será
responsable de reapuntar las rutas al canónico y adelgazarlas.

El `export *` preserva la **identidad de módulo**: el estado module-level del
cache sigue siendo un único singleton, aunque una parte de los consumidores
importe por el shim y otra por el canónico.

## Contratos que protegen esta frontera

- `test/architecture/pricing-infrastructure-boundary-guard.test.ts` — la capa
  existe con implementación real, el cache conserva cero imports y TTL de 5
  minutos, la superficie pública del DB no cambia, cero transacciones, los shims
  son sólo re-exports y ningún canónico consume los shims.
- `test/integration/adapters/controllers/admin-pricing-api.test.ts` y
  `public-pricing-api.test.ts` — contratos HTTP admin/public (reapuntados al
  canónico en M18).
