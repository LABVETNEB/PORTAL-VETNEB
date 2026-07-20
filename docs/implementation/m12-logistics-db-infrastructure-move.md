# M12 — Logistics: move de `db-logistics.ts` a `infrastructure/`

**Estado:** implementado / **pendiente de merge**. Working tree listo para revisión
manual de Nico; ninguna escritura Git/GitHub ejecutada por el agente.

- **Rama:** `refactor/backend-modularization-m12-logistics-db-infrastructure`
- **Base exacta:** `101731dbf105f0938e3e321440675181abdc6c50`
  (`docs(architecture): close M11 and Phase B (#1508)`)
- **Programa:** Fase C (Logistics infra + rutas), milestone **M12**
- **Autorización:** refactor **R2 estructural backend**, autorizado específicamente
  por Nico en la tarea actual (AGENTS.md §3). Sin autorización se habría bloqueado.

## 1. Objetivo y alcance

Mover la implementación completa de la persistencia de Logistics a la capa
`infrastructure` del contexto, preservando exactamente la superficie pública y el
comportamiento observable, dejando el path legacy como shim documentado y añadiendo
un guard ejecutable de frontera.

**Incluido:** move del archivo, shim, reapunte del adaptador de SLA, tests, guard,
documentación.
**Excluido:** M13, M14, M15, M16, M17; rutas; schema; migraciones; dependencias.

## 2. Auditoría R0 (medida en HEAD, no en cifras documentales)

Los documentos previos estaban desactualizados: el README del contexto citaba
~1.322 LOC y el inventario M01 registraba 1.295 LOC. **Prevalece la medición real de
HEAD.**

| Métrica | Valor medido en `101731d` |
| --- | --- |
| LOC de `server/db-logistics.ts` (`wc -l`) | **1.291** |
| SHA-256 del archivo (checksum no secreto) | `3c49f4522399d44ae01b3e4ab30470a9765ce83ce4d38506f08eb4d72493a4da` |
| `git hash-object` | `569e6354a96be4665480a780574fcda268b53c8f` |
| Call-sites `db.transaction(` | **7** |
| Imports externos | `drizzle-orm`, `./db.ts`, `../drizzle/schema.ts`, `./features/logistics/domain/index.ts` |
| Funciones exportadas | **27** (`export async function`) |
| Value exports adicionales | `ROUTE_PLAN_LIFECYCLE_ACTIONS`, `ROUTE_PLAN_LIFECYCLE_TRANSITIONS` + re-export de `LOGISTICS_DEFAULT_LIMIT`, `LOGISTICS_MAX_LIMIT`, `normalizeLogisticsLimit`, `normalizeLogisticsOffset` |
| Type exports | **36** (incluye los 14 `$inferSelect`/`$inferInsert` de schema y las uniones discriminadas de lifecycle/heurística) |

### 2.1 Inventario de exports (antes = después)

Value exports (funciones): `createFieldVisit`, `getFieldVisitById`,
`getClinicScopedFieldVisit`, `listClinicFieldVisits`, `updateClinicScopedFieldVisit`,
`upsertVisitLocationForClinicVisit`, `getVisitLocationForClinicVisit`,
`createTimeWindowForClinicVisit`, `listTimeWindowsForClinicVisit`, `createRoutePlan`,
`getClinicScopedRoutePlan`, `listClinicRoutePlans`, `updateClinicScopedRoutePlan`,
`createRouteStopForClinicRoutePlan`, `listRouteStopsForClinicRoutePlan`,
`updateClinicScopedRouteStop`, `transitionClinicScopedRoutePlanStatus`,
`generateHeuristicRoutePlan`, `createRouteEvent`, `listClinicRouteEvents`,
`listRouteEventsForClinicRoutePlan`, `listIncrementalClinicRouteEvents`,
`listActiveClinicSlaPolicies`, `getClinicSlaSummary`,
`markOverdueActiveClinicSlaInstancesBreached`,
`listOverdueActiveClinicSlaInstances`, `listClinicSlaInstances`.

Constantes: `ROUTE_PLAN_LIFECYCLE_ACTIONS`, `ROUTE_PLAN_LIFECYCLE_TRANSITIONS`, más
los cuatro símbolos de paginación re-exportados del dominio.

Tipos: entidades (`FieldVisit`/`NewFieldVisit`, `VisitLocation`/`NewVisitLocation`,
`TimeWindow`/`NewTimeWindow`, `RoutePlan`/`NewRoutePlan`, `RouteStop`/`NewRouteStop`,
`RouteEvent`/`NewRouteEvent`, `SlaPolicy`, `SlaInstance`), inputs/params de cada
operación, `ClinicSlaSummary`, `RoutePlanLifecycleAction`,
`RoutePlanLifecycleTransition`, `RoutePlanLifecycleTransitionResult`,
`GenerateHeuristicRoutePlanInput`, `GenerateHeuristicRoutePlanResult`.

**Cero exports añadidas, renombradas o eliminadas.** El shim re-exporta la superficie
completa, así que todo consumidor sigue viendo lo mismo.

### 2.2 Consumidores (antes → después)

| Consumidor | Tipo de import | Antes | Después |
| --- | --- | --- | --- |
| `server/routes/logistics-field-visits.fastify.ts` | estático + dinámico | `../db-logistics.ts` | **sin cambios** (resuelve por el shim) |
| `server/routes/logistics-route-plans.fastify.ts` | estático + dinámico | `../db-logistics.ts` | **sin cambios** |
| `server/routes/logistics-route-events.fastify.ts` | estático + dinámico | `../db-logistics.ts` | **sin cambios** |
| `server/routes/logistics-sla.fastify.ts` | estático + dinámico | `../db-logistics.ts` | **sin cambios** |
| `server/features/logistics/infrastructure/sla-breach-db.ts` | tipo estático + import lazy | `../../../db-logistics.ts` | **`./db-logistics.ts`** (canónico de la misma capa) |
| `test/integration/.../logistics-*-integration.fastify.test.ts`, `logistics-audit-runtime`, `logistics-route-plans-{heuristic,metrics}-runtime` | estático | `../../../../server/db-logistics.ts` | **sin cambios** (shim) |
| `test/unit/infrastructure/logistics/logistics-db.test.ts` | lectura de fuente | root | **canónico** (+ contratos de shim) |
| `test/unit/infrastructure/logistics/logistics-sla-breach-runtime.test.ts` | ancla regex | `../../../db-logistics.ts` | **`./db-logistics.ts`** |
| `test/unit/infrastructure/global-performance-resilience-contract.test.ts` | lectura de fuente | root (`server/db-logistics.ts`) | **canónico** (`…/infrastructure/db-logistics.ts`) — source anchor reanclado |

Los tests de `application` y los `*-api.test.ts` que prohíben `db-logistics` **por
nombre de módulo** siguen siendo correctos: el nombre no cambia, sólo el path.

## 3. Estrategia de move

1. Copia **byte-idéntica** del archivo a
   `server/features/logistics/infrastructure/db-logistics.ts` (SHA-256 verificado
   igual al original antes de tocar nada).
2. Ajuste de **exactamente tres specifiers**, exigidos por la nueva profundidad:
   - `./db.ts` → `../../../db.ts` (mismo `server/db.ts`)
   - `../drizzle/schema.ts` → `../../../../drizzle/schema.ts` (mismo `drizzle/schema.ts`)
   - `./features/logistics/domain/index.ts` → `../domain/index.ts` (mismo barrel)
3. Cabecera de contexto (8 líneas de comentario + 1 en blanco) al inicio del archivo.
   Total: 1.300 LOC.

**No se hizo:** reorganizar funciones, dividir el archivo, extraer mappings,
repositorios secundarios, clases, factories o UoW, renombrar exports, formatear en
masa ni corregir deuda funcional preexistente. Las queries Drizzle, el scoping por
`clinicId`, validaciones, ordenamientos, defaults, retornos `undefined`/arrays
vacíos/uniones discriminadas, la condición optimista del lifecycle, la generación
heurística y los helpers de SLA quedan **carácter por carácter iguales**.

## 4. Shim de compatibilidad

`server/db-logistics.ts` pasa de 1.291 LOC de implementación a **16 líneas**: un
comentario de compatibilidad y **un único** re-export.

- `export * from "./features/logistics/infrastructure/db-logistics.ts";`
- **Cero** exports nombrados duplicados, cero imports, cero Drizzle, cero
  `drizzle/schema.ts`, cero `server/db.ts`, cero funciones, cero queries, cero
  transacciones, cero lógica, **sin default export**.

Se conserva porque las cuatro rutas legacy `server/routes/logistics-*.fastify.ts`
siguen importándolo hasta **M14–M16**. No se tocó ninguna ruta.

## 5. Guard de frontera

`test/architecture/logistics-infrastructure-boundary-guard.test.ts` — `node:test` +
`node:assert/strict` + `node:fs`/`path`/`url`, lectura de fuente, **sin dependencias
nuevas, sin spawn, sin invocar PNPM, sin lista cerrada de archivos**. Auto-descubre
recursivamente `server/features/logistics/infrastructure/**/*.ts`. Verifica:

1. la carpeta existe, contiene código y el canónico tiene implementación real
   (el guard **no pasa en vacío**);
2. sólo dependencias justificadas por M12: misma capa, `../domain/index.ts`,
   `server/db.ts`, `drizzle/schema.ts`, `drizzle-orm`;
3. prohibidos Fastify, `server/routes`, la capa `routes` del contexto, `application`,
   `frontend`, auth/session/CORS/audit/email y `server/lib`;
4. imports de dominio **sólo** por el barrel (no archivos internos);
5. ningún archivo de infrastructure importa el shim raíz;
6. `sla-breach-db.ts` consume el canónico de su capa y conserva el import lazy;
7. el shim raíz existe y sólo re-exporta el canónico, sin declarar funciones;
8. el canónico conserva **exactamente 7** `db.transaction(` (baseline R0);
9. el parser reconoce las cuatro formas de specifier y la regla rechaza specifiers
   prohibidos reales.

Los mensajes de fallo identifican **archivo, specifier y regla violada**.

`drizzle-orm`, `server/db.ts` y `drizzle/schema.ts` **no** se prohíben: son
dependencias legítimas de infrastructure según ARCH-2.

## 6. Archivos

**Allowlist: 12 paths.** La revisión manual amplió la allowlist original de 11 a 12,
autorizando `test/unit/infrastructure/global-performance-resilience-contract.test.ts`
**únicamente** para alinear el source anchor del move (ver §6.1). No autoriza ningún
otro path.

| Archivo | Cambio |
| --- | --- |
| `server/features/logistics/infrastructure/db-logistics.ts` | **NUEVO.** Implementación canónica (1.300 LOC = 1.291 originales + 9 de cabecera de contexto); 3 specifiers ajustados. |
| `server/db-logistics.ts` | **REEMPLAZADO** por shim mínimo de 16 líneas (un único `export *`). |
| `server/features/logistics/infrastructure/sla-breach-db.ts` | **MODIFICADO.** Tipo `SlaInstance` e import lazy apuntan a `./db-logistics.ts`; comentario actualizado. |
| `test/unit/infrastructure/logistics/logistics-db.test.ts` | **MODIFICADO.** Fuente canónica + 6 contratos M12 nuevos; asserts previos intactos. |
| `test/unit/infrastructure/logistics/logistics-sla-breach-runtime.test.ts` | **MODIFICADO.** Sólo el ancla del import lazy. |
| `test/unit/infrastructure/global-performance-resilience-contract.test.ts` | **MODIFICADO.** Source anchor de la superficie de Logistics reanclado del shim al archivo canónico. Markers, asserts, nombres de tests y expectativas **intactos**. |
| `test/architecture/logistics-infrastructure-boundary-guard.test.ts` | **NUEVO.** Guard de frontera. |
| `server/features/logistics/infrastructure/README.md` | **MODIFICADO.** Estado M12, canónico, shim, tx, LOC real, M13 pendiente. |
| `server/features/logistics/README.md` | **MODIFICADO.** Fases A/B cerradas, C iniciada por M12. |
| `server/features/logistics/application/README.md` | **MODIFICADO.** Sólo la sección de futuro (M13 pasa a ser el siguiente). |
| `docs/audit/backend-enterprise-modularization-program-audit.md` | **MODIFICADO.** Status M12 en Fase C. |
| `docs/implementation/m12-logistics-db-infrastructure-move.md` | **NUEVO.** Este documento. |

### 6.1 Corrección de source anchor (revisión manual)

La primera iteración de M12 dejó el contrato global de performance leyendo
`server/db-logistics.ts` y mantuvo los markers vivos mediante un re-export nombrado
en el shim. Eso pasaba, pero **medía el shim en vez de la implementación real**. La
revisión manual corrigió la causa raíz en vez del síntoma:

1. **Contrato reanclado** — `HEAVY_SURFACES` apunta ahora a
   `server/features/logistics/infrastructure/db-logistics.ts`. Se cambió
   **únicamente el path** (más un comentario que identifica la ubicación canónica):
   markers, asserts, nombres de tests y expectativas quedan **idénticos**. El
   contrato vuelve a validar los call-sites reales
   (`normalizeLogisticsLimit` / `normalizeLogisticsOffset`) donde de verdad se
   ejecutan.
2. **Shim simplificado** — se eliminó el re-export nombrado que existía sólo para
   satisfacer el ancla legacy. El shim queda en su forma mínima: comentario + un
   único `export *`. La superficie pública no cambia (el `export *` ya cubría esos
   cuatro símbolos).

Resultado: **cero source anchors de M12 apuntan al shim**, y el shim no carga deuda
de test. Esto deja de ser un follow-up pendiente.

**Denylist respetada (cero cambios):** `server/routes/**`, `server/fastify-app.ts`,
`server/db.ts`, `server/lib/logistics-route-plans-cache.ts`,
`server/features/logistics/domain/**`, `server/features/logistics/application/**/*.ts`,
`application/ports/**`, `server/features/logistics/routes/**`, `drizzle/**`,
`migrations/**`, `frontend/**`, `package.json`, `frontend/package.json`,
`pnpm-lock.yaml`, `pnpm-workspace.yaml`, `scripts/**`, `.github/**`, CI/workflows,
auth/cookies/sesiones/RBAC/CORS/CSP/rate limits, M13+, dependencias. **Ningún
endpoint, contrato HTTP ni registro de ruta modificado.**

## 7. Riesgo residual

- **Shim vivo hasta M14–M16.** Mientras exista, hay dos paths válidos para la misma
  superficie. El guard impide que la propia capa infrastructure use el shim, pero no
  fuerza a las rutas legacy a migrar (eso es M14–M16 por diseño).
- **Riesgo de comportamiento: bajo.** El diff del código productivo es un move
  byte-idéntico más tres specifiers; las 7 transacciones están fijadas por dos
  contratos ejecutables independientes.

## 8. Rollback

Independiente y sin efectos de datos:

1. restaurar la implementación completa en `server/db-logistics.ts` (revertir el
   shim);
2. retirar `server/features/logistics/infrastructure/db-logistics.ts` y
   `test/architecture/logistics-infrastructure-boundary-guard.test.ts`;
3. restaurar las anclas de `logistics-db.test.ts`,
   `logistics-sla-breach-runtime.test.ts`,
   `global-performance-resilience-contract.test.ts` (volver a
   `server/db-logistics.ts`) y los imports de `sla-breach-db.ts`;
4. revertir los cinco archivos documentales:
   - `server/features/logistics/infrastructure/README.md`
   - `server/features/logistics/README.md`
   - `server/features/logistics/application/README.md`
   - `docs/audit/backend-enterprise-modularization-program-audit.md`
   - `docs/implementation/m12-logistics-db-infrastructure-move.md`

**Sin rollback de schema, DB ni datos. Sin cambios funcionales que deshacer.** No
depende de revertir M11 ni ningún milestone previo.

## 9. Validaciones

| Gate | Estado |
| --- | --- |
| Dirigido — `global-performance-resilience-contract` (source anchor reanclado) | **PASSED** |
| FASE 1 — contrato global + `logistics-db` + `logistics-sla-breach-runtime` + guard de infraestructura | **PASSED** |
| FASE 2 — guards de frontera domain + application | **PASSED** (18 tests) |
| FASE 3 — contratos de rutas SLA / route-plans / field-visits / route-events | **PASSED** (72 tests) |
| FASE 4 — `pnpm validate:local` (`typecheck && typecheck:test && test && build`) | **PASSED** |
| `pnpm security:public-surface` | **NOT_RUN** (sin superficie pública/frontend) |
| `pnpm validate:local:schema` | **NOT_RUN** (sin schema/migraciones) |
| E2E (Playwright) | **NOT_RUN** (sin frontend) |
| Escrituras Git/GitHub | **BLOCKED** para el agente — **[MANUAL-NICO]** |

## 10. Siguiente milestone

**M13 — cache adapter** para `server/lib/logistics-route-plans-cache.ts`. **No
adelantado aquí.** Fase C **no cerrada**; M12 **no se declara cerrado hasta el
merge**.

## 11. Operaciones [MANUAL-NICO]

El agente **no** ejecutó ninguna escritura Git/GitHub. Pendientes de Nico: `git add`,
`git commit`, `git push`, creación de PR, `gh pr checks --watch` (en la rama del PR
activo, sin número), merge.
