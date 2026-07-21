# Pricing — bounded context

> **Tipo:** Frontera de módulo del contexto Pricing. Establecida en **M18
> (Fase D)** como shell mínimo con **código real** en `infrastructure/`.
> **Origen:** [ARCH-1](../../../docs/audit/repository-domain-architecture-audit.md) · [ARCH-2](../../../docs/architecture/backend-boundary-adr.md) · [ARCH-3](../../../docs/architecture/shared-lib-boundary-inventory.md) · [programa](../../../docs/audit/backend-enterprise-modularization-program-audit.md).
> **ID:** **M18 (Fase D: infraestructura de persistencia y cache en `infrastructure/`)**.
>
> **Estado:** M18 **mergeado y cerrado** — PR #1519, squash SHA
> `5f99b5f40e08ea8929be869374f1d154f740153f`, 2026-07-21. **M19 (thin rutas
> admin+public) — mergeado y cerrado** — PR #1521, squash SHA
> `d1b25111d6bc0aa644647e67a784cb596b4e1afe`, 2026-07-21 (adelgaza las rutas vía
> servicios directos y **retira ambos shims legacy**). **Fase D — abierta. M20 —
> no iniciado.**

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
- **`admin-pricing-service.ts`** y **`public-pricing-service.ts`** (M19) —
  **servicios directos** del contexto: la mínima abstracción real que compone los
  canónicos y retira de las rutas la orquestación de datos/cache/agrupamiento que
  no pertenece al adapter HTTP. No conocen Fastify, auth, CORS ni audit. No hay
  `application/` ni puertos: Pricing no tiene reglas de dominio.

## Rutas thin (M19)

`server/routes/admin-pricing.fastify.ts` y `server/routes/public-pricing.fastify.ts`
quedan **thin**: conservan sólo HTTP y cross-cutting (registro Fastify, CORS,
trusted-origin, auth admin, parsing/validación, status codes, mensajes, headers,
logging de errores, contexto y llamada de auditoría en el punto contractual). La
ruta admin conserva el orden explícito `update → audit → clear cache → response`;
la auditoría **no** vive en el servicio.

## Shims legacy — retirados en M19

Los paths legacy que M18 conservó como shims temporales fueron **retirados** al
adelgazar las rutas (cero consumidores operativos tras el reapunte):

- `server/db-pricing.ts` — **eliminado**.
- `server/lib/public-pricing-cache.ts` — **eliminado**.

El único acceso es ahora `route → servicio directo → canónico`. La identidad de
módulo del cache (singleton compartido) se preserva porque todos los consumidores
resuelven al mismo canónico `infrastructure/public-pricing-cache.ts`.

## Contratos que protegen esta frontera

- `test/architecture/pricing-infrastructure-boundary-guard.test.ts` — la capa
  existe con implementación real, el cache conserva cero imports y TTL de 5
  minutos, la superficie pública del DB no cambia, cero transacciones, **los
  shims legacy están ausentes y no pueden recrearse ni tener consumidores**, los
  servicios directos no conocen HTTP/auth/CORS/audit y las rutas delegan en el
  servicio sin importar los canónicos DB/cache directamente.
- `test/integration/adapters/controllers/admin-pricing-api.test.ts` y
  `public-pricing-api.test.ts` — contratos HTTP admin/public (reapuntados al
  canónico en M18; verdes tras el adelgazamiento M19).
- `test/unit/pricing/pricing-admin-service.test.ts` y
  `pricing-public-service.test.ts` — contratos conductuales de los servicios
  directos (M19).
