# Logistics · routes (adaptación HTTP)

> Capa **routes/http** del contexto Logistics. Docs-only: hoy no contiene código.
> Ver la frontera del contexto en [`../README.md`](../README.md) y el contrato en
> [ARCH-2](../../../../docs/architecture/backend-boundary-adr.md).

## Responsabilidad

Adapta **request/response** HTTP: parseo de entrada, autorización y delegación al
service de `application`. Thin handlers, sin reglas de negocio inline.

## Regla de dependencia

- **Puede importar:** `application`, `domain` (sólo tipos), el shared kernel, los
  adaptadores http (`lib/http`) y los middlewares.
- **No puede importar:** un `db-*` directo, el runtime de Drizzle, ni contener
  reglas de negocio inline.

## Qué vivirá aquí (futuro, no ahora)

Los handlers actuales viven en `server/routes/logistics-{route-plans,field-visits,route-events,sla}.fastify.ts`
y son god-handlers (`logistics-route-plans` ≈ 2.241 LOC). En **ARCH-6** se
adelgazan extrayendo un caso de uso a `application`, **detrás del contrato por-ruta
existente** y sin cambiar paths ni contratos públicos. La ruta permanece registrada
donde está hoy hasta que su lógica esté migrada.

## Qué NO hacer

No tocar `server/routes/logistics-*.fastify.ts` en el PR del shell. No cambiar
paths, contratos ni registro de rutas. No mover reglas de negocio antes de tener el
service y el contrato verde.
