# LIMPIEZA TEST GLOBAL

## Auditoría global de caja blanca de la arquitectura de tests no-E2E — PORTAL-VETNEB

| Campo | Valor |
|---|---|
| Documento | LIMPIEZA TEST GLOBAL |
| Tipo | Auditoría técnica global de caja blanca del subsistema de tests no-E2E |
| Repositorio | PORTAL-VETNEB |
| Alcance | `test/**` (562 specs ejecutables). `frontend/e2e/**` sólo como frontera |
| Estado | ACTIVE |
| Propósito | Fuente rectora del programa de saneamiento `TEST-GLOBAL-*` |
| Implementación | NOT_STARTED — esta auditoría no implementa ninguna fase |

### Metadata de lifecycle

| Campo | Valor |
|---|---|
| Document owner | QA / Backend owner |
| Domain | Arquitectura de tests no-E2E: `test/**`, helpers, fixtures, factories, mocks, guards de arquitectura, CI backend |
| Lifecycle status | ACTIVE |
| Authoritative source role | Diagnóstico y roadmap del programa `TEST-GLOBAL-*`. No es el mapa operativo de CI (ese es [CI_PR_CHECKS_RUNBOOK.md](../ops/CI_PR_CHECKS_RUNBOOK.md)) ni la norma de organización física (esa es [test-suite-enterprise-organization-convention.md](../implementation/test-suite-enterprise-organization-convention.md)) |
| Effective date | 2026-09-21 |
| Last verified date | 2026-09-21 |
| Review cadence | Por fase `TEST-GLOBAL-*` cerrada |
| Supersedes | Ninguno. Reclasifica cifras de `TDR-002` y de `pr-test-architecture-consolidation-audit.md` como históricas (§33) |
| Superseded by | Ninguno |
| Related controls or gaps | `TDR-002`; `ERM-CTRL-011`; `ERM-CTRL-012`; `ERM-CTRL-025`; `ERM-QLT-001` |
| Evidence or approval reference | Auditoría R0 ejecutada sobre `main@ee8e7425f911b4b49848957bff52242aa95158e2` el 2026-09-21 |

> **Vigencia de las cifras.** Todas las cifras de este documento se midieron sobre
> `main@ee8e7425` el 2026-09-21 con los comandos del [Anexo A](#anexo-a--censos-reproducibles).
> Ninguna cifra proviene de auditorías anteriores. Las cifras de `TDR-002`
> (367/514) y de la consolidación de 2026-07-30 (517 archivos / 4.019 tests /
> `ACCIDENTAL_COUPLING = 0`) son **históricas** y se tratan en §33.

---

## 1. Metadata y lifecycle

Ver encabezado. El programa se nombra `LIMPIEZA TEST GLOBAL` y sus fases
`TEST-GLOBAL-01 … TEST-GLOBAL-13`. El documento es rector: cualquier fase que
altere el diagnóstico actualiza este archivo en el mismo PR.

## 2. Naturaleza del programa

`LIMPIEZA TEST GLOBAL` **NO** es:

- una reducción de LOC ni de número de tests;
- una campaña contra los guards basados en source;
- una migración de `test/**` a Playwright;
- una carrera por porcentaje de coverage;
- una reorganización de carpetas.

**ES** un programa transversal para alcanzar un estado en el que cada test
proteja un contrato identificado, en la capa correcta, con el mínimo
acoplamiento necesario y con **poder de detección demostrado** sobre la
regresión que dice proteger.

Frontera con `LIMPIEZA E2E` (CLOSED, verificado 2026-09-21): `frontend/e2e/**`
queda **fuera** del objeto de limpieza. Se consulta sólo para detectar
duplicación y huecos de frontera. Este programa **no reabre** `LIMPIEZA E2E`.

## 3. Baseline reproducible

```text
branch                main
HEAD                  ee8e7425f911b4b49848957bff52242aa95158e2
HEAD -1               docs(e2e): close cleanup program (#1758)   2026-09-21 15:36:24 -0300
working tree          limpio (diff vacío)
untracked             frontend/AGENTS.md, frontend/CLAUDE.md  (generados por `next dev`,
                      no tracked, no contractuales — preservados, no tocados)
stashes               5 preservados (stash@{0}…stash@{4})
AGENTS.md tracked     sólo la raíz. No existen AGENTS.md anidados tracked.
CI en el baseline     Backend CI = success @ ee8e7425 (ubuntu-latest)
```

Ejecución local de referencia (win32, Node v24.14.1):

```text
pnpm test   → tests 4590 | pass 4580 | fail 9 | skipped 1 | wall 26,4 s
```

Los 9 FAILED son **variancia de plataforma**, no regresión: Backend CI está en
`success` sobre el mismo SHA. Se analizan en §14 y §29.

## 4. Metodología

1. Lectura completa de `AGENTS.md` raíz y búsqueda de anidados tracked (`git ls-files`).
2. Captura de baseline (§3) antes de cualquier análisis.
3. Censo físico por `git ls-files` + `wc -l` (nunca por documentación).
4. Clasificación semántica **por lo que el test hace**, no por su carpeta:
   detección de `node:fs`, de imports estáticos y dinámicos a runtime, de
   `app.inject()`, de walkers de árbol y de parseo de configuración.
5. Clasificación de acoplamiento **por poder del oracle**, no por presencia de
   `node:fs` (§7).
6. Verificación empírica: ejecución R0 de la suite completa y de cohortes
   dirigidas; lectura de código fuente para adjudicar casos concretos.
7. Calibración explícita del clasificador heurístico contra lectura manual, con
   tasa de falsos positivos declarada (§7.4).

Principio aplicado en todo el documento:

```text
node:fs encontrado   ≠   ACCIDENTAL_COUPLING
mock encontrado      ≠   mal test
duplicación textual  ≠   redundancia semántica
verde                ≠   protegido
```

## 5. Skills utilizadas

| Skill | Disponible | Cargada | Uso concreto |
|---|---|---|---|
| `vetneb-briefing-planificacion-diseno-desarrollo-pruebas` | SÍ | SÍ | Estructura de fases, scope/no-scope, criterios de aceptación y anti-deriva del roadmap §31 |
| `vetneb-staff-senior-full-stack-engineer` | SÍ | NO | No cargada: el análisis de fronteras arquitectónicas se resolvió por lectura directa de `server/routes/**`, `test/integration/**` y `eslint.config.mjs`. Se declara para no atribuir uso inexistente |
| `vetneb-production-web-optimization-engineer` | SÍ | NO | No cargada. El Pareto de performance (§25) se midió directamente del reporter TAP; la conclusión fue que **no hay problema de performance**, por lo que no se requirió guía de optimización |
| `vetneb-web-end-to-end-global` | SÍ | NO | No cargada. La frontera con `LIMPIEZA E2E` se resolvió leyendo el documento cerrado y el catálogo |
| `vetneb-security-production-invariants` | SÍ | NO | No cargada. Los invariantes de §23 se derivaron de `AGENTS.md` §9 y de la lectura directa de `test/architecture/security/**` y `test/security/**` |
| `vetneb-bugs-errores-optimizacion-rutas` | SÍ | NO | Condicional; no aplicó: la auditoría no entró en diagnóstico de rutas ni de errores HTTP productivos |
| `vetneb-lanzamiento-mantenimiento` | SÍ | NO | Condicional; no aplicó en R0. Relevante para `TEST-GLOBAL-12/13` |
| `senior-large-scale-codebase-analysis-vetneb` | **NOT_AVAILABLE** | — | Verificado contra el registro de skills de la sesión. El censo masivo se realizó con `git ls-files`, `grep`, y tres scripts Node ad hoc reproducibles (Anexo A) |

Declaración explícita: **no se cargó ninguna skill que no figure como "Cargada: SÍ"**.
La auditoría se sostiene en evidencia ejecutable, no en la skill.

## 6. Inventario físico

### 6.1 Volumen

| Métrica | Valor |
|---|---:|
| Archivos tracked bajo `test/**` | 576 |
| Specs ejecutables `*.test.ts` | **562** |
| Archivos de soporte (helpers/fixtures/factories/mocks/tsconfig/README) | 14 |
| Casos `test(` de primer nivel | **4.530** |
| Entradas reportadas por el runner (incluye anidados y file-level) | 4.590 |
| Assertions `assert.*` | **20.623** |
| LOC tracked bajo `test/**` | **156.887** |
| Specs en `test/` raíz | **0** (contrato preservado) |
| `.only(` | **0** |
| `describe(` | **0** (convención: `test()` plano) |
| Tests skipped | 1 (symlink no privilegiado en Windows, skip condicional legítimo) |

La diferencia 4.530 vs 4.590 es el conteo estático de `^\s*test\(` frente al
conteo del runner, que añade entradas de nivel archivo para los archivos que
fallan y subtests anidados. Ambas cifras son correctas en su propio criterio.

### 6.2 Distribución por carpeta

| Carpeta | Archivos | LOC |
|---|---:|---:|
| `test/unit/ui` | 163 | 29.907 |
| `test/architecture` (raíz) | 78 | — |
| `test/unit/infrastructure` | 93 | 22.905 |
| `test/unit/contracts` | 68 | 6.784 |
| `test/integration/adapters` | 56 | — |
| `test/unit/application` | 33 | 8.072 |
| `test/unit/domain` | 27 | 4.767 |
| `test/architecture/security` | 17 | — |
| `test/security` | 10 | 4.552 |
| `test/unit/migrations` | 8 | 1.120 |
| `test/unit/clinics` | 4 | 1.808 |
| `test/integration/app` | 2 | — |
| `test/unit/pricing` | 2 | 272 |
| `test/architecture/database` | 1 | — |
| **Totales por familia** | `architecture` 96 / 39.559 · `integration` 58 / 34.743 · `unit` 398 · `security` 10 | |

### 6.3 Ratio test : producción

| Cuerpo | Archivos | LOC |
|---|---:|---:|
| `server/**` | 226 | 46.081 |
| `frontend/src/**` | 200 | 43.276 |
| `shared/` + `drizzle/` + `scripts/**` | 33 | 9.822 |
| **Producción total** | **459** | **99.179** |
| `test/**` | 574 (TS) | **156.700** |
| `frontend/e2e/**` | 123 | 43.756 |
| **Test total** | **697** | **200.456** |

```text
test/**  :  server/**          =  3,40 : 1
test total : producción total  =  2,02 : 1
```

Este ratio es el dato central de mantenibilidad (§27, §37).

### 6.4 Soporte compartido

| Archivo | LOC | Importadores |
|---|---:|---:|
| `test/helpers/fastify-app-route-stubs.ts` | 762 | 2 |
| `test/fixtures/dashboard-operational-contract.ts` | 552 | 1 |
| `test/helpers/clean7a-dependency-cleanup-scope.ts` | 260 | 11 |
| `test/helpers/api-request-id-contract.ts` | 199 | 6 |
| `test/helpers/tracked-source-files.ts` | 128 | **9** |
| `test/mocks/public-professionals-route.ts` | 69 | 9 |
| `test/helpers/dashboard-scope-guard.ts` | 62 | 8 |
| `test/helpers/read-dashboard-css-source.ts` | 61 | 9 |
| `test/factories/public-professionals.ts` | 49 | 9 |
| `test/factories/report-access.ts` | 42 | 4 |
| `test/helpers/report-foreign-access-scope.ts` | 26 | 8 |
| `test/fixtures/report-access.ts` | 1 | 2 |

**12 archivos de soporte compartido para 562 specs.** El helper canónico de
censo (`tracked-source-files.ts`) tiene **9 importadores** mientras **410
archivos** leen el filesystem por su cuenta (§13.1).

## 7. Source coupling — auditoría profunda

### 7.1 Censo bruto

| Señal | Archivos |
|---|---:|
| Importa `node:fs` | **410 / 562 (73,0 %)** |
| `readFileSync` | 406 |
| `existsSync` | 104 |
| `readdirSync` | 82 |
| `node:child_process` | 25 |
| `statSync` | 20 |
| `js-yaml` | 8 |
| `createRequire` / `node:module` | 8 |

### 7.2 Cruce con ejecución de runtime

| Bucket | Archivos | % |
|---|---:|---:|
| Lee filesystem y **nunca** ejecuta runtime | 351 | 62,5 % |
| Ejecuta runtime y **no** lee filesystem | 89 | 15,8 % |
| Ambos (`MIXED` estructural) | 59 | 10,5 % |
| Ninguno — `await import()` dinámico (integración Fastify) | 61 | 10,9 % |
| Resto | 2 | 0,4 % |

### 7.3 Clasificación por poder del oracle

Criterio declarado (distinto del criterio de 2026-07-30, ver §33):
se clasifica por **qué prueba la assertion**, no por si el archivo es un guard.

| Clase | Archivos | Tests |
|---|---:|---:|
| `RUNTIME_BEHAVIOURAL` | 151 | 1.333 |
| `ACCIDENTAL_COUPLING_CAND` | **137** | **1.042** |
| `LEGITIMATE_GUARD` | 95 | 816 |
| `MIXED` | 87 | 817 |
| `LEGITIMATE_STATIC_CONTRACT` | 90 | 514 |
| `UNKNOWN_REQUIRES_REVIEW` | 2 | 8 |
| **Total** | **562** | **4.530** |

Concentración del pool `ACCIDENTAL_COUPLING_CAND`:

| Carpeta | Archivos candidatos |
|---|---:|
| `test/unit/ui/frontend` | 39 |
| `test/unit/ui/public` | 29 |
| `test/unit/ui/dashboard` | 28 |
| `test/unit/ui/admin` | 26 |
| **Subtotal `test/unit/ui/**`** | **122 (89 %)** |
| Resto (architecture, contracts, infrastructure) | 15 |

**El 89 % del acoplamiento accidental candidato vive en una sola carpeta.**
Ése es el Pareto del programa.

### 7.4 Calibración honesta del clasificador

El clasificador es heurístico. Se calibró leyendo manualmente los 15 candidatos
**fuera** de `test/unit/ui/**`; al menos 2 son falsos positivos claros:

- `test/architecture/database/reconcile-public-profile-db-contract.test.ts`
  asserta sobre el **texto de un script SQL**, que es el entregable. Sin DB no
  hay runtime que ejecutar → `LEGITIMATE_STATIC_CONTRACT`.
- `test/unit/infrastructure/auth-security-rehash-policy.test.ts` incluye una
  assertion **negativa** real (`source.includes("argon2.needsRehash(storedHash))") === false`)
  que prueba la ausencia de la variante insegura → `MIXED` defendible.

Por tanto:

```text
ACCIDENTAL_COUPLING_CANDIDATE   = 137 archivos / 1.042 tests   (pool a adjudicar)
ACCIDENTAL_COUPLING_CONFIRMADO  = 3 archivos                   (verificados a mano, §10.3)
```

**No se declara deuda confirmada sin lectura manual.** La adjudicación del pool
es el objeto de `TEST-GLOBAL-06`, no de esta auditoría.

### 7.5 Guards legítimos que deben preservarse

Ejemplo canónico, `test/unit/ui/frontend/frontend-native-link-preview-contract.test.ts`:

```text
NEXT_LINK_IMPORTS = 0 · LINK_TAGS = 0 · ANCHOR_HITS = 0 · IFRAME_HITS = 1 (sólo Footer)
```

Auto-discovery por walker sobre `frontend/src/**`, fail-closed: un archivo nuevo
con `<a>` rompe el guard. El source **es** el contrato (`AGENTS.md` §10). Este
guard **no se toca**.

Fragilidad acotada del mismo guard: `/<a\b/` sobre el archivo completo también
matchea comentarios y strings (falso rojo) y no detecta
`React.createElement("a", …)` ni `dangerouslySetInnerHTML` (falso negativo). Es
el patrón §19 "sólo funciona mientras la violación use una grafía exacta".
Mejora candidata, no retiro.

## 8. Assertions

| Forma | Ocurrencias |
|---|---:|
| `assert.ok(` | 8.629 |
| `assert.equal(` | 7.960 |
| `assert.deepEqual(` | 1.799 |
| `assert.match(` | 1.459 |
| `assert.doesNotMatch(` | 260 |
| `assert.notEqual(` | 240 |
| `assert.strictEqual(` | 99 |
| `assert.rejects(` | 85 |
| `assert.throws(` | 53 |
| `assert.fail(` | 19 |
| `assert.doesNotThrow(` | 12 |
| **Total** | **20.623** |

Densidad media: **4,55 assertions por test**.

### 8.1 Tests sin oracle útil

```text
Archivos con CERO assert.*   = 0
```

No existe un solo spec sin assertions. Los 21 archivos con densidad aparente
`< 1 assert/test` usan **wrappers de assertion** (`assertContains`,
`assertNotContains`, `assertHasText`) y sí asertan. **No son deuda** — se
verificó por lectura. Esta corrección es deliberada: una heurística de conteo
los habría marcado como falsos hallazgos.

### 8.2 Oracle débil: substring

| Forma | Ocurrencias |
|---|---:|
| `assert.ok(x.includes(…))` | 6.262 |
| `assert.equal(x.includes(…), true\|false)` | 1.522 |
| **Total substring** | **7.784 (37,8 % de todas las assertions)** |

**157 archivos / 1.264 tests** tienen ≥ 80 % de sus assertions en forma
`.includes()` **y** no ejercitan runtime alguno.

### 8.3 Sobre-especificación

`test/unit/ui/frontend/frontend-report-actions.test.ts` (45 tests, 225/243
assertions son `.includes()`) asserta el **texto exacto de sentencias import**,
incluido el orden de los named imports:

```ts
assert.ok(source.includes('import { FormEvent, useEffect, useId, useRef, useState } from "react";'));
```

Reordenar esos named imports —operación no-op que cualquier autofix realiza— o
añadir `useMemo` pone el test en rojo sin que cambie comportamiento alguno.
`OVER_SPECIFICATION` confirmada.

## 9. Test oracles

### 9.1 Oracle circular confirmado — `CROSS_TENANT_IDOR`

`test/architecture/security/security-cross-tenant-idor-contract.test.ts`
declara **en el propio archivo de test** un array literal
`CROSS_TENANT_IDOR_CONTRACTS` con 18 entradas, y después asserta propiedades
**de ese mismo literal**:

```ts
assert.deepEqual(ids, uniqueValues(ids));                    // el literal tiene ids únicos
assert.match(contract.protectedSurface, /^server\/…\.ts$/);  // un string que el test escribió
assert.equal(expectedFailure.noDisclosure, true);            // un `true` que el test escribió
assert.equal(evidenceLine.trim().length >= 20, true);        // longitud de prosa
```

```text
implementación  →  el test NO la toca
                →  el test asserta su propia constante
                →  verde perpetuo
```

De los 18 contratos, sólo **3** (Clinics, Study Tracking, Token Access)
dereferencian su `requiredTestEvidence` con `readSource()`. Los **15 restantes
no verifican nada de producción**. Si mañana se retira el scoping por
`clinicId` de `server/routes/reports.fastify.ts`, los 9 tests siguen en verde.

Evidencia de ejecución: los 134 tests de `test/architecture/security/**`
completan en **299 ms**, coherente con no ejercitar runtime.

El propio archivo es honesto sobre su naturaleza
(`productionReadinessStatus: "pending_runtime_staging_evidence"`): es un
**registro de evidencia pendiente**, no una prueba. El defecto no es que exista
—es útil como ledger— sino que **está ubicado y nombrado como contrato de
seguridad ejecutable** en `test/architecture/security/`, donde un lector
razonable concluye que el IDOR está probado.

### 9.2 Referencias de evidencia stale

11 de las rutas listadas en `requiredTestEvidence` **no existen**: quedaron en
la forma raíz previa a la reorganización física de la suite.

```text
test/reports.fastify.test.ts              test/study-tracking.fastify.test.ts
test/clinic-audit.fastify.test.ts         test/particular-auth.fastify.test.ts
test/particular-tokens.fastify.test.ts    test/report-access-tokens.fastify.test.ts
test/reports-status.fastify.test.ts       test/public-report-access.fastify.test.ts
test/admin-study-tracking.fastify.test.ts test/supabase-storage-boundaries.test.ts
test/supabase-upload-success.test.ts
```

Como nada las dereferencia, **nada detecta que están rotas**. `STALE_GUARD`
silencioso sobre la superficie de aislamiento tenant. Ésta es la razón por la
que el hallazgo es P0 y no P2: no es documentación desactualizada, es un control
de seguridad que se presenta como verificado y no verifica.

### 9.3 Censo repo-wide de referencias a paths

| Métrica | Valor |
|---|---:|
| Referencias literales a paths del repo desde `test/**` | 3.229 |
| Paths únicos referenciados | 732 |
| Paths únicos **inexistentes** | 109 |

De esos 109, la mayoría son legítimos: assertions de **ausencia** (guards de
retiro de shims: `server/db-logistics.ts`, `server/db-study-tracking.ts`, …) e
**inputs sintéticos** a clasificadores puros (`docs/example.md`,
`server/__wbr04a_probe_*.ts`). Se verificó empíricamente: la suite pasa, luego
ninguno de esos paths se está leyendo. El subconjunto peligroso es el de §9.2:
paths dentro de **estructuras de datos que nadie dereferencia**.

## 10. Falsos verdes y falsos rojos

### 10.1 Falso verde demostrado

`test/unit/ui/dashboard/frontend-dashboard-empty-states.test.ts`, test
*"clinic command center distinguishes recent list load failures from empty states"*:

```ts
assert.ok(source.includes("statsLoadError ?"));
assert.ok(source.includes('role="alert"'));
assert.ok(source.includes("No se pudieron cargar las métricas operativas. Intente nuevamente."));
```

Fuente real (`ClinicCommandCenter.tsx:136`):

```tsx
{statsLoadError ? (<div role="alert" …>…</div>) : null}
```

**Mutación que escapa**: invertir la condición a `{!statsLoadError ? …}`.
`.includes("statsLoadError ?")` sigue siendo verdadero porque
`"!statsLoadError ?"` **contiene** `"statsLoadError ?"`. El resultado sería
mostrar la alerta de error exactamente cuando **no** hay error, y los tres
asserts pasan. Las tres assertions además son independientes: nada ata el
mensaje al elemento `role="alert"` ni a la condición.

`FALSE_GREEN` confirmado, con mutación concreta identificada.

### 10.2 Falso rojo confirmado — 9 tests en win32

| | |
|---|---|
| Archivos | `test/unit/infrastructure/e2e-completeness-workflow.test.ts`, `test/unit/infrastructure/frontend-playwright-production-runner.test.ts`, `test/integration/app/e2e-global-03b-authoritative-auth-boundary.fastify.test.ts` |
| Causa | El guard resuelve el `webServer` real importando `frontend/playwright.config.ts`, que delega en `e2e/helpers/playwright-webserver-launcher.mjs`. El launcher resuelve distinto en win32 |
| Síntoma | `selected: node e2e/helpers/playwright-webserver-launcher.mjs application` en vez de `next start` |
| Evidencia | Backend CI = `success` @ `ee8e7425` (ubuntu). Local win32 = 9 FAILED |
| Clase | `PLATFORM_VARIANCE` → `FALSE_RED` |

Impacto real: `AGENTS.md` §1 fija el entorno del proyecto como **Windows +
PowerShell**, y §6 exige `pnpm validate:local` como gate. Con 9 rojos
permanentes, `pnpm validate:local` **nunca** puede reportar PASSED en la máquina
del owner. Un gate que siempre falla deja de ser señal: entrena a ignorar el
rojo y oculta regresiones reales detrás del ruido conocido. Por eso es P1 y no
P3, aunque CI esté verde.

## 11. Mutation strength / negative proof

| Patrón | Archivos |
|---|---:|
| Harness de mutación en memoria (`source.replace(...)` → evaluador → assert falla) | **9** |
| Tests nombrados con semántica fail-closed / mutation | 130 (16 archivos) |
| `assert.rejects(` | 46 |
| `assert.throws(` | 22 |
| `assert.doesNotMatch(` | 90 |
| `assert.equal(x, false)` | 267 |

Los 9 archivos con harness de mutación real:

```text
test/architecture/dashboard-b04-surface-token-migration.test.ts
test/architecture/dashboard-b05-surface-inversion.test.ts
test/architecture/dashboard-b09-mobile-navigation-unification.test.ts
test/architecture/dashboard-foundation-tokens.test.ts
test/architecture/database/reconcile-public-profile-db-contract.test.ts
test/architecture/e2e-mock-backend-contract.test.ts
test/unit/infrastructure/e2e-completeness-workflow.test.ts
test/unit/infrastructure/visual-production-candidate-contract.test.ts
test/unit/infrastructure/visual-regression-workflow-catalog.test.ts
```

**Hallazgo estructural.** La disciplina de prueba negativa existe y es de buena
calidad, pero vive casi exclusivamente en los guards de **E2E/CI/governance** —
los construidos durante `LIMPIEZA E2E`. **Cero** de esos 9 archivos está en
`test/architecture/security/**`.

```text
LIMPIEZA E2E subió el estándar de prueba negativa en la superficie E2E/CI.
Ese estándar nunca se aplicó a la superficie de seguridad ni a la de UI.
```

Ése es el enunciado central de este programa.

### 11.1 Clasificación de contratos críticos

| Contrato | Clase | Evidencia |
|---|---|---|
| Rate limit cross-realm | `NEGATIVE_FIXTURE_PRESENT` | `test/security/security-rate-limit-cross-realm-isolation.test.ts`, 17 `inject`, 44 assertions de 429 |
| CSRF en rutas mutantes | `NEGATIVE_FIXTURE_PRESENT` | `test/security/security-csrf-mutating-route-coverage.test.ts`, 17 tests, 8 `inject` |
| Trusted origin / CORS | `NEGATIVE_FIXTURE_PRESENT` | `test/security/security-trusted-origin-cors-boundaries.test.ts`, 6 `inject` |
| Sesión y cookies (comportamiento) | `NEGATIVE_FIXTURE_PRESENT` | `test/security/auth-session-boundaries.test.ts`, 15 `inject` |
| Enumeración de tokens | `NEGATIVE_FIXTURE_PRESENT` | `test/security/token-access-enumeration-disclosure-regression.test.ts`, 7 `inject` |
| **Tenant isolation / IDOR** | **`NO_NEGATIVE_PROOF`** | §9.1 — oracle circular, 15/18 contratos sin verificación |
| **Invariantes productivas de seguridad** | **`NO_NEGATIVE_PROOF`** | `security-production-invariants.test.ts` — presencia de substring en `server/lib/env.ts`; no prueba que el valor se aplique |
| Ownership de recursos | `MUTATION_CANDIDATE` | `security-resource-ownership-boundaries.test.ts`, fs=1 rt=0 |
| Redacción de logs sensibles | `MUTATION_CANDIDATE` | `security-sensitive-log-redaction-boundaries.test.ts`, 18 tests, fs=1 rt=0 |
| Cut-off de validación | `MUTATION_CANDIDATE` | `security-validation-cutoff-boundaries.test.ts`, 13 tests, fs=1 rt=0 |
| Workflow security policy | `FAIL_CLOSED_GUARD` + `MUTATION_PROOF_PRESENT` | `e2e-completeness-workflow.test.ts` |

Ejemplo de por qué "presencia" no es prueba: el guard de invariantes productivas
asserta `source.includes('cookieSecure: nodeEnv === "production"')`. Eso es
cierto aunque esa línea esté en una rama muerta, aunque una asignación posterior
la sobrescriba, o aunque esté comentada. Y es **falso** si alguien refactoriza a
`cookieSecure: isProd` sin cambiar comportamiento. Falla en las dos direcciones.

### 11.2 Estrategia posterior

`TEST-GLOBAL-12` **no** introduce Stryker ni mutation testing indiscriminado.
Propaga el harness en memoria que ya existe y funciona (9 archivos), en este
orden: (1) tenant isolation/IDOR, (2) auth y sesiones, (3) permisos y roles,
(4) redacción y disclosure, (5) rate limiting, (6) registries de governance.

## 12. Fixtures, factories, mocks y helpers

### 12.1 Mapa `TEST → DOUBLE → PRODUCT BOUNDARY`

| Double | Frontera de producto | Consumidores |
|---|---|---:|
| `mocks/public-professionals-route.ts` | Ruta pública de profesionales | 9 |
| `factories/public-professionals.ts` | Datos de profesionales | 9 |
| `factories/report-access.ts` | Tokens de acceso a informes | 4 |
| `fixtures/report-access.ts` | Fixture inmutable de report access | 2 |
| `fixtures/dashboard-operational-contract.ts` | Contrato operativo dashboard | **1** |
| `helpers/fastify-app-route-stubs.ts` | Stubs de rutas Fastify (762 LOC) | **2** |

Dos artefactos de gran tamaño con 1–2 consumidores (`fastify-app-route-stubs`,
`dashboard-operational-contract`) → candidatos a **sobre-especialización**:
coste de helper compartido sin beneficio de reutilización.

### 12.2 Ausencia total de framework de dobles

```text
mock.fn / mock.method / mock.module / mock.timers   →   0 archivos
```

No se usa la API de dobles de `node:test` en ningún lugar. Todos los dobles son
objetos literales escritos a mano. No es un defecto per se —es consistente— pero
significa que **no hay verificación automática de aridad, de llamadas ni de
contrato** en ningún doble.

### 12.3 Riesgo de `MOCK_DRIFT` cuantificado

| Escape de tipos | Ocurrencias | Archivos |
|---|---:|---:|
| `as any` | **659** | 64 |
| `as unknown as` | 4 | 3 |
| `: any` | 8 | 7 |
| `@ts-expect-error` / `@ts-ignore` | **0** | 0 |

Concentración:

| Contexto | Ocurrencias |
|---|---:|
| `ENV.smtp as any` | 140 |
| `ENV.gmailApi as any` | 121 |
| `supabase.storage as any` | 63 |
| `ENV as any` | 43 |
| `nodemailer as any` | 36 |
| `globalThis as any` | 22 |
| `req` / `res` / `reply as any` | 47 |
| `clinicAuthNativeRoutes as any` | 9 |

Lectura correcta del dato: `tsconfig.json` tiene `strict: true`, pero los 659
escapes están **exactamente en la costura test↔runtime**, que es donde el tipado
serviría para detectar drift. Si una ruta Fastify añade una dependencia
requerida, el registro `app.register(clinicAuthNativeRoutes as any, {…})` no da
error de compilación y la ruta recibe `undefined`.

**Atribución justa**: la mayor parte de estos escapes **no es deuda de test**.
`ENV.smtp`, `nodemailer`, `supabase.storage` y `globalThis.fetch` se parchean
porque la infraestructura de email/storage **no está inyectada por dependencias**
—al contrario que las rutas, que sí lo están. Es `PRODUCT_TESTABILITY_DEBT`
(§27), y su corrección pertenece a producto, no a `test/**`.

### 12.4 Calidad de la restauración

Los parches de singletons **sí** se restauran, y en `try/finally`
(`email-gmail-api`, `email-html-templates`, `email-safe-metadata`,
`email-success`, `logger-and-email`). Disciplina correcta. No es hallazgo.

## 13. Determinismo

| Señal | Archivos |
|---|---:|
| `Date.now()` / `new Date()` | 22 |
| `node:child_process` | 25 |
| Mutación de `process.env` | 11 |
| `setTimeout` / `setInterval` / `mock.timers` | 7 |
| `Math.random` / `randomUUID` | 4 |
| `before` / `beforeEach` / `after` / `afterEach` | 4 |

| Clase | Valoración |
|---|---|
| `DETERMINISTIC` | Mayoría de la suite. Superficie de no-determinismo notablemente pequeña para 4.530 tests |
| `CONTROLLED_NONDETERMINISM` | Parches de `globalThis.fetch` y singletons, restaurados en `finally` (§12.4) |
| `ORDER_DEPENDENT` | 8 de 11 archivos que mutan `process.env` no restauran. **Contenido a intra-archivo** (§13.2) |
| `PLATFORM_DEPENDENT` | 9 tests (§10.2) + 1 skip condicional por symlink en Windows |
| `UNCONTROLLED_NONDETERMINISM` | **No identificado** |
| `ENVIRONMENT_DEPENDENT` | `pnpm test` local requiere DB desde #1711 para `validate:local`; en CI hay servicio Postgres |

### 13.1 Duplicación de lectores de source

| Definición local | Archivos |
|---|---:|
| `function read(` | 216 |
| `function readSource(` | 65 |
| `function walk(` | 18 |
| `function collectFiles(` | 4 |
| `function listFiles(` / `collectSourceFiles(` | 4 |
| **Archivos con lector propio** | **283** |

Frente a **9 importadores** del helper canónico `tracked-source-files.ts`.
`DUPLICATE_SOURCE_OF_TRUTH` de la operación más repetida de la suite.

Consecuencia medible: 295 archivos normalizan CRLF a mano
(`.replace(/\r\n/g, "\n")`) y **36 archivos que leen filesystem no lo hacen**.
Dado que `.gitattributes` fuerza `eol=lf` para `*.ts/js/mjs/json/yml/md/sql`, la
normalización es mayormente redundante; pero la inconsistencia es real y para
`*.ps1`/`*.bat` (`eol=crlf`) sí puede importar.

### 13.2 Aislamiento — fortaleza estructural

`node --test` ejecuta **cada archivo de test en su propio proceso hijo**. Por
construcción:

```text
fuga de estado entre archivos   =  imposible
module cache compartida         =  no existe entre archivos
env mutado en A afecta a B      =  no
```

El riesgo de `process.env` sin restaurar queda **acotado a orden intra-archivo**.
Es una fortaleza real de la arquitectura actual y debe declararse como tal: no
hay que "arreglar" el aislamiento entre archivos porque ya es correcto.

## 14. Unit tests

`test/unit/**` = 398 archivos, pero su contenido no es homogéneo:

| Subcarpeta | Naturaleza real | Valoración |
|---|---|---|
| `unit/domain` (27) | **3 %** toca filesystem. Tests de dominio puros | **Modelo a seguir** |
| `unit/clinics` (4), `unit/pricing` (2) | 0 % filesystem, conductuales | Sanos; fuera del árbol canónico documentado (§21) |
| `unit/application` (33) | 48 % filesystem; 14 de logística son `MIXED` | Revisable |
| `unit/infrastructure` (93) | 64 % filesystem; mezcla conductual real (email, storage) con contratos de workflow/CI | Heterogénea: dos poblaciones distintas bajo un nombre |
| `unit/contracts` (68) | 80 % filesystem. Contratos estáticos | Mayormente legítimo |
| `unit/migrations` (8) | 100 % filesystem, inspección de SQL | Legítimo, pero ver §20 |
| `unit/ui` (163) | **96 %** filesystem, 122 candidatos a acoplamiento accidental | **Foco del programa** |

`unit/infrastructure` es el caso más claro de nombre que no describe el
contenido: contiene tanto adaptadores reales (SMTP, Supabase, argon2) como
guards de workflows de GitHub Actions. Son dos responsabilidades distintas.

## 15. Integration tests

58 archivos, 590 tests. **Calidad alta y arquitectura correcta.**

Patrón verificado en `test/integration/adapters/controllers/auth.fastify.test.ts`:

```ts
await app.register(clinicAuthNativeRoutes as any, {
  prefix: "/api/auth",
  getClinicUserByUsername: async () => null,
  hashSessionToken: (token: string) => `hash:${token}`,
  …
});
```

La ruta declara sus dependencias como **puertos** (opciones del plugin) y el
test inyecta fakes. Se ejercita Fastify real, routing real, middlewares reales,
validación real; sólo la persistencia es falsa. Es testing hexagonal correcto, y
es fruto directo del programa de modularización M33–M48.

Precisión sobre el etiquetado: 52 de 56 en `integration/adapters/controllers`
son efectivamente `INTEGRATION_CONTROLLER`; **4 son estáticos** y están mal
ubicados. Y 8 archivos de `test/security/` son en realidad integración por
comportamiento (`app.inject()`), correctamente escritos aunque clasificados
por dominio y no por capa.

Riesgo asociado: el `as any` del registro (§12.3) anula la única verificación
automática del contrato de puertos.

## 16. Architecture guards

96 archivos, subsistema propio. 93 de 96 leen filesystem — **correcto por
diseño**: el árbol es el objeto del contrato.

Evaluación contra el estándar enterprise de §19 del prompt:

| Propiedad | Estado |
|---|---|
| `NEW_VIOLATION → FAIL` | Cumplido en los guards con walker (auto-discovery) |
| `STALE_EXCEPTION → FAIL` | **Incumplido** en los registries no dereferenciados (§9.2) |
| `UNSUPPORTED_SYNTAX → FAIL` | **Incumplido**: los guards por regex no detectan grafías alternativas |
| `KNOWN_ALLOWED_CASE → PASS` | Cumplido vía allowlists explícitas |

Ejemplo positivo de parser real: el guard de imports reconoce las cuatro formas
de specifier (hay un test dedicado a ello, duplicado en 3 archivos). Eso **sí**
es un guard enterprise-grade.

## 17. Security tests

Dos poblaciones con calidad opuesta:

| Población | Archivos | Tests | Naturaleza | Veredicto |
|---|---:|---:|---|---|
| `test/security/**` | 10 | 67 | `app.inject()` real, 68 invocaciones | **Sólida.** Deny/allow con status reales |
| `test/architecture/security/**` | 17 | 134 | 16 de 17 con `rt=0`; 299 ms totales | **Débil.** Presencia de substring, sin prueba negativa |

Matriz por contrato:

| Threat | Boundary | Expected deny | Negative proof | Source of truth |
|---|---|---|---|---|
| Cross-tenant IDOR | `clinicId` scoping | 403/404 sin disclosure | **AUSENTE** (§9.1) | Literal en el propio test |
| Cross-realm rate limit | Realm admin/clinic/particular | 429 aislado | PRESENTE | `app.inject()` |
| CSRF | Rutas mutantes | Rechazo sin token | PRESENTE | `app.inject()` |
| Trusted origin / CORS | Origin allowlist | Sin `ACAO` | PRESENTE | `app.inject()` |
| Sesión / cookies | `admin_session_id` / `app_session_id` | 401 | PRESENTE (comportamiento) + AUSENTE (config en `env.ts`) | Mixto |
| Enumeración de tokens | Selector hostil | Sin disclosure | PRESENTE | `app.inject()` |
| Redacción de logs | Logger | Sin secretos | AUSENTE | Substring |
| `no-store` privado | Headers | `no-store` | PARCIAL | `backend-api-no-store-cache-contract.test.ts` (fs=1, inject=0) |

Regla innegociable del programa: **ninguna fase debilita un contrato de
seguridad**. Las fases sobre esta área sólo **añaden** prueba negativa.

## 18. Tests de DB y migraciones

```text
Tests que ejecutan SQL contra una base real   =   0
```

10 archivos de migración/schema, **todos** de inspección estática de
`drizzle/migrations/*.sql` y del journal.

Matiz de justicia: CI **sí** levanta un servicio `postgres:16` y ejecuta
`pnpm db:migrate`. Eso prueba que las migraciones **aplican**. Lo que no existe
es prueba de que el **schema resultante** sea el esperado (constraints, índices,
FKs, tipos) ni de que los **repositorios** funcionen contra él.

Concuerda con §21: la carpeta `test/integration/adapters/repositories/` está
**documentada como canónica y vacía**.

Esta auditoría es R0: no se ejecutó ni se diseñó ningún cambio de DB
(`AGENTS.md` §§14–15).

## 19. Frontend static tests

`test/unit/ui/**` = 163 archivos (29 % de la suite), 158 leen source.

Lo que leen, por volumen de referencias:

| Destino | Referencias |
|---|---:|
| `frontend/src/app/dashboard/**` | 224 |
| `frontend/src/components/dashboard/**` | 83 |
| `frontend/src/components/public/**` | 73 |
| `frontend/src/lib/api.ts` | 38 |
| `frontend/src/app/globals.css` | 14 |

Aplicando la frontera del prompt:

```text
SOURCE / CONFIG CONTRACT   → test/**          (next/link=0, CSP, metadata, SEO, manifest)
REAL BROWSER CONTRACT      → frontend/e2e/**  (render, interacción, estados, geometría)
```

- **Legítimos y a preservar**: `frontend-native-link-preview-contract` (§7.5),
  `frontend-csp-*` (7 archivos), `frontend-next-config-security-headers`,
  `frontend-public-devtools-exposure-contract`, `frontend-public-seo-contract`,
  `frontend-public-page-metadata`.
- **Candidatos a acoplamiento accidental**: los que afirman **comportamiento**
  (estados vacíos, feedback, foco, navegación, polish, interacción) mediante
  substrings de `.tsx`. Ahí el contrato es de navegador y ya tiene su lugar en
  `frontend/e2e/**`.

**No se migra nada automáticamente.** `TEST-GLOBAL-06` adjudica caso por caso,
y cualquier traslado a E2E exige verificar antes cobertura equivalente en el
catálogo (`frontend/e2e/suites/catalog.ts`), no asumirla.

## 20. Registries, ledgers y censos congelados

| Tipo | Métrica |
|---|---:|
| Assertions de conteo congelado (`.length, <n>`) | **426** en **116 archivos** |
| Registries literales (`const X = [ … ]` en el test) | 75 archivos |

Clasificación:

| Clase | Ejemplo | Valoración |
|---|---|---|
| `FROZEN_CENSUS` | `M48`: `server/**` congelado en **46.083 LOC / 226 archivos** | Fail-closed deliberado. Coste alto |
| `DERIVED_REGISTRY` | Cohortes E2E derivadas del catálogo | Correcto |
| `AUTHORITATIVE_REGISTRY` | `helpers/session.ts` como fuente única (GLOBAL-07) | Correcto |
| `DUPLICATE_SOURCE_OF_TRUTH` | `M48`: árbol ↔ literal del test ↔ tabla markdown del acta | **Triple declaración** |
| `LEGACY_LIST` | `requiredTestEvidence` de CTIDOR con 11 paths muertos | **P0** (§9.2) |

Caso `M48` en detalle: el guard computa el censo del árbol, lo compara con un
literal del test **y** con una tabla markdown de la certificación. Cualquier
cambio de una línea en `server/**` obliga a editar **tres** lugares. El
propósito (impedir drift de la modularización) es legítimo; el mecanismo
convierte cada PR de backend en una edición triple. Es deuda de diseño de guard,
no motivo para retirarlo.

## 21. Coverage semántico

Estado de la instrumentación:

```text
pnpm test:coverage   → existe en package.json
                     → NO aparece en ningún workflow de .github/workflows/
                     → clasificación: DIAGNOSTIC / LOCAL_ONLY
Thresholds            → no existen (decisión explícita de TDR-004)
```

Evaluación por eje, más allá del porcentaje de líneas:

| Eje | Estado |
|---|---|
| `LINE_COVERED` | Medible on-demand, no publicado ni versionado |
| `BRANCH_COVERED` | No medido |
| `SEMANTICALLY_COVERED` | **Sobre-estimado**: 1.042 tests del pool candidato ejecutan `readFileSync` sobre producción, no producción |
| `MUTATION_SENSITIVE` | 9 archivos (§11) |

Advertencia metodológica que el programa debe respetar: un coverage report sobre
esta suite **atribuiría cobertura al acto de leer el archivo**, no a ejecutarlo.
Los 1.264 tests de §8.2 no ejecutan una sola línea de `frontend/src/**`. Publicar
un porcentaje sin esa salvedad produciría una métrica activamente engañosa.

## 22. Error-path coverage

Assertions de status HTTP en la suite:

| Status | Ocurrencias |
|---|---:|
| 200 | 285 |
| 201 | 27 |
| 400 | 73 |
| 401 | 109 |
| 403 | 67 |
| 404 | 63 |
| 429 | 44 |
| 5xx | 35 |
| 426 | 14 |
| 409 | 5 |
| 422 | 0 |

```text
happy path (2xx)  = 312
error path (4xx/5xx) = 410      →  57 % de las assertions de status son de error
```

**Hallazgo positivo y deliberado**: la capa de integración tiene cobertura de
error-path genuinamente buena. Contrasta con las 138 assertions
`throws`/`rejects` en toda la suite (0,67 % de 20.623): el error-path se prueba
donde corresponde —en la frontera HTTP—, no con excepciones internas.

Huecos concretos:

| Hueco | Estado |
|---|---|
| 409 conflicto | 5 assertions para toda la suite |
| 422 | 0 |
| Timeout / proveedor externo caído | Sin cobertura identificada |
| Error de DB / rollback lógico | Sin cobertura (no hay DB en tests, §18) |
| Recovery path | Sin cobertura identificada |

## 23. Duplicación y redundancia

```text
Nombres de test duplicados entre archivos   =   11
```

Duplicación **textual** despreciable. La redundancia real es de otra naturaleza:
**difusión de ownership**.

| Archivo de producción | Archivos de test que lo referencian |
|---|---:|
| `frontend/src/lib/api.ts` | **45** |
| `server/fastify-app.ts` | 33 |
| `server/routes/study-tracking.fastify.ts` | 31 |
| `server/routes/admin-study-tracking.fastify.ts` | 28 |
| `server/routes/reports.fastify.ts` | 27 |
| `frontend/src/app/dashboard/admin/page.tsx` | 26 |
| `server/routes/particular-auth.fastify.ts` | 26 |

Distribución global (411 archivos de producción referenciados):

```text
1 guard        127 archivos
2-3 guards     134
4-6 guards      60
7-10 guards     40
11-20 guards    37
21+ guards      13
```

**50 archivos de producción tienen ≥ 11 archivos de test apuntándoles.** Renombrar
un símbolo en `frontend/src/lib/api.ts` puede romper 45 archivos de test, ninguno
de los cuales es dueño del contrato. Ésta es la respuesta a "¿qué bloquea
refactors válidos?".

Ningún test se marca hoy como redundante confirmado: exigir la prueba de §15 del
prompt (mismo contrato, misma mutación detectada, señal preservada tras eliminar
uno) requiere la adjudicación de `TEST-GLOBAL-06`.

```text
TESTS_REDUNDANTES_CONFIRMADOS = 0
```

## 24. Performance de la suite

```text
wall time           26,4 s        (4.590 entradas)
tiempo agregado    133,6 s        (paralelismo por proceso/archivo)
```

Pareto:

```text
50 % del tiempo agregado  →   33 entradas   (0,7 %)
80 % del tiempo agregado  →  130 entradas   (2,8 %)
```

Entradas más caras (ms):

| ms | Entrada |
|---:|---|
| 3.529 | overlay config refuses to load outside the production runner |
| 3.250 | a real leak's finding message names the variable and file |
| 3.209 | oversized public bundle is scanned without skip notes |
| 3.122 | E2E-GLOBAL-11: the Fastify census resolves every registered route |
| 2.744 | sensitive marker split across chunks in oversized public bundle |
| ~1.500–2.400 | familia `M44`/`M45`/`M46`/`M35`/`M41` (censos de árbol completos) |

**Conclusión explícita y contraria a la hipótesis inicial del encargo: la
performance de la suite NO es un problema.** 4.530 tests en 26,4 s es un
resultado excelente. El coste se concentra en guards que re-recorren el árbol
completo de forma independiente (consecuencia de §13.1), y su optimización
natural es un subproducto del helper canónico, no una fase propia.

Clasificación de optimizaciones candidatas:

| Optimización | Clase |
|---|---|
| Lector canónico con cache por proceso | `SAFE_EQUIVALENT` (subproducto de `TEST-GLOBAL-05`) |
| Unificar censos de árbol M44–M48 | `REQUIRES_EQUIVALENCE_PROOF` |
| Reducir escaneos de bundle público | `SEMANTIC_RISK` — son guards de seguridad |
| Paralelismo o sharding adicional | `NOT_WORTH_IT` a 26 s |

Ninguna optimización futura puede reducir señal, cobertura ni determinismo para
ahorrar tiempo. A esta escala, **no hay ningún ahorro que lo justifique**.

## 25. CI / execution topology

```text
backend-ci.yml
  detect-backend-impact        →  should_run = false SÓLO si todos los paths
                                  cambiados matchean docs/* o *.md
  backend-heavy-validation     →  lint:backend → audit --prod → audit
                                  → db:migrate (postgres:16 service)
                                  → typecheck → typecheck:test → pnpm test → build
  backend-check                →  contexto required `validate-backend`
```

| Gate | Clase | Nota |
|---|---|---|
| `pnpm test` (562 archivos completos) | `REQUIRED_GATE` | Único lugar donde corre la suite |
| `pnpm lint:backend` | `REQUIRED_GATE` | Cubre `server/`, `scripts/`, `drizzle/` |
| `pnpm db:migrate` | `REQUIRED_GATE` | Con Postgres real |
| `pnpm test:coverage` | `NOT_EXECUTED` | No está en ningún workflow |
| Lint de `test/**` | `NOT_EXECUTED` | **No existe** |

### 25.1 Hallazgo positivo

El detector es **fail-closed e inclusivo**: cualquier path que no sea `docs/*`
ni `*.md` activa `should_run=true`. En consecuencia, una PR que sólo toque
`frontend/src/**` **sí** ejecuta los 163 tests de `test/unit/ui/**` que la
guardan. **No existe el hueco de tests valiosos sin ruta de ejecución.** La
topología de CI es correcta y no requiere cambios.

### 25.2 Hallazgo negativo

```text
test/**  =  156.700 LOC  =  el mayor cuerpo de código del repositorio
         =  0 reglas de lint
```

`eslint.config.mjs` define `lintableFiles` como `server/**`, `scripts/**`,
`drizzle/**`. `test/**` queda fuera, y sólo pasa por `typecheck:test`. El 61 %
del código TypeScript del backend no tiene análisis estático. Un `.only(`
accidental, una promesa flotante o un `assert` sin `await` no tienen hoy ningún
control automático. (Hoy `.only(` = 0, pero por disciplina, no por enforcement.)

## 26. Testability del producto

| Área | Clase | Evidencia |
|---|---|---|
| Rutas Fastify | **Sano** | Dependencias como puertos del plugin; 62 archivos de integración real (§15) |
| Dominio | **Sano** | `unit/domain` 3 % filesystem |
| Email (SMTP / Gmail API) | `PRODUCT_TESTABILITY_DEBT` | 297 `as any` para parchear `ENV.smtp`, `ENV.gmailApi`, `nodemailer`, `globalThis.fetch` |
| Storage (Supabase) | `PRODUCT_TESTABILITY_DEBT` | 63 `supabase.storage as any` |
| `ENV` como singleton mutable | `PRODUCT_TESTABILITY_DEBT` | 43 `ENV as any` |
| Componentes React | `BOTH` | No hay render en `test/**`; sin runner de componentes, el único oracle disponible es el texto fuente (§19) |
| Repositorios / persistencia | `PRODUCT_TESTABILITY_DEBT` | Sin costura para fake de DB; 0 tests de repositorio (§18) |

Distinción central: **los 659 `as any` no son pereza de test.** Son el precio de
que email, storage y `ENV` sean singletons de módulo en lugar de dependencias
inyectadas, al contrario que las rutas. Corregirlo es trabajo de producto (R2) y
**no pertenece a un PR test-only**.

## 27. Proyección de coste

Crecimiento observado entre la consolidación (2026-07-30) y hoy (~7,5 semanas):

```text
archivos   517  →  562     (+8,7 %)
tests    4.019  → 4.530    (+12,7 %)
```

Extrapolación al escenario "el proyecto duplica su tamaño", manteniendo el ratio
3,40:1 y la arquitectura actual:

| Magnitud | Hoy | Proyectado |
|---|---:|---:|
| LOC de producción | 99.179 | ~198.000 |
| LOC de `test/**` | 156.700 | ~313.000 |
| Specs | 562 | ~1.120 |
| Wall time | 26,4 s | ~55 s (sigue siendo irrelevante) |

El cuello de botella proyectado **no es tiempo de ejecución** sino **coste de
edición**: con 50 archivos de producción ya a ≥ 11 guards y 426 censos
congelados, duplicar el tamaño duplica el número de ediciones colaterales que
exige cada PR. El riesgo a escala es de **fricción de refactor y erosión de la
confianza en el rojo**, no de performance.

## 28. Riesgos

| ID | Categoría | Severidad | Hallazgo | Evidencia |
|---|---|---|---|---|
| `TG-R01` | `CIRCULAR_ORACLE` + `FALSE_GREEN` | **P0** | Contrato cross-tenant IDOR probado contra un literal del propio test; 15/18 contratos no tocan producción | §9.1 |
| `TG-R02` | `STALE_GUARD` + `FAIL_OPEN_GUARD` | **P0** | 11 rutas de `requiredTestEvidence` inexistentes y no dereferenciadas: nada detecta la rotura | §9.2 |
| `TG-R03` | `FALSE_GREEN` + `WEAK_ASSERTION` | **P1** | 1.264 tests (157 archivos) con ≥80 % substring y sin runtime; mutación escapante demostrada | §8.2, §10.1 |
| `TG-R04` | `PLATFORM_VARIANCE` + `FALSE_RED` | **P1** | 9 tests rojos permanentes en win32; `validate:local` nunca PASSED en el entorno del owner | §10.2 |
| `TG-R05` | `COVERAGE_GAP` | **P1** | Contratos de seguridad estáticos sin prueba negativa: 0 de 9 harness de mutación en `architecture/security/**` | §11 |
| `TG-R06` | `ACCIDENTAL_COUPLING` | **P1** | 137 archivos / 1.042 tests candidatos, 89 % en `unit/ui/**` | §7.3 |
| `TG-R07` | `MOCK_DRIFT` | **P2** | 659 `as any` en la costura test↔runtime; el tipado no detecta cambio de contrato de puertos | §12.3 |
| `TG-R08` | `PERFORMANCE_DEBT` (gobernanza) | **P2** | `test/**` (156.700 LOC) sin ninguna regla de lint | §25.2 |
| `TG-R09` | `DUPLICATE_SOURCE_OF_TRUTH` | **P2** | 283 lectores de source ad hoc vs 9 importadores del helper canónico | §13.1 |
| `TG-R10` | `COVERAGE_GAP` | **P2** | 0 tests de repositorio y 0 de servicio externo; ambas carpetas documentadas y vacías | §18, §21 |
| `TG-R11` | `OVER_SPECIFICATION` | **P2** | Difusión de ownership: 50 archivos de producción con ≥11 guards; `api.ts` con 45 | §23 |
| `TG-R12` | `FIXTURE_DRIFT` | **P2** | `fastify-app-route-stubs.ts` (762 LOC, 2 consumidores) y `dashboard-operational-contract.ts` (552 LOC, 1) sobre-especializados | §12.1 |
| `TG-R13` | `STALE_GUARD` (coste) | **P3** | 426 censos congelados; `M48` con triple fuente de verdad | §20 |
| `TG-R14` | `DOCUMENTATION_DRIFT` | **P3** | Árbol canónico documenta 2 carpetas vacías y omite `unit/application`, `unit/clinics`, `unit/pricing` | §21 |
| `TG-R15` | `NONDETERMINISM` | **P3** | 8 de 11 archivos mutan `process.env` sin restaurar (acotado a intra-archivo por aislamiento de proceso) | §13.2 |
| `TG-R16` | `WEAK_ASSERTION` | **P3** | Inconsistencia de normalización CRLF: 295 normalizan, 36 lectores no | §13.1 |

```text
P0 = 2      P1 = 4      P2 = 6      P3 = 4
```

Severidades deliberadamente no infladas: `TG-R01`/`TG-R02` son P0 porque afectan
un **control de seguridad presentado como verificado**; nada más se eleva a P0.

## 29. Bloqueantes

```text
Bloqueantes para iniciar el programa   =   NINGUNO
```

| Condición | Estado |
|---|---|
| Baseline reproducible | Capturado (§3) |
| CI verde sobre el baseline | Verificado (`Backend CI` = success @ `ee8e7425`) |
| `LIMPIEZA E2E` cerrado | Verificado (CLOSED, last verified 2026-09-21) |
| Autorización R2 para lint/CI/deps | **Requerida** para `TEST-GLOBAL-05` (config de ESLint) y `TEST-GLOBAL-12` |
| Autorización R2 para producto | **Requerida** para `TEST-GLOBAL-10` (inyección de dependencias en email/storage) |
| DB para gates locales | `pnpm validate:local` queda BLOCKED sin DB desde #1711; reportar como ambiental |

## 30. Estado objetivo

| Eje | Objetivo medible |
|---|---|
| Arquitectura | 100 % de specs clasificados; `test/*.test.ts` = 0; capa inferida == carpeta; helper de lectura canónico único |
| Confiabilidad | 0 falsos rojos tolerados en win32; `validate:local` capaz de PASSED en el entorno del owner |
| Source coupling | 137 candidatos adjudicados a 100 %; guards legítimos preservados sin excepción; acoplamiento accidental corregido o registrado con owner y motivo |
| Assertions | 0 contratos críticos con oracle sólo-presencia; substring ratio global < 20 % |
| Seguridad | Prueba negativa en tenant isolation, auth, permisos, redacción y rate limit; 0 registries stale no dereferenciados |
| Mocks | 0 `as any` en costuras de inyección de rutas; ownership declarado por double |
| Performance | Mantener wall time < 60 s; ninguna optimización con pérdida semántica |
| Gobernanza | `test/**` bajo lint; coverage baseline publicado con su salvedad metodológica (§21) |

## 31. Roadmap `TEST-GLOBAL-*`

La secuencia propuesta en el encargo se **modificó según la evidencia**:

- se **elimina** la fase autónoma de performance (§24: no hay problema);
- se **adelanta** la seguridad al inicio (P0 real);
- se **añade** una fase de falso rojo win32 (bloquea el gate local);
- se **divide** la remediación de `unit/ui` en adjudicación + dos olas;
- se **añade** una fase de testability de producto (R2, fuera de test-only).

| Fase | Título | Scope primario | Riesgo | Depende de |
|---|---|---|---|---|
| `TEST-GLOBAL-01` | Alta del programa e instrumentación del censo | docs-only + test-only | R1 | — |
| `TEST-GLOBAL-02` | **P0** — De-circularizar el registro IDOR y sanear evidencia stale | test-only | R1 | 01 |
| `TEST-GLOBAL-03` | **P1** — Falso rojo win32: restaurar el gate local | test-only | R1 | 01 |
| `TEST-GLOBAL-04` | **P1** — Prueba negativa para guards de seguridad | test-only | R1 | 02 |
| `TEST-GLOBAL-05` | Lector canónico de source + lint de `test/**` | test-only + config-only | **R2** | 01 |
| `TEST-GLOBAL-06` | Adjudicación de los 137 candidatos (sin modificar tests) | docs-only | R0/R1 | 01, 05 |
| `TEST-GLOBAL-07` | Remediación `unit/ui` ola 1 — dashboard | test-only | R1 | 06 |
| `TEST-GLOBAL-08` | Remediación `unit/ui` ola 2 — admin, public, frontend | test-only | R1 | 07 |
| `TEST-GLOBAL-09` | Capa de integración de repositorios y servicios externos | test-only | R1 | 05 |
| `TEST-GLOBAL-10` | Testability de producto: inyección en email/storage/ENV | **backend-only** | **R2** | 09 |
| `TEST-GLOBAL-11` | Consolidación de registries y censos congelados | test-only | R1 | 05 |
| `TEST-GLOBAL-12` | Baseline de coverage semántico y mutation strength | config-only + docs | **R2** | 04, 08 |
| `TEST-GLOBAL-13` | Gobernanza, documentación y certificación de cierre | docs-only | R1 | todas |

### TEST-GLOBAL-01 — Alta del programa e instrumentación

- **Problema**: no existe censo versionado ni clasificación por spec; `TDR-002` cita cifras de julio.
- **Evidencia**: §6, §33.
- **Scope**: este documento; un contrato de censo en `test/architecture/` que congele las cifras de §6 y falle si divergen materialmente; actualización de `TDR-002` reclasificando sus cifras como históricas; fila en `docs/audit/README.md`.
- **No-scope**: ninguna corrección de test.
- **Aceptación**: el censo se reproduce desde el árbol; `pnpm test` verde.
- **Rollback**: revertir el commit; no toca runtime.
- **Coste**: bajo. **Paralelizable**: no (habilita al resto).

### TEST-GLOBAL-02 — P0: de-circularizar el registro IDOR

- **Problema**: `TG-R01` + `TG-R02`.
- **Evidencia**: §9.1, §9.2.
- **Scope**: (a) realinear las 11 rutas stale a sus paths reales; (b) añadir un test que **dereferencie todas** las `requiredTestEvidence` y falle si alguna no existe (cierra el fail-open); (c) extender `readSource()` a los 15 contratos que hoy no verifican nada; (d) renombrar/reubicar lo que sea ledger de evidencia pendiente para que no se lea como contrato ejecutable.
- **No-scope**: `server/**`; no se debilita ninguna assertion existente; no se ejecuta evidencia de staging (R3).
- **Aceptación**: 0 paths stale; un path inventado en el registro **rompe** la suite (prueba negativa obligatoria en el PR).
- **Riesgo**: R1. **Rollback**: revertir el commit.
- **Coste**: medio. **Paralelizable**: sí, con 03.

### TEST-GLOBAL-03 — P1: falso rojo win32

- **Problema**: `TG-R04`. 9 rojos permanentes anulan `validate:local` en el entorno del owner.
- **Evidencia**: §10.2.
- **Scope**: hacer que el guard resuelva el comando **a través del launcher**, de modo que valide el contrato real ("e2e:full corre sobre `next start`") en ambas plataformas, en vez de anclar un literal.
- **No-scope**: cambiar el launcher; debilitar o skipear el guard; marcar `test.skip` por plataforma.
- **Aceptación**: `pnpm test` en win32 = 0 fail; Backend CI sigue verde; una mutación que quite el runner productivo sigue rompiendo el guard.
- **Riesgo**: R1 (toca sólo `test/**`). Si exigiera tocar `frontend/e2e/helpers/**`, se replantea como R2 y se pide autorización.
- **Coste**: medio. **Paralelizable**: sí.

### TEST-GLOBAL-04 — P1: prueba negativa para seguridad

- **Problema**: `TG-R05`. 0 de 9 harness de mutación en `architecture/security/**`.
- **Evidencia**: §11, §17.
- **Scope**: propagar el harness en memoria ya probado a: tenant isolation, auth/sesiones, permisos/roles, redacción de logs, disclosure, rate limiting. Cada guard incorpora al menos una mutación que debe ponerlo en rojo.
- **No-scope**: debilitar cualquier contrato; introducir Stryker; tocar `server/**`.
- **Aceptación**: cada contrato crítico de §17 pasa de `NO_NEGATIVE_PROOF`/`MUTATION_CANDIDATE` a `MUTATION_PROOF_PRESENT`, con la mutación explícita en el test.
- **Coste**: alto. **Paralelizable**: por contrato.

### TEST-GLOBAL-05 — Lector canónico + lint de `test/**`

- **Problema**: `TG-R09` + `TG-R08` + `TG-R16`.
- **Evidencia**: §13.1, §25.2.
- **Scope**: extender `test/helpers/tracked-source-files.ts` a lector canónico (normalización CRLF única, cache por proceso, fallo si falta el path); migrar por lotes los 283 lectores ad hoc; añadir `test/**` a `lintableFiles` con un conjunto mínimo (`no-only-tests` equivalente, promesas flotantes, `no-unused-vars`) **sin autofix masivo**.
- **No-scope**: reformateo; cambio de reglas de `server/**`; migrar los 283 en un solo PR.
- **Riesgo**: **R2** — toca `eslint.config.mjs`. Requiere autorización explícita.
- **Aceptación**: baseline de lint de `test/**` publicado (errores y warnings) sin autofix; wall time no empeora; `pnpm test` verde.
- **Coste**: alto. **Paralelizable**: los lotes de migración, sí.

### TEST-GLOBAL-06 — Adjudicación de los 137 candidatos

- **Problema**: `TG-R06`. El pool es candidato, no deuda confirmada (§7.4).
- **Scope**: **docs-only**. Clasificar cada uno de los 137 en `LEGITIMATE_GUARD` / `LEGITIMATE_STATIC_CONTRACT` / `MIXED` / `ACCIDENTAL_COUPLING` con: contrato protegido, mutación que detecta, mutación que escapa, capa correcta, y si existe cobertura E2E equivalente **verificada contra el catálogo**.
- **No-scope**: modificar, mover o borrar un solo test.
- **Aceptación**: 137/137 adjudicados con owner y decisión `KEEP` / `STRENGTHEN` / `RELOCATE` / `RETIRE`. Sin evidencia → `KEEP`.
- **Coste**: alto. **Paralelizable**: por subcarpeta.

### TEST-GLOBAL-07 / 08 — Remediación `unit/ui`

- **07**: `unit/ui/dashboard` (28 candidatos). **08**: `unit/ui/admin` + `public` + `frontend` (94).
- **Scope por PR**: un subdominio, una causa, un rollback. Cada test `RETIRE` exige la prueba de §15 del encargo. Cada `RELOCATE` exige el spec E2E receptor **existiendo y verde** antes de retirar el estático.
- **No-scope**: tocar `frontend/src/**`; crear specs E2E nuevos sin pasar por el catálogo y sus censos.
- **Aceptación**: substring ratio de la carpeta < 20 %; ningún contrato pierde cobertura demostrable; censos de catálogo realineados en el mismo PR.
- **Coste**: muy alto. **Paralelizable**: no entre sí (comparten censos).

### TEST-GLOBAL-09 — Repositorios y servicios externos

- **Problema**: `TG-R10`. Dos carpetas canónicas documentadas y vacías; 0 SQL ejecutado.
- **Scope**: poblar `test/integration/adapters/repositories/` y `test/integration/external-services/` con la costura que exista hoy. Si no existe costura, el resultado de la fase es **declarar el bloqueo** y derivar a `TEST-GLOBAL-10`.
- **No-scope**: ejecutar migraciones contra DB real (R3, `AGENTS.md` §14); crear una DB de test sin autorización.
- **Aceptación**: cobertura de repositorio con fake verificable, o registro explícito de que la testability lo impide.
- **Coste**: medio-alto.

### TEST-GLOBAL-10 — Testability de producto

- **Problema**: `TG-R07` + §26. **backend-only, R2.**
- **Scope**: inyectar dependencias en email (SMTP/Gmail), storage (Supabase) y `ENV`, replicando el patrón de puertos ya exitoso en las rutas; retirar los `as any` correspondientes.
- **No-scope**: mezclar con cambios de test más allá de la realineación obligatoria; tocar rutas.
- **Aceptación**: `as any` en costuras de inyección = 0; comportamiento productivo idéntico; tests de email/storage sin parchear `globalThis`.
- **Riesgo**: **R2** — requiere autorización explícita de Nico antes de empezar.
- **Coste**: alto.

### TEST-GLOBAL-11 — Registries y censos congelados

- **Problema**: `TG-R13` + `TG-R11`.
- **Scope**: eliminar la triple declaración de `M48` (derivar la tabla markdown del censo, o derivar el censo de una única fuente); revisar los 426 censos congelados distinguiendo `FROZEN_CENSUS` deliberado de `LEGACY_LIST`.
- **No-scope**: retirar guards fail-closed; relajar `M48`.
- **Aceptación**: cada censo congelado tiene fuente única declarada y motivo documentado.
- **Coste**: medio.

### TEST-GLOBAL-12 — Coverage semántico y mutation strength

- **Scope**: publicar baseline de `test:coverage` **con la salvedad metodológica de §21**; decidir si se incorpora a CI como diagnóstico no bloqueante.
- **No-scope**: thresholds; mutation testing indiscriminado.
- **Riesgo**: **R2** si toca workflows.
- **Coste**: medio.

### TEST-GLOBAL-13 — Gobernanza y cierre

- **Scope**: actualizar `TDR-002`, `test/README.md` (§21 drift), la convención de organización y este documento a `CLOSED`; certificación final con censo recomputado.
- **Aceptación**: matriz de §34 completa; residuales con owner.

## 32. Dependencias entre fases

```text
01 ──┬──► 02 ──► 04 ──────────────┐
     ├──► 03                      ├──► 12 ──► 13
     └──► 05 ──┬──► 06 ──► 07 ──► 08 ──┘
               ├──► 09 ──► 10
               └──► 11
```

Paralelizables sin conflicto: `02 ∥ 03`, `09 ∥ 11`.
Serializadas obligatoriamente: `06 → 07 → 08` (comparten censos de catálogo).

## 33. Auditoría de auditorías anteriores

| Documento | Dato | Clase | Fundamento |
|---|---|---|---|
| `TDR-002` | 367/514 tests con `readFileSync`; 134 usos de `readdirSync` en 64 tests | **STALE** | Hoy: 410/562 y 82 archivos con `readdirSync`. Recensar en `TEST-GLOBAL-01` |
| `TDR-002` | `Status: OPEN`, severity HIGH | **CURRENT** | Confirmado y agravado por §7.3 |
| `TDR-003` | Backend lint baseline, `RESOLVED` | **CURRENT** | Verificado en `package.json` y `eslint.config.mjs`. **No cubre `test/**`** (§25.2) |
| `TDR-004` | Coverage baseline, `RESOLVED` | **NEEDS_REVALIDATION** | `test:coverage` existe pero no corre en CI; y sobre esta suite el número sería engañoso (§21) |
| `pr-test-architecture-consolidation-audit.md` | 517 archivos / 4.019 tests | **HISTORICAL** | Baseline de 2026-07-30 |
| ídem | `ACCIDENTAL_COUPLING confirmado = 0` | **NEEDS_REVALIDATION** | Ver nota metodológica abajo |
| ídem | `LEGITIMATE_GUARD` 332 / `MIXED` 38 | **HISTORICAL** | Criterio distinto del de §7.3 |
| ídem | Helper canónico `listSourceFiles` | **CURRENT** | Existe y funciona; adopción baja (9 importadores) |
| `test/README.md` | Árbol canónico con `integration/adapters/repositories` y `integration/external-services` | **STALE** | Ambas vacías (§21) |
| `test/README.md` | `test/*.test.ts` = 0 | **CURRENT** | Verificado |
| `docs/audit/LIMPIEZA E2E.md` | `CLOSED`, last verified 2026-09-21 | **CURRENT** | No se reabre |

**Nota metodológica, importante para no contradecir injustamente el trabajo
previo.** La consolidación de 2026-07-30 concluyó `ACCIDENTAL_COUPLING = 0` bajo
un criterio explícito: *"un test funcional depende innecesariamente de forma
física"*. Bajo ese criterio la conclusión **era correcta**, porque los tests de
`unit/ui` se clasificaron como contratos estáticos sobre source —y en tanto
"contrato estático", lo son.

Esta auditoría aplica un criterio **distinto y más estricto**: el **poder del
oracle** frente al contrato que el test **dice** proteger. Un test llamado
*"distingue fallos de carga de estados vacíos"* enuncia un contrato de
comportamiento; probarlo con `.includes()` es acoplamiento accidental **aunque
el archivo sea un guard estático bien escrito**.

No hay contradicción: hay un criterio nuevo. La auditoría previa queda
`CURRENT` para su propia pregunta y `NEEDS_REVALIDATION` para ésta. **No se
reabre** aquel programa.

## 34. PR splitting y matriz de aceptación

Regla de `AGENTS.md` §4 aplicada: un scope primario, una causa, un rollback.

| Fase | Tipo de PR | Scope único | ¿R2? |
|---|---|---|---|
| 01 | docs-only + test-only | Censo y alta | No |
| 02 | test-only | Registro IDOR | No |
| 03 | test-only | Guard de plataforma | No |
| 04 | test-only | Prueba negativa (1 PR por contrato) | No |
| 05 | test-only **+** config-only → **split obligatorio en 2 PRs** | Helper / ESLint | **Sí** (ESLint) |
| 06 | docs-only | Adjudicación | No |
| 07, 08 | test-only | 1 PR por subdominio | No |
| 09 | test-only | Integración | No |
| 10 | backend-only | Inyección de dependencias | **Sí** |
| 11 | test-only | Registries | No |
| 12 | config-only + docs | Coverage | **Sí** si toca workflows |
| 13 | docs-only | Cierre | No |

Matriz de aceptación transversal — toda fase debe cumplir:

| Criterio | Verificación |
|---|---|
| `pnpm test` sin regresión | Conteo pass ≥ baseline de la fase |
| `pnpm validate:local` | PASSED o BLOCKED con precondición nombrada (DB) |
| Ningún guard debilitado | Diff revisado; 0 `skip`, 0 assertion retirada sin prueba de equivalencia |
| Censos realineados en el mismo PR | `AGENTS.md` §4 |
| Cero artefactos | `playwright-report/`, `test-results/`, `next-env.d.ts` |
| Prueba negativa del propio cambio | Cuando la fase añade o modifica un guard |

## 35. Residuales explícitos

| Residual | Motivo |
|---|---|
| Evidencia runtime de cross-tenant en staging | R3; `AGENTS.md` §17. `TEST-GLOBAL-02` cierra el oracle circular, **no** produce la evidencia de staging |
| Tests contra DB real | R3; `AGENTS.md` §14. Fuera de todo el programa |
| Mutation testing con herramienta externa | Deliberadamente descartado (§11.2) |
| Thresholds de coverage | Fuera de scope; `TDR-004` lo mantiene como decisión separada |
| Runner de componentes React | No se propone. Cambiaría la arquitectura de test del frontend; exige auditoría propia |
| `frontend/e2e/**` | `LIMPIEZA E2E` CLOSED. No se reabre |
| Fila de este documento en `docs/audit/README.md` | Fuera del scope documental autorizado para esta auditoría; pendiente en `TEST-GLOBAL-01` |
| Migración monorepo | `AGENTS.md` §18; política futura, no autorizada |

## 36. Criterio de cierre del programa

`LIMPIEZA TEST GLOBAL` pasa a `CLOSED` cuando, con evidencia reproducible:

1. Los 2 P0 están cerrados con prueba negativa en el propio PR.
2. Los 4 P1 están cerrados o tienen `accepted defer` con owner y fecha.
3. Los 137 candidatos están adjudicados 100 % (`KEEP` es un cierre válido).
4. Ningún contrato crítico de §17 permanece en `NO_NEGATIVE_PROOF`.
5. `pnpm test` puede alcanzar 0 fail en win32 y en CI.
6. `test/**` tiene baseline de lint publicado.
7. Los censos de §6 se recomputan y se declaran como cifras de cierre.
8. Ningún guard de seguridad fue debilitado en todo el programa.
9. Este documento se marca `CLOSED` con su Anexo de cierre.

---

## Anexo A — Censos reproducibles

Todos ejecutados sobre `main@ee8e7425`, 2026-09-21, desde la raíz del repo.

### A.1 Inventario

```bash
git ls-files 'test/**' | wc -l                            # 576
git ls-files 'test/**/*.test.ts' | wc -l                  # 562
git ls-files 'test/**/*.test.ts' | xargs grep -cE "^\s*test\(" | awk -F: '{s+=$NF} END {print s}'   # 4530
git ls-files 'test/**' | xargs wc -l | grep -E 'total$' | awk '{s+=$1} END {print s}'                # 156887
```

*Limitación*: `xargs` divide en lotes; sumar todos los `total` (no `tail -1`).

### A.2 Source coupling

```bash
git ls-files 'test/**/*.test.ts' | xargs grep -lE "from ['\"]node:fs" | wc -l     # 410
git ls-files 'test/**/*.test.ts' | xargs grep -lE "readdirSync" | wc -l           # 82
```

*Limitación*: presencia de `node:fs` **no** implica deuda (§36 del encargo).

### A.3 Assertions

```bash
git ls-files 'test/**/*.test.ts' | xargs grep -oE "assert\.ok\([A-Za-z0-9_.]*\.includes\(" | wc -l   # 6262
git ls-files 'test/**/*.test.ts' | xargs grep -oE "assert\.equal\([A-Za-z0-9_.]*\.includes\(" | wc -l # 1522
git ls-files 'test/**/*.test.ts' | xargs grep -oE "\.length,\s*[0-9]+" | wc -l                        # 426
git ls-files 'test/**/*.ts'      | xargs grep -oE " as any" | wc -l                                   # 659
```

### A.4 Clasificación por capa y acoplamiento

Scripts Node reproducibles usados por esta auditoría (criterio documentado en
§7.3; se recomienda versionarlos en `TEST-GLOBAL-01`):

- `classify.mjs` — capa inferida por comportamiento, señales de determinismo, densidad de assertions.
- `coupling.mjs` — clasificación de acoplamiento por poder del oracle.
- `ownership.mjs` — difusión de ownership (guards por archivo de producción).
- `stale-paths.mjs` — referencias a paths inexistentes.

*Limitación declarada*: son heurísticos. Tasa de falso positivo medida por
lectura manual sobre los 15 candidatos fuera de `unit/ui` (§7.4). Sus salidas
son **pool de candidatos**, no deuda confirmada.

### A.5 Ejecución

```bash
node --experimental-strip-types --experimental-specifier-resolution=node \
     --test --test-reporter=tap "test/**/*.test.ts"
# tests 4590 | pass 4580 | fail 9 | skipped 1 | duration_ms 26422
```

```bash
node --experimental-strip-types --experimental-specifier-resolution=node \
     --test "test/architecture/security/*.test.ts"
# tests 134 | pass 134 | duration_ms 298.7
```

### A.6 CI

```bash
gh run list --branch main --limit 6 \
  --json workflowName,conclusion,headSha \
  --jq '.[] | "\(.conclusion)\t\(.workflowName)\t\(.headSha[0:8])"'
# success  Backend CI  ee8e7425
```

## Anexo B — Casos confirmados por lectura manual

| # | Archivo | Clase | Prueba |
|---|---|---|---|
| B.1 | `test/architecture/security/security-cross-tenant-idor-contract.test.ts` | `CIRCULAR_ORACLE` | Asserta un literal declarado en el propio test; 15/18 contratos no dereferencian evidencia; 11 paths inexistentes |
| B.2 | `test/unit/ui/dashboard/frontend-dashboard-empty-states.test.ts` | `FALSE_GREEN` | `.includes("statsLoadError ?")` también matchea `"!statsLoadError ?"`: invertir la condición pasa los 3 asserts |
| B.3 | `test/unit/ui/frontend/frontend-report-actions.test.ts` | `OVER_SPECIFICATION` | Asserta el texto exacto de imports incluido el orden de named imports; un reorden no-op lo rompe |
| B.4 | `test/unit/ui/frontend/frontend-native-link-preview-contract.test.ts` | `MIXED` | Guard fail-closed excelente (`ANCHOR_HITS=0` por walker) **y** assertions de copy en el mismo archivo |
| B.5 | `test/unit/infrastructure/auth-security-rehash-policy.test.ts` | `MIXED` (falso positivo del clasificador) | Incluye assertion negativa real que prueba ausencia de la variante insegura |
| B.6 | `test/architecture/database/reconcile-public-profile-db-contract.test.ts` | `LEGITIMATE_STATIC_CONTRACT` (falso positivo del clasificador) | El script SQL es el entregable; no hay runtime sin DB |
| B.7 | `test/integration/adapters/controllers/auth.fastify.test.ts` | `INTEGRATION_CONTROLLER` correcto | Puertos inyectados vía opciones del plugin; Fastify real |
| B.8 | `test/unit/infrastructure/email-gmail-api.test.ts` | `CONTROLLED_NONDETERMINISM` correcto | Parches de `globalThis.fetch` restaurados en `try/finally` |

---

## Veredicto

```text
LIMPIEZA TEST GLOBAL
STATUS: ACTIVE
AUDIT: COMPLETE
IMPLEMENTATION: NOT_STARTED
P0: 2
P1: 4
P2: 6
P3: 4
ROADMAP: TEST-GLOBAL-01 … TEST-GLOBAL-13
NEXT: TEST-GLOBAL-01
```
