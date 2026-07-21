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

## Estado de la secuencia (Fase C)

Los handlers productivos viven en `server/routes/logistics-{route-plans,field-visits,route-events,sla}.fastify.ts`.
El adelgazamiento ocurre en la Fase C, después de la capa `application` (M06–M11)
y la infraestructura (M12–M13):

- **M14** — thin `logistics-route-plans` — **completado**.
- **M15** — thin `logistics-field-visits` — **completado**.
- **M16** — thin `logistics-route-events` + `logistics-sla` — **completado**.
- **M17** — cierre integral de Logistics (retiro del shim legacy, regresión
  contractual completa, docs) — **implementado / pendiente de merge**.

Las cuatro rutas están thin. **M17 no mueve ningún handler**: los handlers siguen
registrados en `server/routes/` y esta carpeta `routes/` **continúa docs-only**
(hoy no contiene código). Cada adelgazamiento extrajo casos de uso a `application`
**detrás del contrato por-ruta existente**, sin cambiar paths ni contratos
públicos. La Fase C queda **técnicamente completada / pendiente de merge**.

## Qué NO hacer

No tocar `server/routes/logistics-*.fastify.ts` en la Fase A. No cambiar paths,
contratos ni registro de rutas. No mover reglas de negocio antes de tener el
service y el contrato verde.
