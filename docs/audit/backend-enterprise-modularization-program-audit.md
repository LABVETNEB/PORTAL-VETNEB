# Backend Enterprise Modularization Program — Audit

> **Tipo:** Auditoría técnica **docs-only**. No implementa, no mueve archivos, no toca código,
> tests, `package.json`, lockfiles, CI ni schema. Único archivo nuevo bajo `docs/audit/`.
> **Base:** `main` limpio · **HEAD:** `2b82fa0` fix(e2e): reject empty visual comparisons (#1492).
> **Fecha:** 2026-07-18.
> **Programa auditado:** propuesta externa de reorganización de `server/` en 11 bloques / 110 PR.
> **Documentos rectores previos:** [ARCH-1](./repository-domain-architecture-audit.md) ·
> [ARCH-2 (ADR)](../architecture/backend-boundary-adr.md) ·
> [ARCH-3 (inventario lib)](../architecture/shared-lib-boundary-inventory.md).
> **Modelo / esfuerzo:** Claude Fable 5 · high.
> **ID:** ARCH-AUDIT-110.

Etiquetas de trazabilidad usadas en todo el documento:
`CONFIRMED` (verificado contra HEAD en esta auditoría) · `INFERRED` (derivado de evidencia
verificada) · `UNVERIFIED` (no comprobado; se indica qué falta) · `NOT_FOUND` (buscado y ausente)
· `CONTRADICTED` (la evidencia contradice la premisa del programa).

---

## 1. Executive Summary

**Estado actual.** El backend es un monolito modular emergente de **~40.4k LOC en 108 archivos
`.ts`** bajo `server/` (rutas 25.5k · db 5.9k · lib 7.0k · middlewares 0.9k · features 0.1k ·
entrypoints 0.8k) [CONFIRMED, `wc -l` sobre `git ls-files`]. La organización es Package-by-Layer
con pertenencia a dominio expresada sólo por naming, **excepto Logistics**, cuya migración a
`server/features/logistics/` ya está iniciada y gobernada por un programa interno en vuelo
(ARCH-1..ARCH-8): ADR de fronteras, inventario archivo-por-archivo de `server/lib`, shell
documental, dos helpers de dominio extraídos, barrel público y guard de pureza ejecutable
[CONFIRMED: `server/features/logistics/domain/{index,pagination,route-plan-field-visits}.ts`,
`test/architecture/logistics-domain-boundary-guard.test.ts`].

**Dictamen general: `PARTIALLY_APPROVED`.** La dirección del programa (features con capas
domain/application/infrastructure/routes, puertos, rutas delgadas, guards) coincide con el ADR
vigente del repositorio. Pero el programa, tal como está formulado:

1. **Ignora el estado real de HEAD.** 3 PR ya están implementados (8, 9, 31) y varios otros
   presuponen trabajo inexistente (no hay DELETE de route plans; no hay reglas puras de route
   events; Pricing no tiene reglas de dominio) [CONFIRMED/CONTRADICTED, detalle en §6–§7].
2. **Es desproporcionado.** 110 PR para 40.4k LOC de backend es ~1 PR por 367 LOC. El ADR del
   propio repo prescribe materializar capas sólo cuando hay código real y rechaza la aplicación
   masiva de la estructura de 4 capas. Cantidad final recomendada: **48 PR** (mínima 40,
   probable 48, máxima controlada 60).
3. **Subestima el freno dominante: los guards anclados a paths.** **188 de 438 archivos de test
   referencian paths literales de `server/`** [CONFIRMED, grep]; 28 anclas sólo en
   `security-critical-route-surface-registry.test.ts`. Cada move exige alinear guards en el mismo
   PR (precedente P2-D del ADR), y ese costo — no la complejidad del código — dimensiona los PR.
4. **Duplica un seam que ya existe.** Cada módulo de rutas expone un tipo `Options` con
   dependencias inyectables (repos, hashers, clock) que ~55 tests de integración ya inyectan
   [CONFIRMED: `LogisticsSlaNativeRoutesOptions`, `server/routes/logistics-sla.fastify.ts:57-77`].
   Los "puertos" del Bloque 2 deben derivarse de ese contrato, no crear un sistema paralelo.
5. **El Bloque 10 (Auth) es inejecutable como está.** Tres realms de autenticación
   (clínica/admin/particular, ~3.5k LOC + middlewares + libs congeladas por el ADR) en 3 PR es
   riesgo CRÍTICO (20/25). Se excluye del programa de reorganización; sólo una secuencia de
   seguridad dedicada y autorizada podría abordarlo.
6. **El Bloque 4 (reordenar `server/lib`) se difiere.** Mover `env.ts` (fan-in 42),
   `cors-headers.ts` (fan-in 30) o `auth-security.ts` (fan-in 34) por taxonomía es movimiento
   cosmético con blast radius máximo — prohibido por la restricción 17 del propio programa. Las
   features drenan `lib/` de forma natural; lo residual se reordena al final, si queda algo.

**Cantidades.**

```text
Original proposed count      110
Validated count (sin cambio)   9
Removed PR                    12
Merged PR                     31
Split PR                       4   (27, 28, 80, 86)
Reordered PR                  10   (+ Bloque 4 completo diferido)
Already implemented            3   (8, 9, 31)
New mandatory PR               2   (huérfanos Express-era; refresh/protocolo de guards)
Contingency PR                 5
Final recommended count       48
```

**Principales riesgos:** rotura silenciosa de contratos HTTP al adelgazar god-handlers (2.241 LOC
en `logistics-route-plans`); pérdida de semántica transaccional al extraer repositorios (11
call-sites de `.transaction(` en 3 archivos); aislamiento multi-tenant que es **sólo de
aplicación** (sin RLS en la base — auditoría SW 2026-06-30), por lo que cada refactor de `db-*`
es un punto de riesgo de datos; y desalineación de los 188 tests ancla si un PR mueve archivos
sin actualizar guards en el mismo diff.

**Principales beneficios:** eliminación de los 9 god-handlers >1.000 LOC; frontera verificable
por contexto con guards ejecutables ya probados en Logistics; testabilidad de casos de uso fuera
de HTTP; reducción del cajón `server/lib` por drenaje natural.

**Recomendación: EJECUTAR el programa corregido de §8**, empezando por la Fase 0 + Fase A
(cierre del dominio Logistics), bajo el protocolo R2 de `AGENTS.md` (cada PR de backend requiere
autorización explícita de scope). No ejecutar los bloques 4 y 10 tal como fueron propuestos.

**Nivel de confianza:** ALTO en inventario, métricas, estado de Logistics y clasificación de
`lib` (verificación directa + ARCH-3 contrastado con HEAD); MEDIO en el interior de los
god-handlers no leídos línea a línea (`admin-study-tracking`, `clinic-public-profile`); los
puntos con evidencia incompleta están marcados `UNVERIFIED` con la verificación pendiente.

---

## 2. Repository Evidence

### 2.1 Toolchain y runtime [CONFIRMED]

| Ítem | Valor | Evidencia |
|---|---|---|
| Lenguaje | TypeScript 5.9 estricto, ESM, `allowImportingTsExtensions` (imports con `.ts`) | `tsconfig.json` |
| Runtime | Node 24 (CI) · `tsx` dev · `node --experimental-strip-types` para tests | `package.json`, `backend-ci.yml` |
| HTTP | Fastify ^5.10 — composición manual, sin plugins `@fastify/*` | `server/fastify-app.ts` |
| ORM | Drizzle ^0.45 + driver `postgres` ^3.4 | `package.json` |
| Paquetes | pnpm 11.13.0 (`packageManager` pin) | `package.json` |
| Build | esbuild bundle ESM → `dist/index.js` | script `build` |
| Lint backend | **NOT_FOUND** — sin eslint config raíz ni script `lint`; frontend sí (`frontend/eslint.config.mjs`) | `ls .eslintrc* eslint.config.*` |
| Coverage | **NOT_FOUND** — sin c8/nyc ni script de cobertura | `package.json` |
| Guards de arquitectura | Tests `node:test` en `test/architecture/**` (41 archivos) — patrón de la casa, sin dependencia externa | `test/architecture/` |

Comandos reales (ninguno inventado):
`pnpm install` · `pnpm typecheck` · `pnpm typecheck:test` · `pnpm test` · `pnpm build` ·
`pnpm validate:local` (encadena los 4 anteriores) · `pnpm validate:local:schema` ·
`pnpm audit --prod && pnpm audit` (CI) · `pnpm db:migrate` (CI, Postgres de servicio) ·
`pnpm security:public-surface` · `git diff --check`.
**Gaps:** lint backend, cobertura, y scripts filtrados por capa (`node --test` acepta globs pero
no existen `test:unit`/`test:integration`).

### 2.2 Inventario `server/` [CONFIRMED]

108 archivos `.ts`, 40.420 LOC:

| Categoría | Archivos | LOC | Nota |
|---|---:|---:|---|
| `routes/*.fastify.ts` | 34 | 25.513 | 121 registros de endpoint; 36 `app.register` con prefijo en `fastify-app.ts` |
| `db.ts` + `db-*.ts` | 14 | 5.949 | Ningún `db-*` importa a otro `db-*` (verificado en HEAD) |
| `lib/**` | 43 | 7.053 | Clasificación archivo-por-archivo en ARCH-3, contrastada |
| `middlewares/` | 8 | 943 | `error-handler.ts` **huérfano** (solo su propio test lo importa) |
| `features/logistics/**` | 3 | 104 | domain: `index` (barrel), `pagination`, `route-plan-field-visits` |
| entrypoints | 4 | 848 | `index`, `bootstrap`, `preflight`, `fastify-app` |
| `utils/` | 1 | 10 | `async-handler.ts` **huérfano** Express-era (tipos `Request/Response/NextFunction`) |

God-handlers (>1.000 LOC) [CONFIRMED, `wc -l`]:
`logistics-route-plans` 2.241 · `auth` 1.514 · `logistics-field-visits` 1.421 ·
`clinic-public-profile` 1.316 · `db-logistics` 1.295 · `admin-study-tracking` 1.205 ·
`admin-auth` 1.044 · `study-tracking` 1.034 · `logistics-route-events` 1.008.

Fan-in de `server/lib` (archivos de `server/` que importan cada módulo) [CONFIRMED, grep]:
`env` 42 · `auth-security` 34 · `cors-headers` 30 · `runtime-timing` 21 ·
`session-last-access` 17 · `fastify-admin-auth` 15 · `audit` 15 · `permissions` 14 ·
`supabase` 8 · `rate-limit-store` 8 · `list-pagination` 8 · `http-types` 8 · `email` 5.

Transacciones: **11 call-sites de `.transaction(` en exactamente 3 archivos**: `db.ts`,
`db-logistics.ts`, `db-admin-clinics.ts` [CONFIRMED]. Email desde rutas: 5 archivos
(`contact`, `particular-tokens`, `admin-particular-tokens`, `study-tracking`,
`admin-study-tracking`) [CONFIRMED].

### 2.3 Suite de tests [CONFIRMED]

438 archivos: `test/unit` 323 · `test/integration` 55 · `test/architecture` 41 (17 de ellos en
`architecture/security/`) · `test/security` 9 · `test/helpers` 8. La taxonomía ya es hexagonal
(`unit/domain`, `unit/infrastructure`, `unit/contracts/<contexto>`,
`integration/adapters/controllers`) — **los tests migraron a la arquitectura objetivo antes que
el código fuente** (programa TEST-ARCH).

**Freno dominante:** 188 archivos de test referencian paths literales de `server/`
(24 en `architecture/`, 16 en `architecture/security/`, 106 en `unit/`, 50 en `integration/`).
Ejemplos de anclas: `security-critical-route-surface-registry.test.ts` fija 28 paths
`server/routes/*.fastify.ts`; `report-study-types-catalog.test.ts` censa el catálogo por lista
hardcodeada; los contract-tests por ruta (audit, session-last-access, runtime-timing) leen la
fuente con `readFileSync`. Precedente interno: el batch de migración de controllers de test se
declaró "0 moves" precisamente por estas anclas (TEST-ARCH-12/15).

### 2.4 Registro Fastify y hooks globales [CONFIRMED]

`server/fastify-app.ts`: `genReqId` propio; hooks `onRequest` en orden fijo — request-id +
security headers → `requireTrustedOriginForFastify` → `requireMinimumClientVersionForFastify`;
hook `onSend` — no-store en superficies sensibles + inyección de `requestId` en payloads JSON de
error; `setNotFoundHandler` y `setErrorHandler` con envelope
`{success:false, error, details?, path}` y mapeo de códigos Postgres (`23505`, `23503`, `22P02`,
`42703` → 400). **`/api/reports` está registrado dos veces** (`reportsNativeRoutes` y luego
`reportsStatusNativeRoutes` con el mismo prefijo): el orden de registro es contrato.

### 2.5 Seam de inyección existente [CONFIRMED]

Cada módulo de rutas exporta `<X>NativeRoutesOptions` con funciones inyectables — p. ej.
`LogisticsSlaNativeRoutesOptions` (`logistics-sla.fastify.ts:57-77`) permite reemplazar
`getActiveSessionByToken`, `listActiveClinicSlaPolicies`, `hashSessionToken`, `now`, etc.
`createFastifyApp(options)` propaga estas opciones por módulo. Los 55 tests de integración
construyen la app inyectando stubs por esta vía. **Éste es el mecanismo de puertos de facto del
repositorio.**

### 2.6 CI y gobernanza [CONFIRMED]

`backend-ci.yml`: Postgres 16 de servicio, `pnpm audit` (prod y completo), `db:migrate`,
`typecheck`, `typecheck:test`, `test`, `build`; timeout 15 min; actions pinneadas por SHA.
`pr-governance.yml` y `qga-governance.yml` presentes. `.github/CODEOWNERS`: **mantenedor único
`@LABVETNEB`** con nota explícita de que el ownership independiente por dominio "remains a
future maturity step". `AGENTS.md`: todo cambio de backend/auth/CORS/rate-limits/deps/CI es
**R2** (bloqueado sin autorización explícita por tarea) — cada PR del programa necesita
autorización de scope individual.

### 2.7 Divergencias documentación ↔ código detectadas

- ARCH-3 (inventario) es pre-ARCH-5/7/8: no lista `features/logistics/domain/*` y dice
  `db-logistics` = 1.322 LOC (hoy 1.295). Prevalece HEAD; el refresh es el PR M01.
- ARCH-2 planeó ARCH-5 como "mover `sla-breach.ts`"; lo que aterrizó fue la extracción de
  `route-plan-field-visits` y `pagination` desde handlers. Los 4 módulos grandes de
  `lib/logistics` **siguen sin mover** [CONFIRMED].
- El README de ARCH-4 dice "no hay `index.ts`, no hay barrels" — superado por ARCH-8
  (`domain/index.ts` existe). README desactualizado.

---

## 3. Current Architecture

### 3.1 Mapa de contextos (por naming + imports reales)

```text
                                ┌────────────────────────────────────────────┐
                                │ fastify-app.ts (composition root)          │
                                │ hooks: req-id → sec-headers → trusted-     │
                                │ origin → version-gate · onSend no-store    │
                                └───────────────┬────────────────────────────┘
        ┌───────────────────────────────────────┼──────────────────────────────────────┐
        ▼                                       ▼                                      ▼
  SUPERFICIE ADMIN (15 módulos)          SUPERFICIE CLÍNICA               SUPERFICIE PÚBLICA/PARTICULAR
  admin-auth, admin-clinics,             auth (1.514), clinic-audit,      public-pricing, public-
  admin-pricing, admin-reports,          clinic-public-profile (1.316),   professionals, public-report-
  admin-report-workflow, admin-          logistics-* (4 rutas, ~5.5k),    access, contact, particular-
  study-tracking, admin-sessions,        reports, reports-status,         auth (938), particular-tokens,
  admin-users-roles, admin-audit,        study-tracking, report-          particular-study-tracking,
  admin-system-{health,maintenance,      access-tokens                    particular-audit
  schema-health}, admin-*-tokens
        │                                       │                                      │
        └────────────── db-* por contexto (14, sin imports cruzados) ──────────────────┘
                                        │
                        drizzle/schema.ts (1.196 LOC, shared kernel)
                                        │
                 lib transversal: env(42) auth-security(34) cors-headers(30)
                 runtime-timing(21) session-last-access(17) audit(15)
                 permissions(14) fastify-admin-auth(15) email(5) supabase(8)
```

Contextos funcionales reconocibles (14, coincide con ARCH-1): Logistics, Pricing, Public
Professionals, Clinics, Study Tracking, Particular Access, Report Access, Reports, Users/Roles,
Auth (3 realms), Audit (cross-cutting), Contact, Maintenance/Health (ops), App Version (ops).

### 3.2 Hallazgos estructurales

- **God-handlers**: 9 archivos >1.000 LOC (§2.2). La lógica de aplicación (validación,
  orquestación, side-effects) vive inline en los handlers; los handlers importan `db-*`
  directamente [CONFIRMED: imports de `logistics-route-plans.fastify.ts`].
- **`db-*` = repositorio de facto**: cada uno auto-contenido, mezcla queries + mapping +
  validación (P1-B de ARCH-1). Sólo `db-logistics` delega en dominio.
- **Dominio puro ya existente fuera de `features/`**: `lib/logistics/*` (~1.5k),
  `lib/study-tracking` (648), `lib/report-status` (64), `lib/report-study-types` (69),
  `lib/reports` (105), `lib/report-access-token` (171), `lib/particular-token` (133),
  `lib/token-study-tracking` (155), `lib/professional-bank-eligibility` (124),
  `lib/permissions` (57) — todos importan sólo tipos de schema [CONFIRMED por ARCH-3,
  muestreado en HEAD].
- **Acoplamiento accidental único**: `lib/report-workflow-communication.ts` importa `../db.ts` +
  schema + dispara email (P2-B) [CONFIRMED: header de imports]. Es el único lugar donde la
  introducción de puertos está justificada por un defecto real, no por dogma.
- **Huérfanos Express-era**: `server/utils/async-handler.ts` y
  `server/middlewares/error-handler.ts` — cero consumidores de runtime; los mantiene vivos su
  propio test (`test/unit/infrastructure/error-and-async-middleware.test.ts`) [CONFIRMED].
- **Service locator / event bus: NOT_FOUND.** Composición explícita por opciones; side-effects
  síncronos inline (auditoría ~16 call-sites, email 5), decisión ratificada por ARCH-1.
- **Multi-tenant**: aislamiento sólo por filtros de aplicación en `db-*`; **sin RLS** (auditoría
  SW 2026-06-30). Toda migración de queries es riesgo de datos hasta demostrar lo contrario con
  el test cross-tenant existente (`security-cross-tenant-idor-contract.test.ts`).

---

## 4. Target Architecture

Se ratifica la del ADR ARCH-2 con las siguientes precisiones vinculantes para el programa:

| Contexto | Capas justificadas | Evidencia |
|---|---|---|
| Logistics | domain + application + infrastructure + routes (4) | dominio puro 1.5k LOC ya existe; god-handlers 5.5k; cache propia |
| Reports | 4 (con puertos email/audit) | P2-B exige puertos; workflow con estados; storage |
| Study Tracking | domain + infrastructure + routes (3) + puerto email | dominio puro ~800 LOC; email en 2 rutas |
| Clinics | 3 (application sólo si el diff lo pide) | validación en `db-admin-clinics`; transacciones |
| Public Professionals | 3 | `professional-bank-eligibility` es dominio real; resto query+serialización |
| Particular Access / Report Access | 3 cada uno | tokens puros ya extraídos en lib |
| Pricing | **2 (infrastructure + routes)** | CRUD + serialización; sin reglas de dominio [CONFIRMED: `db-pricing.ts`] |
| Users/Roles | 3; `permissions.ts` queda como **shared kernel de autorización** (fan-in 14) | moverlo acoplaría 14 módulos |
| Auth (3 realms) | **fuera de `features/`** — congelado; sólo secuencia de seguridad dedicada | ADR: "no tocar auth sin PR dedicado" |
| Maintenance/Health, App Version, Contact | fuera de `features/` — plataforma/ops | no son bounded contexts |
| Audit | cross-cutting en `lib`; puerto por contexto sólo al extraer cada feature | fan-in 15; contratos por-ruta |

Dependencias permitidas/prohibidas: exactamente las de la tabla del ADR (routes → application →
domain; infrastructure implementa puertos; shared kernel hoja). **Puertos viven en
`application/`** y se derivan tipológicamente de los `Options` de ruta existentes. **Barrels:**
un `index.ts` por capa migrada, protegido por guard de consumo (patrón ya validado en
Logistics); prohibidos barrels agregadores cross-feature (riesgo de ciclo vía re-export).
**Sin Unit of Work genérico:** las transacciones permanecen dentro de los métodos de repositorio
que hoy las poseen (11 call-sites, 3 archivos).

---

## 5. Gap Analysis

| Contexto | Estado actual | Estado objetivo | Deuda principal | Riesgo | Esfuerzo | Dependencias | Prioridad |
|---|---|---|---|---|---|---|---|
| Logistics | domain 2/6 módulos migrados; app 0; infra 0; rutas god | 4 capas cerradas | 5.5k LOC de rutas + db 1.3k | MODERADO | Alto | ninguna | **1** |
| Pricing | monolito por naming, chico y sano | 2 capas | mínima | BAJO | Bajo | precedente Logistics | 2 |
| Public Professionals | dominio en lib; 9 tests de fixtures anclados | 3 capas | anclas de fixtures | MODERADO | Medio | M01 | 3 |
| Clinics | god-handler público 1.316; transacciones | 3 capas | validación mezclada | ALTO | Medio-alto | precedentes 1–3 | 4 |
| Study Tracking | dominio puro en lib; 3 rutas (2.8k) con email | 3 capas + puerto email | side-effects inline | ALTO | Medio-alto | M01 | 5 |
| Particular/Report Access | tokens puros en lib; rutas ~3.6k | 3 capas c/u | rate limits + anclas seguridad | ALTO | Medio | Study Tracking | 6 |
| Reports | P2-B activo; workflow+email+storage | 4 capas + puertos | acoplamiento invertido | ALTO | Alto | census catálogo | 7 |
| Users/Roles | db+ruta chicas; permissions kernel | 3 capas | poca | MODERADO | Bajo | ninguna dura | 8 |
| Auth | 3 realms, congelado por ADR | sin cambio | N/A (fuera de programa) | CRÍTICO si se toca | — | secuencia de seguridad | fuera |
| `server/lib` residual | cajón mixto (P2-A) | drenado por features; resto al final | taxonomía | ALTO si se mueve antes | Bajo al final | todas las features | última |

---

## 6. Audit of Blocks 1–11

Escala de riesgo por bloque: `riesgo = probabilidad × impacto` (§10 Risk Register para el detalle).

### Bloque 1 — Cierre del dominio puro de Logistics (PR 1–10) — riesgo 4 (BAJO)

**Veredicto: VALID_WITH_CHANGES, con 3 PR ya implementados y 1 a eliminar.** La premisa "extraer
del runtime HTTP las reglas puras restantes" está **parcialmente invertida**: las reglas puras ya
no viven mayoritariamente en los handlers sino en `server/lib/logistics/{metrics(829),
route-planning(515),sla-breach(111),time-window(40)}.ts`, todos importando sólo tipos de schema
[CONFIRMED]. El trabajo real del bloque es **mover 4 módulos ya puros** (~1.5k LOC) a
`features/logistics/domain/`, actualizando barrel, guard y anclas de tests en el mismo PR — no
re-derivar reglas desde los handlers. La partición propuesta por entidad (route plans / field
visits / route events / SLA) no coincide con la organización real por capacidad
(metrics / planning / sla / time-window). PR 7 (value objects + errores de dominio) es DDD
ceremonial prohibido por las restricciones 15–16 del propio programa: el estilo del dominio
existente es funciones + tipos. PR 8 y 9 ya existen (barrel ARCH-8; guard + 3 suites unit en
`test/unit/domain/logistics/`).

### Bloque 2 — Capa de aplicación de Logistics (PR 11–20) — riesgo 9 (MODERADO)

**Veredicto: VALID_WITH_CHANGES.** Correcciones vinculantes:
- **Puertos**: derivarlos de las firmas de los `Options` de ruta existentes; viven en
  `application/`. Un puerto de repositorio por agregado real sólo cuando un caso de uso lo
  consuma en ese mismo PR.
- **PR 14 parte de premisa falsa**: no existe DELETE de route plans; el ciclo de vida se opera
  con `POST /:routePlanId/cancel` vía `handleRoutePlanLifecycleAction`
  [CONFIRMED: `logistics-route-plans.fastify.ts:2237-2238`]. El caso de uso correcto es
  "lifecycle actions", no "Delete/Cancel".
- **Sin Unit of Work**: las transacciones viven dentro de `db-logistics` (métodos completos);
  los casos de uso llaman métodos de repositorio ya atómicos. Introducir UoW cambiaría semántica
  de commit — prohibido por invariante DB.
- **PR 19 (repos en memoria)**: no crear framework de fakes paralelo; el patrón de stubs por
  `Options` (usado por los 8 tests de integración logistics) es la fixture canónica. Fakes en
  memoria sólo para tests de application puros, derivados de los mismos tipos.
- **Auditoría y cache como puertos separados**: sí, pero sólo los que el caso de uso migrado
  use; el orden auditoría→respuesta es contractual (`logistics-audit-runtime.test.ts`).

### Bloque 3 — Infraestructura y rutas delgadas de Logistics (PR 21–30) — riesgo 12 (ALTO)

**Veredicto: VALID_WITH_CHANGES + 2 SPLIT + 3 MERGE.** `db-logistics.ts` es UN archivo (1.295
LOC): separar su migración en 3 PR por entidad (22/23/24) fabrica estados intermedios con el
archivo partido y anclas rotas; **mover el archivo completo en un PR** con re-export temporal
documentado es más chico en diff efectivo y más fácil de revertir. PR 21 ("repositorio base")
sin código real que lo habite es capa vacía — merge con el move. PR 25 (mapping) sólo si el
move lo exige. PR 27 y 28: adelgazar 2.241 LOC (route-plans) y 3.221 LOC
(field-visits+events+sla) excede el presupuesto de revisión de un PR — split por módulo de
ruta. La ruta no está delgada si conserva reglas, queries o side-effects no delegados (criterio
aceptado). Riesgos concretos: invalidación de `logistics-route-plans-cache` (contract-test de
runtime existente), serialización de fechas (`toISOString` en mapping), headers CORS por-ruta
(`cors-headers` importado por la ruta), `session-last-access` refresh y `runtime-timing`
(contratos por-ruta), y el orden de registro global fijo en `fastify-app.ts`.

### Bloque 4 — Reordenamiento de `server/lib` (PR 31–40) — riesgo 12 (ALTO) como propuesto

**Veredicto: REORDER_REQUIRED (diferir al final) + 1 ALREADY_IMPLEMENTED + 1 a contingencia.**
PR 31 ya existe (ARCH-3); sólo cabe refresh (M01). El resto del bloque, ejecutado ANTES de las
features (posición 31–40 de 110), maximiza el blast radius: `env` (fan-in 42), `cors-headers`
(30), `auth-security` (34) — y 188 tests ancla. Además viola la restricción 17 (mover por
apariencia): ninguno de estos moves crea una frontera verificable que un guard no pueda fijar
hoy sobre los paths actuales. Corrección: las features drenan `lib` (cada contexto se lleva sus
domain/infra al migrar); al final del programa se reclasifica **lo residual** en 2–3 PR con
shims re-export documentados. `fastify-admin-auth`, `auth-security`, `login-rate-limit`,
`session-last-access`: congelados (REQUIRES_SECURITY_SEQUENCE). `lib/shared` (PR 38): riesgo de
cajón nuevo; sólo `http-types` y `list-pagination` califican hoy — contingencia. PR 39
(guards): REORDER — los guards nacen con cada frontera desde la Fase A, no en el bloque 4.
PR 40 (huérfanos): válido y **adelantado** — `async-handler.ts` y `middlewares/error-handler.ts`
se eliminan con su test en un PR temprano (M02).

### Bloque 5 — Pricing y Maintenance/Health (PR 41–50) — riesgo 4 (BAJO) / N/A

**Veredicto: Pricing VALID_WITH_CHANGES (10 PR → 3); Maintenance/Health REMOVE_FROM_PROGRAM.**
Pricing no tiene reglas de dominio: `db-pricing.ts` (160 LOC) es CRUD + `serializePricingItem` +
guard de patch [CONFIRMED: lectura del archivo]. PR 42 ("extraer modelo y reglas") fabrica una
capa para código inexistente — prohibido (restricción 13). Estructura correcta: infrastructure
(db-pricing + `public-pricing-cache` 54) + routes (admin 513, public 136); las consultas
públicas son query service directo. Maintenance/Health NO es bounded context: `/health` +
`/api/health` viven en `fastify-app`/`http-runtime`; `schema-health` y `db-maintenance` son
utilidades operativas admin. No existen readiness/liveness diferenciados hoy [CONFIRMED:
handlers en `fastify-app.ts:419-432`]; crearlos (PR 49) sería funcionalidad nueva (restricción
18). Se quedan donde están, con ownership documentado.

### Bloque 6 — Public Professionals y base de Clinics (PR 51–60) — riesgo 6 (MODERADO)

**Veredicto: Professionals VALID_WITH_CHANGES (6 PR → 4); base de Clinics MERGE con Bloque 7.**
Elegibilidad es dominio real (`professional-bank-eligibility.ts` 124 + tests de histopatología
con SQL-drift-guard que fija el SQL de `db-public-professionals` [CONFIRMED:
`public-professionals-histopathology-sql-drift.test.ts`]). Peligro específico: **9 tests de
arquitectura de fixtures** de este contexto anclan paths y estructura — presupuestar alineación.
Rate limiting: wrapper de 9 LOC sobre `rate-limit-store` compartido; se mueve con la ruta, el
store queda en lib. Shells de Clinics sin código (57, 59 "contratos" anticipados): prohibidos
(restricciones 13–14); Clinics arranca directamente con su primer PR de código en el Bloque 7.
No hay dependencia de código entre Professionals y Clinics que impida cerrarlos por separado
[CONFIRMED: `db-public-professionals` no importa `db-admin-clinics`].

### Bloque 7 — Finalización de Clinics (PR 61–70) — riesgo 12 (ALTO)

**Veredicto: VALID_WITH_CHANGES (10 → 5).** `db-admin-clinics.ts` (694) usa `.transaction(`
[CONFIRMED] — el move debe preservar los límites transaccionales exactos. Separación
lectura/escritura: aceptable como organización de casos de uso, no como capas distintas. PR 66
(cache de Clinics): **NOT_FOUND** — no existe cache de clinics en `lib` [CONFIRMED: inventario
ARCH-3 + listado de archivos]; eliminar el PR. El perfil público (`clinic-public-profile`
1.316) tiene contrato reconciliado con DB (`reconcile-public-profile-db-contract.test.ts`) —
cualquier cambio de mapping rompe el guard: alinear en el mismo PR. Exposición de campos
internos en el perfil público = riesgo de datos: el test de disclosure existente
(`security-response-disclosure-boundaries.test.ts`) debe correr verde en cada PR del bloque.
Cross-tenant: obligatorio aquí (no en contingencia).

### Bloque 8 — Study Tracking y dominios de acceso (PR 71–80) — riesgo 15 (ALTO)

**Veredicto: VALID_WITH_CHANGES (10 → 8, repartidos en fases G y H); PR 80 SPLIT_REQUIRED.**
Study Tracking es contexto propio, separado de Reports por vocabulario, datos y rutas
[CONFIRMED: `db-study-tracking` ≠ `db-report-workflow`; rutas distintas]. Su dominio ya es puro
en lib (`study-tracking` 648, `token-study-tracking` 155). Tokens: tres familias distintas
(particular, report-access, study-tracking) con hashing/expiración propios — **no** unificar en
un kernel de tokens (abstracción especulativa). Las reglas de acceso hoy no dependen de
cookies/Fastify en dominio [CONFIRMED: imports sólo-schema]; la dependencia con los realms de
auth queda en las rutas y NO se toca (auth congelado). PR 77 (puertos notificación/audit): sólo
para los side-effects reales (email en `study-tracking` y `admin-study-tracking`). PR 80
(migrar rutas y cerrar TRES contextos en un PR): inaceptable — ~3.6k LOC de rutas y 3 cierres;
split en cierre por contexto. Riesgo dominante: enumeración/filtración en errores de token (los
contract-tests de no-secrets/no-stack existen y deben permanecer verdes).

### Bloque 9 — Reports (PR 81–90) — riesgo 15 (ALTO)

**Veredicto: VALID_WITH_CHANGES (10 → 6).** El único acoplamiento invertido del backend está
aquí: `report-workflow-communication.ts` (db + schema + email) [CONFIRMED] — su desacople por
puertos es el corazón del bloque y está bien planteado (PR 83/87). Correcciones: el catálogo de
tipos de estudio está censado por lista hardcodeada en `report-study-types-catalog.test.ts`
(bloqueador conocido: TEST-ARCH-15); se necesita el ajuste path-aware en el MISMO PR que mueva
`lib/report-study-types.ts`. PR 86 mezcla repositorio y almacenamiento: **split** —
`supabase.ts` tiene 8 consumidores y es infra compartida; el feature consume storage por
puerto, el cliente no se absorbe. Consistencia DB↔email: hoy no hay outbox/compensación; el
programa NO debe introducirla (sería feature nueva); debe preservar el orden actual de
side-effects y documentarlo como limitación. Las rutas públicas de acceso a informes pertenecen
al contexto Report Access (Bloque 8), no a Reports — no duplicar ownership. El doble registro
de `/api/reports` (reports + reports-status) hace el orden de registro contractual. ¿Alcanzan
10 PR? Sí: 6 con la partición corregida.

### Bloque 10 — Users, Roles, Permissions y Auth (PR 91–100) — riesgo 20 (CRÍTICO) como propuesto

**Veredicto: Users/Roles VALID_WITH_CHANGES (5 → 2); Auth REMOVE del programa de reorganización
(REQUIRES_SECURITY_SEQUENCE).** Evidencia de la escala real de Auth: 3 realms — clínica
(`auth.fastify` 1.514 + middleware `auth.ts` + `clinic-permissions.ts`), admin
(`admin-auth.fastify` 1.044 + `fastify-admin-auth` 354 + middleware `admin-auth.ts`),
particular (`particular-auth.fastify` 938 + middleware `particular-auth.ts`) — más
`auth-security` (fan-in 34), `login-rate-limit`, `session-last-access` (fan-in 17),
`db-admin-sessions`, alertas de login fallido, y 17 tests de `architecture/security/` + 9 de
`test/security/` fijando cookies, fases de auditoría, CSRF, aislamiento de rate limit por
realm. Comprimir eso en PR 96–98 es el punto de mayor riesgo del programa (P=4, I=5 → 20
CRÍTICO). El ADR ya congela auth ("sólo PR de seguridad dedicado"). Decisión de esta auditoría:
**Auth no se reorganiza en este programa.** Mover archivos de auth no crea ninguna frontera
nueva que los guards actuales no fijen ya, y el beneficio no compensa el riesgo.
`permissions.ts` (fan-in 14) queda como shared kernel de autorización, documentado — no se muda
a la feature Users/Roles. PR 99 se redistribuye: la regresión de seguridad es DoD de CADA
cierre de contexto, no un PR final. PR 100 sobrevive como certificación global.

### Bloque 11 — Contingencia y endurecimiento (PR 101–110)

**Veredicto: redistribuir 6 de 10.** Obligatorios desde antes: detección de ciclos e imports
legacy (guard de cada frontera + DoD de cada cierre; 101/102/103 quedan como barrido final
menor); cross-tenant (105) es DoD de las fases F–I con el test IDOR existente
(`security-cross-tenant-idor-contract.test.ts`); documentación (109) es incremental por cierre.
PR 104 (coverage): requiere dependencia nueva (c8) — gate de autorización explícita
(restricción 12 + protocolo R2 de `AGENTS.md`); queda en contingencia con decisión previa
documentada. PR 106 (CODEOWNERS por contexto): **sin efecto real** — `.github/CODEOWNERS`
documenta mantenedor único y lo declara explícitamente; REMOVE. PR 107 (límites de
complejidad): contingencia legítima. PR 108: merge con los guards. PR 110: cierre con evidencia
acumulada — válido.

---

## 7. Audit of PR 1–110

Estados: `V`=VALID · `VC`=VALID_WITH_CHANGES · `SP`=SPLIT_REQUIRED · `MG`=MERGE_RECOMMENDED ·
`RO`=REORDER_REQUIRED · `RM`=REMOVE_FROM_PROGRAM · `CT`=MOVE_TO_CONTINGENCY ·
`SEC`=REQUIRES_SECURITY_SEQUENCE · `IE`=INSUFFICIENT_EVIDENCE · `AI`=ALREADY_IMPLEMENTED.
Riesgo = P×I. Columna "→" = PR del programa corregido (§8). Confianza: A=alta M=media B=baja.

### Bloque 1 (Logistics domain)

| PR | Contexto | Estado | Alcance validado / Evidencia | Dependencias | Riesgo | Pruebas | Guard | Rollback | Corrección → | Conf |
|-:|---|---|---|---|---|---|---|---|---|---|
| 1 | Logistics | VC | Inventario ya existe (ARCH-3) pero pre-ARCH-5/7/8; falta matriz origen-destino | — | 1 | n/a (docs) | n/a | revert doc | Refresh → **M01** | A |
| 2 | Logistics | VC | No hay "reglas de Route Plans" que extraer de handlers; lo puro ya está en `lib/logistics/route-planning.ts` (515) | M01 | 4 | unit viajan con el move | domain-boundary-guard | revert + shim | Move de archivo → **M03** | A |
| 3 | Logistics | MG | Validaciones/transiciones viven inline en handler (2.241 LOC) = application, no domain | Fase B | 4 | contract por-ruta | ídem | revert | Merge → **M08** | A |
| 4 | Logistics | VC | Única regla pura de field visits ya extraída (ARCH-5); resto es application | Fase B | 4 | `logistics-heuristic-field-visit-ids.test` | ídem | revert | Re-scope → **M09** | A |
| 5 | Logistics | IE | No existe módulo puro de route events; "events" son datos persistidos (ARCH-1) [CONTRADICTED] | — | — | — | — | — | UC en **M10** | A |
| 6 | Logistics | VC | SLA puro existe: `sla-breach.ts` (111) + `time-window.ts` (40) | M01 | 4 | `logistics-sla-breach-runtime` | ídem | revert | Move → **M02b** | A |
| 7 | Logistics | RM | VOs/errores = DDD ceremonial; estilo actual funciones+tipos (restr. 15–16) | — | — | — | — | — | Eliminar | A |
| 8 | Logistics | AI | Barrel ya existe: `domain/index.ts` (ARCH-8) + guard de consumo | — | — | `logistics-domain-barrel.test` | existente | — | Extender por move | A |
| 9 | Logistics | AI | Guard de pureza + 3 suites unit ya existen | — | — | existentes | `logistics-domain-boundary-guard` | — | Extender por move | A |
| 10 | Logistics | VC | "Eliminar duplicación" demasiado amplio; cierre = docs + borrar `lib/logistics/` vacío + endurecer guard | M02b–M04 | 4 | suite completa | endurecido | revert | → **M05** | A |

### Bloque 2 (Logistics application)

| PR | Estado | Alcance validado / Evidencia | Dependencias | Riesgo | Pruebas | Guard | Rollback | → | Conf |
|-:|---|---|---|---|---|---|---|---|---|
| 11 | VC | Puertos derivados de `Options` de rutas (seam §2.5); en `application/`; sin UoW | M05 | 9 | typecheck + integración stubs | guard application nuevo | revert | **M06** | A |
| 12 | V | Create Route Plan existe (`app.post` raíz) | M06 | 9 | `logistics-route-plans-api` | ídem | revert por UC | **M08** | A |
| 13 | MG | Update comparte invariantes con Create; separar sólo si diff >800 | M06 | 9 | ídem | ídem | revert | **M08** | M |
| 14 | IE | No hay DELETE; lifecycle = `POST /:id/cancel` (`:2237`) [CONTRADICTED] | M06 | 9 | ídem | ídem | revert | **M08** | A |
| 15 | VC | Assign field visit: confirmar endpoint exacto en M01 [UNVERIFIED endpoint-level] | M06 | 9 | `logistics-field-visits-api` | ídem | revert | **M09** | M |
| 16 | VC | Estados de field visit → mismo módulo UC | M06 | 9 | ídem | ídem | revert | **M09** | M |
| 17 | VC | Route events = append/list de datos | M06 | 9 | `logistics-route-events-api` | ídem | revert | **M10** | A |
| 18 | VC | SLA/alertas: UC lectura + overdue — piloto ARCH-6 | M06 | 9 | `logistics-sla-routes-*` | ídem | revert | **M06** | A |
| 19 | VC | Sin framework de fakes paralelo; stubs por Options = fixture canónica | Fase B | 4 | unit application nuevos | — | revert | **M11** | A |
| 20 | V | Guard de dependencias application + closeout | Fase B | 4 | guard test | nuevo | revert | **M11** | A |

### Bloque 3 (Logistics infra + rutas)

| PR | Estado | Alcance validado / Evidencia | Dependencias | Riesgo | Pruebas | Guard | Rollback | → | Conf |
|-:|---|---|---|---|---|---|---|---|---|
| 21 | MG | "Repo base" sin move = capa vacía (restr. 13) | M11 | — | — | — | — | **M12** | A |
| 22 | VC | `db-logistics.ts` es 1 archivo (1.295); mover entero, tx intactas | M11 | 12 | `logistics-db` + integración | infra guard | revert + shim | **M12** | A |
| 23 | MG | Mismo archivo que 22 | — | — | — | — | — | **M12** | A |
| 24 | MG | Mismo archivo que 22 | — | — | — | — | — | **M12** | A |
| 25 | VC | Mapping ya inline; extraer sólo si el move lo exige | M12 | 6 | ídem | ídem | revert | dentro **M12** | A |
| 26 | V | Cache adapter: `logistics-route-plans-cache.ts` (107) con contract-test de runtime | M12 | 6 | `…cache-runtime.test` | ídem | revert | **M13** | A |
| 27 | SP | Thin route-plans: 2.241 LOC excede presupuesto de revisión; split lectura/escritura | M12–13 | 12 | contratos por-ruta ×3 | routes guard | revert por ruta | **M14** | A |
| 28 | SP | Field-visits (1.421) + events (1.008) + sla (792) ≠ 1 PR | M14 | 12 | ídem | ídem | revert | **M15/M16** | A |
| 29 | V | Regresión contractual: red existente ~30 tests logistics | M14–16 | 6 | suite | — | n/a | **M17** | A |
| 30 | V | Cierre: legacy imports fuera, docs, barrel | Fase C | 4 | suite | endurecidos | revert | **M17** | A |

### Bloque 4 (server/lib)

| PR | Estado | Alcance validado / Evidencia | Riesgo | → | Conf |
|-:|---|---|---|---|---|
| 31 | AI | ARCH-3 es este inventario; sólo refresh | — | **M01** | A |
| 32 | RO | `lib/http` al final; cors-headers fan-in 30 + 188 anclas | 12 | **M46** | A |
| 33 | RO+SEC | api-response-security / sensitive-response-cache = superficie de seguridad de respuesta; sólo con revisión de seguridad | 12 | **M46** | A |
| 34 | RO | `env` fan-in 42 = blast radius máximo; `logger` trivial | 12 | **M47** o no mover | A |
| 35 | RO | email (5) y supabase (8) se consumen por puerto desde features; el cliente queda en lib | 9 | **M47** | A |
| 36 | RO+SEC | `login-rate-limit` es auth (congelado); resto infra | 12 | parcial **M47** | A |
| 37 | RO | Audit cross-cutting (fan-in 15); puerto por contexto al extraer cada feature | 9 | dentro de features | A |
| 38 | CT | `lib/shared` = riesgo de cajón nuevo; sólo http-types + list-pagination califican | 4 | contingencia C3 | A |
| 39 | RO | Guards nacen con cada frontera (Fase A en adelante) | — | cada fase | A |
| 40 | VC | Huérfanos confirmados: `utils/async-handler.ts` + `middlewares/error-handler.ts` (+ su test) | 2 | **M02** (adelantado) | A |

### Bloque 5 (Pricing / Maintenance-Health)

| PR | Estado | Alcance validado / Evidencia | Riesgo | → | Conf |
|-:|---|---|---|---|---|
| 41 | MG | Shell sin código prohibido (restr. 14); shell+primer move juntos | 4 | **M18** | A |
| 42 | RM | Sin reglas de dominio en Pricing [CONFIRMED `db-pricing.ts` = CRUD+serialize] | — | — | A |
| 43 | MG | UCs admin no justificados; handler delega en repo | 4 | **M19** | A |
| 44 | VC | Consultas públicas = query service directo (public-pricing 136) | 4 | **M19** | A |
| 45 | V | Repo: move `db-pricing` (160) | 4 | **M18** | A |
| 46 | V | Cache pública (54 LOC; no confundir con la cache frontend homónima) | 4 | **M18** | A |
| 47 | MG | Thin rutas admin+public | 4 | **M19** | A |
| 48 | RM | Maintenance/Health no es bounded context; plataforma/ops | — | docs en **M20** | A |
| 49 | RM | No existen readiness/liveness hoy; crearlos = feature nueva (restr. 18) | — | — | A |
| 50 | SP | Cierre de 2 contextos en 1 PR; con 48–49 fuera queda sólo cierre Pricing | 4 | **M20** | A |

### Bloque 6 (Public Professionals / base Clinics)

| PR | Estado | Alcance validado / Evidencia | Riesgo | → | Conf |
|-:|---|---|---|---|---|
| 51 | MG | Shell+primer move | 6 | **M21** | A |
| 52 | V | `professional-bank-eligibility` (124) + tests histopatología = dominio real | 6 | **M21** | A |
| 53 | VC | Query service, sin application pesada | 6 | **M22** | M |
| 54 | V | Repo `db-public-professionals` (756); SQL-drift-guard fija el SQL → alinear in-PR | 9 | **M22** | A |
| 55 | VC | Rate limit: wrapper 9 LOC se muda con ruta; store queda en lib | 6 | **M23** | A |
| 56 | V | Thin ruta pública (path/contrato intocables) + cierre | 6 | **M23–M24** | A |
| 57 | MG | Shell Clinics sin código: prohibido | — | **M25** | A |
| 58 | VC | Modelo/reglas: validación hoy dentro de `db-admin-clinics` | 9 | **M25** | M |
| 59 | RM | "Contratos de repositorio" anticipados = abstracción especulativa | — | — | A |
| 60 | MG | Pruebas/guards iniciales nacen con M25 | — | **M25** | A |

### Bloque 7 (Clinics)

| PR | Estado | Alcance validado / Evidencia | Riesgo | → | Conf |
|-:|---|---|---|---|---|
| 61 | V | Repo `db-admin-clinics` (694) con `.transaction(` — límites tx exactos | 12 | **M26** | A |
| 62 | VC | Consultas admin (lectura) | 9 | **M27** | M |
| 63 | VC | Comandos admin (escritura) | 12 | **M27** | M |
| 64 | V | Perfil público (1.316) con `reconcile-public-profile-db-contract` | 12 | **M28** | A |
| 65 | MG | Validación/mapping no son capa aparte | — | dentro M26–28 | A |
| 66 | RM | Cache de Clinics NOT_FOUND en lib | — | — | A |
| 67 | V | Thin admin routes (987) | 9 | **M27** | A |
| 68 | V | Thin public route; disclosure-test verde obligatorio | 12 | **M28** | A |
| 69 | V | Contractuales + authz + cross-tenant (obligatorio aquí) | 8 | **M29** | A |
| 70 | V | Cierre | 6 | **M29** | A |

### Bloque 8 (Study Tracking / accesos)

| PR | Estado | Alcance validado / Evidencia | Riesgo | → | Conf |
|-:|---|---|---|---|---|
| 71 | MG | Shell+move | — | **M30** | A |
| 72 | V | `lib/study-tracking` (648) ya puro → move | 6 | **M30** | A |
| 73 | V | `token-study-tracking` (155) puro → move; cada familia de token separada | 12 | **M30** | A |
| 74 | VC | UC consulta | 9 | **M31** | M |
| 75 | VC | UC actualización; email inline en 2 rutas → puerto | 12 | **M31** | A |
| 76 | V | Repo `db-study-tracking` (295) | 6 | **M31** | A |
| 77 | VC | Puertos notificación/audit sólo donde hay side-effect real | 9 | **M31** | A |
| 78 | VC | Particular Access: tokens sí; realm particular-auth NO (congelado) | 15 | **M33** | A |
| 79 | VC | Report Access: tokens + rate limits públicos; anclas de seguridad | 15 | **M34** | A |
| 80 | SP | 3 cierres en 1 PR inaceptable (~3.6k LOC rutas) | — | **M32/M32b/M33/M34/M35** | A |

### Bloque 9 (Reports)

| PR | Estado | Alcance validado / Evidencia | Riesgo | → | Conf |
|-:|---|---|---|---|---|
| 81 | MG | Shell+move | — | **M36** | A |
| 82 | VC | `report-status`(64) `report-study-types`(69) `reports`(105) puros; census del catálogo bloquea → ajuste path-aware in-PR | 9 | **M36** | A |
| 83 | V | Desacoplar `report-workflow-communication` (P2-B) — corazón del bloque | 12 | **M37** | A |
| 84 | V | UC creación/edición | 12 | **M38** | M |
| 85 | V | UC transiciones; orden side-effects contractual | 12 | **M38** | A |
| 86 | SP | Repo (`db-report-workflow` 220) ≠ storage (supabase compartido, 8 consumidores; por puerto) | 12 | **M37/M39** | A |
| 87 | VC | Un puerto por side-effect real (email/audit) | 9 | **M37** | A |
| 88 | V | Thin admin-reports (838) + admin-report-workflow (479) | 12 | **M39** | A |
| 89 | VC | reports(769)+reports-status(610): doble registro `/api/reports` = orden contractual; public-report-access pertenece a Report Access (B8) | 12 | **M40** | A |
| 90 | V | Cierre con pruebas de consistencia DB↔email (sin compensación nueva) | 12 | **M41** | A |

### Bloque 10 (Users/Roles/Auth)

| PR | Estado | Alcance validado / Evidencia | Riesgo | → | Conf |
|-:|---|---|---|---|---|
| 91 | MG | Shell+move | — | **M42** | A |
| 92 | VC | `permissions.ts` fan-in 14 = shared kernel de autorización; NO se muda | 12 | **M42** (docs+guard) | A |
| 93 | VC | UC usuarios (`db-admin-users-roles` 357; ruta 645) | 12 | **M42** | M |
| 94 | MG | Roles/permisos junto a 93 (tamaño) | — | **M42** | A |
| 95 | V | Repo | 6 | **M43** | A |
| 96 | SEC+RM | Auth: 3 realms ~3.5k LOC + middlewares + libs congeladas; fuera del programa | 20 | secuencia dedicada C4 | A |
| 97 | SEC+RM | Ídem | 20 | ídem | A |
| 98 | SEC+RM | Ídem | 20 | ídem | A |
| 99 | RO | Regresión de seguridad = DoD de cada cierre, no PR final | — | cada fase | A |
| 100 | V | Certificación global | 2 | **M48** | A |

### Bloque 11 (Contingencia)

| PR | Estado | Corrección | → | Conf |
|-:|---|---|---|---|
| 101 | CT | Ciclos: guard activo desde Fase A; barrido residual final | **M45** + C5 | A |
| 102 | RO | Legacy imports = DoD por cierre | cada fase + **M44** | A |
| 103 | RO | Barrels = parte de cada cierre | cada fase | A |
| 104 | CT | Coverage requiere dep nueva (c8) → gate de autorización (restr. 12 / R2) | C1 | A |
| 105 | RO | Cross-tenant obligatorio en fases F–I; test IDOR existente verde en todo PR | DoD | A |
| 106 | RM | CODEOWNERS = mantenedor único documentado; sin efecto | — | A |
| 107 | CT | Complejidad/tamaño de handlers | C2 | A |
| 108 | MG | Auditoría de deps entre features = parte de los guards | **M45** | A |
| 109 | RO | Docs incremental por cierre + roll-up | cada fase + **M48** | A |
| 110 | V | Certificación con evidencia acumulada | **M48** | A |

---

## 8. Corrected Program

```text
Original proposed count : 110
Validated count         : 9
Removed PR              : 12   (5, 7, 42, 48, 49, 59, 66, 96, 97, 98, 106 + 14 re-fundado)
Merged PR               : 31
Split PR                : 4    (27, 28, 80, 86)
Reordered PR            : 10 + Bloque 4 completo diferido
New mandatory PR        : 2    (M01 refresh/protocolo · M02 huérfanos)
Contingency PR          : 5    (C1 coverage · C2 complejidad · C3 lib/shared · C4 Auth · C5 ciclos)
Final recommended count : 48   (mínima 40 · probable 48 · máxima controlada 60)
```

Secuencia corregida (48 PR). Criterio de entrada de cada PR: fase previa cerrada y verde (§17);
criterio de salida: §18. Todos los PR de código son R2 bajo `AGENTS.md` → autorización de scope
explícita por PR.

**Fase 0 — Precondiciones (2):**
**M01** (docs) Refresh de ARCH-3 a HEAD + matriz origen-destino por contexto + protocolo de
alineación de guards (lista de los 188 tests ancla, por contexto). ·
**M02** Limpieza de huérfanos Express-era: borrar `server/utils/async-handler.ts`,
`server/middlewares/error-handler.ts` y su test; actualizar censo `tracked-source-inventory`.

**Fase A — Logistics domain (4):**
**M02b** mover `sla-breach` + `time-window` · **M03** mover `route-planning` (515) ·
**M04** mover `metrics` (829) · **M05** cierre: borrar `lib/logistics/` vacío, endurecer guard,
docs. *(M02b+M03 fusionables → mínima 40.)*

**Fase B — Logistics application (6):**
**M06** primer UC (SLA lectura/overdue) + puertos mínimos derivados de Options (= ARCH-6) ·
**M07** UC route-plans lectura + generate-heuristic · **M08** UC route-plans escritura +
lifecycle (`cancel`) · **M09** UC field-visits (asignación + estados) · **M10** UC route-events ·
**M11** guard application + suite UCs + closeout de capa.

**Fase C — Logistics infra + rutas (6):**
**M12** mover `db-logistics.ts` completo → infrastructure (tx intactas; shim documentado) ·
**M13** cache adapter · **M14** thin `logistics-route-plans` · **M15** thin
`logistics-field-visits` · **M16** thin `logistics-route-events` + `logistics-sla` ·
**M17** cierre Logistics (legacy imports, regresión contractual completa, docs).

**Fase D — Pricing (3):** **M18** infra (db-pricing + cache) · **M19** thin rutas admin+public ·
**M20** cierre (+ nota de ownership Maintenance/Health fuera de features).

**Fase E — Public Professionals (4):** **M21** domain (bank-eligibility) · **M22** repo +
mapping (SQL-drift alineado) · **M23** thin ruta + rate limit wiring · **M24** cierre.

**Fase F — Clinics (5):** **M25** domain/validaciones reales · **M26** repo (tx exactas) ·
**M27** thin admin (consultas+comandos) · **M28** thin perfil público (disclosure verde) ·
**M29** cierre + cross-tenant.

**Fase G — Study Tracking (5):** **M30** domain moves · **M31** UCs + puerto email + repo ·
**M32** thin `study-tracking` + `particular-study-tracking` · **M32b** thin
`admin-study-tracking` · **M35** cierre.

**Fase H — Accesos por token (3):** **M33** Particular Access (domain+repo+thin+cierre) ·
**M34** Report Access (ídem; rate limits públicos) · **M35b** regresión conjunta de
enumeración/filtración.

**Fase I — Reports (6):** **M36** domain moves + census catálogo path-aware · **M37** desacople
P2-B por puertos (datos/notificación) · **M38** UCs creación/edición/transiciones · **M39** thin
admin (reports + workflow) · **M40** thin reports/reports-status (orden de registro preservado) ·
**M41** cierre + consistencia DB↔email.

**Fase J — Users/Roles (2):** **M42** domain+UCs (permissions documentado como kernel, no se
muda) · **M43** repo + thin ruta + cierre.

**Fase K — Cierre global (4):** **M44** barrido de imports legacy residuales · **M45** guard
global anti-ciclos + matriz de deps entre features · **M46** reclasificación residual de
`server/lib` (http) con revisión de seguridad — **opcional, sólo si queda masa crítica** ·
**M48** certificación final con evidencia acumulada. *(M47 infra-residual: opcional, dentro del
techo de 60.)*

**Contingencia (fuera del conteo):** C1 coverage (autorizar dep c8 primero) · C2 límites de
complejidad · C3 `lib/shared` · C4 secuencia de seguridad Auth (diseño separado + sign-off) ·
C5 ciclos residuales imprevistos.

---

## 9. Dependency Graph

```text
M01 (docs) ──► M02 ──► Fase A (M02b→M03→M04→M05)
                            │
                            ▼
                Fase B (M06→M07→M08→M09→M10→M11)
                            │
                            ▼
                Fase C (M12→M13→{M14,M15,M16}→M17)
                            │
              ┌─────────────┼───────────────────────┐
              ▼             ▼                       ▼
        Fase D (Pricing) Fase E (Professionals) Fase F (Clinics)   ← paralelizables tras M17
              └─────────────┴───────────┬───────────┘
                                        ▼
                          Fase G (Study Tracking) ──► Fase H (Accesos por token)
                                        │                  │
                                        └──────► Fase I (Reports)  ← M36 condicionado por census
                                                        │             del catálogo (ajuste in-PR)
                                                        ▼
                                              Fase J (Users/Roles)
                                                        ▼
                                        Fase K (M44→M45→[M46/M47]→M48)
```

Dependencias duras: B sobre A (los UC consumen dominio migrado); C sobre B (rutas delegan en
UC); D–F sobre C sólo como precedente metodológico (no hay dependencia de código —
paralelizables con disciplina de anclas); H sobre G (tokens de study-tracking comparten patrón
de guard); I condicionada por el ajuste path-aware del census del catálogo
(`report-study-types-catalog.test.ts`, bloqueador TEST-ARCH-15 conocido); K sobre todo lo
anterior. Auth: sin nodo — excluido del grafo.

---

## 10. Risk Register

Escalas: P (probabilidad 1–5) · I (impacto 1–5) · R = P×I (1–4 BAJO · 5–9 MODERADO · 10–15 ALTO
· 16–25 CRÍTICO).

| ID | Riesgo | Evidencia | P | I | R | Clase | Mitigación | PR responsable | Señal de bloqueo |
|---|---|---|---:|---:|---:|---|---|---|---|
| R-01 | Guards ancla desalineados al mover archivos (188 tests referencian paths `server/`) | grep §2.3; precedente TEST-ARCH-12 "0 moves" | 5 | 3 | 15 | ALTO | Matriz de anclas por contexto en M01; alineación en el MISMO PR (P2-D) | M01 + cada move | `pnpm test` rojo en architecture/* |
| R-02 | Pérdida de semántica transaccional al extraer repositorios | 11 call-sites `.transaction(` en `db.ts`, `db-logistics`, `db-admin-clinics` | 3 | 5 | 15 | ALTO | Mover archivos db completos; prohibido re-particionar tx; diff de métodos 1:1 | M12, M26 | cualquier cambio en límites de `.transaction(` |
| R-03 | Cambio observable de contrato HTTP al adelgazar god-handlers | 121 endpoints; envelope de error global; serialización de fechas ISO | 3 | 4 | 12 | ALTO | Contract-tests por-ruta existentes verdes; sin cambios de payload declarados | M14–M16, M27–M28, M39–M40 | diff en snapshot de contrato |
| R-04 | Exposición cross-tenant al reescribir queries | Sin RLS (aislamiento sólo de aplicación, auditoría SW 2026-06-30) | 2 | 5 | 10 | ALTO | Moves de archivo (no reescritura de queries); test IDOR verde en todo PR; cross-tenant DoD en F–I | todas las fases F–I | fallo en `security-cross-tenant-idor-contract` |
| R-05 | Ejecución del Bloque 10 tal como fue propuesto (Auth en 3 PR) | 3 realms ~3.5k LOC + 26 tests de seguridad anclados | 4 | 5 | 20 | CRÍTICO | Auth excluido del programa (C4 sólo con diseño + sign-off) | — | cualquier diff en `auth*`/`middlewares/` sin secuencia dedicada |
| R-06 | Big-move de `server/lib` temprano (Bloque 4 como propuesto) | fan-in env 42 / auth-security 34 / cors-headers 30 | 4 | 3 | 12 | ALTO | Diferir a Fase K; drenaje natural por features; shims documentados | M46/M47 | >30 archivos tocados en un PR |
| R-07 | Invalidez de cache tras mover adaptadores (logistics route-plans, public pricing) | contract-test `logistics-route-plans-cache-runtime` | 2 | 3 | 6 | MODERADO | Adapter move con test de runtime verde; TTL/keys intactos | M13, M18 | fallo cache-runtime test |
| R-08 | Orden de side-effects (audit→email→respuesta) alterado por casos de uso | `logistics-audit-runtime`, contratos audit por-ruta; email 5 rutas | 3 | 4 | 12 | ALTO | El UC preserva el orden actual documentado en M01; tests de fase de auditoría verdes | Fases B, G, I | fallo en audit-phase boundaries |
| R-09 | Doble registro `/api/reports` reordenado accidentalmente | `fastify-app.ts:574-582` | 2 | 4 | 8 | MODERADO | Orden de `app.register` fijado por test de arquitectura (nuevo guard en M40) | M40 | colisión de rutas en arranque |
| R-10 | Regresión de headers/CORS por-ruta al adelgazar handlers | `cors-headers` importado por 30 archivos; variantes allow-null/block-null fijadas por tests | 3 | 4 | 12 | ALTO | No tocar helpers CORS en PRs de features; sólo delegación | M14+, M46 | diff en `cors-headers.ts` fuera de M46 |
| R-11 | Enumeración/filtración en errores de token al migrar accesos | contratos no-secrets / no-stack-traces existentes | 2 | 5 | 10 | ALTO | Moves sin re-redactar mensajes; contratos verdes | M33–M34 | diff en textos de error |
| R-12 | Test insuficiente en capa application nueva (mocks que ocultan fallos reales) | patrón stubs por Options ya validado | 3 | 3 | 9 | MODERADO | Fakes derivados de los mismos tipos `Options`; integración con app real por `createFastifyApp` | M11 | UC sin test de integración correlativo |
| R-13 | Conflicto con trabajo paralelo (frontend redesign, E2E, TEST-ARCH-15-b) | programas activos en docs/audit | 3 | 2 | 6 | MODERADO | 1 fase en vuelo a la vez; rebase corto; no tocar `test/` fuera de anclas propias | todos | rebase >2 días |
| R-14 | Rollback imposible por PRs entrelazados | — | 2 | 4 | 8 | MODERADO | Shims re-export documentados por move; revert independiente verificado en DoD | todos | revert de PR N exige revertir N-1 |
| R-15 | CI inestable / timeout (suite crece con UCs) | timeout 15 min en backend-ci | 2 | 3 | 6 | MODERADO | Vigilar duración; si >12 min, PR de CI dedicado (autorización R2) | M48 | job >15 min |

Riesgos por categoría exigidos: regresión (R-03, R-07, R-10) · contractual (R-03, R-09) · datos
(R-02, R-04) · seguridad (R-05, R-11) · multi-tenant (R-04) · despliegue (R-15; deploy no cambia:
mismo `dist/index.js`) · rollback (R-14) · observabilidad (logs `[API ERROR]` y request-id
preservados por invariante I-OP) · test insuficiente (R-12) · trabajo paralelo (R-13).

---

## 11. Invariant Catalog

Criticidad: C1 crítica · C2 alta · C3 media. "Prueba" = existente en HEAD; "Falta" = a crear en
el PR indicado.

### HTTP

| Invariante | Ubicación actual | Prueba existente | Falta | Crit | PR protector |
|---|---|---|---|---|---|
| Métodos+paths de 121 endpoints y 36 prefijos | `fastify-app.ts` + rutas | `api-contract-smoke`, contratos por-ruta, `security-critical-route-surface-registry` | snapshot de prefijos ante moves | C1 | cada thin-PR |
| Envelope de error `{success:false,error,details?,path,requestId}` + mapeo PG→400 | `fastify-app.ts:165-300` | `api-error-*` (content-type, no-secrets, no-stack), `api-request-id-observability` | — | C1 | M14+ |
| Orden de hooks (req-id→sec-headers→trusted-origin→version-gate; onSend no-store) | `fastify-app.ts:351-366` | `client-version-gate-contract`, `backend-api-no-store-cache-contract`, `security-trusted-origin-cors-boundaries` | — | C1 | ninguno lo toca |
| Doble registro `/api/reports` en orden reports→reports-status | `fastify-app.ts:574-582` | implícita (integración) | guard explícito de orden | C2 | M40 |
| Serialización (fechas ISO, nombres de campos) | mapping en `db-*` | contratos de serialización (`public-professionals-serialization-invariants`, etc.) | — | C1 | M12, M22, M26 |
| Paginación/defaults | `lib/list-pagination`, `features/logistics/domain/pagination` | `admin-heavy-list-pagination-contract`, `logistics-pagination` | — | C2 | moves de dominio |
| Idempotencia observable (lifecycle actions) | handlers | contratos por-ruta | test de doble-cancel | C2 | M08 |

### Base de datos

| Invariante | Ubicación | Prueba | Falta | Crit | PR |
|---|---|---|---|---|---|
| Schema intacto; migraciones 0000–0030 intactas | `drizzle/` | `migration-integrity`, `schema:verify` | — | C1 | todos (prohibición) |
| Límites de transacción exactos (11 call-sites) | `db.ts`, `db-logistics`, `db-admin-clinics` | integración logistics/clinics | diff-review 1:1 en moves | C1 | M12, M26 |
| Orden de escrituras en flujos críticos | `db-*` + rutas | `audit-critical-flow-writes` | — | C1 | fases G–I |
| Sin `db-*` importando otro `db-*` | verificado HEAD | — | guard explícito | C3 | M45 |

### Seguridad

| Invariante | Ubicación | Prueba | Falta | Crit | PR |
|---|---|---|---|---|---|
| Cookies (HttpOnly/Secure/SameSite/path/expiración) por realm | rutas auth (congeladas) | `security-session-cookie-boundaries`, `auth-session-boundaries` | — | C1 | fuera de programa (C4) |
| Hashing/comparación segura | `auth-security`, tokens libs | `auth-password-change`, suites de token | — | C1 | moves de token no tocan hashing |
| Rate limiting por realm aislado | `rate-limit-store` + wrappers | `security-rate-limit-cross-realm-isolation`, `security-rate-limit-isolation-boundaries` | — | C1 | M23, M34 |
| Aislamiento multi-tenant (sin RLS) | filtros en `db-*` | `security-cross-tenant-idor-contract`, `security-resource-ownership-boundaries` | casos por contexto migrado | C1 | DoD F–I |
| Sin disclosure en respuestas/logs | rutas + `audit-log` | `security-response-disclosure-*`, `security-sensitive-log-redaction-*`, `api-error-no-secrets` | — | C1 | todos |
| CSRF/trusted-origin en mutaciones | hook global + rutas | `security-csrf-mutating-route-coverage` | — | C1 | ninguno lo toca |
| Auditoría de escrituras con actor/tenant | `lib/audit*` + rutas | `security-write-attribution-boundaries`, contratos audit por-ruta | — | C1 | UCs preservan orden |
| Nombres `data-*` sin stems sensibles (superficie pública) | frontend/scripts | `security:public-surface` | — | C2 | n/a backend |

### Operación

| Invariante | Ubicación | Prueba | Falta | Crit | PR |
|---|---|---|---|---|---|
| `/health` + `/api/health` semántica y payload | `fastify-app` + `http-runtime` | integración app | — | C1 | fuera (ops) |
| Log crítico `[API ERROR]` con requestId | `setErrorHandler` | `api-request-id-observability-contract` | — | C2 | ninguno |
| runtime-timing y session-last-access por ruta | libs + rutas | 21+17 contratos por-ruta | — | C2 | thin-PRs alinean imports |
| Cache-Control (dev vs prod; no-store sensibles) | hook onSend | `backend-api-no-store-cache-contract` | — | C1 | ninguno |

### Integraciones

| Invariante | Ubicación | Prueba | Falta | Crit | PR |
|---|---|---|---|---|---|
| Email: destinatarios/momentos/plantillas (5 rutas) | `lib/email` + rutas | snapshot de contacto (`fastify-app-route-stubs`), contratos de workflow | tests de puerto en M31/M37 | C1 | M31, M37 |
| Transporter cacheado por host/port/user | `lib/email` | suites email (host único por test) | — | C3 | ninguno |
| Supabase storage: buckets/URLs/tokens | `lib/supabase` (8 consumidores) | `global-storage-report-safety-contract` | contrato de puerto storage | C1 | M37/M39 |
| Tokens: TTL/expiración/single-use por familia | libs de token | suites de token + edge | — | C1 | M30, M33, M34 |

---

## 12. Test Strategy

Matriz por capa (el runner es `node:test`; sin dependencias nuevas):

| Capa | Qué se exige | Patrón/ubicación | Regla anti-mock |
|---|---|---|---|
| Dominio | unitarias determinísticas, sin I/O; transiciones válidas/inválidas; casos límite | `test/unit/domain/<ctx>/` (patrón logistics existente) | ninguna: código puro |
| Aplicación | por caso de uso: orden de puertos, errores, idempotencia; fakes tipados | `test/unit/<ctx>/` nuevos; fakes derivados de los tipos `Options` | el mismo escenario debe existir como integración vía `createFastifyApp` |
| Infraestructura | integración Drizzle (CI tiene Postgres real + migraciones), mapping, constraints, tx | `test/integration/adapters/**` existentes | sin mock de Drizzle: DB real de CI |
| HTTP | contratos por-ruta: status, headers, cookies, errores, serialización | contratos audit/session-last-access/runtime-timing + `*.fastify.test.ts` | inyección sólo por `Options` |
| Seguridad | cross-tenant, roles, tokens, expiración, revocación, rate limits, enumeración, cache privada | `test/security/` + `test/architecture/security/` (26 archivos) verdes en TODO PR | prohibido debilitar asserts para pasar |
| Arquitectura | guards §13 | `test/architecture/` | actualización de anclas en el mismo PR, nunca borrado |

Property-based: no hay librería instalada; los generadores manuales del patrón actual son
suficientes — no agregar dependencia (restricción 12).

---

## 13. Architecture Guards

Existentes [CONFIRMED]: `logistics-domain-boundary-guard` (pureza + barrel),
`fastify-only-guardrail`, `tracked-source-inventory`, `toolchain-contract`,
`migration-integrity`, 17 guards de `architecture/security/`, censos de suites
(`*-suite-completeness`). Patrón: `node:test` + `readFileSync` + regex de import — sin deps.

Guards a incorporar (todos como extensión del patrón existente):

| Guard | Patrón prohibido | Excepciones | Ubicación | Introducción | PR |
|---|---|---|---|---|---|
| domain sin framework/IO (por contexto) | fastify, drizzle runtime, `db-*`, env, fs/http, supabase, `process.*`, `fetch(` | tipos de `drizzle/schema` | clonar `logistics-domain-boundary-guard` por contexto | con el primer move de cada dominio | M02b, M21, M25, M30, M36 |
| application sin `FastifyRequest/Reply` ni infra concreta | `from "fastify"`, `../db`, `db-*`, supabase, email | tipos puros | `<ctx>-application-boundary-guard` | con el primer UC | M06+ |
| routes sin reglas/queries inline (post-thin) | `drizzle-orm` imports en rutas migradas | — | guard por contexto | al cerrar cada fase | M17+ |
| features sin imports a internals de otra feature | `features/<a>/**` → `features/<b>/(domain|application|infrastructure)/` | barrel público | guard global | M45 (activo antes por contexto) | M45 |
| shared/lib sin depender de features | `server/lib/**` → `features/**` | — | guard global | M45 | M45 |
| sin ciclos (por resolución de imports relativos) | ciclo A→…→A | — | walker tipo `resolveRelativeTsSpecifier` ya escrito en el guard logistics | M45; por contexto desde M05 | M45 |
| sin archivos legacy tras closeout | path viejo presente tras cierre | shims documentados con fecha de expiración | censo por fase | cada cierre | M05, M17, M20… |
| orden de registro de prefijos | diff del orden en `fastify-app.ts` | — | snapshot del orden | M40 | M40 |

Mensaje de error esperado: el del patrón actual (`assert.deepEqual(violations, [])` con lista
`archivo: regla ("import")`). Falsos positivos: mismos escapes que el guard logistics (resolver
`.ts`/`index.ts`; ignorar comentarios no es necesario — precedente aceptado).

---

## 14. Rollback Strategy

| Categoría | Estrategia | Verificación |
|---|---|---|
| Move de archivo (domain/infra) | revert del PR; shim re-export temporal documentado hace el revert 1-commit | `pnpm validate:local` post-revert |
| Extracción de UC | revert del PR: el handler vuelve a su versión inline; Options intactas | contratos por-ruta |
| Thin-route | revert por módulo de ruta (cada thin-PR toca 1 módulo) | contrato de esa ruta |
| Guard nuevo | revert del test; nunca bloquea rollback de código | n/a |
| Docs | revert directo | n/a |
| Cierre de fase | los cierres no borran shims hasta verificar 1 ciclo de CI en main | censo de legacy |

Regla dura (DoD): **revert independiente** — si revertir el PR N exige revertir N−1, el PR N
estaba mal particionado (señal de stop §19). Deploy sin cambios: mismo artefacto
`dist/index.js`, mismas env vars; no hay PR del programa que toque bootstrap/deploy.

---

## 15. CI Strategy

CI actual (backend-ci): audit → migrate → typecheck ×2 → test → build, sobre Postgres real.
Suficiente para el programa; **no se modifican workflows** (R2; restricción del ADR).

| Tipo de PR | Debe pasar |
|---|---|
| docs-only (M01, cierres de docs) | CI se salta por `paths-ignore` (docs/** y *.md); `git diff --check` local |
| move de dominio | validate:local completo + guards del contexto + anclas alineadas |
| UC / application | validate:local + integración del módulo afectado |
| infra move (db-*) | validate:local (la integración corre contra Postgres de CI con migraciones) |
| thin-route | validate:local + contratos por-ruta del módulo + suite de seguridad |
| cierre de fase | validate:local + barrido de censos + evidencia en docs |

Local previo a push (protocolo del repo): `pnpm validate:local` como mínimo; con schema:
`pnpm validate:local:schema`. Nota operativa conocida: si se corrió E2E de frontend antes,
revertir `next-env.d.ts` antes de `pnpm test` (memoria del repo).

---

## 16. CODEOWNERS Strategy

Estado real: mantenedor único `@LABVETNEB`; el propio archivo declara que ownership
independiente "remains a future maturity step" [CONFIRMED]. Por lo tanto: **no hay PR de
CODEOWNERS por bounded context en este programa** (PR 106 removido). Recomendación de madurez
futura (fuera de alcance): cuando exista un segundo mantenedor, primeras entradas dedicadas =
`/server/features/reports/**`, `/server/lib/auth*`, `/server/middlewares/**`,
`/test/architecture/security/**` (superficies sensibles), manteniendo el fallback global.

---

## 17. Definition of Ready (por PR)

1. Fase previa cerrada (cierre mergeado y main verde).
2. Autorización de scope R2 explícita para los archivos del PR (protocolo `AGENTS.md`).
3. Matriz de anclas (M01) consultada: lista de tests que fijan los paths a tocar, adjunta al PR.
4. Contratos afectados enumerados (rutas, headers, side-effects) con su test correlativo.
5. Baseline capturado (`git status`, `log -1`, `diff --stat` limpios).
6. Para thin-PRs: el UC/repo destino ya mergeado (no se adelgaza contra código inexistente).
7. Para moves: shim de re-export decidido (sí/no) y documentado en la descripción.

## 18. Definition of Done (por PR y por fase)

Por PR (los 23 criterios del programa aplican; operacionalizados así):
`pnpm validate:local` verde (typecheck + typecheck:test + test + build) · `git diff --check`
limpio · alcance único y diff ≤ ~1k líneas efectivas salvo move-de-archivo · contratos
preservados (contract-tests intactos, sin asserts debilitados) · guards del contexto verdes y
extendidos si nace frontera · sin imports legacy nuevos · sin dependencia nueva · sin cambio de
schema/migraciones · rollback independiente verificado razonando el revert · evidencia
(comandos + resultados) en la descripción del PR · docs del contexto actualizadas en el mismo PR.

Por fase (cierre): censo de legacy = 0 (o shims con expiración documentada) · suite completa
verde · guard endurecido · sección de docs del contexto actualizada · anotación en este
documento (tabla §8) del estado real.

## 19. Stop Conditions

Detener el programa (no el PR: el programa) si:
1. Divergencia contractual no explicada (un contract-test cambia de resultado sin diff declarado).
2. Un flujo crítico queda sin prueba (p. ej. transición de workflow sin contrato tras un thin).
3. Se vuelve necesario un cambio de schema para continuar (REQUIRES_SCHEMA_DECISION → fuera).
4. Un revert independiente resulta imposible (R-14 materializado).
5. Ciclo de imports no resoluble sin re-diseño (C5 insuficiente).
6. Cualquier hallazgo de seguridad P0 durante un move (congelar y tratar por secuencia dedicada).
7. Evidencia cross-tenant insuficiente en fases F–I (IDOR test no cubre el contexto migrado).
8. Comportamiento actual desconocido: un handler contiene semántica no cubierta por tests y no
   reproducible localmente (documentar primero, mover después).
9. CI inestable (>2 corridas rojas no atribuibles al PR).
10. Conflicto con migración paralela activa (frontend redesign, TEST-ARCH-15-b) sobre los mismos
    archivos ancla.

## 20. Final Verdict

```text
PARTIALLY_APPROVED
```

- **Aprobado con correcciones:** Bloques 1, 2, 3 (Logistics), 5-parcial (Pricing), 6-parcial
  (Professionals), 7 (Clinics), 8 (Study Tracking/accesos), 9 (Reports), 10-parcial
  (Users/Roles), 11-parcial (redistribuido).
- **Rechazado como fue propuesto:** Bloque 4 en posición temprana (diferido a Fase K);
  Maintenance/Health como bounded context (PR 48–49); Auth como reorganización (PR 96–98 →
  secuencia de seguridad dedicada, fuera del programa); CODEOWNERS por contexto (PR 106);
  VOs/errores de dominio ceremoniales (PR 7).
- **Respuesta a la pregunta objetivo:** el programa corregido de 48 PR **sí** puede transformar
  el backend en un monolito modular empresarial sin alterar comportamiento productivo, sin
  debilitar seguridad y sin romper contratos — porque cada paso se apoya en la red existente de
  438 tests (contratos por-ruta + 26 suites de seguridad + guards de arquitectura), en el seam
  de inyección por `Options` ya operativo, y en el precedente Logistics ya validado. El programa
  original de 110 PR, ejecutado literalmente, habría fabricado capas vacías, movido superficies
  congeladas de seguridad y roto sistemáticamente los 188 tests ancla.
- **Primer bloque autorizado para ejecución:** Fase 0 (M01 docs + M02 huérfanos), seguida de
  Fase A — cada PR con autorización R2 individual previa.
