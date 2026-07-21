# Logistics — bounded context

> **Tipo:** Frontera de módulo del contexto Logistics. Establecida como shell
> docs-only en ARCH-4; **desde ARCH-5 contiene código real** en `domain/` y, desde
> M02b, también en `infrastructure/`.
> **Origen:** [ARCH-1](../../../docs/audit/repository-domain-architecture-audit.md) · [ARCH-2](../../../docs/architecture/backend-boundary-adr.md) · [ARCH-3](../../../docs/architecture/shared-lib-boundary-inventory.md).
> **ID:** ARCH-4 (shell) → ARCH-5/7/8 (domain) → M02b (time-window + SLA) → M03 (route-planning) → M04 (metrics) → **M05 (cierre de Fase A)** → M06–M10 (casos de uso) → **M11 (cierre de Fase B)** → **M12 (Fase C: persistencia canónica en `infrastructure/`)** → **M13 (cache canónico en `infrastructure/`)**.
>
> **Estado:** Fase A **cerrada** (M05) · Fase B **cerrada** (M11, PR #1507 merged) ·
> Fase C **en curso**: M12 **mergeado** (PR #1509) · M13 implementado / pendiente
> de merge.

Este directorio es la **frontera** del contexto Logistics. Declara las reglas de
dependencia del ADR ([ARCH-2](../../../docs/architecture/backend-boundary-adr.md))
y ya aloja código migrado, capa por capa, detrás de contratos con tests verdes:

- **`domain/`** — reglas puras con barrel público (`index.ts`): paginación,
  normalización de visitas heurísticas, ventanas de tiempo, el núcleo puro de
  breach de SLA, la heurística de planificación de rutas y las métricas puras de
  logística (`metrics.ts`).
- **`infrastructure/`** — **persistencia canónica del contexto**
  (`db-logistics.ts`, movida completa en M12 con las 7 transacciones intactas), el
  adaptador de DB para el breach de SLA (`sla-breach-db.ts`, que desde M12 consume el
  canónico de su propia capa) y, desde M13, el **cache canónico de route plans**
  (`logistics-route-plans-cache.ts`, move byte-idéntico).
- **`application/`** — casos de uso extraídos en M06–M10 y cerrados en M11.
- **`routes/`** — todavía sólo README (sin código).

El runtime legacy que queda fuera es `server/routes/logistics-*.fastify.ts` (thin
routes en **M14–M16**, cierre en M17). `server/db-logistics.ts` y
`server/lib/logistics-route-plans-cache.ts` **ya no son implementación**: desde M12
y M13 respectivamente son **shims de compatibilidad** que sólo re-exportan sus
canónicos de `features/logistics/infrastructure/`, y se conservan únicamente porque
esas rutas legacy siguen importándolos. **M05 cierra la Fase A**: el namespace de
dominio legacy `server/lib/logistics/` queda **retirado** (cero archivos
versionados y directorio ausente en un checkout limpio, garantizado por el guard
endurecido); todo consumidor externo del dominio lo hace por el barrel público. M05
no cambia ningún comportamiento runtime.

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
  `route-planning`, `metrics`), consumido por el resto del backend a través del
  barrel `domain/index.ts`. `metrics.ts` es cálculo puro con **cero imports**
  (ni siquiera tipos de `drizzle/schema.ts`); cero `fastify`, cero `db`.
- **Persistencia canónica (M12)** — `server/features/logistics/infrastructure/db-logistics.ts`
  (**1.291 LOC** medidos en HEAD `101731d`; 7 transacciones intactas). Único `db-*`
  que delega en helpers de dominio (`time-window`, `route-planning`), ahora vía
  `../domain/index.ts`. `server/db-logistics.ts` queda como **shim** temporal.
- **Adaptador de infraestructura** — `server/features/logistics/infrastructure/sla-breach-db.ts`:
  cablea el núcleo puro de SLA con la persistencia canónica de su misma capa vía
  import lazy.
- **Cache canónico (M13)** — `server/features/logistics/infrastructure/logistics-route-plans-cache.ts`
  (107 LOC, cero imports, 9 exports; move byte-idéntico).
  `server/lib/logistics-route-plans-cache.ts` queda como **shim** temporal hasta M14.
  Claves, TTL (5 min), invalidaciones y header `X-Logistics-Cache` sin cambios; la
  construcción de claves y el header siguen en la ruta hasta M14.
- **Adaptadores HTTP** — `server/routes/logistics-{route-plans,field-visits,route-events,sla}.fastify.ts`.

> **Nota (M01/ARCH-4 vs. código real):** el inventario ARCH-3 clasificaba
> `sla-breach.ts` como dominio puro que importa "sólo el tipo `SlaTargetType`". En
> realidad el archivo legacy también importaba **tipos y runtime** desde
> `db-logistics.ts` (import estático de tipos + import dinámico del helper). M02b
> resuelve esa divergencia separando el núcleo puro (`domain/sla-breach.ts`, opaco
> respecto de la fila de `slaInstances`) del adaptador con `db-*`
> (`infrastructure/sla-breach-db.ts`).

## 2. Relación temporal con el runtime legacy

Tras el cierre de Fase A (M05), el namespace de dominio `server/lib/logistics/`
**ya no existe**: sus cuatro módulos puros migraron a `domain/` (`sla-breach` +
`time-window` en M02b, `route-planning` en M03, `metrics` en M04) y el directorio
se retiró. El dominio migrado (`domain/`) es la fuente de verdad ejecutable de la
paginación, la normalización de visitas heurísticas, las ventanas de tiempo, el
núcleo puro de SLA, la planificación de rutas y las métricas; `server/db-logistics.ts`
y `server/routes/logistics-route-plans.fastify.ts` los consumen por el barrel.

Tras **M12** la persistencia ya no es legacy: vive en
`features/logistics/infrastructure/db-logistics.ts` y el root es sólo un shim. Tras
**M13** el cache tampoco: vive en
`features/logistics/infrastructure/logistics-route-plans-cache.ts` y el path de
`server/lib` es sólo un shim. Lo que **aún es legacy**:
`server/routes/logistics-*.fastify.ts` (rutas delgadas en **M14–M16**, cierre en
**M17**).

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
- **M03 (hecho)** — `route-planning.ts` movido a `domain/route-planning.ts` (move
  byte-idéntico; el módulo no tiene imports). Barrel re-exporta `buildHeuristicRoutePlan`,
  `calculateHaversineKm` y sus tipos; `server/db-logistics.ts` los consume por el barrel.
  `server/lib/logistics/route-planning.ts` eliminado.
- **M04 (hecho)** — `metrics.ts` movido a `domain/metrics.ts` (move byte-idéntico;
  el módulo tiene **cero imports**). El barrel re-exporta explícitamente sus 12 funciones
  y 20 tipos; `server/routes/logistics-route-plans.fastify.ts` los consume por el barrel.
  `server/lib/logistics/metrics.ts` eliminado; `server/lib/logistics/` queda sin
  módulos de dominio.
- **M05 — cierre de Fase A** — closeout de arquitectura, tests y
  documentación; **cero cambios runtime**. Certifica que `server/lib/logistics/` está
  retirado (cero archivos versionados, directorio ausente), que ningún import de
  `server/**` ni `test/**` apunta al dominio legacy y que el inventario mínimo del
  dominio está presente y se consume por el barrel. Endurece
  `test/architecture/logistics-domain-boundary-guard.test.ts` con tres contratos
  nuevos (inventario requerido como subconjunto, ausencia del directorio legacy,
  prohibición de imports legacy). No mueve `db-logistics.ts`, la cache ni las rutas.
- **M06–M10 (hechos) — Logistics application** — casos de uso extraídos a
  `application/` con puertos mínimos, dejando los handlers thin.
- **M11 (hecho) — cierre de Fase B** — closeout de la capa application (guard de
  frontera + contrato global de inventario); cero cambios runtime.
- **M12 (hecho, PR #1509) — apertura de Fase C** — move **completo** de
  `server/db-logistics.ts` (1.291 LOC) a
  `infrastructure/db-logistics.ts`, con las **7 transacciones intactas**, shim
  documentado en el root, `sla-breach-db.ts` reapuntado al canónico y guard de
  frontera nuevo (`test/architecture/logistics-infrastructure-boundary-guard.test.ts`).
  Sin cambios de comportamiento, endpoints, schema ni migraciones.
- **M13 (este PR)** — move **byte-idéntico** de
  `server/lib/logistics-route-plans-cache.ts` (107 LOC, cero imports, 9 exports) a
  `infrastructure/logistics-route-plans-cache.ts`, shim documentado en el path
  legacy, tests del cache reapuntados al canónico y guard de infraestructura
  extendido (pureza del cache, shim sólo-re-export, infra no consume el shim).
  TTL, claves, invalidaciones y semántica HIT/MISS sin cambios; la ruta
  productiva queda byte-idéntica. Sin puerto de cache anticipado.
  `M14–M16` (thin routes) y `M17` (cierre de Logistics) permanecen futuros.

## 5. Qué NO se mueve en M12

- **No** mover `server/lib/logistics-route-plans-cache.ts` (cache adapter en M13).
- **No** tocar `server/routes/logistics-*.fastify.ts` (rutas delgadas en M14–M16).
- **No** eliminar el shim `server/db-logistics.ts` mientras las rutas legacy lo
  importen.
- **No** reparticionar transacciones ni dividir el archivo canónico.
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
- [Nota de implementación — M04](../../../docs/implementation/m04-logistics-metrics-domain-move.md) — mueve las métricas puras `metrics` a `domain/` y las re-exporta por el barrel.
- [Nota de implementación — M05](../../../docs/implementation/m05-logistics-domain-phase-closeout.md) — cierre de la Fase A: censo legacy, endurecimiento del guard y reconciliación documental, sin cambios runtime.
- [Nota de implementación — M12](../../../docs/implementation/m12-logistics-db-infrastructure-move.md) — mueve `db-logistics.ts` completo a `infrastructure/` con shim en el root.
- [Nota de implementación — M13](../../../docs/implementation/m13-logistics-cache-infrastructure-move.md) — mueve el cache de route plans a `infrastructure/` con shim en `server/lib`.
