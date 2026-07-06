# Logistics · application (orquestación)

> Capa **application** del contexto Logistics. Docs-only: hoy no contiene código.
> Ver la frontera del contexto en [`../README.md`](../README.md) y el contrato en
> [ARCH-2](../../../../docs/architecture/backend-boundary-adr.md).

## Responsabilidad

Orquesta **casos de uso** de logística: coordina reglas de `domain` con datos
provistos por `infrastructure`, aplicando la secuencia de un flujo (validar →
resolver → persistir → responder) sin conocer detalles de HTTP ni de persistencia
concreta.

## Regla de dependencia

- **Puede importar:** `domain`, **puertos** (interfaces) y el shared kernel.
- **No puede importar:** `fastify`, un `db-*` concreto, el runtime de Drizzle,
  React/Next ni `http`.
- Habla con el exterior a través de **puertos**, no de implementaciones concretas.
  `infrastructure` implementa esos puertos; `application` no los implementa.

## Qué vivirá aquí (futuro, no ahora)

En **ARCH-6** se extraerá **un** caso de uso desde un god-handler existente
(candidato: parte de `logistics-route-plans.fastify.ts`) a un service aquí, detrás
del contrato por-ruta existente, dejando el handler thin. El puerto de repositorio
se introduce **junto con** su primer consumidor y su implementación real — nunca
como interfaz vacía anticipada.

## Qué NO hacer

No crear services vacíos ni puertos/interfaces sin implementación. No introducir
event bus. No mover lógica antes de tener el contrato por-ruta verde.
