# Logistics · infrastructure (implementación de puertos)

> Capa **infrastructure** del contexto Logistics. **Contiene código** desde M02b
> (adaptador de DB para el breach de SLA) y, desde **M12 — implementado /
> pendiente de merge**, la **persistencia canónica** del contexto.
> Ver la frontera del contexto en [`../README.md`](../README.md) y el contrato en
> [ARCH-2](../../../../docs/architecture/backend-boundary-adr.md).

## Responsabilidad

Implementa los **puertos** que define `application`: repositorios sobre Drizzle,
cache de planes de ruta, clientes externos. Es el único lugar que conoce el motor
de persistencia y el I/O real del contexto.

## Regla de dependencia

- **Puede importar:** `domain` (para implementar sus puertos, vía su barrel público),
  el shared kernel, el runtime de Drizzle y clientes externos (incluido `db-*`).
- **No puede importar:** `routes/http` ni `application` (no invierte la dirección de
  la dependencia).

## Qué vive aquí

- **`db-logistics.ts`** (M12) — **implementación canónica** de la persistencia del
  contexto: **1.291 LOC** medidos en HEAD `101731d` antes del move (la cifra real;
  el inventario ARCH-3 citaba 1.322/1.295 LOC, desactualizados). El archivo se movió
  **completo** desde `server/db-logistics.ts`, sin reorganizar funciones, sin
  dividirlo, sin renombrar exports y **sin reparticionar transacciones**: conserva
  exactamente los **7 call-sites `db.transaction(`** del baseline R0, verificado por
  `test/architecture/logistics-infrastructure-boundary-guard.test.ts` y por
  `test/unit/infrastructure/logistics/logistics-db.test.ts`. Lo único que cambia son
  los tres specifiers exigidos por la nueva profundidad: `../../../db.ts`,
  `../../../../drizzle/schema.ts` y `../domain/index.ts` (mismo `server/db.ts`,
  mismo `drizzle/schema.ts`, mismo barrel de dominio).
- **`sla-breach-db.ts`** (M02b, reapuntado en M12) — adaptador que cablea el núcleo
  puro `markOverdueSlaBreaches` (importado del barrel de `domain`) con la
  persistencia real. Desde M12 consume el **archivo canónico de su propia capa**
  (`./db-logistics.ts`) en vez del shim raíz, conservando el import dinámico (lazy)
  de `markOverdueActiveClinicSlaInstancesBreached`, la delegación al núcleo de
  dominio y las signatures.

## Shim de compatibilidad en el root

`server/db-logistics.ts` queda como **shim temporal**: sólo re-exporta la superficie
pública desde `./features/logistics/infrastructure/db-logistics.ts`. No importa
Drizzle, ni `drizzle/schema.ts`, ni `server/db.ts`; no contiene funciones, queries ni
transacciones, y no declara default export. Existe porque las rutas legacy
`server/routes/logistics-*.fastify.ts` siguen importando `../db-logistics.ts`
(estática y dinámicamente) hasta **M14–M16**; al cerrarse esa secuencia, el shim
desaparece.

**Sin cambios de schema ni de migraciones**: M12 no toca `drizzle/schema.ts`,
`drizzle/**`, `migrations/**`, endpoints ni contratos HTTP.

## Qué vivirá aquí (futuro, no ahora)

- **M13 — cache adapter** para `server/lib/logistics-route-plans-cache.ts` (TTL/keys
  preservados; contract-test de runtime existente). **Pendiente**: M12 no lo adelanta.

## Qué NO hacer

No mover la cache todavía (M13). No crear adaptadores vacíos. No tocar
`drizzle/schema.ts` ni migraciones. No reparticionar las transacciones del archivo
canónico. No importar `application`, `routes` ni Fastify desde esta capa (el guard
de frontera lo bloquea).
