# Logistics · infrastructure (implementación de puertos)

> Capa **infrastructure** del contexto Logistics. **Contiene código** desde M02b
> (adaptador de DB para el breach de SLA); desde **M12 (mergeado en PR #1509)**,
> la **persistencia canónica** del contexto; desde **M13 (mergeado en PR
> #1511)**, el **cache de route plans**; desde **M14 (mergeado en PR #1512)**,
> el **adapter del puerto de cache** y el **adapter DB de route plans**; desde
> **M15 (mergeado en PR #1513)**, el **adapter DB de field visits**; y desde
> **M16 (implementado / pendiente de merge)**, los **adapters DB de route events y SLA**.
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
- **`logistics-route-plans-cache.ts`** (M13) — **cache canónico** de route plans:
  move **byte-idéntico** desde `server/lib/logistics-route-plans-cache.ts`
  (107 LOC, **cero imports**, 9 exports). In-memory puro (dos `Map` module-level),
  TTL de 5 minutos, expiración lazy, miss = `null`, invalidación completa y por
  prefijo `clinic:`/`clinic:+plan:`. **Intacto en M14.** Desde M14 la
  **construcción de claves** y el read-through viven en el caso de uso de cache
  de application; el header `X-Logistics-Cache` (HIT/MISS) sigue perteneciendo a
  `server/routes/logistics-route-plans.fastify.ts`. La pureza (cero imports)
  queda fijada por el guard de frontera.
- **`logistics-route-plans-cache-adapter.ts`** (M14) — **adapter del puerto de
  cache**: implementa por composición mínima sobre el cache canónico (mismas
  Maps, mismo TTL, sin estado propio) el puerto
  `LogisticsRoutePlansCacheRepository` que define application, con conformidad
  estructural (esta capa no importa `application`). La ruta lo compone una sola
  vez al registrar el plugin. El guard fija que sólo importa el canónico y que
  no declara Maps propias.
- **`logistics-route-plans-db-adapter.ts`** (M14) — **adapter DB de la ruta
  thin**: factory `createLogisticsRoutePlansDbAdapter()` con **referencias
  directas** a las 9 operaciones del DB canónico consumidas por
  `logistics-route-plans` (sin envolver resultados ni alterar signatures,
  null/undefined, errores o transacciones) + re-export de los 11 tipos de I/O.
  Desde la corrección M14, la ruta no contiene **ninguna** referencia a
  `db-logistics`: sus tipos y su carga default (lazy, dentro de
  `loadDefaultDeps`) llegan por este adapter. El guard fija que sólo importa
  `./db-logistics.ts` y que no contiene queries ni transacciones propias.
- **`logistics-field-visits-db-adapter.ts`** (M15) — **adapter DB de la ruta
  thin de field visits**: factory `createLogisticsFieldVisitsDbAdapter()` con
  **referencias directas** a las 7 operaciones del DB canónico consumidas por
  `logistics-field-visits` (create/list/update de visitas, get/upsert de
  ubicación, list/create de ventanas horarias; sin envolver resultados ni
  alterar signatures, null/undefined, errores o transacciones) + re-export de
  los 8 tipos de I/O. Desde M15 la ruta no contiene **ninguna** referencia a
  `db-logistics`: sus tipos y su carga default (lazy, dentro de
  `loadDefaultDeps`) llegan por este adapter. El guard fija que sólo importa
  `./db-logistics.ts`, que no contiene queries ni transacciones propias y que
  expone exactamente esa superficie de 7 operaciones.
- **`logistics-route-events-db-adapter.ts`** (M16) — **adapter DB de la ruta
  thin de route events**: factory `createLogisticsRouteEventsDbAdapter()` con
  **referencias directas** a las 4 operaciones del DB canónico consumidas por
  `logistics-route-events` (`createRouteEvent`, `listClinicRouteEvents`,
  `listRouteEventsForClinicRoutePlan`, `listIncrementalClinicRouteEvents`) +
  re-export de los 3 tipos de I/O (`CreateRouteEventInput`, `ListRouteEventsParams`,
  `RouteEvent`). Desde M16 la ruta no contiene **ninguna** referencia a
  `db-logistics`: sus tipos y su carga default (lazy, dentro de
  `loadDefaultDeps`) llegan por este adapter. El guard fija que sólo importa
  `./db-logistics.ts`, que no contiene queries ni transacciones propias y que
  expone exactamente esa superficie de 4 operaciones.
- **`logistics-sla-db-adapter.ts`** (M16) — **adapter DB de la ruta thin de
  SLA**: factory `createLogisticsSlaDbAdapter()` con **referencias directas** a
  las 4 operaciones del DB canónico consumidas por `logistics-sla`
  (`listActiveClinicSlaPolicies`, `listClinicSlaInstances`,
  `listOverdueActiveClinicSlaInstances`, `getClinicSlaSummary`) + re-export de
  los 6 tipos de I/O (`ClinicSlaSummary`, `ListActiveClinicSlaPoliciesParams`,
  `ListClinicSlaInstancesParams`, `ListOverdueActiveClinicSlaInstancesParams`,
  `SlaInstance`, `SlaPolicy`). La operación overdue se re-expone sólo como
  referencia directa para la carga default de la ruta; su caso de uso sigue
  siendo el de M06. Desde M16 la ruta no contiene **ninguna** referencia a
  `db-logistics`: sus tipos y su carga default (lazy) llegan por este adapter.
  El guard fija que sólo importa `./db-logistics.ts`, sin queries ni
  transacciones propias, y que expone exactamente esa superficie de 4
  operaciones.

## Shims de compatibilidad fuera de la capa

`server/db-logistics.ts` queda como **shim temporal**: sólo re-exporta la superficie
pública desde `./features/logistics/infrastructure/db-logistics.ts`. No importa
Drizzle, ni `drizzle/schema.ts`, ni `server/db.ts`; no contiene funciones, queries ni
transacciones, y no declara default export. Desde M14, `logistics-route-plans`
**ya no lo consume** (usa el adapter DB de esta capa); desde M15 tampoco
`logistics-field-visits` (usa `logistics-field-visits-db-adapter.ts`); y desde
**M16** tampoco `logistics-route-events` ni `logistics-sla` (usan
`logistics-route-events-db-adapter.ts` / `logistics-sla-db-adapter.ts`). Tras
M16 el shim **ya no tiene consumidores productivos**: los únicos imports
restantes son de tests que necesitan sus tipos. Su eliminación global sigue
prevista para **M17**, o cuando desaparezca el último consumidor.

El **shim del cache** (`server/lib/logistics-route-plans-cache.ts`) fue
**retirado en M14**: su único consumidor productivo era la ruta de route plans,
que ahora consume el cache por el puerto de application y este adapter. El guard
de frontera fija que el path retirado no se recree ni se importe.

**Sin cambios de schema ni de migraciones**: M12–M16 no tocan `drizzle/schema.ts`,
`drizzle/**`, `migrations/**`, endpoints ni contratos HTTP.

## Qué vivirá aquí (futuro, no ahora)

- Nada nuevo planificado para esta capa: el milestone restante de la Fase C
  (**M17**, cierre) retira el shim de `db-logistics` (ya sin consumidores
  productivos tras M16) y completa la regresión contractual; no añade módulos
  aquí.

## Qué NO hacer

No crear adaptadores vacíos. No reescribir el cache canónico ni duplicar su
estado en el adapter. No tocar `drizzle/schema.ts` ni migraciones. No
reparticionar las transacciones del archivo canónico. No importar `application`,
`routes` ni Fastify desde esta capa (el guard de frontera lo bloquea).
