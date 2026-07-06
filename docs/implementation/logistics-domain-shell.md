# Implementación — ARCH-4: Logistics read-only domain shell

> **Tipo:** Nota de implementación **docs-only**. No implementa runtime, no mueve
> código, no re-exporta, no toca rutas, DB, schema, CSS, tests de runtime,
> `package.json`, lockfiles ni CI.
> **Base:** `main` limpio · **HEAD:** `cacfe3f` docs(architecture): inventory shared lib boundaries (#1298).
> **Rama:** `refactor/logistics-domain-shell`.
> **Documentos rectores:** [ARCH-1](../audit/repository-domain-architecture-audit.md) · [ARCH-2](../architecture/backend-boundary-adr.md) · [ARCH-3](../architecture/shared-lib-boundary-inventory.md).
> **Modelo / esfuerzo:** Claude Opus 4.8 · high.
> **ID:** ARCH-4.

## Objetivo del PR

Introducir la **frontera de módulo** del contexto Logistics en
`server/features/logistics/`, alineada con [ARCH-1](../audit/repository-domain-architecture-audit.md),
[ARCH-2](../architecture/backend-boundary-adr.md) y
[ARCH-3](../architecture/shared-lib-boundary-inventory.md), **sin migrar
comportamiento**. Deja el terreno listo para los PRs de extracción (ARCH-5+) con el
contrato de dependencia por capa documentado en el lugar donde vivirá cada capa.

## Por qué es un read-only shell

El ADR (ARCH-2) advierte que el mayor riesgo de esta secuencia es crear
**abstracciones vacías**: carpetas, barrels o interfaces sin código real que las
habite. Para evitarlo, este PR **prefiere README/docs antes que archivos TS
vacíos**:

- No crea `index.ts`, barrels ni re-exports (eso ya sería runtime/API interna).
- No crea services, puertos ni interfaces vacías.
- No mueve `server/lib/logistics/*` ni `server/db-logistics.ts`.
- No toca `server/routes/logistics-*.fastify.ts` ni ningún import de runtime.

Así la frontera queda **declarada y contractual** (prosa verificable en review),
mientras el comportamiento observable permanece exactamente donde estaba. Cada capa
materializará código sólo cuando haya algo real que mover (ARCH-5 en adelante).

## Archivos creados

Sólo archivos de documentación:

- `server/features/logistics/README.md` — frontera del contexto: responsabilidad,
  relación temporal con `server/lib/logistics`, reglas de dependencia, qué migrar
  en ARCH-5, qué NO mover, testing matrix y links a ARCH-1/2/3.
- `server/features/logistics/domain/README.md` — capa de reglas puras.
- `server/features/logistics/application/README.md` — capa de orquestación.
- `server/features/logistics/infrastructure/README.md` — implementación de puertos.
- `server/features/logistics/routes/README.md` — adaptación HTTP.
- `docs/implementation/logistics-domain-shell.md` — esta nota.

## Comportamiento preservado

Cero cambios de runtime. La fuente de verdad ejecutable de Logistics sigue intacta:

- `server/lib/logistics/{metrics,route-planning,sla-breach,time-window}.ts` — sin cambios.
- `server/lib/logistics-route-plans-cache.ts` — sin cambios.
- `server/db-logistics.ts` — sin cambios.
- `server/routes/logistics-{route-plans,field-visits,route-events,sla}.fastify.ts` — sin cambios.

Ningún import de runtime se modifica. No hay cambios de rutas, DB, schema ni
migraciones. Los paths y contratos públicos son idénticos.

## Próximos PRs

- **ARCH-5** — Extraer 1 helper de dominio puro (candidato: `sla-breach` o
  `time-window`) a `server/features/logistics/domain/`, con su test,
  comportamiento idéntico.
- **ARCH-6** — Extraer 1 application service detrás de una ruta existente, dejando
  el god-handler thin, detrás del contrato por-ruta.
- **ARCH-7** — Auditoría de eventos (opcional), sólo si ARCH-5..6 revelan fan-out
  real; si no, documentar "no eventos" y cerrar.

## Guardrails

- Docs-only: sin código de runtime, sin re-exports, sin CSS, sin tests de runtime,
  sin deps, sin lockfiles, sin CI, sin stashes, sin `.claude`, sin worktrees.
- No mover `server/lib/logistics/*` ni `server/db-logistics.ts` todavía.
- No tocar `server/routes/logistics-*.fastify.ts` ni imports de runtime.
- No crear `index.ts`, services, puertos ni interfaces vacías.
- No event bus. No fragmentar `drizzle/schema.ts`. No tocar migraciones.
- No auth/security. No API pública. No frontend.
- 1 contexto por PR; los futuros moves van detrás de contratos con tests verdes y
  guardrail de literal actualizado en el mismo PR.

## Validación

- Revisión de documentación (docs review).
- `pnpm test`, `pnpm build` verdes (sin cambios de runtime que puedan romperlos).
- `git diff --check`, `git status --short --untracked-files=all`, `git diff --stat`,
  `git diff --name-only` confirman que el único cambio son los 6 archivos de docs
  bajo `server/features/logistics/**` y `docs/implementation/`.

## Documentos relacionados

- [ARCH-1 — Repository Domain Architecture Audit](../audit/repository-domain-architecture-audit.md).
- [ARCH-2 — Backend Domain Boundary ADR](../architecture/backend-boundary-adr.md).
- [ARCH-3 — Shared / Lib Boundary Inventory](../architecture/shared-lib-boundary-inventory.md).
- [`server/features/logistics/README.md`](../../server/features/logistics/README.md) — frontera del contexto.
