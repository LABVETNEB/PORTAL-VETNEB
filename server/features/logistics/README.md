# Logistics — domain shell (read-only)

> **Tipo:** Frontera de módulo **docs-only**. No implementa, no mueve código, no
> re-exporta, no toca rutas, CSS, tests de runtime, `package.json`, lockfiles, CI
> ni schema. Sólo README bajo `server/features/logistics/`.
> **Base:** `main` limpio · **HEAD:** `cacfe3f` docs(architecture): inventory shared lib boundaries (#1298).
> **Rama:** `refactor/logistics-domain-shell`.
> **Documentos rectores:** [ARCH-1](../../../docs/audit/repository-domain-architecture-audit.md) · [ARCH-2](../../../docs/architecture/backend-boundary-adr.md) · [ARCH-3](../../../docs/architecture/shared-lib-boundary-inventory.md).
> **Modelo / esfuerzo:** Claude Opus 4.8 · high.
> **ID:** ARCH-4.

Este directorio es un **shell de frontera** para el contexto Logistics. Declara
las reglas de dependencia del ADR ([ARCH-2](../../../docs/architecture/backend-boundary-adr.md))
en el lugar donde vivirán las capas, **sin migrar todavía ni una línea de código**.
No hay `index.ts`, no hay barrels, no hay re-exports: sólo documentación de
frontera. El comportamiento en tiempo de ejecución sigue viviendo, sin cambios, en
`server/lib/logistics/`, `server/db-logistics.ts` y `server/routes/logistics-*.fastify.ts`.

## 1. Responsabilidad del contexto Logistics

Logistics es el contexto de **planificación y operación de rutas de recolección y
entrega** del portal: planes de ruta, visitas de campo, eventos de ruta y control
de SLA. Según [ARCH-1](../../../docs/audit/repository-domain-architecture-audit.md)
es el mini-dominio con **cohesión muy alta**, **acoplamiento bajo** y **riesgo
bajo**, y por eso es el piloto de migración por dominios. Concentra además los
god-handlers más grandes del backend (`logistics-route-plans.fastify.ts` ≈ 2.241
LOC), donde extraer application/domain tiene el mayor retorno de mantenibilidad.

Su superficie actual (por *naming*, no por carpeta) es:

- **Dominio puro** — `server/lib/logistics/{metrics,route-planning,sla-breach,time-window}.ts`
  (~1.5k LOC). Importan **sólo tipos** de `drizzle/schema.ts`; cero `fastify`,
  cero `db`. Ya cumplen la regla "domain sin framework" del ADR.
- **Persistencia + dominio mezclados** — `server/db-logistics.ts` (~1.322 LOC). Único
  `db-*` que delega en helpers de dominio (`time-window`, `route-planning`);
  candidato natural a repositorio del contexto.
- **Infra de contexto** — `server/lib/logistics-route-plans-cache.ts`.
- **Adaptadores HTTP** — `server/routes/logistics-{route-plans,field-visits,route-events,sla}.fastify.ts`.

## 2. Relación temporal con `server/lib/logistics` actual

Esta carpeta **convive** con la estructura actual; no la reemplaza en este PR. El
código de runtime **no se ha movido**: `server/lib/logistics/*`, `server/db-logistics.ts`
y `server/routes/logistics-*.fastify.ts` siguen siendo la única fuente de verdad
ejecutable. `server/features/logistics/` es, por ahora, sólo el **destino
documentado** de la migración incremental descrita en el ADR.

Es un estado transitorio y deliberado: primero se fija la frontera y su contrato
en prosa; recién después (ARCH-5+) se mueve código real, capa por capa, detrás de
los contratos por-ruta existentes y sólo con tests verdes.

## 3. Reglas de dependencia

Dirección permitida: `routes/http → application → domain`. `application` habla con
`infrastructure` **por puertos**; `infrastructure` implementa esos puertos. El
*shared kernel* (`drizzle/schema.ts`, sólo tipos) puede ser importado por
cualquier capa; nunca al revés. La dependencia **siempre apunta hacia adentro**.

| Capa | Rol | Puede importar | No puede importar |
| --- | --- | --- | --- |
| **[domain](./domain/README.md)** | Reglas puras. | shared kernel (sólo tipos), utilidades puras del propio contexto | `fastify`, Drizzle runtime, `env`, `http`, auth middleware, React/Next, `db-*` |
| **[application](./application/README.md)** | Orquesta casos de uso. | domain, puertos (interfaces), shared kernel | `fastify`, `db-*` concreto, Drizzle runtime, React/Next, `http` |
| **[infrastructure](./infrastructure/README.md)** | Implementa puertos. | domain, shared kernel, Drizzle runtime, clientes externos | routes/http, application (no invierte la dirección) |
| **[routes](./routes/README.md)** | Adapta HTTP. | application, domain (tipos), shared kernel, adaptadores http, middlewares | `db-*` directo, Drizzle runtime, reglas de negocio inline |

Cada capa detalla su propio contrato en su README. Ninguna capa contiene código
todavía; los READMEs describen dónde vivirá cada cosa cuando se migre.

## 4. Qué se puede migrar en ARCH-5 (y siguientes)

Migración incremental, **un paso por PR**, siempre detrás de contratos y con tests
verdes:

- **ARCH-5 — Extraer 1 helper de dominio puro.** Mover un helper puro (candidato:
  `sla-breach.ts` o `time-window.ts`, los más chicos y sin dependencias) de
  `server/lib/logistics/` a `server/features/logistics/domain/`, con su test,
  comportamiento idéntico. Valida la regla "domain sin framework".
- **ARCH-6 — Extraer 1 application service detrás de una ruta existente.** Sacar un
  caso de uso de un god-handler (candidato: parte de `logistics-route-plans`) a
  `server/features/logistics/application/`, detrás del contrato por-ruta existente;
  el handler queda thin. Valida la regla "routes/http delega".
- **ARCH-7 — Auditoría de eventos (opcional).** Sólo si ARCH-5..6 revelan fan-out
  real. Si no, documentar "no eventos" y cerrar.

Cada carpeta materializa código **sólo cuando hay algo real que la habite** — nunca
carpetas/barrels vacíos por dogma.

## 5. Qué NO se debe mover todavía

- **No** mover `server/lib/logistics/*` a este directorio en este PR.
- **No** mover `server/db-logistics.ts`.
- **No** tocar `server/routes/logistics-*.fastify.ts`.
- **No** crear `index.ts`, barrels, re-exports, services vacíos ni puertos/interfaces vacíos.
- **No** introducir event bus.
- **No** fragmentar `drizzle/schema.ts` ni tocar migraciones.
- **No** cambiar auth/security/middlewares.
- **No** cambiar la API pública (paths ni contratos).

## 6. Testing matrix (para futuros PRs)

| Check | Cuándo aplica |
| --- | --- |
| `pnpm test` | Siempre. |
| `pnpm build` | Siempre. |
| Backend route tests (contrato por-ruta) | Si el PR toca `server/routes/**` o mueve lógica detrás de una ruta. |
| Test de dominio movido | ARCH-5+: el test del helper migra junto al helper y debe quedar verde. |
| E2E (Playwright) | Sólo si el PR toca frontend (no aplica a este contexto backend). |
| Guardrail de literal-de-fuente | Si el PR mueve un literal fijado por un test; se actualiza en el **mismo PR**. |
| **No** lockfiles / deps / CI | Ningún PR de esta secuencia toca `package.json`, lockfiles ni workflows. |

Los contratos por-ruta existentes (audit, session-last-access, runtime-timing) son
la red de seguridad que habilita reorganizar sin cambiar comportamiento.

## 7. Documentos rectores

- [ARCH-1 — Repository Domain Architecture Audit](../../../docs/audit/repository-domain-architecture-audit.md) — documento rector: clasifica Logistics como piloto.
- [ARCH-2 — Backend Domain Boundary ADR](../../../docs/architecture/backend-boundary-adr.md) — reglas de dependencia por capa y secuencia de migración.
- [ARCH-3 — Shared / Lib Boundary Inventory](../../../docs/architecture/shared-lib-boundary-inventory.md) — inventario a nivel de archivo del terreno a migrar.
- [Nota de implementación — ARCH-4 shell](../../../docs/implementation/logistics-domain-shell.md) — objetivo, alcance y guardrails de este PR.
