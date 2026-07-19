# Logistics · infrastructure (implementación de puertos)

> Capa **infrastructure** del contexto Logistics. **Contiene código** desde M02b:
> un adaptador transitorio de DB para el breach de SLA.
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

- **`sla-breach-db.ts`** (M02b) — adaptador **transitorio** que cablea el núcleo puro
  `markOverdueSlaBreaches` (importado del barrel de `domain`) con la persistencia real
  de `server/db-logistics.ts`. Conserva el import dinámico (lazy) de
  `markOverdueActiveClinicSlaInstancesBreached` y expone `markOverdueSlaBreachesWithDb`
  sin duplicar la lógica de negocio: es el único lugar del contexto que conoce el
  `db-*`. Su existencia **no** implica mover `server/db-logistics.ts` ni adelantar
  M12; cuando M12 formalice el repositorio sobre puertos, este adaptador se reemplaza
  por esa infraestructura.

## Qué vivirá aquí (futuro, no ahora)

El candidato natural a repositorio del contexto es `server/db-logistics.ts` (~1.322
LOC), único `db-*` que ya delega en helpers de dominio (`time-window`,
`route-planning`); y la cache `server/lib/logistics-route-plans-cache.ts`. Su
migración es **posterior** a la extracción de un puerto en `application` que les dé
forma. **`db-logistics.ts` sigue siendo legacy y fuera de alcance en M02b.**

## Qué NO hacer

No mover `server/db-logistics.ts` ni la cache todavía. No crear adaptadores vacíos.
No tocar `drizzle/schema.ts` ni migraciones.
