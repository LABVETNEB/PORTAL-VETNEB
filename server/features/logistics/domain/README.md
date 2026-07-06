# Logistics · domain (reglas puras)

> Capa **domain** del contexto Logistics. Docs-only: hoy no contiene código.
> Ver la frontera del contexto en [`../README.md`](../README.md) y el contrato en
> [ARCH-2](../../../../docs/architecture/backend-boundary-adr.md).

## Responsabilidad

Reglas de negocio **puras** de logística: cálculo de ventanas de tiempo,
planificación de rutas, detección de breach de SLA y métricas. Sin efectos
secundarios, sin I/O, sin framework. Determinista y testeable en aislamiento.

## Regla de dependencia

- **Puede importar:** el shared kernel (`drizzle/schema.ts`) **sólo como tipos**, y
  otras utilidades puras del propio contexto.
- **No puede importar:** `fastify`, el runtime de Drizzle, `env`, `http`, middleware
  de auth, React/Next ni ningún `db-*`.
- La dependencia apunta hacia adentro: `domain` no conoce el transporte HTTP ni el
  motor de persistencia. `infrastructure` depende de `domain`, nunca al revés.

## Qué vivirá aquí (futuro, no ahora)

Los helpers puros que hoy están en `server/lib/logistics/`
(`metrics`, `route-planning`, `sla-breach`, `time-window`) ya cumplen esta regla
(importan sólo tipos de schema). En **ARCH-5** se migrará **uno** de ellos aquí,
con su test, comportamiento idéntico. No se crea ningún archivo hasta que haya
código real que mover.

## Qué NO hacer

No mover `server/lib/logistics/*` en el PR del shell. No crear stubs, interfaces ni
barrels vacíos.
