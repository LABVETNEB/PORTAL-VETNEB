# Logistics — bounded context

> **Tipo:** Frontera de módulo del contexto Logistics. Establecida como shell
> docs-only en ARCH-4; **desde ARCH-5 contiene código real** en `domain/` y, desde
> M02b, también en `infrastructure/`.
> **Origen:** [ARCH-1](../../../docs/audit/repository-domain-architecture-audit.md) · [ARCH-2](../../../docs/architecture/backend-boundary-adr.md) · [ARCH-3](../../../docs/architecture/shared-lib-boundary-inventory.md).
> **ID:** ARCH-4 (shell) → ARCH-5/7/8 (domain) → M02b (time-window + SLA) → M03 (route-planning) → M04 (metrics) → **M05 (cierre de Fase A)** → M06–M10 (casos de uso) → **M11 (cierre de Fase B)** → **M12 (Fase C: persistencia canónica en `infrastructure/`)** → **M13 (cache canónico en `infrastructure/`)** → **M14 (thin `logistics-route-plans` + puerto de cache)** → **M15 (thin `logistics-field-visits` + adapter DB de field visits)**.
>
> **Estado:** Fase A **cerrada** (M05) · Fase B **cerrada** (M11, PR #1507 merged) ·
> Fase C **en curso**: M12 **mergeado** (PR #1509) · M13 **mergeado** (PR #1511) ·
> M14 **mergeado** (PR #1512) · M15 **mergeado** (PR #1513) · M16–M17
> pendientes.

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

El runtime legacy que queda fuera son las rutas de route-events y SLA
(`server/routes/logistics-*.fastify.ts`, thin routes en **M16**, cierre en M17);
`logistics-route-plans` quedó thin en **M14** (cache vía puerto de application +
adapter de infrastructure) y `logistics-field-visits` en **M15** (seis handlers
delegando en casos de uso y carga default por
`logistics-field-visits-db-adapter.ts`). `server/db-logistics.ts` **ya no es
implementación**: desde M12 es un **shim de compatibilidad** que sólo re-exporta el
canónico de `features/logistics/infrastructure/`, conservado únicamente porque las
rutas legacy restantes (route-events y SLA) siguen importándolo. El shim del cache
(`server/lib/logistics-route-plans-cache.ts`) fue **retirado en M14** (su único
consumidor productivo era la ruta de route plans). **M05 cierra la Fase A**: el namespace de
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
- **Cache canónico (M13) + adapter del puerto (M14)** —
  `server/features/logistics/infrastructure/logistics-route-plans-cache.ts`
  (107 LOC, cero imports, 9 exports; move byte-idéntico, intacto en M14) y
  `logistics-route-plans-cache-adapter.ts`, que implementa por composición mínima
  el puerto `LogisticsRoutePlansCacheRepository` de application. Claves, TTL
  (5 min), invalidaciones y semántica HIT/MISS sin cambios; desde M14 la
  construcción de claves y el read-through viven en el caso de uso de
  application, y la ruta sólo escribe el header `X-Logistics-Cache` a partir del
  `cacheStatus` retornado. El shim de `server/lib` fue retirado.
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
`features/logistics/infrastructure/logistics-route-plans-cache.ts`; el shim de
`server/lib` fue retirado en **M14**, cuando la ruta de route plans quedó thin y
pasó a consumir el cache por puerto de application + adapter. Tras **M15**,
`logistics-field-visits` también quedó thin: sus siete handlers funcionales
delegan en casos de uso de application y su carga default de persistencia pasa
por `logistics-field-visits-db-adapter.ts`, sin ninguna referencia a
`db-logistics`. Lo que **aún es legacy**: las rutas de route-events y SLA (rutas
delgadas en **M16**, cierre en **M17**).

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
- **M13 (hecho, PR #1511)** — move **byte-idéntico** de
  `server/lib/logistics-route-plans-cache.ts` (107 LOC, cero imports, 9 exports) a
  `infrastructure/logistics-route-plans-cache.ts`, shim documentado en el path
  legacy, tests del cache reapuntados al canónico y guard de infraestructura
  extendido (pureza del cache, shim sólo-re-export, infra no consume el shim).
  TTL, claves, invalidaciones y semántica HIT/MISS sin cambios; la ruta
  productiva queda byte-idéntica. Sin puerto de cache anticipado.
- **M14 (hecho, PR #1512) — thin `logistics-route-plans`** — la ruta deja de orquestar el
  cache directamente: se introduce el puerto opaco
  `LogisticsRoutePlansCacheRepository` (application/ports) **junto con su primer
  consumidor real**, el caso de uso `createRoutePlansCacheUseCases`
  (read-through HIT/MISS de listado y métricas con las mismas claves, más las
  invalidaciones exactas tras las siete mutaciones), implementado en
  infrastructure por `logistics-route-plans-cache-adapter.ts` (composición mínima
  sobre el cache canónico de M13, intacto). La ruta queda además **sin ninguna
  referencia a `db-logistics`**: tipos y carga default llegan por
  `logistics-route-plans-db-adapter.ts` (referencias directas al DB canónico de
  M12, laziness preservada). La ruta conserva sólo HTTP: auth,
  RBAC, clinic scoping, parsing, serialización pura vía callbacks
  (`serializeSnapshot` síncrono, sin efectos), mapeo de status codes y escritura
  de `X-Logistics-Cache` desde el `cacheStatus` retornado. El shim
  `server/lib/logistics-route-plans-cache.ts` queda **retirado**; el shim
  `server/db-logistics.ts` permanece sólo para las rutas de M15/M16. Cero
  cambios de contrato HTTP, claves, TTL, invalidaciones, auth ni auditoría.
- **M15 (mergeado en PR #1513) — thin `logistics-field-visits`** — los seis handlers que aún
  llamaban `deps.*` directamente delegan en casos de uso de application
  (`createListFieldVisits`, `createCreateFieldVisit`,
  `createVisitLocationUseCases`, `createTimeWindowUseCases`), cada uno con su
  puerto mínimo genérico derivado del seam
  `LogisticsFieldVisitsNativeRoutesOptions`; el PATCH conserva el caso de uso
  M09 intacto. La ruta queda **sin ninguna referencia a `db-logistics`**: los 8
  tipos de I/O y las 7 operaciones de persistencia llegan por
  `logistics-field-visits-db-adapter.ts` (referencias directas al DB canónico de
  M12, laziness de `loadDefaultDeps` preservada). La ruta conserva sólo HTTP:
  CORS por-ruta, trusted-origin, auth de sesión de clínica, RBAC, parsing,
  validaciones, serializers, mensajes y status codes, carácter por carácter. El
  shim `server/db-logistics.ts` permanece sólo para route-events y SLA (M16;
  retiro global en M17). Cero cambios de contrato HTTP, schema, migraciones,
  auth ni CORS. `M16` (thin route-events + SLA) y `M17` (cierre de Logistics)
  permanecen futuros.

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
- [Nota de implementación — M14](../../../docs/implementation/m14-logistics-route-plans-thin-route.md) — thin `logistics-route-plans`: puerto de cache + adapter DB; retira el shim del cache.
- [Nota de implementación — M15](../../../docs/implementation/m15-logistics-field-visits-thin-route.md) — thin `logistics-field-visits`: casos de uso + adapter DB de field visits.
