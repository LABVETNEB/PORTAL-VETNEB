# Logistics · infrastructure (implementación de puertos)

> Capa **infrastructure** del contexto Logistics. Docs-only: hoy no contiene código.
> Ver la frontera del contexto en [`../README.md`](../README.md) y el contrato en
> [ARCH-2](../../../../docs/architecture/backend-boundary-adr.md).

## Responsabilidad

Implementa los **puertos** que define `application`: repositorios sobre Drizzle,
cache de planes de ruta, clientes externos. Es el único lugar que conoce el motor
de persistencia y el I/O real del contexto.

## Regla de dependencia

- **Puede importar:** `domain` (para implementar sus puertos), el shared kernel, el
  runtime de Drizzle y clientes externos.
- **No puede importar:** `routes/http` ni `application` (no invierte la dirección de
  la dependencia).

## Qué vivirá aquí (futuro, no ahora)

El candidato natural a repositorio del contexto es `server/db-logistics.ts` (~1.322
LOC), único `db-*` que ya delega en helpers de dominio (`time-window`,
`route-planning`); y la cache `server/lib/logistics-route-plans-cache.ts`. Su
migración es **posterior** a la extracción de un puerto en `application` que les dé
forma. **No se mueve `db-logistics.ts` en el PR del shell** ni en ARCH-5.

## Qué NO hacer

No mover `server/db-logistics.ts` ni la cache todavía. No crear adaptadores vacíos.
No tocar `drizzle/schema.ts` ni migraciones.
