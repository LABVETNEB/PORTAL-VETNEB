# M30 — Study Tracking: apertura de Fase G y move de dominio

**Estado:** implementado localmente, pendiente de revisión y merge.

- **Rama:** `refactor/backend-modularization-m30-study-tracking-domain-moves`
- **Base exacta:** `d0ddc11ed94cec827053986e713f1a5fd9ca034a`
  (`test(clinics): certify cross-tenant phase closeout (#1563)`)
- **Programa:** Fase G, milestone M30
- **Riesgo:** R2 estructural backend, autorizado específicamente para este
  milestone. No hubo escrituras Git/GitHub.

## 1. Objetivo y exclusiones

M30 abre la Fase G moviendo, sin reescribir, los dos módulos de dominio de Study
Tracking desde `server/lib` a
`server/features/study-tracking/domain`. El barrel canónico pasa a ser la única
entrada para consumidores runtime y tests de comportamiento.

Quedan fuera M31, M32, M32b, M33, M34 y M35. No se crearon `application/`,
`infrastructure/`, puertos, adapters, repositorios, casos de uso, servicios,
clases, factories ni reglas nuevas. Tampoco se modificaron persistencia, schema,
migraciones, endpoints, handlers, Options Fastify, email, auditoría, auth,
sesiones, cookies, permisos, CORS, frontend, dependencias o CI.

## 2. Baseline R0

El baseline se capturó con working tree limpio, en la rama y base obligatorias.
Sólo aplica el `AGENTS.md` raíz.

| Módulo legacy inicial | SHA-256 inicial | LOC inicial |
| --- | --- | ---: |
| `server/lib/study-tracking.ts` | `f88c2dcdaf343d64a9da78ed5d1e42371f8a1e70da8a437073cd93c13ac785ce` | 648 |
| `server/lib/token-study-tracking.ts` | `f311a5d5295c66538894f32b5be3697ac93e91ef377959bdb7ac1a3ee1e7868f` | 155 |

### 2.1 Consumidores y contratos censados

| Grupo | Paths iniciales | Resultado M30 |
| --- | --- | --- |
| Runtime de `study-tracking.ts` | `study-tracking.fastify.ts`, `admin-study-tracking.fastify.ts`, `particular-study-tracking.fastify.ts` | Los tres importan `features/study-tracking/domain/index.ts`. |
| Runtime de `token-study-tracking.ts` | `admin-reports.fastify.ts`, `admin-particular-tokens.fastify.ts`, `particular-tokens.fastify.ts` | Los tres importan el mismo barrel. |
| Tests de comportamiento | Tres unit tests de dominio, `token-study-tracking.test.ts`, `study-tracking.fastify.test.ts` | Reapuntados al barrel canónico. |
| Contratos de source path | `study-tracking-suite-completeness.test.ts`, `security-validation-cutoff-boundaries.test.ts` | Reanclados al módulo canónico. |
| Tests Fastify sin import legacy | `particular-study-tracking.fastify.test.ts`, `admin-study-tracking.fastify.test.ts` | Sin cambios; incluidos en la cohorte dirigida. |
| Documentos históricos | `docs/pr-history`, auditorías y notas previas | Sin cambios por exclusión explícita de scope. |

## 3. Arquitectura antes y después

Antes:

```text
server/lib/study-tracking.ts
server/lib/token-study-tracking.ts
server/routes/* -> server/lib/*
```

Después:

```text
server/features/study-tracking/
  README.md
  domain/
    README.md
    index.ts
    study-tracking.ts
    token-study-tracking.ts

server/routes/* -> features/study-tracking/domain/index.ts
server/lib/study-tracking.ts       -> re-export del barrel
server/lib/token-study-tracking.ts -> re-export del barrel
```

El move conserva las 648/155 LOC de implementación. Los únicos cambios dentro
de los módulos canónicos son los specifiers de `drizzle/schema.ts` requeridos
por la nueva profundidad. `token-study-tracking.ts` sigue importando
`./study-tracking.ts` dentro de la misma capa.

| Archivo final | SHA-256 final | LOC final |
| --- | --- | ---: |
| `domain/study-tracking.ts` | `979787d75f25fe4074ddbc34b1c475d5dc6828658b0ddf11f405eef072e35141` | 648 |
| `domain/token-study-tracking.ts` | `bb2b3c213ccc4569b2f3dac49da249fbda77c50b29fe4a61f4e906255417da2e` | 155 |
| `server/lib/study-tracking.ts` (shim) | `cb7e13af0dc4142829dbf034ec2bdb71f7b692a5e1f834aa2266302b2333ad25` | 1 |
| `server/lib/token-study-tracking.ts` (shim) | `cb7e13af0dc4142829dbf034ec2bdb71f7b692a5e1f834aa2266302b2333ad25` | 1 |

Como control de equivalencia, al normalizar únicamente
`../../../../drizzle/schema.ts` al specifier legacy
`../../drizzle/schema.ts`, los SHA-256 canónicos vuelven exactamente a
`f88c...785ce` y `f311...7868f`. No hay otra diferencia de implementación.

## 4. Exports y contratos preservados

El barrel reexporta ambos módulos completos. Se preservan 24 value exports y el
tipo público `StudyTrackingStage` de `study-tracking.ts`, más
`ensureStudyTrackingCaseForToken`:

- Catálogo y schemas: `STUDY_TRACKING_STAGES`, `StudyTrackingStage`,
  `adminCreateStudyTrackingSchema`, `clinicCreateStudyTrackingSchema`,
  `updateStudyTrackingSchema`.
- Parsing y validación: `parsePositiveInt`, `parseOffset`, `parseEntityId`,
  `parseBooleanQuery`, `buildValidationError`.
- Fechas: `argentinaHolidaysByYear`, `getArgentinaNonWorkingDates`,
  `getArgentinaNationalHolidayKeys`, `isSunday`, `isSaturday`,
  `isArgentinaNationalHoliday`, `getWorkingDayWeight`,
  `getBusinessDayWeight`, `addBusinessDaysFromLabReceivedDate`,
  `calculateEstimatedDeliveryAt`, `applyEstimatedDeliveryRules`.
- Seguimiento: `applyStageTimestampDefaults`,
  `shouldCreateSpecialStainNotification`, `serializeStudyTrackingCase`,
  `serializeStudyTrackingNotification`, `ensureStudyTrackingCaseForToken`.

Los tests dirigidos preservan schemas Zod, mensajes, normalización, catálogo y
orden de etapas, feriados y fechas hábiles, timestamps, serialización, regla de
tinción especial, fechas/defaults, semántica `null`/`undefined` y el orden de
consultas/escrituras inyectadas de `ensureStudyTrackingCaseForToken`.

## 5. Shims y guard de frontera

Cada path legacy contiene exactamente:

```ts
export * from "../features/study-tracking/domain/index.ts";
```

No tienen imports adicionales, lógica, tipos duplicados, wrappers ni aliases.
Se conservan sólo como compatibilidad temporal y expiran en M35, después del
censo final de Fase G.

`study-tracking-domain-boundary-guard.test.ts` verifica dinámicamente contexto,
domain, barrel, módulos, reexports, consumidores runtime, shims de una línea,
cero consumidores runtime de legacy, cero imports externos a archivos internos,
allowlist de dependencias, denylist, persistencia inyectada y ausencia de capas
anticipadas.

## 6. Allowlist real

Los 22 paths modificados o creados son:

```text
docs/implementation/m30-study-tracking-domain-moves.md
server/features/study-tracking/README.md
server/features/study-tracking/domain/README.md
server/features/study-tracking/domain/index.ts
server/features/study-tracking/domain/study-tracking.ts
server/features/study-tracking/domain/token-study-tracking.ts
server/lib/study-tracking.ts
server/lib/token-study-tracking.ts
server/routes/study-tracking.fastify.ts
server/routes/admin-study-tracking.fastify.ts
server/routes/particular-study-tracking.fastify.ts
server/routes/admin-reports.fastify.ts
server/routes/admin-particular-tokens.fastify.ts
server/routes/particular-tokens.fastify.ts
test/architecture/study-tracking-domain-boundary-guard.test.ts
test/architecture/security/security-validation-cutoff-boundaries.test.ts
test/unit/domain/study-tracking/study-tracking.test.ts
test/unit/domain/study-tracking/study-tracking-edge.test.ts
test/unit/domain/study-tracking/study-tracking-clinic-schema.test.ts
test/unit/contracts/study-tracking/token-study-tracking.test.ts
test/unit/contracts/study-tracking/study-tracking-suite-completeness.test.ts
test/integration/adapters/controllers/study-tracking.fastify.test.ts
```

## 7. Denylist aplicada

El dominio permite `zod`, archivos internos de `domain` y
`drizzle/schema.ts` sólo como `import type`. El guard rechaza Fastify, routes,
`db-study-tracking`, env, auth, sesiones, cookies, CORS, audit, email, Supabase,
filesystem, HTTP/HTTPS/red, child processes, `process.*`, `fetch`, servidores,
listeners y timers con efectos laterales. El diff de las seis rutas contiene
únicamente el cambio de specifier; `server/db-study-tracking.ts` y
`server/lib/email.ts` tienen diff vacío.

## 8. Validaciones observadas

| Gate | Estado | Evidencia |
| --- | --- | --- |
| Guard M30 aislado | **PASSED** | 10/10, exit code 0 |
| Cohorte dirigida exacta | **PASSED** | 92/92, exit code 0 |
| `pnpm typecheck` | **PASSED** | exit code 0 |
| `pnpm typecheck:test` | **PASSED** | exit code 0 |
| `pnpm validate:local` | **PASSED** | 3.596 tests: 3.595 pass, 1 skip, 0 fail; build completado; exit code 0 |
| `pnpm security:public-surface` | **PASSED** | sin findings públicos; dos markers server-only esperados; exit code 0 |
| `git diff --check` | **PASSED** | exit code 0 |

No se seleccionaron auditorías de dependencias, migraciones ni E2E porque M30 no
modifica manifiestos, lockfile, schema, DB, frontend ni contratos visuales.

## 9. Riesgos y rollback

El riesgo residual se limita a resolución de imports/barrel; queda cubierto por
el guard, typechecks, tests de comportamiento, integración Fastify, suite
completa y build. El rollback consiste en devolver los dos módulos completos a
`server/lib`, restaurar los specifiers previos y retirar contexto/guard/README
M30; no requiere migración de datos ni rollback de schema.

Fase G queda abierta por M30, pero no cerrada. El siguiente milestone es M31 y
no fue iniciado. Este documento no afirma merge, PR ni checks remotos
inexistentes.
