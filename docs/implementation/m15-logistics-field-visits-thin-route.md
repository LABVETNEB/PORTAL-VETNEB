# M15 — Logistics: thin `logistics-field-visits` (casos de uso + adapter DB)

**Estado:** implementado / **pendiente de merge**. Working tree listo para revisión
manual de Nico; ninguna escritura Git/GitHub ejecutada por el agente.

- **Rama:** `refactor/backend-modularization-m15-thin-logistics-field-visits`
- **Base exacta:** `c48791657a4c0eb9532d24df367cae8d18da3b7b`
  (`refactor(logistics): thin route plans handlers (#1512)` = **M14 ya mergeado**)
- **Programa:** Fase C (Logistics infra + rutas), milestone **M15**
- **Autorización:** refactor **R2 estructural backend**, autorizado específicamente
  por Nico en la tarea actual (AGENTS.md §3), limitado al diseño, allowlist,
  invariantes y validaciones de la auditoría R0 entregada en la misma sesión.

## 1. Objetivo y alcance

Adelgazar `server/routes/logistics-field-visits.fastify.ts`: los seis handlers
que aún invocaban `deps.*` directamente delegan en casos de uso de application,
y la ruta deja de tener **cualquier** referencia a `db-logistics` (la carga
default de persistencia pasa por un adapter mínimo de infrastructure).

**Incluido:** 4 puertos mínimos, 4 módulos de casos de uso, adapter DB de field
visits, ruta delegando, realineación de contratos in-PR, documentación.
**Excluido:** M16, M17; el UC/puerto M09 (intactos); el canónico M12 y el shim
raíz (intactos); cache; auditoría; schema; migraciones; dependencias; auth
global; CORS helpers; rutas de route-plans/route-events/SLA; frontend; CI.

## 2. Baseline R0 (medido en HEAD `c487916`)

| Métrica | Valor |
| --- | --- |
| LOC de la ruta (`wc -l`) | **1.427** → **1.453** tras M15 (+26 netas: zona de composición de los 4 UCs) |
| Endpoints | 7 funcionales + 4 `OPTIONS` (sin cambios) |
| Fuga de capa | shim `../db-logistics.ts`: 8 tipos estáticos + 7 operaciones vía import dinámico lazy |
| Llamadas `deps.*` DB directas en handlers | **6** (la séptima, update, ya pasaba por el UC M09) |
| Cache / auditoría / transacciones / queries inline | 0 / 0 / 0 / 0 |

## 3. Diseño implementado

```text
route (HTTP: CORS, trusted-origin, auth cookie, RBAC, parsing, status codes, serialización)
  -> createListFieldVisits          -> LogisticsFieldVisitsReadRepository
  -> createCreateFieldVisit         -> LogisticsFieldVisitCreateRepository
  -> createVisitLocationUseCases    -> LogisticsVisitLocationRepository
  -> createTimeWindowUseCases       -> LogisticsTimeWindowsRepository
  -> createUpdateFieldVisit (M09, intacto) -> LogisticsFieldVisitUpdateRepository
  -> loadDefaultDeps (lazy, forma intacta)
       -> createLogisticsFieldVisitsDbAdapter (infrastructure, M15)
            -> db-logistics.ts (canónico M12, intacto)
```

- **Puertos** (application/ports, nuevos): estructurales, genéricos, derivados
  del seam `LogisticsFieldVisitsNativeRoutesOptions`; sin Fastify, Drizzle,
  schema, `db-logistics`, `server/lib` ni tipos concretos de infraestructura.
- **Casos de uso**: cada operación recibe inputs ya autenticados, clinic-scoped
  y validados; delega exactamente una vez; devuelve la misma promesa/resultado
  (identidad, `null`, `undefined`, array vacío); propaga el mismo error sin
  envolver; no serializa, no mapea status HTTP, no genera mensajes, no agrega
  side-effects.
- **Composición**: cada factory se compone **exactamente una vez** en la zona de
  composición de la ruta, antes de los handlers (contrato M11 de completeness).
- **Adapter DB** `createLogisticsFieldVisitsDbAdapter()`: referencias directas a
  las 7 operaciones canónicas (`createFieldVisit`, `listClinicFieldVisits`,
  `updateClinicScopedFieldVisit`, `getVisitLocationForClinicVisit`,
  `upsertVisitLocationForClinicVisit`, `createTimeWindowForClinicVisit`,
  `listTimeWindowsForClinicVisit`) + re-export de los 8 tipos de I/O. Sólo
  importa `./db-logistics.ts`; sin queries, sin `.transaction`, sin wrappers,
  sin captura de errores, sin imports de application/Fastify/`server/lib`.
- **Ruta**: los tipos y la carga default llegan por el adapter (laziness de
  `loadDefaultDeps` preservada: registrar el plugin con todas las deps
  inyectadas sigue sin cargar `server/db.ts` ni la DB real). Cero referencias
  estáticas, dinámicas, type-only o textuales a `db-logistics`. CORS, preflight,
  trusted-origin, auth de sesión (`app_session_id` vía `ENV.cookieName`,
  expiración, clear-cookie, refresh last-access), RBAC
  `canManageLogisticsFieldVisits`, parsing, validaciones, serializers, mensajes
  y status codes: carácter por carácter iguales.

## 4. Archivos (allowlist ejecutada: 22 paths, 0 eliminados)

| Archivo | Cambio |
| --- | --- |
| `server/features/logistics/application/ports/logistics-field-visits-read-repository.ts` | **NUEVO.** Puerto de listado. |
| `server/features/logistics/application/ports/logistics-field-visit-create-repository.ts` | **NUEVO.** Puerto de creación. |
| `server/features/logistics/application/ports/logistics-visit-location-repository.ts` | **NUEVO.** Puerto de ubicación (get + upsert). |
| `server/features/logistics/application/ports/logistics-time-windows-repository.ts` | **NUEVO.** Puerto de ventanas horarias (list + create). |
| `server/features/logistics/application/list-field-visits.ts` | **NUEVO.** UC `createListFieldVisits`. |
| `server/features/logistics/application/create-field-visit.ts` | **NUEVO.** UC `createCreateFieldVisit`. |
| `server/features/logistics/application/visit-location-use-cases.ts` | **NUEVO.** UCs `getVisitLocation`/`upsertVisitLocation`. |
| `server/features/logistics/application/time-window-use-cases.ts` | **NUEVO.** UCs `listTimeWindows`/`createTimeWindow`. |
| `server/features/logistics/application/index.ts` | **MODIFICADO.** Barrel: 4 factories + 4 tipos de UC + 4 puertos M15. |
| `server/features/logistics/infrastructure/logistics-field-visits-db-adapter.ts` | **NUEVO.** Adapter DB mínimo (7 ops + 8 tipos). |
| `server/routes/logistics-field-visits.fastify.ts` | **MODIFICADO.** Delegación de los 6 handlers; tipos y carga default vía adapter; cero referencias a `db-logistics`. |
| `test/unit/application/logistics/list-field-visits.test.ts` | **NUEVO.** 5 tests (identidad, array vacío, llamadas independientes, error, frontera de imports). |
| `test/unit/application/logistics/create-field-visit.test.ts` | **NUEVO.** 5 tests (identidad, null, undefined, error, frontera). |
| `test/unit/application/logistics/visit-location-use-cases.test.ts` | **NUEVO.** 6 tests (get/upsert: identidad, null/undefined, errores independientes, frontera). |
| `test/unit/application/logistics/time-window-use-cases.test.ts` | **NUEVO.** 6 tests (list/create: identidad, array vacío, null/undefined, errores, frontera). |
| `test/integration/adapters/controllers/logistics-field-visits-api.test.ts` | **MODIFICADO.** Anclas realineadas (`dbLogistics.*` → `fieldVisitsDb.*`, `deps.*` directos → delegación UC) + 2 contratos M15 nuevos (composición única + adapter como única carga default + bloqueo textual de `db-logistics`). Sin debilitar reglas. |
| `test/architecture/logistics-infrastructure-boundary-guard.test.ts` | **MODIFICADO.** 2 contratos M15: adapter de field visits (sólo canónico, sin queries/tx, superficie exacta de 7 ops) y ruta sin canónicos ni referencia textual a `db-logistics`. Reglas M12–M14 intactas. |
| `server/features/logistics/README.md` | **MODIFICADO.** Estado M14 mergeado (#1512) + M15. |
| `server/features/logistics/application/README.md` | **MODIFICADO.** Sección M15 + futuro (M16–M17). |
| `server/features/logistics/infrastructure/README.md` | **MODIFICADO.** Adapter M15; shim consumido sólo por route-events/SLA. |
| `docs/audit/backend-enterprise-modularization-program-audit.md` | **MODIFICADO.** Status M14 mergeado + Status M15. |
| `docs/implementation/m15-logistics-field-visits-thin-route.md` | **NUEVO.** Este documento. |

**Denylist respetada (cero cambios):** canónico M12
(`infrastructure/db-logistics.ts`, byte-idéntico, 7 transacciones), shim
`server/db-logistics.ts` (intacto; route-events y SLA lo consumen hasta M16),
`update-field-visit.ts` + puerto M09, cache M13/M14 y sus adapters,
`server/routes/logistics-{route-plans,route-events,sla}.fastify.ts`,
`server/fastify-app.ts`, `server/db.ts`, `server/lib/**` (auth-security,
cors-headers, env, permissions, session-last-access), `domain/**`, `drizzle/**`,
migraciones, `package.json`/lockfiles/CI/`.github/**`, `frontend/**`, M16+.

## 5. Invariantes preservadas (antes = después)

- Métodos+paths de los 7 endpoints + 4 `OPTIONS`; prefijo
  `/api/logistics/field-visits`; sin endpoints nuevos ni eliminados.
- Status codes 200/201/400/401/403/404/500 y mensajes exactos; envelope y
  serializers idénticos (location **sin** `createdAt`); paginación default 50 /
  max 100; orden de resultados y semántica `null`/`undefined`.
- Secuencia observable: trusted-origin → auth/sesión → RBAC → parse
  path/query/body → operación → mapeo 404/500/2xx → serialización.
- `app_session_id` (cookie `ENV.cookieName`); sin `admin_session_id`;
  expiración con delete de sesión + clear-cookie; refresh de last-access;
  `getClinicPermissions(auth.role).canManageLogisticsFieldVisits` en métodos
  unsafe; CORS por-ruta sin wildcard; preflight intacto; `clinicId`
  exclusivamente desde la sesión autenticada (nunca del body).
- Persistencia: 7 operaciones canónicas con signatures, queries, transacciones
  (upsert de location y create de time window incluidas), normalizaciones,
  scoping y ordenamientos intactos — el adapter sólo referencia funciones
  existentes; `git diff` vacío sobre canónico y shim.
- Laziness: deps totalmente inyectadas siguen sin cargar `server/db.ts`.
- Sin cache, auditoría, máquina de estados ni side-effects nuevos.

## 6. Riesgo residual y rollback

- **Riesgo de comportamiento: bajo.** Delegación 1:1 fijada por 22 tests
  unitarios nuevos, el contrato de fuente realineado, el runtime de integración
  M09 (sin cambios) y los contratos de seguridad (auth global, CSRF, RBAC,
  production-invariants) verdes sin cambiar expectativas.
- **Shim `server/db-logistics.ts`: intacto y sin consumo desde field-visits.**
  Permanece sólo por route-events y SLA (M16); retiro global en M17.
- LOC de la ruta sube levemente (1.427 → 1.453) por la zona de composición de
  los 4 UCs; la lógica de persistencia directa en handlers queda en 0.

Rollback independiente y sin efectos de datos: revertir la ruta al import
directo del shim y a las 6 llamadas `deps.*`, borrar los 9 archivos nuevos de
application/infrastructure y sus 4 tests, revertir barrel, las anclas del
contrato API y del guard, y los 5 archivos documentales. No requiere revertir
M09–M14.

## 7. Validaciones

| Gate | Estado |
| --- | --- |
| Cohorte 1 — 4 suites unitarias M15 | **PASSED** (22/22, exit code 0) |
| Cohorte 2 — unitarios M09+M15 + completeness M11 + contrato API + runtime integración M09 + guards domain/application/infrastructure + auth global + CSRF + RBAC | **PASSED** (126/126, exit code 0) |
| `pnpm validate:local` (`typecheck && typecheck:test && test && build`) | **PASSED** (3.327 tests: 3.326 pass, 1 skipped, 0 fail; build OK, exit code 0) |
| `pnpm security:public-surface` | **PASSED** (sin exposición pública, exit code 0) |
| `pnpm validate:local:schema` / `db:migrate` | **NOT_RUN** (sin schema/migraciones) |
| E2E (Playwright) | **NOT_RUN** (sin frontend) |
| Audits de dependencias | **NOT_RUN** (manifests/lockfile fuera de scope) |
| Escrituras Git/GitHub | **BLOCKED** para el agente — **[MANUAL-NICO]** |

## 8. Siguiente milestone

**M16 — thin `logistics-route-events` + `logistics-sla`.** No adelantado aquí.
Fase C **no cerrada**; M15 **no se declara cerrado hasta el merge**.

## 9. Operaciones [MANUAL-NICO]

El agente **no** ejecutó ninguna escritura Git/GitHub. Pendientes de Nico:
`git add`, `git commit`, `git push`, creación de PR, `gh pr checks --watch` (en
la rama del PR activo, sin número), merge.
