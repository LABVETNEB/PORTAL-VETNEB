# M16 — Logistics: thin `logistics-route-events` + `logistics-sla`

**Estado:** **mergeado y cerrado técnicamente**. Registro histórico del milestone.

- **PR:** #1515
- **Squash SHA:** `a4245d74501ee7c055c8eb09212bca93a4b50d3d`
- **Merge date:** 2026-07-21
- **Base:** `30d604d0f488618357f02bb7ccb6c9fa0ace37fe`
  (`docs(architecture): close M15 logistics milestone` = **M15 ya mergeado**, PR #1513)
- **Resultado:** `a4245d74501ee7c055c8eb09212bca93a4b50d3d` (= `origin/main`)
- **Rama técnica:** `refactor/backend-modularization-m16-thin-route-events-sla`
- **Rama técnica eliminada:** local y remota.
- **Programa:** Fase C (Logistics infra + rutas), milestone **M16**
- **Autorización:** refactor **R2 estructural backend**, autorizado específicamente
  por Nico (AGENTS.md §3), limitado a la allowlist de 16 archivos, invariantes y
  validaciones de esta especificación. No cubrió M17.

## 1. Objetivo y alcance

Eliminar de las dos últimas rutas productivas de Logistics
(`logistics-route-events` y `logistics-sla`) toda referencia — estática,
dinámica, type-only o textual — a `db-logistics` (`../db-logistics.ts` /
`server/db-logistics.ts`), sin retirar ni modificar el shim raíz. La carga
default de persistencia pasa a adapters mínimos de infrastructure y las tres
lecturas SLA que aún llamaban `deps.*` directamente delegan en un caso de uso
nuevo de application.

**Incluido:** 2 adapters DB de infrastructure, 1 puerto de read models SLA, 1
factory de casos de uso SLA, ambas rutas delegando, realineación de contratos
in-PR, documentación.
**Excluido:** M17 (retiro del shim, regresión contractual completa, cierre);
M06 (overdue) y M10 (route events) intactos; el canónico M12 y el shim raíz
intactos; `sla-breach-db.ts` intacto; cache; schema; migraciones; dependencias;
auth global; CORS; rutas de route-plans/field-visits; frontend; CI.

## 2. Baseline R0 (medido en HEAD `30d604d`)

| Métrica | route-events | SLA |
| --- | --- | --- |
| LOC de la ruta antes → después | 1.025 → 1.029 (+4) | 797 → 813 (+16) |
| Endpoints funcionales + `OPTIONS` | 4 + 3 (sin cambios) | 4 + 4 (sin cambios) |
| Fuga de capa previa | tipos type-only + import dinámico lazy del shim | tipos type-only + import dinámico lazy del shim |
| Handlers con `deps.*` DB directos antes | 0 (M10 ya delegaba las 4) | 3 (`/summary`, `/policies`, `/instances`; `/overdue` ya delegaba en M06) |
| Cache / auditoría\* / transacciones / queries inline | 0 / (auditoría en la ruta, intacta) / 0 / 0 | 0 / 0 / 0 / 0 |

\* La auditoría de route-events (`writeAuditLog`, posterior al append) permanece
en la ruta, sin cambios de orden ni ubicación.

## 3. Diseño implementado

```text
logistics-route-events.fastify.ts
  -> application M10 (createCreateRouteEvent, createRouteEventsReadUseCases) — INTACTA
  -> loadDefaultDeps (lazy, forma intacta)
       -> createLogisticsRouteEventsDbAdapter (infrastructure, M16)
            -> db-logistics.ts (canónico M12, intacto)
  -> writeAuditLog vía ../lib/audit.ts (intacto, después del append, en la ruta)

logistics-sla.fastify.ts
  -> application M06 (createListOverdueActiveSlaInstances) — INTACTA  [/overdue]
  -> application M16 (createSlaReadUseCases)                          [/policies, /instances, /summary]
       -> LogisticsSlaReadModelsRepository (application/ports, M16)
  -> loadDefaultDeps (lazy, forma intacta)
       -> createLogisticsSlaDbAdapter (infrastructure, M16)
            -> db-logistics.ts (canónico M12, intacto)
```

- **Adapters DB** (infrastructure, nuevos): factories con **referencias
  directas** a las operaciones canónicas + re-export de sus tipos de I/O. Sólo
  importan `./db-logistics.ts`; sin queries, sin `.transaction`, sin wrappers,
  sin captura de errores, sin imports de application/Fastify/`server/lib`/shim.
  - `logistics-route-events-db-adapter.ts` — 4 ops: `createRouteEvent`,
    `listClinicRouteEvents`, `listRouteEventsForClinicRoutePlan`,
    `listIncrementalClinicRouteEvents` + tipos `CreateRouteEventInput`,
    `ListRouteEventsParams`, `RouteEvent`.
  - `logistics-sla-db-adapter.ts` — 4 ops: `listActiveClinicSlaPolicies`,
    `listClinicSlaInstances`, `listOverdueActiveClinicSlaInstances`,
    `getClinicSlaSummary` + 6 tipos (`ClinicSlaSummary`,
    `ListActiveClinicSlaPoliciesParams`, `ListClinicSlaInstancesParams`,
    `ListOverdueActiveClinicSlaInstancesParams`, `SlaInstance`, `SlaPolicy`).
    La operación overdue se re-expone sólo como referencia directa para la
    carga default de la ruta; su caso de uso sigue siendo el de M06.
- **Puerto SLA** `LogisticsSlaReadModelsRepository` (application/ports, nuevo):
  genérico y estructural (`TSlaPolicy`, `TSlaInstance`, `TSlaSummary`,
  `TListPoliciesParams`, `TListInstancesParams`), cero imports, cero `any`. Sólo
  las **tres** lecturas con consumidor directo (`listActiveClinicSlaPolicies`,
  `listClinicSlaInstances`, `getClinicSlaSummary`); overdue queda en el puerto
  M06 (`logistics-sla-read-repository.ts`), separado por diseño.
- **Casos de uso SLA** `createSlaReadUseCases` (application, nuevo): devuelve
  `listActivePolicies`, `listInstances`, `getSummary`; cada uno delega
  exactamente una vez, mismos argumentos y orden, retorna la promesa por
  identidad, preserva arrays vacíos y objetos, propaga el error original sin
  envolverlo, sin defaults, parsing, serialización, mutación ni estado global.
- **Rutas**: los tipos y la carga default llegan por los adapters (laziness de
  `loadDefaultDeps` preservada: registrar el plugin con todas las deps
  inyectadas sigue sin cargar `server/db.ts`). Cero referencias
  estáticas/dinámicas/type-only/textuales a `db-logistics`. En SLA, el caso de
  uso M16 se compone **exactamente una vez** antes de los handlers, junto a la
  composición M06 intacta.

## 4. Archivos (allowlist ejecutada: 16 paths, 0 eliminados, 0 renombrados)

### Nuevos (6)

| Archivo | Cambio |
| --- | --- |
| `server/features/logistics/infrastructure/logistics-route-events-db-adapter.ts` | **NUEVO.** Adapter DB mínimo (4 ops + 3 tipos). |
| `server/features/logistics/infrastructure/logistics-sla-db-adapter.ts` | **NUEVO.** Adapter DB mínimo (4 ops + 6 tipos). |
| `server/features/logistics/application/ports/logistics-sla-read-models-repository.ts` | **NUEVO.** Puerto de read models SLA (3 ops, genérico, cero imports). |
| `server/features/logistics/application/sla-read-use-cases.ts` | **NUEVO.** Factory `createSlaReadUseCases` (3 lecturas). |
| `test/unit/application/logistics/sla-read-use-cases.test.ts` | **NUEVO.** 10 tests (identidad, array vacío, summary por identidad, delegación única, error propagado, frontera de imports, puerto sin imports). |
| `docs/implementation/m16-logistics-route-events-sla-thin-routes.md` | **NUEVO.** Este documento. |

### Modificados (10)

| Archivo | Cambio |
| --- | --- |
| `server/routes/logistics-route-events.fastify.ts` | **MODIFICADO.** Tipos + carga default vía adapter; comentario realineado; cero referencias a `db-logistics`. Handlers, auditoría, orden append→audit intactos. |
| `server/routes/logistics-sla.fastify.ts` | **MODIFICADO.** Tipos + carga default vía adapter; composición M16; 3 handlers delegan; `/overdue` M06 intacto; cero referencias a `db-logistics`. |
| `server/features/logistics/application/index.ts` | **MODIFICADO.** Barrel: +`createSlaReadUseCases`, +`SlaReadUseCases`, +`LogisticsSlaReadModelsRepository`. Exports M06/M10/M14/M15 sin reordenar. |
| `test/integration/adapters/controllers/logistics-route-events-api.test.ts` | **MODIFICADO.** Anclas `dbLogistics.*`→`routeEventsDb.*` + contrato M16 (tipos/carga default vía adapter, composición única, cero referencia textual a `db-logistics`). Sin debilitar seguridad. |
| `test/integration/adapters/controllers/logistics-sla-routes-api.test.ts` | **MODIFICADO.** Anclas `dbLogistics.*`→`slaDb.*` y `deps.*`→`slaReads.*` + contratos M16 (adapter, delegación de las 3 lecturas, composición única, `/overdue` M06 intacto, cero referencia textual) + `applicationFiles` extendida con los 2 módulos nuevos. |
| `test/architecture/logistics-infrastructure-boundary-guard.test.ts` | **MODIFICADO.** 4 contratos M16: 2 adapters (sólo canónico, superficie exacta de 4 ops, sin queries/tx/wrappers) + 2 rutas sin canónicos ni referencia a `db-logistics`. Reglas M12–M15 intactas. |
| `server/features/logistics/README.md` | **MODIFICADO.** Estado M16. |
| `server/features/logistics/application/README.md` | **MODIFICADO.** Sección "Qué vive aquí (M16)". |
| `server/features/logistics/infrastructure/README.md` | **MODIFICADO.** 2 adapters M16. |
| `docs/audit/backend-enterprise-modularization-program-audit.md` | **MODIFICADO.** Status M16. |

**Denylist respetada (cero cambios, hashes verificados):** canónico M12
(`infrastructure/db-logistics.ts`, 7 transacciones), shim `server/db-logistics.ts`,
`sla-breach-db.ts`, casos de uso y puertos M06/M10, rutas
route-plans/field-visits, `server/fastify-app.ts`, `server/db.ts`,
`server/lib/**`, tests de denylist, `drizzle/**`, `migrations/**`,
`frontend/**`, `scripts/**`, `.github/**`, `package.json`,
`pnpm-lock.yaml`, `AGENTS.md`, `routes/README.md`. M17 no iniciado.

## 5. Invariantes preservadas (antes = después)

- **route-events:** métodos+paths de 4 endpoints + 3 `OPTIONS`; prefijo
  `/api/logistics/route-events`; status codes 200/201/400/401/403/404;
  serializers, parsing, tipos/sources validados, `lat`/`lng` null-safe,
  paginación 50/100, `afterId`/`lastEventId`; trusted-origin sólo en `POST`;
  auth de sesión de clínica, RBAC `canManageLogisticsRouteEvents` en unsafe;
  auditoría `LOGISTICS_ROUTE_EVENT_CREATED` **después** del append y sólo si el
  append devolvió evento; duplicados permitidos, sin deduplicación.
- **SLA:** métodos+paths de 4 endpoints + 4 `OPTIONS`; prefijo
  `/api/logistics/sla`; status codes 200/400/401/403; `canViewLogisticsSla`;
  target types/instance statuses/targetId; default 50/max 100; offset
  inválido→0; fallback `dueAtOrBefore = new Date(now())`; fechas ISO; forma de
  `summary`; clinic scope idéntico. `/overdue` sigue delegando en M06.
- **Transversales:** laziness de `loadDefaultDeps` (deps 100% inyectadas no
  cargan `server/db.ts`); 7 transacciones del canónico intactas; sin
  cache/event-bus/outbox/retry/idempotency nuevos; sin endpoints nuevos.

## 6. Tests

| Cohorte | Comando | Resultado |
| --- | --- | --- |
| 1 — unit M16 | `pnpm exec tsx --test sla-read-use-cases.test.ts` | **PASSED** (10/10) |
| 2 — dirigida M16 + seguridad | 16 archivos (unit M06/M10/M16 + completeness M11 + guards application/infrastructure + contratos API + runtime integración route-events/SLA + audit runtime + RBAC Logistics + auth global + CSRF + production invariants) | **PASSED** (179/179) |
| 3 — validación completa | `pnpm validate:local`, `pnpm security:public-surface`, `git diff --check` | ver §7 |

## 7. Validaciones (estados canónicos)

| Gate | Estado |
| --- | --- |
| Cohorte 1 (unit M16) | **PASSED** (10/10) |
| Cohorte 2 (dirigida + seguridad) | **PASSED** (179/179) |
| `pnpm validate:local` (`typecheck && typecheck:test && test && build`) | **PASSED** (3343 tests: 3342 pass, 1 skipped, 0 fail) |
| `pnpm security:public-surface` | **PASSED** |
| `git diff --check` | **PASSED** |
| Hashes de archivos protegidos (9) | **PASSED** (sin cambios) |
| Canónico con 7 transacciones | **PASSED** |
| `pnpm validate:local:schema` / `db:migrate` | **NOT_RUN** (sin schema/migraciones) |
| Frontend E2E (Playwright) | **NOT_RUN** (sin frontend) |
| Dependency audits | **NOT_RUN** (sin manifests/lockfile) |
| Escrituras Git/GitHub | **COMPLETADAS** — ver §11 (histórico) |

### 7.1 Checks de CI del PR #1515 (histórico)

Resultado real de la corrida del PR: **5 successful · 1 skipped · 0 failing · 0 pending**.

| Check | Resultado |
| --- | --- |
| `qga-workflow-security` | **successful** |
| `QGA Governance/qga-workflow-security` | **successful** |
| `Backend CI/validate-backend (pull_request)` | **successful** |
| `PR Governance/validate-pr-governance` | **successful** |
| `Backend CI/validate-backend (push)` | **successful** |
| `Supabase Preview` | **skipped** (omitido, no fallido) |

## 8. Riesgos residuales y mitigación

- **Comportamiento: bajo.** Delegación 1:1 fijada por 10 tests unitarios nuevos,
  ambos contratos de fuente realineados, los dos runtime de integración (sin
  cambiar expectativas) y los contratos de seguridad verdes.
- **Shim `server/db-logistics.ts`: intacto y sin consumidores productivos tras
  M16.** Los únicos consumidores restantes son tests que importan **tipos** del
  shim (`logistics-audit-runtime`, `*-integration.fastify`, route-plans
  heuristic/metrics runtime) — no productivos. Su retiro global se decide en
  **M17**.
- **Laziness:** preservada; el adapter se importa dinámicamente dentro de
  `loadDefaultDeps`.

## 9. Rollback

Independiente y sin efectos de datos: revertir ambas rutas al import directo del
shim y a las llamadas `deps.*`, borrar los 4 archivos nuevos de
application/infrastructure y su test, revertir el barrel, las anclas de los dos
contratos API y del guard de infraestructura, y los 5 archivos documentales. No
requiere revertir M06–M15. Cada ruta se revierte por separado.

## 10. Estado final

```text
M16 mergeado y cerrado técnicamente
PR #1515
squash SHA a4245d74501ee7c055c8eb09212bca93a4b50d3d
M17 pendiente
Fase C abierta
```

## 11. Operaciones Git/GitHub (completadas, histórico)

Estas operaciones se ejecutaron manualmente y ya están **completadas**; se dejan
registradas como historia del milestone:

- `git add` / `git commit` de la rama técnica
  `refactor/backend-modularization-m16-thin-route-events-sla` sobre la base
  `30d604d0f488618357f02bb7ccb6c9fa0ace37fe`.
- `git push` de la rama técnica.
- Creación del PR **#1515**.
- Corrida de checks del PR (5 successful · 1 skipped · 0 failing · 0 pending; ver §7.1).
- **Merge** por squash → SHA `a4245d74501ee7c055c8eb09212bca93a4b50d3d`
  (merge date 2026-07-21); `origin/main` sincronizado a ese SHA.
- Eliminación de la rama técnica: **local y remota**.
