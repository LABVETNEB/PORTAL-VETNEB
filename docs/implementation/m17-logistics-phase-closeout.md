# M17 — Logistics: retiro del shim legacy y cierre técnico de Fase C

**Estado:** **mergeado y cerrado.**

- **PR técnico:** [#1517](https://github.com/LABVETNEB/PORTAL-VETNEB/pull/1517) — MERGED
- **Squash SHA:** `6157e9e71baf83aa9bf0ae3dfb748eaefac74be1`
- **Merge timestamp:** `2026-07-21T12:17:23Z`
- **Merge date:** 2026-07-21
- **Rama técnica:** `refactor/backend-modularization-m17-logistics-closeout` —
  eliminada local y remotamente
- **Base técnica:** `dd729bf973120ac4f8e667e08d5f87aedec1c0da`
  (`docs(architecture): close M16 logistics milestone` = **M16 ya mergeado**, PR #1515)
- **Resultado técnico:** `6157e9e71baf83aa9bf0ae3dfb748eaefac74be1` (= `main` =
  `origin/main` = `origin/HEAD`)
- **Programa:** Fase C (Logistics infra + rutas), milestone **M17** (cierre)
- **Autorización:** refactor **R2 estructural backend**, autorizado específicamente
  por Nico (AGENTS.md §3), limitado a la allowlist exacta de 14 paths, invariantes
  y validaciones de esta especificación.
- **Estado de fase:** con M17, la **Fase C queda cerrada**. **M18 (Pricing) no
  iniciado.**

> Este documento registra el estado **histórico** del cierre técnico de M17, ya
> mergeado. El closeout documental posterior
> (`docs(architecture): close M17 logistics milestone`) convierte esta nota y el
> documento rector del programa en registro definitivo de Fase C.

## 1. Objetivo y alcance

Retirar el shim de compatibilidad raíz `server/db-logistics.ts` — última pieza
legacy de Logistics — y cerrar técnicamente la Fase C, sin cambiar comportamiento
runtime.

Desde M12 el shim era exclusivamente `export * from
"./features/logistics/infrastructure/db-logistics.ts";` (16 LOC, sin lógica). Tras
M14–M16 ninguna ruta productiva lo consumía; sus únicos consumidores restantes eran
**cinco** tests que sólo importaban **tipos**. M17 lo elimina y realinea esos cinco
tests al canónico (Opción B).

**Incluido:** eliminación del shim; realineación de 5 imports `type-only` de tests
al canónico; inversión del contrato de shim en el guard de infraestructura; poda de
los contratos de shim en `logistics-db.test.ts` (conservando la protección del
canónico); documentación de cierre.
**Excluido:** el canónico M12 (`infrastructure/db-logistics.ts`) y sus 7
transacciones; los cuatro adapters DB M14–M16; `sla-breach-db.ts`; domain;
application; rutas productivas; cache; schema; migraciones; auth/CORS/CSRF;
dependencias; frontend; CI. La cabecera stale de M12 (fuera de alcance por decisión
de scope). M18 (Pricing).

## 2. Baseline R0 (medido en HEAD `dd729bf`)

| Métrica | Valor |
| --- | --- |
| Shim `server/db-logistics.ts` | SHA256 `db2810ad…433d` · 16 LOC · 1 statement (`export *`) |
| Canónico `infrastructure/db-logistics.ts` | SHA256 `657309…802d3` · 1300 LOC · **7** `db.transaction(` |
| Consumidores productivos del shim | **0** |
| Consumidores test del shim | **5** (todos `import type`, cero runtime) |
| Contratos que exigían su existencia | 2 archivos (guard de infraestructura + `logistics-db.test.ts`) |

## 3. Diseño implementado

```text
server/db-logistics.ts (shim raíz, export * del canónico)   →  ELIMINADO
  · 5 tests type-only  →  realineados a
      server/features/logistics/infrastructure/db-logistics.ts (canónico, INTACTO)
  · guard de infraestructura: "shim existe" → "shim retirado y no recreable"
  · logistics-db.test.ts: elimina lecturas del shim; conserva protección del canónico
```

- **Retiro del shim.** Se elimina exclusivamente `server/db-logistics.ts`. No se
  mueve, vacía, deprecia ni reemplaza por otro barrel. La **única** fuente de
  persistencia de Logistics es `server/features/logistics/infrastructure/db-logistics.ts`.
- **Realineación de 5 tests (Opción B).** En cada archivo se cambia **únicamente**
  el specifier del `import type`, de `../../../../server/db-logistics.ts` a
  `../../../../server/features/logistics/infrastructure/db-logistics.ts`. Se
  preservan `import type`, la lista y el orden de símbolos, cuerpos, fixtures,
  assertions y runtime. No se parten imports entre adapters ni se agregan imports
  runtime, y ningún adapter se modifica para exportar tipos adicionales.
  - `logistics-audit-runtime.test.ts` — `GenerateHeuristicRoutePlanInput,
    GenerateHeuristicRoutePlanResult, RouteEvent, RoutePlan,
    RoutePlanLifecycleAction, RouteStop`.
  - `logistics-field-visits-integration.fastify.test.ts` — `FieldVisit,
    UpdateFieldVisitInput`.
  - `logistics-route-events-integration.fastify.test.ts` — `CreateRouteEventInput,
    ListRouteEventsParams, RouteEvent`.
  - `logistics-route-plans-heuristic-runtime.test.ts` — `GenerateHeuristicRoutePlanInput,
    GenerateHeuristicRoutePlanResult, RoutePlan, RouteStop`.
  - `logistics-route-plans-metrics-runtime.test.ts` — idénticos a heuristic.
- **Guard de infraestructura invertido.** En
  `logistics-infrastructure-boundary-guard.test.ts` se elimina la constante muerta
  `canonicalSpecifierFromRoot` y el test *"El shim raíz existe y sólo re-exporta la
  implementación canónica"* se reemplaza por *"El shim raíz `server/db-logistics.ts`
  fue retirado en M17 y no puede recrearse"* (espeja el precedente M14 del shim de
  cache retirado). El nuevo contrato afirma, **por path resuelto** (nunca por texto):
  `existsSync(server/db-logistics.ts) === false`; ningún import de `server/**`
  resuelve al path retirado; y los cinco tests antes consumidores no resuelven al
  path retirado. Los imports `./db-logistics.ts` dentro de `infrastructure/` siguen
  permitidos porque resuelven al canónico. Se preservan intactos el resto de
  contratos M12–M16 (auto-discovery, dirección de dependencias, dominio por barrel,
  `sla-breach-db.ts`, cache canónico, shim de cache retirado, adapters M14–M16,
  rutas sin canónicos ni referencia textual a `db-logistics`, implementación real
  del canónico y **7 transacciones**). No se crea un segundo guard.
- **`logistics-db.test.ts` realineado.** Se eliminan `ROOT_SHIM_PATH`, la lectura
  top-level `rootShimSource` y los tres tests exclusivos del shim (re-export, no
  persistencia, no segunda implementación); en el test de preservación R0 se
  conserva la aserción de 7 transacciones del canónico y se elimina sólo la mitad
  del shim. Todas las lecturas del canónico (exports, fuente real, transacciones,
  queries, scoping) quedan intactas. El archivo importa y ejecuta sus tests con el
  shim ya ausente.

## 4. Archivos (allowlist ejecutada: 14 paths — 1 D · 1 A · 12 M · 0 R)

### DELETE (1)

| Archivo | Cambio |
| --- | --- |
| `server/db-logistics.ts` | **ELIMINADO.** Shim de compatibilidad sin consumidores productivos. |

### CREATE (1)

| Archivo | Cambio |
| --- | --- |
| `docs/implementation/m17-logistics-phase-closeout.md` | **NUEVO.** Este documento. |

### MODIFY — tests (7)

| Archivo | Cambio |
| --- | --- |
| `test/architecture/logistics-infrastructure-boundary-guard.test.ts` | Contrato de shim invertido (existe → retirado/no-recreable, por path resuelto); `canonicalSpecifierFromRoot` eliminado. Resto M12–M16 intacto. |
| `test/unit/infrastructure/logistics/logistics-db.test.ts` | Quita lectura top-level del shim + 3 tests de shim + mitad-shim del test R0. Protección del canónico intacta. |
| `test/integration/adapters/controllers/logistics-audit-runtime.test.ts` | Specifier `import type` shim → canónico (Opción B). |
| `test/integration/adapters/controllers/logistics-field-visits-integration.fastify.test.ts` | idem. |
| `test/integration/adapters/controllers/logistics-route-events-integration.fastify.test.ts` | idem. |
| `test/integration/adapters/controllers/logistics-route-plans-heuristic-runtime.test.ts` | idem. |
| `test/integration/adapters/controllers/logistics-route-plans-metrics-runtime.test.ts` | idem. |

### MODIFY — documentación (5)

| Archivo | Cambio |
| --- | --- |
| `docs/audit/backend-enterprise-modularization-program-audit.md` | Status M17 = mergeado (PR #1517); Fase C cerrada; M18 no iniciado. |
| `server/features/logistics/README.md` | Estado M17; shim retirado; canónico como única persistencia; se elimina la instrucción de conservar el shim; +link M17. |
| `server/features/logistics/application/README.md` | M17 no toca application (M06–M16 intacta); sólo retira compat legacy. |
| `server/features/logistics/infrastructure/README.md` | Sección de shims: `db-logistics` retirado en M17; canónico único; 7 transacciones; adapters intactos. |
| `server/features/logistics/routes/README.md` | M14–M16 completados; M17 mergeado (PR #1517); `routes/` sigue docs-only; ningún handler se movió. |

**Denylist respetada (cero cambios, hashes verificados):** canónico M12
(`infrastructure/db-logistics.ts`, 7 transacciones), los cuatro adapters DB
M14–M16, `sla-breach-db.ts`, cache canónico y su adapter, domain, application,
rutas productivas `logistics-*.fastify.ts`, `server/db.ts`, `server/lib/**`,
`drizzle/**`, `migrations/**`, `frontend/**`, `scripts/**`, `.github/**`,
`package.json`, `pnpm-lock.yaml`, `AGENTS.md`, ROLLING_ROADMAP, docs m12–m16,
guards de domain/application, `logistics-sla-breach-runtime.test.ts`,
`global-performance-resilience-contract.test.ts`. La cabecera stale de M12 queda
**fuera de alcance**.

## 5. Invariantes preservadas (antes = después)

- **Canónico M12 byte-idéntico:** SHA256 `657309…802d3`, **7** `db.transaction(`.
- **Cuatro adapters DB M14–M16 y `sla-breach-db.ts`:** hashes idénticos.
- **Cuatro rutas productivas:** hashes idénticos; cero cambios de endpoints,
  contratos HTTP, status codes, serializers, auth, RBAC, CORS, CSRF, cache ni
  auditoría.
- **Cinco tests:** mismos símbolos, `import type`, mismos cuerpos y assertions;
  sólo cambió la fuente del tipo. Sin cambio de runtime.
- **Sin dependencias nuevas, sin schema, sin migraciones, sin frontend.**

## 6. Validaciones (estados canónicos)

| Gate | Estado |
| --- | --- |
| Cohorte 1 (7 archivos de cambio directo) | **PASSED** — ver §6.1 |
| Cohorte 2 (regresión contractual Logistics dirigida) | **PASSED** — ver §6.2 |
| `pnpm validate:local` (`typecheck && typecheck:test && test && build`) | **PASSED** — ver §6.3 |
| `pnpm security:public-surface` | **PASSED** |
| `git diff --check` | **PASSED** |
| Shim ausente (`Test-Path` = False; `D` en status) | **PASSED** |
| Cero imports reales al shim (prod + test) | **PASSED** |
| Canónico con 7 `db.transaction(` | **PASSED** |
| Hashes protegidos (canónico + 4 adapters + `sla-breach-db` + 4 rutas) | **PASSED** (sin cambios) |
| UTF-8 estricto / sin BOM / sin U+FFFD / sin conflict markers (13 paths) | **PASSED** |
| `pnpm validate:local:schema` / `db:migrate` | **NOT_RUN** (sin schema/migraciones) |
| Frontend E2E (Playwright) | **NOT_RUN** (sin frontend) |
| Dependency audits (`pnpm audit`) | **NOT_RUN** (sin manifests/lockfile) |
| CI remoto (PR #1517) | **PASSED** — 5 successful · 1 skipped · 0 failing · 0 pending; ver §6.4 |

### 6.1 Cohorte 1

`pnpm exec tsx --test` sobre los 7 archivos de cambio directo (guard de
infraestructura, `logistics-db`, y los 5 runtime/integration realineados).
Resultado: **PASSED** — `tests 97 · pass 97 · fail 0 · skipped 0 · duration ≈ 1.32 s · exit 0`.

### 6.2 Cohorte 2

Regresión contractual Logistics dirigida — **38 paths**: 3 guards
(domain/application/infrastructure); completeness de application; 15 casos de uso
unit de application; 4 contratos API; 7 runtime/integration de
route-plans/field-visits/route-events/SLA + audit runtime; `logistics-db`;
route-plans cache; SLA breach runtime; RBAC Logistics; auth global; CSRF
mutating-route coverage; production invariants; global performance/resilience.
Resultado: **PASSED** — `tests 367 · pass 367 · fail 0 · skipped 0 · duration ≈ 1.47 s · exit 0`.

### 6.3 `pnpm validate:local`

`typecheck && typecheck:test && test && build`. Resultado: **PASSED** —
`test: tests 3340 · pass 3339 · skipped 1 · fail 0`; `build: esbuild dist/index.js ≈ 848 kb`; `exit 0`.

### 6.4 CI remoto (PR #1517)

**5 successful · 1 skipped · 0 failing · 0 pending.**

Checks exitosos:

- `qga-workflow-security`
- `QGA Governance / qga-workflow-security (pull_request_target)`
- `Backend CI / validate-backend (pull_request)`
- `PR Governance / validate-pr-governance (pull_request)`
- `Backend CI / validate-backend (push)`

Check omitido (no fallido): `Supabase Preview`.

## 7. Riesgos residuales y mitigación

- **Eliminación incompleta:** mitigada por la realineación de los 5 imports, el
  guard invertido y `typecheck:test`.
- **Pérdida de cobertura del canónico:** mitigada — `logistics-db.test.ts` conserva
  sus contratos del canónico y el guard conserva implementación real + 7
  transacciones.
- **Falso positivo por el nombre `db-logistics`:** mitigado — el guard compara por
  **path resuelto**, no prohíbe el texto global (el canónico conserva ese nombre y
  los adapters lo importan legítimamente como `./db-logistics.ts`).
- **Scope creep:** mitigado — allowlist exacta de 14; M12 stale y roadmap histórico
  excluidos; runtime productivo en denylist.
- **Cierre prematuro de fase:** mitigado — el squash merge de PR #1517
  (`6157e9e71baf83aa9bf0ae3dfb748eaefac74be1`, 2026-07-21) y el closeout
  documental posterior (`docs(architecture): close M17 logistics milestone`)
  registran el cierre definitivo con SHA, fecha y CI.

## 8. Rollback

Independiente y sin efectos de datos:

- restaurar `server/db-logistics.ts` con su único `export * from
  "./features/logistics/infrastructure/db-logistics.ts";`;
- restaurar los cinco `import type` al shim raíz;
- restaurar en el guard el contrato de existencia/forma del shim y la constante
  `canonicalSpecifierFromRoot`; restaurar en `logistics-db.test.ts` la lectura del
  shim y sus tres tests;
- revertir únicamente los documentos M17.

No requiere revertir M12–M16 ni rollback de DB, schema, migraciones o datos.

## 9. Estado Git/GitHub

```text
rama técnica = refactor/backend-modularization-m17-logistics-closeout
base técnica = dd729bf973120ac4f8e667e08d5f87aedec1c0da
commit técnico local = creado
rama técnica = publicada
PR #1517 = creado
checks CI = completados (5 successful · 1 skipped · 0 failing)
squash merge = completado (SHA 6157e9e71baf83aa9bf0ae3dfb748eaefac74be1, 2026-07-21)
rama técnica = eliminada local y remotamente
main = sincronizado con origin/main y origin/HEAD en el squash SHA
working tree = limpio
M18 = no iniciado
```

## 10. Estado final

```text
M17 mergeado y cerrado (PR #1517, squash SHA 6157e9e71baf83aa9bf0ae3dfb748eaefac74be1, 2026-07-21)
shim server/db-logistics.ts retirado
cero consumidores productivos · cero imports reales de tests al shim
canónico intacto (7 transacciones)
Fase C cerrada
M18 (Pricing) no iniciado
```
