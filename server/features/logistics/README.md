# Logistics — bounded context

> **Tipo:** Frontera de módulo del contexto Logistics. Establecida como shell
> docs-only en ARCH-4; **desde ARCH-5 contiene código real** en `domain/` y, desde
> M02b, también en `infrastructure/`.
> **Origen:** [ARCH-1](../../../docs/audit/repository-domain-architecture-audit.md) · [ARCH-2](../../../docs/architecture/backend-boundary-adr.md) · [ARCH-3](../../../docs/architecture/shared-lib-boundary-inventory.md).
> **ID:** ARCH-4 (shell) → ARCH-5/7/8 (domain) → M02b (time-window + SLA) → M03 (route-planning).

Este directorio es la **frontera** del contexto Logistics. Declara las reglas de
dependencia del ADR ([ARCH-2](../../../docs/architecture/backend-boundary-adr.md))
y ya aloja código migrado, capa por capa, detrás de contratos con tests verdes:

- **`domain/`** — reglas puras con barrel público (`index.ts`): paginación,
  normalización de visitas heurísticas, ventanas de tiempo, el núcleo puro de
  breach de SLA y la heurística de planificación de rutas.
- **`infrastructure/`** — adaptador transitorio de DB para el breach de SLA
  (`sla-breach-db.ts`).
- **`application/`** y **`routes/`** — todavía sólo README (sin código).

El resto del runtime sigue viviendo, sin cambios en M03, en
`server/lib/logistics/metrics.ts`, `server/db-logistics.ts` y
`server/routes/logistics-*.fastify.ts`.

## 1. Responsabilidad del contexto Logistics

Logistics es el contexto de **planificación y operación de rutas de recolección y
entrega** del portal: planes de ruta, visitas de campo, eventos de ruta y control
de SLA. Según [ARCH-1](../../../docs/audit/repository-domain-architecture-audit.md)
es el mini-dominio con **cohesión muy alta**, **acoplamiento bajo** y **riesgo
bajo**, y por eso es el piloto de migración por dominios. Concentra además los
god-handlers más grandes del backend (`logistics-route-plans.fastify.ts` ≈ 2.241
LOC), donde extraer application/domain tiene el mayor retorno de mantenibilidad.

Su superficie actual es:

- **Dominio migrado** — `server/features/logistics/domain/` (paginación,
  `route-plan-field-visits`, `time-window`, núcleo puro de `sla-breach`,
  `route-planning`), consumido por el resto del backend a través del barrel
  `domain/index.ts`.
- **Dominio pendiente** — `server/lib/logistics/metrics.ts`. Importa **sólo tipos**
  de `drizzle/schema.ts`; cero `fastify`, cero `db`. Migra en M04.
- **Adaptador de infraestructura** — `server/features/logistics/infrastructure/sla-breach-db.ts`
  (transitorio): cablea el núcleo puro de SLA con `db-logistics.ts` vía import lazy.
- **Persistencia + dominio mezclados (legacy, fuera de M02b)** — `server/db-logistics.ts`
  (~1.322 LOC). Único `db-*` que delega en helpers de dominio (`time-window`,
  `route-planning`); candidato natural a repositorio del contexto en M12.
- **Infra de contexto** — `server/lib/logistics-route-plans-cache.ts`.
- **Adaptadores HTTP** — `server/routes/logistics-{route-plans,field-visits,route-events,sla}.fastify.ts`.

> **Nota (M01/ARCH-4 vs. código real):** el inventario ARCH-3 clasificaba
> `sla-breach.ts` como dominio puro que importa "sólo el tipo `SlaTargetType`". En
> realidad el archivo legacy también importaba **tipos y runtime** desde
> `db-logistics.ts` (import estático de tipos + import dinámico del helper). M02b
> resuelve esa divergencia separando el núcleo puro (`domain/sla-breach.ts`, opaco
> respecto de la fila de `slaInstances`) del adaptador con `db-*`
> (`infrastructure/sla-breach-db.ts`).

## 2. Relación temporal con `server/lib/logistics` actual

Esta carpeta **convive** con la estructura legacy y ya absorbió parte de ella. El
dominio migrado (`domain/`) es la fuente de verdad ejecutable de la paginación, la
normalización de visitas heurísticas, las ventanas de tiempo, el núcleo puro de
SLA y la planificación de rutas; `server/db-logistics.ts` los consume por el
barrel. Lo que **aún no se ha movido**: `server/lib/logistics/metrics.ts` (M04),
`server/db-logistics.ts` (legacy, candidato a repositorio en M12) y
`server/routes/logistics-*.fastify.ts`.

Es una migración incremental y deliberada: se mueve código real capa por capa,
detrás de los contratos por-ruta existentes y sólo con tests verdes.

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

Cada capa detalla su propio contrato en su README. `domain/` e `infrastructure/`
ya contienen código; `application/` y `routes/` describen dónde vivirá cada cosa
cuando se migre.

## 4. Estado de la migración

Migración incremental, **un paso por PR**, siempre detrás de contratos y con tests
verdes. Cada carpeta materializa código **sólo cuando hay algo real que la habite**
— nunca carpetas/barrels vacíos por dogma.

- **ARCH-5 (hecho)** — `route-plan-field-visits.ts` movido a `domain/`.
- **ARCH-7 (hecho)** — `pagination.ts` extraído a `domain/`.
- **ARCH-8 (hecho)** — barrel público `domain/index.ts`.
- **M02b (hecho)** — `time-window.ts` y el núcleo puro de `sla-breach.ts` movidos a
  `domain/`; el adaptador de DB de SLA (`markOverdueSlaBreachesWithDb`) a
  `infrastructure/sla-breach-db.ts`. `server/lib/logistics/{time-window,sla-breach}.ts`
  eliminados.
- **M03 (este PR)** — `route-planning.ts` movido a `domain/route-planning.ts` (move
  byte-idéntico; el módulo no tiene imports). Barrel re-exporta `buildHeuristicRoutePlan`,
  `calculateHaversineKm` y sus tipos; `server/db-logistics.ts` los consume por el barrel.
  `server/lib/logistics/route-planning.ts` eliminado.
- **M04 (pendiente)** — mover `metrics.ts` desde `server/lib/logistics/` a `domain/`.
- **Application / routes (pendiente)** — extraer un caso de uso de un god-handler a
  `application/` y dejar el handler thin; sólo cuando haya código real que lo habite.

## 5. Qué NO se mueve en M03

- **No** mover `server/lib/logistics/metrics.ts` (M04).
- **No** mover `server/db-logistics.ts` (legacy; candidato a repositorio en M12).
- **No** tocar `server/routes/logistics-*.fastify.ts`.
- **No** crear services vacíos ni puertos/interfaces vacíos.
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
- [Nota de implementación — ARCH-4 shell](../../../docs/implementation/logistics-domain-shell.md) — objetivo, alcance y guardrails del shell.
- [Nota de implementación — M02b](../../../docs/implementation/m02b-logistics-sla-time-window-domain-move.md) — mueve `time-window` y el núcleo puro de `sla-breach` a `domain/`, y el adaptador de DB a `infrastructure/`.
- [Nota de implementación — M03](../../../docs/implementation/m03-logistics-route-planning-domain-move.md) — mueve la heurística pura `route-planning` a `domain/` y la re-exporta por el barrel.
