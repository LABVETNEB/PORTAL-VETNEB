# LIMPIEZA TEST GLOBAL

## Auditoría global de caja blanca de la arquitectura de tests no-E2E — PORTAL-VETNEB

| Campo | Valor |
|---|---|
| Documento | LIMPIEZA TEST GLOBAL |
| Tipo | Auditoría técnica global de caja blanca del subsistema de tests no-E2E |
| Repositorio | PORTAL-VETNEB |
| Alcance | `test/**` (562 specs ejecutables). `frontend/e2e/**` sólo como frontera |
| Estado | ACTIVE |
| Propósito | Fuente rectora **autosuficiente** del programa de saneamiento `TEST-GLOBAL-*` |
| Implementación | IN_PROGRESS — estado por fase en el [Veredicto](#veredicto) (verificado sobre `main@247a497c`). Esta auditoría no implementa ninguna fase |
| Revisión | R2 — diagnóstico original + reauditoría de gobernanza aplicada (§37) |

### Metadata de lifecycle

| Campo | Valor |
|---|---|
| Document owner | QA / Backend owner |
| Domain | Arquitectura de tests no-E2E: `test/**`, helpers, fixtures, factories, mocks, guards de arquitectura, CI backend |
| Lifecycle status | ACTIVE |
| Authoritative source role | Diagnóstico y roadmap del programa `TEST-GLOBAL-*`. No es el mapa operativo de CI (ese es [CI_PR_CHECKS_RUNBOOK.md](../ops/CI_PR_CHECKS_RUNBOOK.md)) ni la norma de organización física (esa es [test-suite-enterprise-organization-convention.md](../implementation/test-suite-enterprise-organization-convention.md)) |
| Effective date | 2026-09-21 |
| Last verified date | 2026-09-21 (reauditoría de gobernanza y reverificación de censos) |
| Review cadence | Por fase `TEST-GLOBAL-*` cerrada |
| Supersedes | Ninguno. Reclasifica cifras de `TDR-002` y de `pr-test-architecture-consolidation-audit.md` como históricas (§33) |
| Superseded by | Ninguno |
| Related controls or gaps | `TDR-002`; `ERM-CTRL-011`; `ERM-CTRL-012`; `ERM-CTRL-025`; `ERM-QLT-001` |
| Evidence or approval reference | Auditoría técnica R0 sobre `main@ee8e7425f911b4b49848957bff52242aa95158e2`; reauditoría de gobernanza R0 y reverificación de censos sobre `main@38fe1dfe12423454b3c48f1b139a5775e4b9d388` (§3, §37) |
| Autosuficiencia | Este documento **no depende de ningún prompt, encargo ni conversación externa**. Toda definición normativa que necesita una fase está transcrita aquí (§31.0, §31.6) |

> **Vigencia y reproducibilidad de las cifras.** El diagnóstico técnico se midió
> sobre `main@ee8e7425` el 2026-09-21; una reauditoría de gobernanza posterior
> reverificó los censos sobre `main@38fe1dfe` (§3). **No todas las cifras son
> reproducibles hoy desde el repositorio:** el [Anexo A](#anexo-a--censos-y-su-reproducibilidad)
> (A.0) clasifica cada cifra central en una de seis categorías —
> `REPRODUCIBLE_FROM_REPO`, `REPRODUCIBLE_WITH_DOCUMENTED_COMMAND`,
> `AUDIT_DERIVED_NOT_YET_REPRODUCIBLE`, `MANUAL_CLASSIFICATION`,
> `HISTORICAL_EXECUTION_EVIDENCE` y `CURRENT_REVERIFICATION`. En particular, la
> clasificación heurística de §7 y los censos de ownership y de paths stale
> provienen de scripts de scratchpad **no versionados** (A.4) y siguen siendo
> `AUDIT_DERIVED_NOT_YET_REPRODUCIBLE` hasta `TEST-GLOBAL-01B`. Ninguna cifra
> proviene de auditorías anteriores. Las cifras de `TDR-002` (367/514) y de la
> consolidación de 2026-07-30 (517 archivos / 4.019 tests /
> `ACCIDENTAL_COUPLING = 0`) son **históricas** y se tratan en §33.
>
> **Regla innegociable de reproducibilidad.** Una cifra
> `AUDIT_DERIVED_NOT_YET_REPRODUCIBLE` no se cita nunca como hecho confirmado.
> Toda decisión que dependa de ella la recomputa primero. Ninguna revisión de
> este documento puede promover una cifra a una categoría reproducible sin
> adjuntar el comando que la reprodujo y su salida.

---

## 1. Metadata y lifecycle

Ver encabezado. El programa se nombra `LIMPIEZA TEST GLOBAL` y sus fases
`TEST-GLOBAL-01 … TEST-GLOBAL-13`: **13 fases lógicas, más de 13 PRs** (§34),
porque `AGENTS.md` §4 obliga a entregar por separado docs-only, test-only,
config-only y backend-only, y algunas fases se dividen en varios PRs (p. ej.
`01A`/`01B`). El documento es rector: cualquier fase que altere el diagnóstico
lo registra en este archivo mediante un PR **docs-only propio**, posterior al
PR de la fase; nunca dentro de un PR test-only, config-only o backend-only.

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

## 3. Baselines

Este documento distingue **tres** baselines y nunca los mezcla. Confundirlos es
la causa habitual de citar evidencia histórica como si fuera estado actual.

```text
technical_measurement_baseline   el SHA sobre el que se midió el diagnóstico técnico
governance_reaudit_baseline      el SHA sobre el que se reverificaron censos y gobernanza
current_revision_baseline         el SHA vigente cuando se lee o se ejecuta una fase
```

### 3.1 `technical_measurement_baseline` — diagnóstico original

```text
branch                main
HEAD                  ee8e7425f911b4b49848957bff52242aa95158e2
HEAD -1               docs(e2e): close cleanup program (#1758)   2026-09-21 15:36:24 -0300
working tree          limpio (diff vacío)
AGENTS.md tracked     sólo la raíz. No existen AGENTS.md anidados tracked.
CI en el baseline     Backend CI = success @ ee8e7425 (ubuntu-latest)
```

Todas las cifras de §§6–27 se midieron sobre este SHA.

### 3.2 `governance_reaudit_baseline` — reverificación

```text
branch                main
HEAD                  38fe1dfe12423454b3c48f1b139a5775e4b9d388
HEAD == origin/main   sí, sin divergencia
log -1                docs(test): add global test cleanup audit (#1759)
diff ee8e7425..HEAD   1 archivo: docs/audit/LIMPIEZA TEST GLOBAL.md (+1711 líneas)
working tree          limpio; 0 stashes
AGENTS.md tracked     sólo la raíz (git ls-files '*AGENTS.md')
CI                    Backend CI = success @ ee8e7425 y @ 38fe1dfe
```

Como el único cambio entre ambos SHAs es **este mismo documento**, ninguna cifra
técnica quedó invalidada. Eso no se infiere: los censos `REPRODUCIBLE_*` se
**volvieron a ejecutar** sobre `38fe1dfe` y devolvieron los mismos valores
(A.0 los marca `CURRENT_REVERIFICATION`; comandos en A.1–A.3c).

### 3.3 `current_revision_baseline` — obligación de quien ejecute una fase

Cada fase `TEST-GLOBAL-*` **captura su propio baseline** antes de empezar
(`AGENTS.md` §2) y lo compara con §3.2. Si el árbol avanzó, la fase:

1. recomputa las cifras `REPRODUCIBLE_*` que su aceptación use (A.1–A.3c);
2. trata como no vigente cualquier cifra `AUDIT_DERIVED_NOT_YET_REPRODUCIBLE`;
3. declara en su PR el SHA sobre el que midió.

**Prohibido** usar §3.1 o §3.2 como si fueran el estado del árbol en el momento
de ejecutar una fase. Los checks son evidencia únicamente del SHA que los
produjo (`AGENTS.md` §5.7).

### 3.4 Estado ambiental — no es evidencia técnica

El árbol de trabajo (archivos untracked, stashes, worktrees) es **estado
ambiental de la máquina del operador**, no evidencia del repositorio: cambia
entre sesiones sin que cambie ningún contrato. Este documento no lo registra
como parte del baseline, y ninguna aceptación de fase puede depender de él.
`AGENTS.md` §3.3 obliga a preservarlo, no a documentarlo aquí.

### 3.5 Ejecución local de referencia

Medida sobre §3.1 (win32, Node v24.14.1). Clase: `HISTORICAL_EXECUTION_EVIDENCE`
para los tiempos observados (§24); `CURRENT_REVERIFICATION` para la
descomposición de fallos, que se volvió a ejecutar por archivo sobre §3.2 y dio
idéntico resultado (A.5b).

```text
pnpm test   → tests 4590 | pass 4580 | fail 9 | skipped 1 | wall 26,4 s
```

Los 9 FAILED **no son una sola clase** y ninguno es una regresión de código:
Backend CI está en `success` sobre el mismo SHA. Se descomponen en **8**
falsos rojos por variancia Win32 del launcher de Playwright y **1** fallo por
precondición de DB ausente (`DATABASE_URL` / `SUPABASE_DB_URL`). Se analizan en
§10.2 y §29.

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
| `senior-large-scale-codebase-analysis-vetneb` | **NOT_AVAILABLE** | — | Verificado contra el registro de skills de la sesión. El censo masivo se realizó con `git ls-files`, `grep`, y cuatro scripts Node ad hoc de scratchpad **no versionados** (Anexo A.4) |

Declaración explícita: **no se cargó ninguna skill que no figure como "Cargada: SÍ"**.
La auditoría se sostiene en evidencia ejecutable, no en la skill.

### 5.1 Skills de la reauditoría de gobernanza (§37)

| Skill | Disponible | Cargada | Uso concreto |
|---|---|---|---|
| `vetneb-briefing-planificacion-diseno-desarrollo-pruebas` | SÍ | **SÍ** | Normalización de §31/§32/§34/§36: fichas de fase, splits obligatorios, DAG, aceptación y rollback. Origen de las correcciones `TG-A01`, `TG-A02`, `TG-A03`, `TG-A04`, `TG-A07`, `TG-A08` |
| `vetneb-staff-senior-full-stack-engineer` | SÍ | **SÍ** | Fronteras `test/**` ↔ backend ↔ config ↔ CI; separación test debt / `PRODUCT_TESTABILITY_DEBT`; splits de `05`, `10` y `12`; propiedad de las costuras de inyección. Origen de `TG-A02`, `TG-A05`, `TG-A06`, `TG-A08`, `TG-A10` |
| `vetneb-security-production-invariants` | SÍ | **SÍ** | Preservación del significado de `TG-R01`, `TG-R02` y `TG-R05`; separación entre contrato estático, prueba negativa y evidencia runtime/staging; verificación de que ninguna corrección rebaja un control de seguridad |
| `vetneb-production-web-optimization-engineer` | SÍ | NO | No cargada: §24 sigue vigente (la performance de la suite no es el problema) y no apareció evidencia nueva que obligara a revisarlo |
| `senior-large-scale-codebase-analysis-vetneb` | **NOT_AVAILABLE** | — | No existe en el registro de skills de la sesión. No se sustituyó ni se inventó. Los censos se recomputaron con PowerShell + Git (A.3c) |

No se cargaron skills de E2E, PWA, dashboard, rutas, comunicaciones, release ni
optimización visual: la revisión fue exclusivamente documental y de gobernanza.

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

Este ratio es el dato central de mantenibilidad (§27, §30).

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
censo (`tracked-source-files.ts`) tiene **8 importadores** mientras **410
archivos** leen el filesystem por su cuenta (§13.1).

Precisión sobre esos 8 (recomputado sobre §3.2, A.3c; la revisión anterior de
este documento decía 9): los 8 **importan** el helper, no sólo lo mencionan.
Dos de ellos —`test/architecture/tracked-source-inventory.test.ts` y
`test/architecture/test-support-layout-contract.test.ts`— son además **guards
del propio helper**, de modo que su uso es a la vez consumo y verificación. La
distinción importa para `TEST-GLOBAL-05A`: la meta no es "subir de 8", es que el
lector canónico sea la única vía de lectura de source de la suite.

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

Archivo: `test/unit/ui/dashboard/frontend-dashboard-empty-states.test.ts`.
Test exacto (línea 36):
*"dashboard overview clinic command center distinguishes recent list load failures from empty states"*.

Datos verificados sobre §3.2: el archivo tiene 4 tests y 43 assertions; **este
test tiene 11 assertions y las 11 son `.includes()`**. Las tres que se citan
abajo son el subconjunto que demuestra la mutación escapante; las otras ocho
tampoco la detectan.

```ts
assert.ok(source.includes("statsLoadError ?"));
assert.ok(source.includes('role="alert"'));
assert.ok(source.includes("No se pudieron cargar las métricas operativas. Intente nuevamente."));
```

El `source` proviene de
`const CLINIC_COMMAND_CENTER_PATH = "frontend/src/app/dashboard/ClinicCommandCenter.tsx";`.

Fuente real (`frontend/src/app/dashboard/ClinicCommandCenter.tsx:136`):

```tsx
{statsLoadError ? (<div role="alert" …>…</div>) : null}
```

**Mutación que escapa**: invertir la condición a `{!statsLoadError ? …}`.
`.includes("statsLoadError ?")` sigue siendo verdadero porque
`"!statsLoadError ?"` **contiene** `"statsLoadError ?"` (verificado sobre §3.2:
`('!statsLoadError ?').Contains('statsLoadError ?')` → `True`). El resultado
sería mostrar la alerta de error exactamente cuando **no** hay error, y **las 11
assertions del test siguen pasando**. Las assertions además son independientes
entre sí: nada ata el mensaje al elemento `role="alert"` ni a la condición.

`FALSE_GREEN` confirmado, con mutación concreta identificada. La mutación está
**razonada y verificada por contención de substring, no ejecutada** contra el
árbol: ejecutarla exigiría modificar `frontend/src/**`, lo que esta auditoría no
hace. Convertirla en prueba negativa ejecutable es trabajo de `TEST-GLOBAL-07`.

### 10.2 Los 9 FAILED locales: 8 falsos rojos win32 + 1 precondición de DB

Los 9 fallos de `pnpm test` en win32 se descomponen por archivo (recomputado con
el comando de A.5 y por archivo, ver A.5b). **No comparten causa.**

**Grupo A — 8 falsos rojos por variancia Win32 del launcher** (`PLATFORM_VARIANCE` → `FALSE_RED`)

| | |
|---|---|
| Archivos | `test/unit/infrastructure/e2e-completeness-workflow.test.ts` (2), `test/unit/infrastructure/frontend-playwright-production-runner.test.ts` (6: 5 subtests + su test padre) |
| Causa | El guard resuelve el `webServer` real importando `frontend/playwright.config.ts`. En win32, `resolveWindowsWebServerLifecycle()` devuelve un valor y la config sustituye el comando por `node e2e/helpers/playwright-webserver-launcher.mjs application`; en Linux conserva `pnpm start` / `pnpm dev` |
| Síntoma | `actual: 'node e2e/helpers/playwright-webserver-launcher.mjs application'` frente a `expected: 'pnpm dev --hostname 127.0.0.1'` (o `'pnpm start --hostname 127.0.0.1'`) |
| Evidencia | Backend CI = `success` @ `ee8e7425` (ubuntu). Local win32 = 8 FAILED en estos dos archivos |
| Clase | `PLATFORM_VARIANCE` → `FALSE_RED` |

**Grupo B — 1 fallo por precondición de DB ausente** (`ENVIRONMENT_DEPENDENT`, **no** es variancia de plataforma)

| | |
|---|---|
| Archivo | `test/integration/app/e2e-global-03b-authoritative-auth-boundary.fastify.test.ts` (1, fallo a nivel de archivo) |
| Causa | Antes de importar nada del servidor ni del launcher, el archivo exige `SUPABASE_DB_URL` o `DATABASE_URL` con host `localhost`/`127.0.0.1` y base `portal_vetneb_ci`; si no, lanza `Error` en la línea 21 |
| Síntoma | `Error: E2E-GLOBAL-03B requiere DATABASE_URL o SUPABASE_DB_URL para la DB aislada portal_vetneb_ci` |
| Evidencia | La condición no depende de la plataforma (no hay rama por `process.platform` en el archivo); en CI hay servicio Postgres (§18) y Backend CI = `success` |
| Clase | `ENVIRONMENT_DEPENDENT` — precondición ausente, no `FALSE_RED` |

```text
9 FAILED  =  8 (PLATFORM_VARIANCE, launcher, win32)  +  1 (ENVIRONMENT_DEPENDENT, DB)
```

Impacto real: `AGENTS.md` §1 fija el entorno del proyecto como **Windows +
PowerShell**, y §6 exige `pnpm validate:local` como gate. Con los 8 rojos del
launcher, `pnpm validate:local` **nunca** puede reportar PASSED en la máquina
del owner; corregirlos **no basta** por sí solo, porque el fallo de DB persiste
mientras no exista la DB aislada y, sin ella, el gate se reporta BLOCKED con la
precondición nombrada (§29), no PASSED. Un gate que siempre falla deja de ser
señal: entrena a ignorar el rojo y oculta regresiones reales detrás del ruido
conocido. Por eso el grupo A es P1 y no P3, aunque CI esté verde.

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

> **Nota post-remediación — `TEST-GLOBAL-04`, verificada sobre `main@247a497c`
> (2026-09-23).** La tabla anterior es la fotografía de §3.1 y se conserva sin
> editar. Estado vigente de las filas que cambiaron:
>
> - **Tenant isolation / IDOR** → `MUTATION_PROOF_PRESENT` (#1763): el registro
>   dereferencia su evidencia y lleva negative proof ejecutable (path inventado,
>   evidencia materialmente inválida y código comentado ponen el guard en rojo).
> - **Redacción de logs sensibles** → `MUTATION_PROOF_PRESENT` (#1766): evaluador
>   sobre `server/lib/logger.ts` con mutaciones en memoria que lo ponen en rojo.
> - **Invariantes productivas de seguridad** → **sólo** el contrato
>   `Secure`/`SameSite` de `server/lib/env.ts` pasa a `MUTATION_PROOF_PRESENT`
>   (#1767, `security-session-cookie-boundaries.test.ts`), incluidas las dos
>   mutaciones del ejemplo anterior (asignación posterior y línea comentada) que
>   el substring deja en verde. `security-production-invariants.test.ts` no
>   cambió y conserva `NO_NEGATIVE_PROOF` para el resto de sus invariantes.
>
> `Ownership de recursos` y `Cut-off de validación` siguen en
> `MUTATION_CANDIDATE`. No son filas de la matriz de §17, pero el primero
> pertenece al dominio *tenant isolation* del Scope de `04` y figura como
> pendiente en su dimensión B; el segundo queda fuera de los seis dominios y
> sin adjudicar (ficha de `TEST-GLOBAL-04`).

### 11.2 Estrategia posterior

`TEST-GLOBAL-12` **no** introduce Stryker ni mutation testing indiscriminado.
Propaga el harness en memoria que ya existe y funciona (9 archivos), en este
orden: (1) tenant isolation/IDOR, (2) auth y sesiones, (3) permisos y roles,
(4) redacción y disclosure, (5) rate limiting, (6) registries de governance.

> **Nota de ownership (2026-09-23).** Las fichas ejecutables de `12` no
> contienen esta propagación: `12A` excluye `test/**` y el mutation testing de su
> scope, y `12B` es ci-only. Los puntos (1)–(5) están transcritos en el Scope de
> `TEST-GLOBAL-04`, que es su dueño ejecutable, y lo que sigue pendiente figura
> allí (dimensión B). El punto (6) no tiene ninguna ficha que lo asigne. Esta
> nota no lo reasigna.

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
| `Math.random` / `randomUUID` / `randomBytes` | 4 |
| `before` / `beforeEach` / `after` / `afterEach` | 4 |

| Clase | Valoración |
|---|---|
| `DETERMINISTIC` | Mayoría de la suite. Superficie de no-determinismo notablemente pequeña para 4.530 tests |
| `CONTROLLED_NONDETERMINISM` | Parches de `globalThis.fetch` y singletons, restaurados en `finally` (§12.4) |
| `ORDER_DEPENDENT` | 8 de 11 archivos que mutan `process.env` no restauran. **Contenido a intra-archivo** (§13.2) |
| `PLATFORM_DEPENDENT` | 8 tests (§10.2, grupo A) + 1 skip condicional por symlink en Windows |
| `UNCONTROLLED_NONDETERMINISM` | **No identificado** |
| `ENVIRONMENT_DEPENDENT` | `pnpm test` local requiere DB desde #1711 para `validate:local`; en CI hay servicio Postgres. Incluye el fallo de `e2e-global-03b-authoritative-auth-boundary` (§10.2, grupo B) |

### 13.1 Duplicación de lectores de source

| Definición local | Archivos |
|---|---:|
| `function read(` | 216 |
| `function readSource(` | 65 |
| `function walk(` | 18 |
| `function collectFiles(` | 4 |
| `function listFiles(` / `collectSourceFiles(` | 4 |
| **Archivos con lector propio** | **283** |

Frente a **8 importadores** del helper canónico `tracked-source-files.ts`
(§6.4; recomputado sobre §3.2). `DUPLICATE_SOURCE_OF_TRUTH` de la operación más
repetida de la suite.

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

**Estándar de guard enterprise (definición normativa, transcrita aquí para que
este documento sea autosuficiente).** Un guard de arquitectura es
enterprise-grade cuando cumple las cuatro propiedades siguientes:

```text
NEW_VIOLATION    → FAIL    una violación nueva, introducida por un archivo que
                           el guard no conocía, lo pone en rojo (auto-discovery)
STALE_EXCEPTION  → FAIL    una excepción, allowlist o entrada de registry que ya
                           no corresponde a nada real lo pone en rojo
UNSUPPORTED_SYNTAX → FAIL  una grafía que el guard no sabe analizar lo pone en
                           rojo, en vez de pasar en silencio (fail-closed)
KNOWN_ALLOWED_CASE → PASS  un caso legítimo y declarado no produce falso rojo
```

Las tres primeras son fail-closed: ante duda, rojo. La cuarta impide que el
guard sea ruido. Evaluación de los 96 guards contra ese estándar:

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

La tabla de poblaciones es la medición de §3.1. La matriz por contrato es la
matriz viva de `TEST-GLOBAL-04`: la columna «Negative proof (§3.1)» conserva la
clasificación original y «Estado vigente» registra el estado verificado sobre
`main@247a497c` (2026-09-23).

Matriz por contrato:

| Threat | Boundary | Expected deny | Negative proof (§3.1) | Estado vigente | Source of truth |
|---|---|---|---|---|---|
| Cross-tenant IDOR | `clinicId` scoping | 403/404 sin disclosure | **AUSENTE** (§9.1) | `MUTATION_PROOF_PRESENT` (#1763) | `security-cross-tenant-idor-contract.test.ts`: registro que dereferencia evidencia trackeada + negative proof en memoria |
| Cross-realm rate limit | Realm admin/clinic/particular | 429 aislado | PRESENTE | `NEGATIVE_FIXTURE_PRESENT` (sin cambios) | `app.inject()` — `security-rate-limit-cross-realm-isolation.test.ts` |
| CSRF | Rutas mutantes | Rechazo sin token | PRESENTE | `NEGATIVE_FIXTURE_PRESENT` (sin cambios) | `app.inject()` — `security-csrf-mutating-route-coverage.test.ts` |
| Trusted origin / CORS | Origin allowlist | Sin `ACAO` | PRESENTE | `NEGATIVE_FIXTURE_PRESENT` (sin cambios) | `app.inject()` — `security-trusted-origin-cors-boundaries.test.ts` |
| Sesión / cookies | `admin_session_id` / `app_session_id` | 401 | PRESENTE (comportamiento) + AUSENTE (config en `env.ts`) | `NEGATIVE_FIXTURE_PRESENT` (comportamiento, sin cambios) + `MUTATION_PROOF_PRESENT` (config `Secure`/`SameSite` en `env.ts`, #1767) | `app.inject()` — `auth-session-boundaries.test.ts` + evaluador sobre `server/lib/env.ts` — `security-session-cookie-boundaries.test.ts` |
| Enumeración de tokens | Selector hostil | Sin disclosure | PRESENTE | `NEGATIVE_FIXTURE_PRESENT` (sin cambios) | `app.inject()` — `token-access-enumeration-disclosure-regression.test.ts` |
| Redacción de logs | Logger | Sin secretos | AUSENTE | `MUTATION_PROOF_PRESENT` (#1766) | Evaluador sobre `server/lib/logger.ts` — `security-sensitive-log-redaction-boundaries.test.ts` |
| `no-store` privado | Headers | `no-store` | PARCIAL | `MUTATION_PROOF_PRESENT` (#1768) | Evaluador sobre `server/lib/http/sensitive-response-cache.ts` y el cableado `onSend` de `server/fastify-app.ts` — `backend-api-no-store-cache-contract.test.ts` |

«Sin cambios» significa que el archivo de test es idéntico al de §3.2
(`git diff 38fe1dfe 247a497c` vacío sobre esos paths). Ninguna fila de la matriz
es evidencia runtime de staging (§35).

**Esta matriz es sólo la dimensión A de `TEST-GLOBAL-04`.** Tenerla completa
no cierra `04` si quedan guards estáticos de su Scope sin mutation proof
(dimensión B, en la ficha). Una prueba runtime `NEGATIVE_FIXTURE_PRESENT` no
reemplaza el mutation proof de un guard estático distinto. Por ejemplo,
`security-rate-limit-cross-realm-isolation.test.ts` no prueba la fuerza de
detección de `security-rate-limit-isolation-boundaries.test.ts`.

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

Concuerda con §33: `test/README.md` documenta como canónicos dos paths —
`test/integration/adapters/repositories/` y `test/integration/external-services/`—
que **no existen en el árbol**. Verificado sobre §3.2: 0 archivos tracked y el
directorio ausente en el working tree para ambos. La redacción precisa es
**"paths canónicos documentados pero ausentes del árbol"**, no "carpetas
vacías": la diferencia importa porque un directorio vacío no sobrevive a `git`,
de modo que `TEST-GLOBAL-09` no encuentra una carpeta que poblar sino un path
que crear o que retirar de la documentación.

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

**Frontera de capa entre `test/**` y `frontend/e2e/**` (definición normativa,
transcrita aquí para que este documento sea autosuficiente).** La capa correcta
de un test frontend se decide por la **naturaleza del contrato**, no por su
coste ni por la carpeta donde ya vive:

```text
SOURCE / CONFIG CONTRACT   → test/**          (next/link=0, CSP, metadata, SEO, manifest)
REAL BROWSER CONTRACT      → frontend/e2e/**  (render, interacción, estados, geometría)
```

Criterio de decisión: si el contrato puede violarse **sin que cambie el texto
del source** (porque depende de render, de layout, de foco, de orden de eventos
o de estado en tiempo de ejecución), es contrato de navegador y su oracle vive
en `frontend/e2e/**`. Si la violación exige necesariamente cambiar el source o
una configuración, es contrato estático y su oracle vive en `test/**`.

Aplicar esta frontera **no autoriza a mover nada automáticamente** ni a reabrir
`LIMPIEZA E2E`: cualquier traslado sigue el procedimiento `RELOCATE` de §31.6.

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
| Assertions de conteo congelado (`.length, <n>`) — misma línea | **426** en **116 archivos** |
| ídem, incluyendo las formateadas en varias líneas | **498** en **134 archivos** |
| Registries literales (`const X = [ … ]` en el test) | 75 archivos |

**Corrección de esta revisión (`TG-A13`).** La cifra 426/116 es correcta pero
**parcial**: procede de un censo line-scoped (`grep -oE`), que por construcción
no puede ver una assertion escrita así:

```ts
assert.equal(
  registry.length,
  42,
);
```

Recomputado sobre §3.2 con un censo que lee el archivo completo (A.3c), hay
**72 assertions adicionales** de esa forma: 426 + 72 = **498**, en 134 archivos.
La cifra operativa de `TEST-GLOBAL-11` es **498 / 134**, no 426 / 116. El coste
de edición colateral que describe §27 es, por tanto, un 17 % mayor de lo que
indicaba la medición original.

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
| `LINE_COVERED` | Medible on-demand con `pnpm test:coverage`; no publicado ni versionado. Mide **ejecución** de módulos instrumentados, no lectura |
| `BRANCH_COVERED` | Reportado por el mismo comando (columna `branch %`); no publicado ni versionado |
| `SEMANTICALLY_COVERED` | **No medido por coverage.** Los tests que sólo leen source como datos no dejan señal de ejecución sobre ese source (ver abajo); su protección semántica debe juzgarse por el oracle (§7.3, §8.2), no por este eje |
| `MUTATION_SENSITIVE` | 9 archivos (§11) |

#### 21.1 Qué se observó (y qué no)

El coverage nativo de Node reporta los módulos instrumentados que el proceso de
test **ejecuta**. Leer un archivo con `readFileSync` lo trata como datos: no lo
ejecuta ni lo instrumenta, y por tanto no genera señal de coverage sobre él. Se
verificó por ejecución (R0, `main@ee8e7425`, win32, Node v24.14.1):

```bash
node --experimental-strip-types --experimental-specifier-resolution=node \
     --experimental-test-coverage --test \
     test/unit/ui/dashboard/frontend-dashboard-empty-states.test.ts
# tests pass; la tabla de archivos queda VACÍA y sólo aparece la fila
# "all files | 100.00 | 100.00 | 100.00" sin ningún archivo listado
```

- El spec que asserta sobre `ClinicCommandCenter.tsx` **no** produce fila alguna
  para ese `.tsx`. No hay cobertura atribuida al acto de leerlo.
- Corrida completa (`pnpm test:coverage`, con 9 FAILED preexistentes, §3): la
  tabla lista 226 archivos; de `frontend/src/**` sólo aparecen módulos `.ts`
  importados y ejecutados por otros tests (p. ej. `src/lib/routes.ts`,
  `src/lib/security/csp-policy.ts`) y **ninguna fila `.tsx`**.
- Por tanto el problema **no** es una inflación de coverage causada por
  `readFileSync`, sino la **ausencia de señal**: un contrato estático basado
  exclusivamente en leer source como datos puede no dejar señal ejecutable de
  coverage sobre ese source.

Cuatro ejes que no deben confundirse:

| Eje | Qué responde | Lo aporta |
|---|---|---|
| Line/branch execution coverage | ¿Qué líneas y ramas de módulos importados ejecutó algún test? | `pnpm test:coverage` |
| Static source contract coverage | ¿Qué archivos de source vigila un guard estático? | El propio guard (walkers, registries); no lo mide coverage |
| Semantic protection | ¿La assertion detectaría un cambio real de comportamiento? | El oracle (§7.3, §8.2) |
| Mutation sensitivity | ¿Una mutación concreta pone el guard en rojo? | Harness de mutación (§11) |

Advertencia metodológica que el programa debe respetar: la fila agregada de un
coverage report sobre esta suite describe sólo el código que la suite ejecuta.
No dice nada sobre los guards estáticos, ni a favor ni en contra: un guard que
lee `frontend/src/**` no suma ni resta a ese porcentaje. Este documento **no**
afirma que el baseline de coverage "mida" guards estáticos, ni que el
porcentaje esté inflado por ellos. Publicarlo sin esta salvedad induciría a
interpretar el número como medida de protección de los contratos estáticos, que
es una lectura que la evidencia no respalda.

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

Ningún test se marca hoy como redundante confirmado: exigir la prueba de
equivalencia de §31.6 (mismo contrato con owner verificable, misma clase de
mutación detectada, negative proof y fail-closed preservados tras eliminar uno)
requiere la adjudicación de `TEST-GLOBAL-06`.

```text
TESTS_REDUNDANTES_CONFIRMADOS = 0
```

## 24. Performance de la suite

**Procedencia de las cifras de esta sección — dos conjuntos distintos, cada uno
con una sola clasificación** (A.0). No se mezclan ni se reutilizan bajo la misma
regla:

| Conjunto | Qué incluye | Clase | Regla de reutilización |
|---|---|---|---|
| **Tiempos observados** | `26.422 ms` y `298,7 ms` (corrida original); `146.129 ms` y `1.864 ms` (re-ejecución en la misma máquina) | `HISTORICAL_EXECUTION_EVIDENCE` | Son evidencia de que una corrida ocurrió, **no** cifras estables. Dependen del host y del momento. Ninguna aceptación de fase puede compararse contra ellas |
| **Pareto y ranking derivados** | 50 % → 33 entradas · 80 % → 130 entradas · tabla de entradas más caras · tiempo agregado 133,6 s | `AUDIT_DERIVED_NOT_YET_REPRODUCIBLE` | Salen de procesar la salida TAP con un script **no versionado**. Toda decisión que dependa de ellas las recomputa primero (`TEST-GLOBAL-01B`) |

```text
wall time           26,4 s        (4.590 entradas)   → HISTORICAL_EXECUTION_EVIDENCE
tiempo agregado    133,6 s        (derivado)         → AUDIT_DERIVED_NOT_YET_REPRODUCIBLE
```

Pareto (derivado, `AUDIT_DERIVED_NOT_YET_REPRODUCIBLE`):

```text
50 % del tiempo agregado  →   33 entradas   (0,7 %)
80 % del tiempo agregado  →  130 entradas   (2,8 %)
```

Entradas más caras (ms) — ranking derivado, misma clase que el Pareto:

| ms | Entrada |
|---:|---|
| 3.529 | overlay config refuses to load outside the production runner |
| 3.250 | a real leak's finding message names the variable and file |
| 3.209 | oversized public bundle is scanned without skip notes |
| 3.122 | E2E-GLOBAL-11: the Fastify census resolves every registered route |
| 2.744 | sensitive marker split across chunks in oversized public bundle |
| ~1.500–2.400 | familia `M44`/`M45`/`M46`/`M35`/`M41` (censos de árbol completos) |

**Conclusión explícita, y contraria a la hipótesis con la que se abrió esta
auditoría: la performance de la suite NO es un problema.** 4.530 tests en 26,4 s es un
resultado excelente. El coste se concentra en guards que re-recorren el árbol
completo de forma independiente (consecuencia de §13.1), y su optimización
natural es un subproducto del helper canónico, no una fase propia.

Clasificación de optimizaciones candidatas:

| Optimización | Clase |
|---|---|
| Lector canónico con cache por proceso | `SAFE_EQUIVALENT` (subproducto de `TEST-GLOBAL-05A`) |
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
edición**: con 50 archivos de producción ya a ≥ 11 guards y 498 assertions de
censo congelado, duplicar el tamaño duplica el número de ediciones colaterales que
exige cada PR. El riesgo a escala es de **fricción de refactor y erosión de la
confianza en el rojo**, no de performance.

## 28. Riesgos

| ID | Categoría | Severidad | Hallazgo | Evidencia |
|---|---|---|---|---|
| `TG-R01` | `CIRCULAR_ORACLE` + `FALSE_GREEN` | **P0** | Contrato cross-tenant IDOR probado contra un literal del propio test; 15/18 contratos no tocan producción | §9.1 |
| `TG-R02` | `STALE_GUARD` + `FAIL_OPEN_GUARD` | **P0** | 11 rutas de `requiredTestEvidence` inexistentes y no dereferenciadas: nada detecta la rotura | §9.2 |
| `TG-R03` | `FALSE_GREEN` + `WEAK_ASSERTION` | **P1** | 1.264 tests (157 archivos) con ≥80 % substring y sin runtime; mutación escapante demostrada | §8.2, §10.1 |
| `TG-R04` | `PLATFORM_VARIANCE` + `FALSE_RED` | **P1** | 8 tests rojos permanentes en win32 por el launcher de Playwright; `validate:local` nunca PASSED en el entorno del owner. Un noveno FAILED es una precondición de DB ausente (`ENVIRONMENT_DEPENDENT`), fuera de este riesgo | §10.2 |
| `TG-R05` | `COVERAGE_GAP` | **P1** | Contratos de seguridad estáticos sin prueba negativa: 0 de 9 harness de mutación en `architecture/security/**` | §11 |
| `TG-R06` | `ACCIDENTAL_COUPLING` | **P1** | 137 archivos / 1.042 tests candidatos, 89 % en `unit/ui/**` | §7.3 |
| `TG-R07` | `MOCK_DRIFT` | **P2** | 659 `as any` en la costura test↔runtime; el tipado no detecta cambio de contrato de puertos | §12.3 |
| `TG-R08` | `PERFORMANCE_DEBT` (gobernanza) | **P2** | `test/**` (156.700 LOC) sin ninguna regla de lint | §25.2 |
| `TG-R09` | `DUPLICATE_SOURCE_OF_TRUTH` | **P2** | 283 lectores de source ad hoc vs **8** importadores del helper canónico | §6.4, §13.1 |
| `TG-R10` | `COVERAGE_GAP` | **P2** | 0 tests de repositorio y 0 de servicio externo; los dos paths canónicos están documentados en `test/README.md` pero **ausentes del árbol** | §18, §33 |
| `TG-R11` | `OVER_SPECIFICATION` | **P2** | Difusión de ownership: 50 archivos de producción con ≥11 guards; `api.ts` con 45 | §23 |
| `TG-R12` | `FIXTURE_DRIFT` | **P2** | `fastify-app-route-stubs.ts` (762 LOC, 2 consumidores) y `dashboard-operational-contract.ts` (552 LOC, 1) sobre-especializados | §12.1 |
| `TG-R13` | `STALE_GUARD` (coste) | **P3** | **498** assertions de censo congelado en **134** archivos (426/116 en el censo line-scoped original, §20); `M48` con triple fuente de verdad | §20 |
| `TG-R14` | `DOCUMENTATION_DRIFT` | **P3** | El árbol canónico de `test/README.md` documenta 2 paths ausentes del árbol y omite `unit/application`, `unit/clinics`, `unit/pricing` | §18, §33 |
| `TG-R15` | `NONDETERMINISM` | **P3** | 8 de 11 archivos mutan `process.env` sin restaurar (acotado a intra-archivo por aislamiento de proceso) | §13.2 |
| `TG-R16` | `WEAK_ASSERTION` | **P3** | Inconsistencia de normalización CRLF: 295 normalizan, 36 lectores no | §13.1 |

```text
TECHNICAL_P0 = 2      TECHNICAL_P1 = 4      TECHNICAL_P2 = 6      TECHNICAL_P3 = 4
```

Severidades deliberadamente no infladas: `TG-R01`/`TG-R02` son P0 porque afectan
un **control de seguridad presentado como verificado**; nada más se eleva a P0.

### 28.1 Dos registros de hallazgos que no se suman

Este documento mantiene **dos series separadas** y nunca las agrega en un mismo
conteo:

```text
TG-Rxx   riesgo TÉCNICO del subsistema de tests.
         Se cierra implementando una fase TEST-GLOBAL-*.
         Inventario (§28): 2 P0 · 4 P1 · 6 P2 · 4 P3. Estado vigente por
         riesgo: Veredicto.

TG-Axx   hallazgo de CALIDAD de esta auditoría y de su roadmap.
         Se cierra corrigiendo ESTE documento.
         Estado actual: 13 hallazgos, todos CORRECTED_IN_THIS_REVISION (§37).
```

Un `TG-Axx` corregido **no** incrementa el conteo técnico ni lo reduce: son
planos distintos. Que la gobernanza del roadmap esté corregida no cierra ningún
riesgo técnico; que un riesgo técnico siga abierto no invalida la corrección de
gobernanza. El único punto de contacto es que `TG-A13` corrigió una **cifra**
citada por `TG-R13` (426/116 → 498/134) sin cambiar su severidad P3.

## 29. Bloqueantes

```text
Bloqueantes para iniciar el programa   =   NINGUNO
```

| Condición | Estado |
|---|---|
| Baseline reproducible | Capturado (§3) |
| CI verde sobre el baseline | Verificado (`Backend CI` = success @ `ee8e7425`) |
| `LIMPIEZA E2E` cerrado | Verificado (CLOSED, last verified 2026-09-21) |
| Autorización R2 para lint | **Requerida** para `TEST-GLOBAL-05B` (`eslint.config.mjs`). No bloquea `05A`, que es R1 |
| Autorización R2 para CI | **Requerida** para `TEST-GLOBAL-12B` (workflow de coverage, ci-only). Su default es **no ejecutarse**; `12A` es docs-only y no la necesita |
| Autorización R2 para producto | **Requerida** para `TEST-GLOBAL-10A` (inyección en email/storage/`ENV`) y `TEST-GLOBAL-10C` (registro de plugins Fastify). No bloquea `10B` ni `10D`, que son test-only |
| DB para gates locales | `pnpm validate:local` queda BLOCKED sin DB desde #1711; reportar como ambiental |

## 30. Estado objetivo

**Regla de trazabilidad (`TG-A06`): toda métrica de cierre mapea a exactamente
una fase dueña.** Un objetivo sin fase dueña es un objetivo que nadie ejecuta y
que bloquearía el cierre para siempre; por eso la columna "Fase dueña" es
obligatoria y §36 sólo puede exigir objetivos que la tengan.

| Eje | Objetivo medible | Fase dueña |
|---|---|---|
| Arquitectura | 100 % de specs clasificados; `test/*.test.ts` = 0; capa inferida == carpeta; helper de lectura canónico único | `01B`, `05A`, `06` |
| Confiabilidad | 0 falsos rojos de launcher tolerados en win32; `validate:local` capaz de PASSED en el entorno del owner **cuando su precondición de DB está satisfecha**, y BLOCKED con esa precondición nombrada cuando no lo está | `03` |
| Source coupling | 137 candidatos adjudicados a 100 %; guards legítimos preservados sin excepción; acoplamiento accidental corregido o registrado con owner y motivo | `06`, `07`, `08` |
| Assertions | 0 contratos críticos con oracle sólo-presencia; substring ratio < 20 % **en las carpetas remediadas por `07`/`08`** | `04`, `07`, `08` |
| Seguridad | Prueba negativa en tenant isolation, auth, permisos, redacción y rate limit; 0 registries stale no dereferenciados | `02`, `04` |
| Mocks — costuras de infraestructura | 0 `as any` sobre `ENV`, email y storage; ownership declarado por double | `10A` → `10B` |
| Mocks — costuras de inyección de rutas | 0 `as any` en el registro de plugins Fastify (`clinicAuthNativeRoutes as any` = 9 sobre §3.2) y criterio declarado para los casts de `req`/`res`/`reply` (47) | `10C` → `10D` |
| Performance | Mantener wall time < 60 s; ninguna optimización con pérdida semántica | subproducto de `05A`; sin fase propia (§24) |
| Gobernanza | `test/**` bajo lint; coverage baseline publicado con su salvedad metodológica (§21) | `05B`, `12A`, `12B` |

Nota sobre el eje "Assertions": el objetivo original decía *substring ratio
global < 20 %*. Esta revisión lo acota a las carpetas efectivamente remediadas
porque el ratio global depende de los 137 candidatos adjudicados, y `06` puede
resolver legítimamente muchos de ellos como `KEEP` (§31.6): exigir un ratio
global sería exigir retirar guards legítimos para mover un número. El objetivo
sustantivo —ningún contrato crítico con oracle sólo-presencia— se conserva
intacto y es el que §36 audita.

## 31. Roadmap `TEST-GLOBAL-*`

La secuencia inicialmente prevista se **modificó según la evidencia recogida en
§§6–29**:

- se **elimina** la fase autónoma de performance (§24: no hay problema);
- se **adelanta** la seguridad al inicio (P0 real);
- se **añade** una fase de falso rojo win32 del launcher (8 de los 9 FAILED locales; bloquea el gate local);
- se **divide** la remediación de `unit/ui` en adjudicación + dos olas;
- se **añade** una fase de testability de producto (R2, fuera de test-only).

### 31.0 Convenciones normativas del roadmap

Estas reglas son vinculantes para toda fase y subfase. Derivan de `AGENTS.md`
y no lo relajan en ningún punto.

**Ficha obligatoria.** Ninguna fase es ejecutable sin los trece campos:

```text
ID · Objetivo · Tipo de scope · Paths permitidos · No-scope · Riesgo
Autorización · Dependencias · Aceptación · Gates · Rollback · Output · Coste
```

**Vocabulario de riesgo.** Sólo `R0`, `R1`, `R2` o `R3`, tal como los define
`AGENTS.md` §3.1. **Prohibido** escribir `R0/R1` o cualquier categoría
compuesta: si una fase contiene acciones de riesgo distinto, se declara el
riesgo **máximo** de la fase y se enumera por acción cuál es cuál.

**Un scope por entrega.** `AGENTS.md` §4 obliga a entregar por separado
docs-only, test-only, config-only, scripts-only, backend-only, frontend-only y
ci-only. Una fase que abarque dos scopes primarios se **divide en subfases**
con sufijo (`05A`/`05B`), cada una con ficha completa propia. La excepción
mixed-scope existe, pero exige enumerar cada scope, justificar por qué los
dominios no pueden entregarse por separado, y declarar la frontera de
acoplamiento y la de rollback. **En este roadmap no se invoca en ninguna fase.**

**Rollback obligatorio y específico.** Toda subfase declara su rollback. Para
cambios sin efecto en runtime productivo, «revertir el commit» es suficiente y
se declara así. Para cualquier cambio con impacto estructural o productivo
(`10A`, `10C`, `12B`), «revertir el commit» **no** es un rollback válido por sí
solo: la ficha declara qué queda en estado intermedio y cómo se restablece.

**Estados canónicos.** Los gates se reportan exclusivamente como `PASSED`,
`FAILED`, `NOT_RUN`, `NOT_AVAILABLE` o `BLOCKED` (`AGENTS.md` §6). `BLOCKED`
nombra siempre la precondición ausente. **`BLOCKED` no es `PASSED`** y no puede
usarse para cerrar un criterio de aceptación: sólo para declarar honestamente
que un gate no pudo ejecutarse.

**Precondición de DB y falsos rojos de launcher — regla transversal.**

La suite tiene **dos** fuentes de fallo no atribuibles al cambio en curso, con
causas **independientes** que nunca se agregan ni se confunden (§10.2):

```text
GRUPO A · launcher win32   8 FAILED · PLATFORM_VARIANCE · lo corrige TEST-GLOBAL-03
GRUPO B · DB aislada       1 FAILED · ENVIRONMENT_DEPENDENT · precondición de entorno
```

El estado esperado depende de **si `03` ya está fusionada** y de **si la DB
existe**. Los tres estados posibles son:

```text
┌─ PRE-03  (TEST-GLOBAL-03 no fusionada; DB ausente) ────────────────────────┐
│  launcher       = 8 FAILED conocidos y nominados  (grupo A, preexistentes) │
│  DB             = 1 FAILED por precondición ausente (grupo B)              │
│  total observado= 9 FAILED   ← el baseline de §3.5                         │
│  gate pnpm test = BLOCKED, declarando el desglose "launcher 8 / DB 1"      │
└────────────────────────────────────────────────────────────────────────────┘

┌─ POST-03  (03 fusionada; DB ausente) ──────────────────────────────────────┐
│  launcher       = 0                                                        │
│  DB             = 1 FAILED (grupo B)                                        │
│  gate pnpm test = BLOCKED por la precondición "DB aislada portal_vetneb_ci  │
│                   ausente", declarando "launcher 0 / DB 1"                  │
└────────────────────────────────────────────────────────────────────────────┘

┌─ POST-03  (03 fusionada; DB disponible) ───────────────────────────────────┐
│  launcher       = 0                                                        │
│  DB             = 0                                                        │
│  gate pnpm test = PASSED                                                    │
└────────────────────────────────────────────────────────────────────────────┘
```

Reglas derivadas, vinculantes:

- **Los 8 fallos del grupo A son `FAILED`, no `BLOCKED`.** Son rojos reales de un
  guard que asserta un literal de plataforma; `BLOCKED` describe un gate que no
  pudo ejecutarse, y estos se ejecutan y fallan. Reclasificarlos como `BLOCKED`
  ocultaría un defecto corregible detrás de una precondición ambiental ajena.
- **El fallo del grupo B es una precondición ausente**, no un defecto del código.
  Mientras la DB no exista, el gate agregado `pnpm test` se reporta `BLOCKED`
  nombrando la precondición, **nunca `PASSED`** y nunca un `FAILED` silencioso.
- Toda fase que se ejecute **antes** de `03` (`01B`, `02`, y `05A` si se
  adelanta) declara su estado contra el bloque PRE-03: su criterio es **0 fallos
  atribuibles a la fase**, sobre una línea base de 9 fallos preexistentes
  nominados. Declarar «1 fallo esperado» en ese estado sería falso.
- Toda fase posterior a `03` declara contra POST-03 y su línea base es 1 (DB
  ausente) o 0 (DB disponible).

**Ninguna fase puede escribir «`pnpm test` verde» como criterio de aceptación.**
La forma admitida es: *«0 fallos atribuibles a esta fase; los fallos
preexistentes del estado vigente (PRE-03 o POST-03) se conservan sin modificar,
nominados y con su gate agregado reportado `BLOCKED` con la precondición
nombrada»*. Prohibido, en toda fase: suministrar credenciales, leer `.env`,
montar una DB, o convertir cualquiera de esos fallos en `skip` o en `PASSED`.

### 31.1 Tabla maestra de fases

| Fase | Título | Scope primario | Riesgo | Autorización | Depende de |
|---|---|---|---|---|---|
| `TEST-GLOBAL-01A` | Alta documental del programa (`TDR-002`, `docs/audit/README.md`) | docs-only | R1 | — | — |
| `TEST-GLOBAL-01B` | Instrumentación del censo (contrato de censo y tooling versionado) | test-only | R1 | — | 01A |
| `TEST-GLOBAL-02` | **P0** — De-circularizar el registro IDOR y sanear evidencia stale | test-only | R1 | — | 01 |
| `TEST-GLOBAL-03` | **P1** — Falso rojo win32 del launcher: restaurar el gate local | test-only | R1 | — | 01 |
| `TEST-GLOBAL-04` | **P1** — Prueba negativa para guards de seguridad (1 PR por contrato) | test-only | R1 | — | 02 |
| `TEST-GLOBAL-05A` | Lector canónico de source y migración de lectores ad hoc | test-only | R1 | — | 01 |
| `TEST-GLOBAL-05B` | Alta de `test/**` en `lintableFiles` y baseline de lint | config-only | **R2** | **Nico, explícita** | 05A |
| `TEST-GLOBAL-06` | Adjudicación de los 137 candidatos (sin modificar tests) | docs-only | R1 | — | 01, 05A |
| `TEST-GLOBAL-07` | Remediación `unit/ui` ola 1 — dashboard | test-only | R1 | — | 06 |
| `TEST-GLOBAL-08` | Remediación `unit/ui` ola 2 — admin, public, frontend | test-only | R1 | — | 07 |
| `TEST-GLOBAL-09` | Integración de repositorios y servicios externos, o declaración de bloqueo | test-only | R1 | — | 05A |
| `TEST-GLOBAL-10A` | Costura de testabilidad en email/storage/`ENV` (puertos inyectables) | **backend-only** | **R2** | **Nico, explícita** | 09 |
| `TEST-GLOBAL-10B` | Realineación de tests y retiro de `as any` de infraestructura | test-only | R1 | — | 10A |
| `TEST-GLOBAL-10C` | Costura tipada en el registro de plugins Fastify | **backend-only** | **R2** | **Nico, explícita** | 10A |
| `TEST-GLOBAL-10D` | Retiro de `as any` en el registro de rutas y criterio para `req`/`res`/`reply` | test-only | R1 | — | 10C |
| `TEST-GLOBAL-11` | Consolidación de registries y censos congelados (incluido el de `01B`) | test-only | R1 | — | 05A, 01B |
| `TEST-GLOBAL-12A` | Publicación documental del baseline de coverage con su salvedad | docs-only | R1 | — | 04, 08 |
| `TEST-GLOBAL-12B` | Incorporación de `test:coverage` a CI como diagnóstico no bloqueante | ci-only | **R2** | **Nico, explícita** | 12A |
| `TEST-GLOBAL-13` | Gobernanza, documentación y certificación de cierre | docs-only | R1 | — | todas |

```text
FASES LÓGICAS  = 13   (TEST-GLOBAL-01 … 13)
SUBFASES       = 19   (por los splits de 01, 05, 10 y 12)
PRs            > 19   (04 entrega 1 PR por contrato; 07/08, 1 por subdominio;
                       05A y 10B, por lotes)
```

`12B` es **R2**, categoría única. Editar un archivo de workflow es R2
(`AGENTS.md` §3.1); todo lo que la elevaría a R3 —variables productivas,
secretos, environments, branch protection, settings de required checks— está
declarado **fuera de scope** en su ficha, con una regla de parada explícita: si
apareciera esa necesidad, la fase se detiene y se abre una tarea nueva con su
propia autorización. Su default sigue siendo **no ejecutarla**.

### TEST-GLOBAL-01 — Alta del programa e instrumentación (dos PRs: 01A → 01B)

`TEST-GLOBAL-01` es **una fase lógica entregada en dos PRs**, porque mezclar
documentación y un test nuevo en un mismo PR incumple `AGENTS.md` §4 (docs-only y
test-only se entregan separados) y no se invoca la excepción mixed-scope: los dos
dominios sí pueden entregarse por separado y cada uno tiene su propio rollback.
Toda dependencia "de `01`" (§31, §32) significa **ambos PRs fusionados**. El
orden 01A → 01B es recomendado; no hay acoplamiento de código entre ellos.

#### 01A — Alta documental (docs-only)

- **Objetivo**: poner el programa en el registro documental del repositorio y reclasificar las cifras de julio como históricas.
- **Problema**: `TDR-002` cita cifras de julio; el programa no figura en `docs/audit/README.md`.
- **Evidencia**: §6, §33. Verificado sobre §3.2: `TDR-002` vive en `docs/governance/technical-debt-register.md` y conserva «367 de 514 … 134 usos de `readdirSync` en 64 tests»; `docs/audit/README.md` no contiene ninguna fila de este programa.
- **Tipo de scope**: docs-only.
- **Paths permitidos**: `docs/governance/technical-debt-register.md`, `docs/audit/README.md`.
- **No-scope**: cualquier archivo bajo `test/**`, `server/**`, `frontend/**`, `scripts/**`, `drizzle/**` o `.github/**`; ninguna corrección de test; **este mismo documento** (modificarlo es un PR docs-only propio, §1).
- **Riesgo**: R1. **Autorización**: no requiere.
- **Dependencias**: ninguna. Es la entrada del programa.
- **Aceptación**: (1) `TDR-002` reclasificado como histórico con la cifra vigente (410/562) citada y el enlace a este documento; (2) fila del programa presente en `docs/audit/README.md` con el mismo formato que la fila de `LIMPIEZA E2E`; (3) `git diff --name-only` contiene exclusivamente los dos paths permitidos.
- **Gates**: `git diff --check` → `PASSED`. `pnpm test` → `NOT_RUN` (docs-only; `AGENTS.md` §6 matriz por dominio).
- **Rollback**: revertir el commit. No toca runtime, tests ni configuración; el rollback es completo y sin estado intermedio.
- **Output**: dos archivos de documentación actualizados.
- **Coste**: bajo. **Paralelizable**: no con `01B` por orden recomendado.

#### 01B — Instrumentación del censo (test-only)

- **Objetivo**: convertir las cifras heurísticas de la auditoría en censos recomputables desde el árbol.
- **Problema**: no existe censo versionado ni clasificación por spec; las cifras `AUDIT_DERIVED_NOT_YET_REPRODUCIBLE` de A.0 dependen de scripts de scratchpad que no están en el repo (A.4).
- **Evidencia**: §6, A.0, A.4.
- **Tipo de scope**: test-only.
- **Paths permitidos**: `test/architecture/**` (contrato de censo), `test/helpers/**` (tooling de clasificación como módulos `.ts` no-spec).
- **Scope**: un contrato de censo en `test/architecture/` que verifique las cifras de §6 clasificadas `REPRODUCIBLE_*` en A.0 y falle si divergen materialmente; versionar bajo `test/**` la clasificación heurística de A.4 (`classify`, `coupling`, `ownership`, `stale-paths`). Si se decidiera ubicar ese tooling bajo `scripts/`, sería scripts-only y exige un PR propio, no este.
- **No-scope**: cualquier archivo de `docs/**` (incluido este documento: registrar el resultado en A.0 es un PR docs-only posterior, §1); ninguna corrección de un test existente; `server/**`, `frontend/**`, `.github/**`.
- **Riesgo**: R1. **Autorización**: no requiere.
- **Dependencias**: `01A`.
- **Aceptación**: (1) el censo se reproduce desde el árbol ejecutando el tooling versionado; (2) cada cifra `AUDIT_DERIVED_NOT_YET_REPRODUCIBLE` de A.0 queda reproducida por el tooling **o** reclasificada con la diferencia numérica declarada en el propio contrato de censo — no se admite dejarla sin resolver ni promoverla sin evidencia; (3) el contrato cumple la regla de fuente única de §31.2; (4) **0 fallos atribuibles a esta fase** sobre el estado **PRE-03** de §31.0: 8 fallos de launcher (grupo A) y 1 de DB (grupo B) preexistentes y nominados, ninguno modificado por esta fase.
- **Gates**: `pnpm test` dirigido al nuevo contrato → `PASSED`. `pnpm test` completo → `BLOCKED`, declarando el desglose PRE-03 «launcher = 8 preexistentes (FAILED, los corrige `03`); DB-dependiente = 1 (precondición ausente)». `pnpm typecheck:test` → `PASSED`.
- **Rollback**: revertir el commit. No toca runtime productivo; el tooling y el contrato desaparecen juntos y ninguna otra fase depende todavía de ellos.
- **Output**: tooling de censo versionado + un contrato de arquitectura que lo ejerce.
- **Coste**: medio. **Paralelizable**: no (habilita al resto, junto con `01A`).

##### 31.2 Regla de fuente única para el censo de `01B` (`TG-A08`)

`01B` introduce un censo nuevo. Sin una regla explícita, reproduciría el mismo
patrón `FROZEN_CENSUS` + `DUPLICATE_SOURCE_OF_TRUTH` que `TG-R13` denuncia y que
`TEST-GLOBAL-11` debe sanear. El contrato de censo de `01B` **debe** declarar, en
el propio archivo, esta separación:

| Elemento | Dónde vive | Regla |
|---|---|---|
| **Fuente de verdad** | el árbol de trabajo (`git ls-files` + lectura) | Única. Ninguna cifra se declara a mano |
| **Cálculo** | el tooling versionado de `01B` | Determinista y sin red; misma salida para el mismo SHA |
| **Guard** | el contrato en `test/architecture/` | Compara cálculo contra **umbral o invariante**, no contra un literal exacto, salvo en las cifras que deban ser exactas por contrato |
| **Congelable** | sólo las cifras cuyo cambio deba forzar revisión humana (p. ej. `test/*.test.ts` = 0, `.only(` = 0) | Se congelan con motivo escrito en el propio test |
| **No congelable** | volúmenes que crecen por trabajo legítimo (número de specs, LOC, assertions) | Se verifican por **tendencia o rango**, nunca por igualdad exacta |
| **Actualización** | el PR que cambia el árbol realinea el censo en el mismo PR (`AGENTS.md` §4) | Nunca se debilita ni se marca skip |
| **Revisión** | `TEST-GLOBAL-11` | Obligatoria: `11` audita este censo junto con los 498 preexistentes |

Ese último punto es vinculante: **el censo introducido por `01B` entra
explícitamente en el scope de `TEST-GLOBAL-11`**, de modo que no escape al
programa que existe para consolidar censos.

### TEST-GLOBAL-02 — P0: de-circularizar el registro IDOR

- **Objetivo**: que el registro cross-tenant IDOR deje de asertar sobre su propio literal y pase a verificar producción, y que un registro roto rompa la suite.
- **Problema**: `TG-R01` + `TG-R02`.
- **Evidencia**: §9.1, §9.2. Verificado sobre §3.2: 18 contratos, `readSource()` sólo en `CTIDOR-016`/`017`/`018`, 11 paths de `requiredTestEvidence` inexistentes, 9 tests en el archivo.
- **Tipo de scope**: test-only.
- **Paths permitidos**: `test/architecture/security/**`, y los specs de `test/security/**` o `test/integration/**` que deban recibir el ledger reubicado.
- **Scope**: (a) realinear las 11 rutas stale a sus paths reales; (b) añadir un test que **dereferencie todas** las `requiredTestEvidence` y falle si alguna no existe (cierra el fail-open); (c) extender `readSource()` a los 15 contratos que hoy no verifican nada; (d) renombrar/reubicar lo que sea ledger de evidencia pendiente para que no se lea como contrato ejecutable.
- **No-scope**: `server/**`; no se debilita ninguna assertion existente; no se ejecuta evidencia de staging ni de producción (R3, `AGENTS.md` §17); no se retira ningún contrato del registro.
- **Riesgo**: R1. **Autorización**: no requiere.
- **Dependencias**: `01`.
- **Aceptación**: (1) 0 paths stale en `requiredTestEvidence`; (2) los 18 contratos dereferencian su evidencia; (3) **prueba negativa obligatoria dentro del propio PR**: un path inventado o una evidencia inválida introducida en el registro **pone la suite en rojo**, y el PR incluye el test que lo demuestra. Una prueba puramente positiva —«todos los paths existen»— **no satisface** este criterio: sin la prueba negativa el guard vuelve a ser fail-open y la fase no se acepta. Un registro documental de la corrección tampoco la sustituye.
- **Gates**: `pnpm test` dirigido a `test/architecture/security/**` → `PASSED`. `pnpm test` completo → `BLOCKED`, declarando el desglose **PRE-03** de §31.0 («launcher = 8 preexistentes; DB = 1»), ya que `02` puede fusionarse antes que `03`.
- **Rollback**: revertir el commit. Sólo afecta a `test/**`; el registro vuelve a su estado circular anterior, que es el estado documentado en §9.1 — se reabre `TG-R01`/`TG-R02`, no se pierde nada más.
- **Output**: registro IDOR ejecutable + guard fail-closed sobre su propia evidencia.
- **Coste**: medio. **Paralelizable**: sí, con `03`.

> **Frontera que `02` no cruza.** Cerrar el oracle circular **no** produce
> evidencia de aislamiento tenant en runtime. `02` demuestra que el registro
> verifica algo real; la prueba de que clínica A no accede a datos de clínica B
> en un entorno desplegado es evidencia de staging, es R3, se rige por
> `AGENTS.md` §17 y permanece como residual explícito (§35). Confundir ambas
> cosas volvería a presentar como verificado un control que no lo está — que es
> exactamente el defecto que `TG-R01` denuncia.

### TEST-GLOBAL-03 — P1: falso rojo win32

- **Objetivo**: devolverle señal al gate local, haciendo que el guard del launcher valide el contrato real en ambas plataformas en vez de anclar un literal de una sola.
- **Problema**: `TG-R04`. 8 rojos permanentes por el launcher (grupo A de §10.2) anulan `validate:local` en el entorno del owner. El noveno FAILED (`e2e-global-03b-authoritative-auth-boundary`, grupo B) es una precondición de DB ausente y **no** pertenece a esta fase.
- **Evidencia**: §10.2, A.5b.
- **Tipo de scope**: test-only.
- **Scope**: hacer que el guard resuelva el comando **a través del launcher**, de modo que valide el contrato real ("e2e:full corre sobre `next start`") en ambas plataformas, en vez de anclar un literal. Sólo los dos archivos del grupo A.
- **No-scope**: cambiar el launcher; debilitar o skipear el guard; marcar `test.skip` por plataforma; **tocar `e2e-global-03b-authoritative-auth-boundary`**, suministrar una DB, credenciales o `DATABASE_URL`, o convertir su fallo en skip/PASSED.
- **Aceptación** (separada por causa, según los tres estados de §31.0):
  - *Launcher*: los 8 fallos del grupo A pasan de **FAILED a 0** en win32 y siguen en 0 en CI; una mutación que quite el runner productivo sigue rompiendo el guard (prueba negativa obligatoria en el PR).
  - *DB*: el archivo del grupo B **no cambia**. Sin DB local aislada (`portal_vetneb_ci`) su fallo se conserva y el gate `pnpm test` completo se reporta `BLOCKED` con la precondición nombrada y el desglose POST-03 «launcher = 0; DB = 1». Con la DB disponible debe pasar sin modificaciones.
  - *Global*: `pnpm test` = 0 fail requiere **ambas** condiciones (launcher corregido **y** DB presente). Esta fase sólo es responsable de la primera; el tránsito que produce es PRE-03 → POST-03 de §31.0.
- **Riesgo**: R1 (toca sólo `test/**`). Si exigiera tocar `frontend/e2e/helpers/**`, se replantea como R2 y se pide autorización.
- **Autorización**: no requiere, salvo el caso R2 anterior.
- **Dependencias**: `01`.
- **Paths permitidos**: `test/unit/infrastructure/e2e-completeness-workflow.test.ts` y `test/unit/infrastructure/frontend-playwright-production-runner.test.ts`, y ningún otro.
- **Gates**: los dos archivos del grupo A → `PASSED` en win32 y en CI. `pnpm test` completo → `BLOCKED` con el desglose POST-03 «launcher = 0; DB = 1» (§31.0), o `PASSED` si la DB está disponible.
- **Rollback**: revertir el commit. Sólo afecta a dos archivos de `test/**`; el gate local vuelve a su estado de ruido conocido (8 rojos) y `TG-R04` se reabre.
- **Output**: gate local capaz de distinguir un rojo real de la variancia de plataforma.
- **Coste**: medio. **Paralelizable**: sí.

### TEST-GLOBAL-04 — P1: prueba negativa para seguridad

- **Objetivo**: que cada contrato de seguridad estático demuestre, con una mutación concreta, que detecta la regresión que dice proteger.
- **Problema**: `TG-R05`. 0 de 9 harness de mutación en `architecture/security/**` (verificado sobre §3.2).
- **Evidencia**: §11, §17.
- **Tipo de scope**: test-only. **Un PR por contrato.**
- **Paths permitidos**: `test/architecture/security/**`, `test/security/**`.
- **Scope**: propagar el harness en memoria ya probado a: tenant isolation, auth/sesiones, permisos/roles, redacción de logs, disclosure, rate limiting. Cada guard incorpora al menos una mutación que debe ponerlo en rojo.
- **No-scope**: debilitar cualquier contrato; introducir Stryker o mutation testing por herramienta externa; tocar `server/**`; producir evidencia de staging.
- **Riesgo**: R1. **Autorización**: no requiere. **Dependencias**: `02`.
- **Aceptación**: se evalúa en dos niveles —por PR y agregada de fase— definidos a continuación.
- **Aceptación — por PR (unidad)**: cada PR de `04` se acepta **de forma independiente**, sin esperar a los demás, cuando su único contrato cumple: (1) el guard incorpora al menos una mutación explícita en el propio test; (2) esa mutación pone el guard en rojo y el test lo demuestra; (3) el contrato pasa de `NO_NEGATIVE_PROOF` o `MUTATION_CANDIDATE` a `MUTATION_PROOF_PRESENT` en la matriz de §17 o, si es un guard de la dimensión B, en el inventario de esta ficha; (4) ninguna assertion previa se retira ni se debilita; (5) gates dirigidos en `PASSED`.
- **Aceptación — agregada (fase)**: `04` se declara cerrada sólo cuando se cumplen **las dos dimensiones**. Ninguna reemplaza a la otra. El cierre agregado es condición de `12A`, no de cada PR.
  - *Dimensión A — los ocho contratos de la matriz de §17*, según su clase en §3.1: (a) los que eran `AUSENTE` o `PARCIAL`, incluida la mitad de configuración de Sesión / cookies, llegan a `MUTATION_PROOF_PRESENT` o a un `accepted defer` con owner y fecha; (b) los que ya estaban en `NEGATIVE_FIXTURE_PRESENT` conservan esa clase sin degradarse. La clase (b) no exige harness de mutación, y un contrato sin harness no se reetiqueta `MUTATION_PROOF_PRESENT`.
  - *Dimensión B — guards estáticos del Scope*: cada guard de `test/architecture/security/**` que pertenece a uno de los seis dominios del Scope incorpora al menos una mutación explícita que lo pone en rojo, o tiene un `accepted defer` con owner y fecha. La dimensión A no cubre esta: un fixture runtime no prueba la fuerza de detección de un guard estático distinto. El inventario está más abajo, en «Progreso verificado».

  Los ocho de la dimensión A, nominados para que el criterio sea evaluable sin ambigüedad:

```text
1. Cross-tenant IDOR          5. Sesión / cookies
2. Cross-realm rate limit     6. Enumeración de tokens
3. CSRF                       7. Redacción de logs
4. Trusted origin / CORS      8. `no-store` privado
```

Al alta del programa (§3.1), los que carecían de prueba negativa suficiente y
por tanto definían el trabajo real de `04` eran: Cross-tenant IDOR (`AUSENTE`),
Redacción de logs (`AUSENTE`), `no-store` privado (`PARCIAL`) y la mitad de
configuración de Sesión / cookies (`AUSENTE` en `env.ts`). Los otros cuatro ya
estaban en `NEGATIVE_FIXTURE_PRESENT` y `04` sólo verifica que no se degraden.

**Progreso verificado sobre `main@247a497c` (2026-09-23). Estado: `IN_PROGRESS`.**

Dimensión A. Detalle en §17:

```text
Cross-tenant IDOR          MUTATION_PROOF_PRESENT   #1763  bbce3261  (PR de 02)
Redacción de logs          MUTATION_PROOF_PRESENT   #1766  fc1c6361
Sesión / cookies (config)  MUTATION_PROOF_PRESENT   #1767  8905197b
no-store privado           MUTATION_PROOF_PRESENT   #1768  247a497c
Rate limit · CSRF · CORS · Enumeración · Sesión (comportamiento)
                           NEGATIVE_FIXTURE_PRESENT sin degradación (tests sin cambios)
Backend CI en main         success en los cuatro merge commits
DIMENSIÓN A                CUMPLIDA — 0 accepted defer
```

Dimensión B. `test/architecture/security/**` tiene 17 archivos (`git ls-files`).
Sólo 3 tienen una mutación explícita en memoria, es decir, contienen
`replaceOnce(`. La asignación de cada guard a un dominio es
`MANUAL_CLASSIFICATION` y se hizo leyendo sus tests:

```text
Dominio del Scope   Guard (test/architecture/security/)            Estado
tenant isolation    security-cross-tenant-idor-contract            MUTATION_PROOF_PRESENT  #1763
tenant isolation    security-resource-ownership-boundaries         PENDIENTE
tenant isolation    security-actor-relationship-boundaries         PENDIENTE
auth / sesiones     security-session-cookie-boundaries             MUTATION_PROOF_PRESENT  #1767 (config env.ts)
auth / sesiones     global-auth-boundary-contract                  PENDIENTE
auth / sesiones     security-cross-auth-surface-boundaries         PENDIENTE
auth / sesiones     security-access-lifecycle-boundaries           PENDIENTE
auth / sesiones     security-production-invariants                 PENDIENTE (archivo mixto)
permisos / roles    security-mutation-permission-surface           PENDIENTE
redacción de logs   security-sensitive-log-redaction-boundaries    MUTATION_PROOF_PRESENT  #1766
disclosure          security-response-disclosure-boundaries        PENDIENTE
rate limiting       security-rate-limit-isolation-boundaries       PENDIENTE
DIMENSIÓN B         3 de 12 guards del Scope con mutation proof · 9 PENDIENTES · 0 accepted defer
```

Hay cinco guards que no pertenecen a ninguno de los seis dominios y quedan
**sin adjudicar**: `security-validation-cutoff-boundaries`,
`security-write-attribution-boundaries` y tres registries de governance
(`security-boundary-suite-completeness`,
`security-critical-route-surface-registry` y
`security-docs-matrix-drift-guard`). El Objetivo de `04` habla de *cada*
contrato de seguridad estático. Por eso, antes de cerrar `04`, esos cinco
necesitan una adjudicación explícita en un PR docs-only propio: mutation proof
en `04`, reasignación o `accepted defer` con owner y fecha. Esta revisión no los
adjudica.

```text
TEST-GLOBAL-04   IN_PROGRESS — dimensión A cumplida; dimensión B con 9 pendientes
TG-R05           ABIERTO (parcial) — 3 de 17 guards de architecture/security/** con mutación explícita
12A              sigue bloqueada: exige 04 cerrada en agregado (§32)
```

Ninguna de las dos dimensiones produce evidencia runtime de staging (§35). El
registro IDOR mantiene `pending_runtime_staging_evidence`.

- **Gates**: por PR, `pnpm test` dirigido al archivo del contrato → `PASSED`; `pnpm test` completo → `BLOCKED` declarando el desglose del estado vigente de §31.0.
- **Rollback**: por PR, revertir ese commit. Como cada PR toca un contrato distinto, el rollback de uno no afecta a los demás; el contrato revertido vuelve a su clase previa en §17.
- **Output**: prueba negativa ejecutable por contrato de seguridad.
- **Coste**: alto. **Paralelizable**: sí, por contrato.

### TEST-GLOBAL-05 — Lector canónico y lint de `test/**` (dos PRs: 05A → 05B)

`TEST-GLOBAL-05` es **una fase lógica entregada en dos subfases de scope
distinto**. La versión anterior de este documento la describía como un bloque
único «test-only + config-only», lo que incumple `AGENTS.md` §4 sin invocar la
excepción mixed-scope. Los dos dominios **sí** pueden entregarse por separado:
el lector canónico es trabajo dentro de `test/**` y no necesita ESLint; el alta
de `test/**` en `lintableFiles` toca `eslint.config.mjs`, es R2 y necesita
autorización de Nico. Cada uno tiene su propio rollback. Toda dependencia «de
`05`» en §31.1 y §32 significa **`05A` fusionado**, salvo donde se indique `05B`.

#### 05A — Lector canónico de source (test-only)

- **Objetivo**: que la operación más repetida de la suite —leer un archivo de source— tenga una sola implementación correcta.
- **Problema**: `TG-R09` + `TG-R16`. 281 archivos con lector propio frente a 8 importadores del helper canónico; normalización CRLF inconsistente.
- **Evidencia**: §6.4, §13.1.
- **Tipo de scope**: test-only.
- **Paths permitidos**: `test/helpers/tracked-source-files.ts` y los archivos de `test/**` migrados en cada lote.
- **Scope**: extender `test/helpers/tracked-source-files.ts` a lector canónico (normalización CRLF única, cache por proceso, fallo explícito si falta el path); migrar **por lotes** los lectores ad hoc.
- **No-scope**: `eslint.config.mjs` y cualquier configuración (eso es `05B`); reformateo; cambio de reglas de `server/**`; migrar todos los lectores en un solo PR; alterar el oracle de ningún test —la migración cambia **cómo se lee**, nunca **qué se asserta**.
- **Riesgo**: R1. **Autorización**: no requiere. **Dependencias**: `01`.
- **Aceptación**: (1) el lector canónico falla de forma explícita ante un path ausente, con prueba negativa en el PR; (2) cada lote migrado conserva el mismo conjunto de assertions y el mismo resultado que antes de migrar; (3) el número de archivos con lector propio disminuye en la cantidad declarada por el lote; (4) **0 fallos atribuibles al lote**, sobre el estado vigente de §31.0 —PRE-03 si `03` aún no fusionó, POST-03 si ya lo hizo— con los fallos preexistentes conservados y nominados; (5) el wall time de la suite no empeora respecto de la medición del lote anterior.
- **Gates**: `pnpm test` dirigido a los archivos del lote → `PASSED`. `pnpm typecheck:test` → `PASSED`. `pnpm test` completo → `BLOCKED`, declarando el desglose del estado vigente (§31.0).
- **Rollback**: por lote, revertir ese commit. Los lotes son independientes entre sí y el helper conserva compatibilidad hacia atrás mientras queden lectores sin migrar; no hay estado intermedio inconsistente.
- **Output**: lector canónico único + lectores ad hoc migrados por lotes.
- **Coste**: alto. **Paralelizable**: sí, los lotes entre sí.

#### 05B — Alta de `test/**` en lint (config-only, R2)

- **Objetivo**: que el mayor cuerpo de código TypeScript del repositorio deje de estar sin análisis estático.
- **Problema**: `TG-R08`. `eslint.config.mjs` define `lintableFiles` como `server/**`, `scripts/**` y `drizzle/**`; `test/**` (156.887 LOC) queda fuera.
- **Evidencia**: §25.2. Verificado sobre §3.2 en `eslint.config.mjs:15-18`.
- **Tipo de scope**: config-only.
- **Paths permitidos**: `eslint.config.mjs`, y `package.json` **sólo** si el alta exige un script nuevo — en cuyo caso se declara en el PR como parte del mismo scope de configuración.
- **Scope**: añadir `test/**` a `lintableFiles` con un conjunto **mínimo** de reglas (equivalente a `no-only-tests`, promesas flotantes, `no-unused-vars`) **sin autofix masivo**, y publicar el baseline resultante.
- **No-scope**: cualquier archivo bajo `test/**` (corregir lo que el lint reporte es trabajo posterior, no de este PR); cambio de reglas de `server/**`; autofix; workflows de `.github/**`.
- **Riesgo**: **R2** — toca configuración ejecutable.
- **Autorización**: **explícita de Nico, obligatoria antes de empezar** (`AGENTS.md` §3.1).
- **Dependencias**: `05A` fusionado. Activar el lint antes de unificar los lectores multiplicaría los hallazgos sobre código que `05A` va a reescribir.
- **Aceptación**: (1) baseline de lint de `test/**` publicado con su conteo de errores y de warnings, **sin autofix y sin corregir hallazgos en este PR**; (2) el lint de `server/**`, `scripts/**` y `drizzle/**` no cambia de resultado; (3) `pnpm lint:backend` se ejecuta y su estado se reporta canónicamente; (4) si el volumen de hallazgos hiciera inviable dejar el gate en bloqueante, el PR lo declara y propone el modo no bloqueante — no se silencian reglas para forzar un verde.
- **Gates**: `pnpm lint:backend` → `PASSED` o `FAILED` con el baseline publicado. `pnpm test` completo → `NOT_RUN` (config de lint; no altera la suite).
- **Rollback**: revertir el commit restaura `lintableFiles` a sus tres entradas previas. El rollback es completo: ningún archivo de `test/**` fue modificado por esta subfase, de modo que no queda código a medio corregir.
- **Output**: `test/**` bajo análisis estático + baseline publicado.
- **Coste**: medio. **Paralelizable**: no.

### TEST-GLOBAL-06 — Adjudicación de los 137 candidatos

- **Objetivo**: convertir un pool de candidatos heurísticos en decisiones adjudicadas con evidencia, sin tocar un solo test.
- **Problema**: `TG-R06`. El pool es candidato, no deuda confirmada (§7.4).
- **Evidencia**: §7.3, §7.4, §19.
- **Tipo de scope**: docs-only.
- **Paths permitidos**: `docs/audit/**` (el registro de adjudicación).
- **Riesgo**: **R1** — escribe documentación. El análisis que la sustenta es R0 (lectura), pero la entrega es una escritura local, y la fase se clasifica por su riesgo máximo (§31.0). *La versión anterior de este documento decía `R0/R1`, que no es una categoría canónica de `AGENTS.md` §3.1.*
- **Autorización**: no requiere. **Dependencias**: `01` (el pool debe recomputarse con el tooling de `01B` antes de adjudicar: las cifras de §7.3 son `AUDIT_DERIVED_NOT_YET_REPRODUCIBLE`) y `05A`.
- **Scope**: clasificar cada candidato del pool recomputado en `LEGITIMATE_GUARD` / `LEGITIMATE_STATIC_CONTRACT` / `MIXED` / `ACCIDENTAL_COUPLING`, con: contrato protegido, mutación que detecta, mutación que escapa, capa correcta según la frontera de §19, y si existe cobertura E2E equivalente **verificada contra `frontend/e2e/suites/catalog.ts`**, no supuesta.
- **No-scope**: modificar, mover o borrar un solo test; crear specs E2E; reabrir `LIMPIEZA E2E`.
- **Aceptación**: (1) 100 % del pool adjudicado —137 si el recómputo lo confirma, o la cifra recomputada con la diferencia declarada—; (2) cada candidato con owner y decisión `KEEP` / `STRENGTHEN` / `RELOCATE` / `RETIRE`; (3) **cada decisión distinta de `KEEP` lleva su evidencia**; (4) regla fail-closed: **sin evidencia suficiente → `KEEP`**. Nunca `RETIRE` por defecto, nunca `RETIRE` por sospecha, nunca `RETIRE` para mover una métrica.
- **Gates**: `git diff --check` → `PASSED`. `pnpm test` → `NOT_RUN` (docs-only).
- **Rollback**: revertir el commit. No toca `test/**`; ninguna decisión se ejecuta en esta fase.
- **Output**: registro de adjudicación que gobierna `07` y `08`.
- **Coste**: alto. **Paralelizable**: por subcarpeta.

#### 31.6 Prueba de equivalencia — requisito normativo de `RETIRE` y `RELOCATE`

Esta definición es **normativa y autosuficiente**. La revisión anterior de este
documento remitía a «§15 del encargo», un texto externo al repositorio: un
agente que sólo tuviera `AGENTS.md` y este archivo no podía ejecutar `07`/`08`.
Queda transcrita aquí y no se delega en ninguna fuente externa.

**Retirar un test es la operación más peligrosa del programa.** Un `RETIRE` mal
adjudicado no produce un fallo visible: produce la desaparición silenciosa de
una señal. Por eso la carga de la prueba recae siempre sobre quien retira.

Antes de retirar un test, el PR debe demostrar **las ocho condiciones**:

```text
1. OWNER DEL CONTRATO
   El contrato que el test protege sigue teniendo un owner verificable:
   otro test, un guard, o un spec E2E identificado por path. "Lo cubre el
   sistema" no es un owner.

2. OBSERVACIÓN EQUIVALENTE
   Existe otra prueba que observa el MISMO comportamiento o invariante.
   Cubrir "algo parecido" o "la misma zona del código" no es equivalencia.

3. MISMA CLASE DE MUTACIÓN
   Esa prueba detecta la misma clase de mutación o de fallo que el test que
   se retira. Se declara la mutación concreta y se demuestra que la prueba
   receptora se pone en rojo ante ella.

4. NEGATIVE PROOF PRESERVADA
   Si el test retirado aportaba prueba negativa (assertion de ausencia, de
   rechazo, de no-disclosure), la receptora la conserva. Retirar el único
   negative proof de un contrato está PROHIBIDO, sea cual sea el resto.

5. FAIL-CLOSED PRESERVADO
   Ningún guard fail-closed se convierte en fail-open. En particular, no se
   retira el auto-discovery de un walker dejando en su lugar una allowlist.

6. NINGÚN P0/P1 SIN SEÑAL
   Ningún riesgo P0 o P1 de §28 queda sin señal ejecutable como consecuencia
   del retiro. Se verifica contra la matriz de §17 y la tabla de §28.

7. RECEPTOR E2E REAL (sólo para RELOCATE)
   Cuando la decisión es RELOCATE hacia `frontend/e2e/**`, el spec receptor
   debe EXISTIR, estar en el catálogo (`frontend/e2e/suites/catalog.ts`) y
   estar VERDE antes de retirar el estático. La cobertura E2E no se presume
   nunca: "E2E lo cubrirá" no es evidencia. El orden es siempre
   receptor-verde → retiro, jamás al revés.

8. FALLBACK FAIL-CLOSED
   Si cualquiera de las siete condiciones anteriores no puede demostrarse,
   el resultado es KEEP. La duda se resuelve conservando el test.
```

Reglas adicionales, vinculantes:

- Las ocho condiciones se demuestran **en el propio PR** que retira, no en un
  documento posterior ni en un comentario.
- `STRENGTHEN` y `KEEP` no requieren esta prueba; `RETIRE` y `RELOCATE` sí.
- `RELOCATE` **no reabre `LIMPIEZA E2E`**: el programa E2E está CLOSED y aquí es
  sólo frontera contractual. Crear un spec receptor obliga a realinear los
  censos del catálogo **en el mismo PR** (`AGENTS.md` §4).
- Ningún `RETIRE` puede justificarse por reducir LOC, número de tests,
  substring ratio ni wall time. §2 declara que este programa no es una campaña
  de reducción, y §30 acota el objetivo de ratio precisamente para que no
  presione hacia retiros indebidos.

### TEST-GLOBAL-07 / 08 — Remediación `unit/ui`

- **Objetivo**: ejecutar las decisiones adjudicadas por `06` en `unit/ui`, sin perder ninguna señal.
- **07**: `unit/ui/dashboard` (28 candidatos). **08**: `unit/ui/admin` + `public` + `frontend` (94). Cifras del pool heurístico; `06` las recomputa antes de ejecutar.
- **Tipo de scope**: test-only, **un PR por subdominio**.
- **Paths permitidos**: la subcarpeta de `test/unit/ui/**` del PR, y `frontend/e2e/suites/catalog.ts` **sólo** para realinear censos cuando un `RELOCATE` lo exija.
- **Riesgo**: R1. **Autorización**: no requiere. **Dependencias**: `06` para `07`; `07` para `08`.
- **Scope por PR**: un subdominio, una causa, un rollback. Todo `RETIRE` y todo `RELOCATE` cumple **las ocho condiciones de la prueba de equivalencia de §31.6**, demostradas dentro del propio PR.
- **No-scope**: tocar `frontend/src/**`; crear specs E2E nuevos sin pasar por el catálogo y sus censos; reabrir `LIMPIEZA E2E`; retirar cualquier guard de seguridad.
- **Aceptación**: (1) todas las decisiones del subdominio, tal como `06` las adjudicó, ejecutadas o revertidas a `KEEP` con motivo; (2) **ningún contrato pierde cobertura demostrable** — se verifica contra §31.6 condiciones 1–6; (3) substring ratio **de la subcarpeta remediada** < 20 %, entendido como consecuencia de fortalecer oracles y no como objetivo que autorice retiros (§30); (4) censos de catálogo realineados en el mismo PR; (5) 0 fallos atribuibles al PR, sobre el estado **POST-03** de §31.0 (`03` es dependencia transitiva vía `01`→`03`; si excepcionalmente no hubiera fusionado, se declara contra PRE-03); (6) cero artefactos `playwright-report/`, `test-results/` y `frontend/next-env.d.ts` sin alterar (`AGENTS.md` §7, §13).
- **Gates**: `pnpm test` dirigido a la subcarpeta → `PASSED`. Cohorte E2E mínima que contenga el spec receptor, cuando hubo `RELOCATE` → `PASSED` (§7 de `AGENTS.md`: la cohorte más pequeña que lo contenga, **nunca `e2e:full`** salvo que no exista alternativa).
- **Rollback**: por PR, revertir ese commit restaura los tests del subdominio y su realineación de censos juntos. Riesgo de rollback a vigilar: si un `RELOCATE` ya fusionó su spec receptor E2E, revertir el PR del estático **no** retira el receptor — queda cobertura duplicada, que es el lado seguro del error y se resuelve en `13`.
- **Output**: `unit/ui` con oracles alineados a la capa correcta.
- **Coste**: muy alto. **Paralelizable**: no entre sí (comparten censos de catálogo).

### TEST-GLOBAL-09 — Repositorios y servicios externos

- **Objetivo**: cubrir repositorios y servicios externos **si el producto ya ofrece una costura testeable**, y declarar el bloqueo con evidencia si no la ofrece.
- **Problema**: `TG-R10`. Dos paths canónicos documentados en `test/README.md` pero **ausentes del árbol** (§18); 0 SQL ejecutado contra una base real.
- **Evidencia**: §18, §26, §33.
- **Tipo de scope**: test-only.
- **Paths permitidos**: `test/integration/adapters/repositories/**`, `test/integration/external-services/**` (ambos a crear), y `test/README.md` **sólo** si la fase concluye que el árbol canónico debe corregirse — en cuyo caso esa corrección se entrega como PR docs-only aparte.
- **Riesgo**: R1. **Autorización**: no requiere. **Dependencias**: `05A`.
- **Scope**: poblar los dos paths con la costura que exista hoy. **Si no existe costura, el resultado legítimo y esperado de la fase es declarar el bloqueo** con la evidencia de qué falta, y derivar a `TEST-GLOBAL-10A`.
- **No-scope**: ejecutar migraciones o SQL contra una DB real (R3, `AGENTS.md` §14); crear una DB de test sin autorización; **fabricar la costura ausente con mocks o casts más débiles** — eso convertiría deuda de producto en deuda de test y está prohibido (§26); tocar `server/**`.
- **Aceptación**: exactamente **una** de estas dos salidas, ambas válidas: (a) cobertura de repositorio y de servicio externo con fake verificable, sin `as any` nuevos y sin parchear `globalThis`; **o** (b) **declaración de bloqueo** que nombre, por cada costura ausente, el módulo concreto, por qué no es inyectable hoy y qué exigiría `10A`. Una salida (b) bien fundamentada **cierra la fase**: no es un fallo, es el hallazgo.
- **Gates**: `pnpm test` dirigido a los nuevos paths → `PASSED` en la salida (a); `NOT_RUN` en la salida (b), porque no hay test que ejecutar.
- **Rollback**: revertir el commit. En la salida (b) no hay nada que revertir salvo documentación de bloqueo.
- **Output**: cobertura de repositorio, o un bloqueo documentado que define el scope de `10A`.
- **Coste**: medio-alto. **Paralelizable**: sí, con `11`.

### TEST-GLOBAL-10 — Testability de producto (cuatro PRs: 10A → 10B, 10C → 10D)

`TG-R07` y §26 describen **deuda de producto, no de test**: los 659 `as any` de
la costura test↔runtime existen porque email, storage y `ENV` son singletons de
módulo, al contrario que las rutas, que sí declaran puertos. Corregir eso es
trabajo de producción (R2). Retirar los casts que quedan innecesarios es trabajo
de `test/**` (R1).

La versión anterior de este documento declaraba `10` como `backend-only` pero su
aceptación (`as any` = 0) obligaba a editar `test/**`, mientras su no-scope
restringía esos mismos cambios: la ficha se contradecía. **Se divide en dos
pares secuenciales**, cada uno con costura primero y realineación después:

```text
10A (backend-only, R2)  crea la costura en email/storage/ENV
  └─ 10B (test-only, R1)  retira los casts que esa costura volvió innecesarios
10C (backend-only, R2)  crea la costura tipada en el registro de plugins Fastify
  └─ 10D (test-only, R1)  retira los casts de rutas y fija criterio para req/res/reply
```

**Regla vinculante del par**: una subfase `*B`/`*D` **no** puede retirar un cast
cuya costura no exista todavía, y una subfase `*A`/`*C` **no** puede cambiar
comportamiento productivo. Si al ejecutar `10B` un cast sigue siendo necesario,
se conserva y se declara por qué: eso es evidencia de que `10A` quedó
incompleta, no licencia para debilitar el test.

#### 10A — Costura de testabilidad en email, storage y `ENV` (backend-only, R2)

- **Objetivo**: que email, storage y `ENV` se inyecten como puertos, igual que ya hacen las rutas.
- **Evidencia**: §12.3, §15, §26. Verificado sobre §3.2: `ENV.smtp as any` 140, `ENV.gmailApi as any` 121, `supabase.storage as any` 63, `ENV as any` 43, `nodemailer as any` 36, `globalThis as any` 22.
- **Tipo de scope**: backend-only. **Paths permitidos**: `server/**`.
- **No-scope**: `test/**` salvo la realineación que el cambio **rompa** legítimamente (`AGENTS.md` §4); el registro de plugins Fastify (eso es `10C`); cualquier cambio de comportamiento observable.
- **Riesgo**: **R2**.
- **Autorización**: **explícita de Nico, obligatoria antes de empezar.**
- **Dependencias**: `09` (su salida define qué costuras faltan realmente).
- **Aceptación**: (1) email, storage y `ENV` accesibles por inyección; (2) **comportamiento productivo idéntico**, demostrado por los tests de integración existentes en `PASSED` sin modificarlos; (3) ningún endpoint, header, status ni contrato HTTP alterado; (4) ningún invariante de `AGENTS.md` §9 tocado.
- **Gates**: `pnpm validate:local` → `PASSED`, o `BLOCKED` nombrando la DB ausente (§31.0). `pnpm security:public-surface` → `PASSED` si se tocó superficie pública.
- **Rollback**: **no basta con revertir el commit.** Esta subfase cambia código productivo desplegable. El PR declara: qué módulos cambian de forma de construcción, si algún consumidor queda con dos formas de acceso durante la transición, y en qué orden se revierte para no dejar un módulo pidiendo una dependencia que ya nadie inyecta. Si `10B` ya fusionó, revertir `10A` **rompe** los tests realineados: el rollback correcto es `10B` primero y `10A` después, y el PR de `10A` lo dice explícitamente.
- **Output**: costura de inyección en infraestructura.
- **Coste**: alto.

#### 10B — Retiro de `as any` de infraestructura (test-only)

- **Objetivo**: retirar los casts que `10A` volvió innecesarios.
- **Tipo de scope**: test-only. **Paths permitidos**: `test/**`.
- **No-scope**: `server/**`; retirar un cast cuya costura no exista; sustituir un cast por otro escape de tipos (`as unknown as`, `@ts-expect-error`).
- **Riesgo**: R1. **Autorización**: no requiere. **Dependencias**: `10A` fusionado.
- **Aceptación**: (1) `as any` sobre `ENV`, email y storage = 0, **o** la lista nominal de los que sobreviven con el motivo de cada uno; (2) los tests de email y storage no parchean `globalThis`; (3) ninguna assertion retirada ni debilitada —cambia cómo se construye el doble, no qué se asserta—; (4) `pnpm typecheck:test` en `PASSED` sin escapes nuevos.
- **Gates**: `pnpm test` dirigido a los archivos migrados → `PASSED`. `pnpm typecheck:test` → `PASSED`. `pnpm test` completo → `BLOCKED` declarando el desglose POST-03 de §31.0.
- **Rollback**: revertir el commit. Los casts vuelven; la costura de `10A` permanece y no queda nada inconsistente.
- **Output**: tests de email, storage y `ENV` construidos sobre puertos inyectados, sin parches de `globalThis`; y la lista nominal de los casts que sobreviven con su motivo.
- **Coste**: medio.

#### 10C — Costura tipada en el registro de plugins Fastify (backend-only, R2)

- **Objetivo**: dar dueño al objetivo de §30 «0 `as any` en costuras de inyección de rutas», que hasta esta revisión **no tenía fase asignada** (`TG-A06`).
- **Problema**: §15 documenta que el `as any` del registro anula la única verificación automática del contrato de puertos: si una ruta añade una dependencia requerida, `app.register(clinicAuthNativeRoutes as any, {…})` no da error de compilación y la ruta recibe `undefined`.
- **Evidencia**: §12.3, §15. Verificado sobre §3.2: `clinicAuthNativeRoutes as any` = **9**; casts de `req`/`res`/`reply` = 47.
- **Tipo de scope**: backend-only. **Paths permitidos**: `server/**`.
- **No-scope**: `test/**` salvo realineación forzada; email/storage/`ENV` (eso es `10A`); cualquier cambio de comportamiento de ruta.
- **Riesgo**: **R2**.
- **Autorización**: **explícita de Nico, obligatoria antes de empezar.**
- **Dependencias**: `10A` fusionado (comparten el patrón de puertos y conviene no abrir dos refactors de inyección a la vez).
- **Aceptación**: (1) las opciones de plugin de las rutas quedan tipadas de forma que omitir una dependencia requerida **falle en compilación**, demostrado con un caso negativo; (2) comportamiento de ruta idéntico, con los 62 archivos de integración de §15 en `PASSED` sin modificarlos; (3) ningún invariante de `AGENTS.md` §9 tocado.
- **Gates**: `pnpm validate:local` → `PASSED` o `BLOCKED` por DB. `pnpm typecheck` y `pnpm typecheck:test` → `PASSED`.
- **Rollback**: como `10A`, no basta revertir el commit si `10D` ya fusionó: el orden es `10D` primero, `10C` después. El PR lo declara.
- **Output**: opciones de plugin tipadas, de modo que omitir una dependencia requerida falle en compilación; más el caso negativo que lo demuestra.
- **Coste**: alto.

#### 10D — Retiro de `as any` en rutas y criterio para `req`/`res`/`reply` (test-only)

- **Objetivo**: cerrar el eje «costuras de inyección de rutas» de §30.
- **Tipo de scope**: test-only. **Paths permitidos**: `test/**`.
- **No-scope**: `server/**`; retirar un cast cuya costura tipada no exista todavía; sustituir un cast por otro escape de tipos (`as unknown as`, `@ts-expect-error`); modificar el comportamiento o las assertions de los 62 archivos de integración de §15.
- **Riesgo**: R1.
- **Autorización**: no requiere.
- **Dependencias**: `10C` fusionado.
- **Aceptación**: (1) `clinicAuthNativeRoutes as any` y equivalentes de registro de plugin = 0; (2) **criterio declarado y escrito** para los 47 casts de `req`/`res`/`reply`: cuáles se retiran, cuáles se conservan y por qué —conservarlos con motivo es una salida válida, ya que tipar un objeto de request parcial no siempre aporta señal—; (3) ninguna assertion retirada ni debilitada.
- **Gates**: `pnpm test` dirigido a `test/integration/**` → `PASSED`. `pnpm typecheck:test` → `PASSED`. `pnpm test` completo → `BLOCKED` declarando el desglose POST-03 de §31.0.
- **Rollback**: revertir el commit; los casts vuelven y la costura de `10C` permanece.
- **Output**: registro de plugins sin `as any`; y el criterio escrito para los 47 casts de `req`/`res`/`reply`, con la decisión tomada para cada grupo. Cierra el eje «costuras de inyección de rutas» de §30.
- **Coste**: medio.

### TEST-GLOBAL-11 — Registries y censos congelados

- **Objetivo**: que cada censo congelado proteja un contrato real desde una sola fuente de verdad, y que ninguno sobreviva por inercia.
- **Problema**: `TG-R13` + `TG-R11`.
- **Evidencia**: §20, §23.
- **Tipo de scope**: test-only. **Paths permitidos**: `test/**`.
- **Riesgo**: R1. **Autorización**: no requiere. **Dependencias**: `05A` y **`01B`** (ver abajo).
- **Scope**: (a) eliminar la triple declaración de `M48` —derivar la tabla markdown del censo, o derivar el censo de una única fuente—; (b) revisar las **498 assertions de censo congelado en 134 archivos** (§20, cifra corregida en esta revisión) distinguiendo `FROZEN_CENSUS` deliberado de `LEGACY_LIST`; (c) **auditar el censo introducido por `TEST-GLOBAL-01B`** contra la regla de fuente única de §31.2, para que el instrumento creado al inicio del programa no quede fuera de la consolidación que el programa existe para hacer (`TG-A08`).
- **No-scope**: retirar guards fail-closed; relajar `M48`; convertir un censo en warning para evitar mantenerlo.
- **Aceptación**: (1) cada censo congelado superviviente tiene fuente única declarada y motivo escrito en el propio test; (2) `M48` deja de exigir edición en tres lugares; (3) todo `LEGACY_LIST` identificado queda retirado o convertido en derivación; (4) el censo de `01B` queda clasificado y conforme a §31.2; (5) ningún guard pierde poder de detección —se verifica con §31.6 condiciones 4, 5 y 6.
- **Gates**: `pnpm test` dirigido a `test/architecture/**` → `PASSED`. `pnpm test` completo → `BLOCKED`, declarando el desglose del estado vigente de §31.0.
- **Rollback**: revertir el commit; los censos vuelven a su forma triple. Sin estado intermedio: la derivación y el literal no coexisten.
- **Output**: censos con fuente única y motivo.
- **Coste**: medio. **Paralelizable**: sí, con `09`.

### TEST-GLOBAL-12 — Coverage semántico y mutation strength (dos PRs: 12A → 12B)

La versión anterior declaraba `12` como «config-only + docs» en una sola
entrega, bajo una columna titulada «scope único». `AGENTS.md` §4 obliga a
separarlos y no se invoca la excepción mixed-scope: publicar un baseline es
documentación y no necesita tocar CI; incorporarlo a CI es configuración
ejecutable, es R2 y necesita autorización. Se dividen.

**Conclusión técnica que ambas subfases deben preservar intacta** (§21.1): leer
un archivo con `readFileSync` lo trata como **datos**, no lo ejecuta ni lo
instrumenta, y por tanto **no genera señal de coverage sobre él**. Los cuatro
ejes no se confunden nunca:

```text
source-as-data              qué archivos vigila un guard estático
runtime coverage            qué líneas y ramas ejecutó la suite
semantic assertion strength si la assertion detectaría un cambio real
mutation strength           si una mutación concreta pone el guard en rojo
```

El número de coverage **no mide** los guards estáticos, ni a favor ni en contra.
Publicarlo sin esa salvedad induciría a leerlo como medida de protección de los
contratos estáticos, lectura que la evidencia no respalda.

#### 12A — Publicación documental del baseline (docs-only)

- **Objetivo**: publicar el baseline canónico de coverage con su salvedad metodológica, sin tocar CI.
- **Tipo de scope**: docs-only.
- **Paths permitidos**: `docs/**`.
- **Scope**: ejecutar `pnpm test:coverage` y publicar **la tabla por archivo**, no sólo la fila agregada, junto con la salvedad de §21.1 escrita de forma explícita.
- **No-scope**: thresholds; mutation testing indiscriminado o por herramienta externa; `.github/**`; `package.json`; `test/**`.
- **Riesgo**: R1.
- **Autorización**: no requiere.
- **Dependencias**: `04` cerrada en agregado y `08` fusionada.

**Condición de publicabilidad — un baseline canónico exige una corrida completa.**
`pnpm test:coverage` ejecuta la suite entera; si algún archivo falla o no llega a
ejecutarse, los módulos que ese archivo habría importado **no** quedan
instrumentados y el porcentaje resultante subestima la cobertura real. Un número
así no describe el sistema: describe una corrida rota. Por eso:

```text
pnpm test:coverage = PASSED   → la corrida es completa
                              → el baseline es CANÓNICO y publicable
                              → 12A puede cerrar y habilitar §36 criterio 10

pnpm test:coverage = BLOCKED  → la corrida es incompleta (DB ausente, §31.0)
   o FAILED                   → NO se publica baseline canónico
                              → 12A PERMANECE ABIERTA
                              → se registra, si aporta, una MEDICIÓN DIAGNÓSTICA
                                NO CANÓNICA, marcada como tal, con el estado del
                                gate y el motivo; esa medición NO cierra 12A,
                                NO satisface §36 y NO se cita como baseline
```

- **Aceptación**: (1) `pnpm test:coverage` en `PASSED` —requisito previo, no negociable: sin él la fase no cierra—; (2) baseline publicado con tabla por archivo y el SHA sobre el que se midió; (3) la salvedad metodológica aparece junto al número, no en una nota al pie; (4) el documento declara explícitamente que el baseline **no** evalúa los guards estáticos. Si (1) no se cumple, la salida legítima de la fase es **`accepted defer` con owner y fecha**, nombrando la precondición ausente; `13` la registra como tal y §36 criterio 10 se cierra por esa vía, no por un baseline incompleto.
- **Gates**: `pnpm test:coverage` → `PASSED` (canónico) · `BLOCKED` con precondición nombrada (§31.0) → fase abierta o `accepted defer`. `git diff --check` → `PASSED`.
- **Rollback**: revertir el commit. Sin impacto en runtime ni en CI; el baseline publicado desaparece y `12A` vuelve a abierta.
- **Output**: baseline canónico de coverage publicado en `docs/**` con su salvedad metodológica; o un `accepted defer` con la precondición nombrada.
- **Coste**: bajo-medio.

#### 12B — Coverage en CI como diagnóstico no bloqueante (ci-only, R2)

- **Objetivo**: decidir e implementar, si Nico lo autoriza, la ejecución de `test:coverage` en CI como señal diagnóstica no bloqueante.
- **Tipo de scope**: ci-only.
- **Paths permitidos**: `.github/workflows/**`, y ningún otro.
- **No-scope**: variables productivas; secretos; environments; branch protection; configuración de required checks; deploy; staging; producción; convertir coverage en gate bloqueante; thresholds; los cuatro contextos required de `AGENTS.md` §6; **cualquier operación R3**.
- **Riesgo**: **R2**. Categoría única. Editar un archivo de workflow dentro de los paths permitidos es R2 según `AGENTS.md` §3.1. Todo lo que elevaría la acción a R3 —variables productivas, secretos, environments, branch protection, settings de required checks— está **fuera de scope** por la línea anterior, de modo que la fase no puede alcanzar R3 sin salirse de su propia definición.
- **Regla de parada**: si durante `12B` apareciera la necesidad de tocar cualquiera de los elementos del no-scope, la ejecución **se detiene**. No se amplía el scope, no se reclasifica la fase y no se ejecuta la acción R3: se reporta como hard stop y se abre una tarea nueva con su propia autorización (`AGENTS.md` §3.2, §5.5).
- **Autorización**: **explícita de Nico, obligatoria antes de empezar.** El default de esta subfase es **no ejecutarla**: §25.1 concluye que la topología de CI es correcta y no requiere cambios, y añadir un job tiene coste de tiempo y de mantenimiento sin cerrar ningún riesgo P0/P1.
- **Dependencias**: `12A` cerrada con baseline canónico publicado. Incorporar a CI una métrica cuyo baseline no es canónico no tendría con qué compararse.
- **Aceptación**: (1) el job es **estrictamente no bloqueante** y no se añade a los contextos required; (2) los cuatro required de `AGENTS.md` §6 conservan su definición exacta; (3) el tiempo añadido al pipeline se mide y se declara; (4) `qga-workflow-security` en `PASSED`; (5) el diff se limita a `.github/workflows/**`.
- **Gates**: `qga-workflow-security` → `PASSED`. Los cuatro contextos required → `PASSED`.
- **Rollback**: revertir el commit retira el job. Riesgo a vigilar: si el job llegara a figurar como required en la configuración efectiva de GitHub, revertir el workflow dejaría un check required que nunca reporta y **bloquearía todos los merges**. Por eso la aceptación (1) y (2) son innegociables. Verificar o modificar branch protection es R3, está fuera de scope y pertenece a Nico: si el rollback lo exigiera, se aplica la regla de parada.
- **Output**: job de coverage no bloqueante en CI, con su tiempo añadido medido y declarado; o la fase registrada como `accepted defer` si Nico no la autoriza.
- **Coste**: medio.

### TEST-GLOBAL-13 — Gobernanza y cierre

- **Objetivo**: certificar el cierre del programa con censo recomputado y residuales con owner.
- **Tipo de scope**: docs-only. **Paths permitidos**: `docs/**`, `test/README.md`.
- **Scope**: actualizar `TDR-002`, `test/README.md` (corrigiendo el árbol canónico: los dos paths ausentes de §18 y las tres subcarpetas omitidas, `TG-R14`), la convención de organización y este documento a `CLOSED`; certificación final con el censo recomputado por el tooling de `01B`.
- **No-scope**: `test/**` salvo su `README.md`; cualquier corrección de test —si al cerrar aparece una, es una fase nueva, no un añadido a `13`.
- **Riesgo**: R1. **Autorización**: no requiere.
- **Dependencias**: **todas** las subfases ejecutables, por las ramas del DAG de §32. `13` no puede declararse antes que `03`, `10D` ni `11`, aunque ninguna de las tres alimente a `12`.
- **Aceptación**: los nueve criterios de §36, cada uno con su evidencia y su estado canónico; matriz de §34 completa; residuales de §35 con owner y motivo; ledger de §37 cerrado.
- **Gates**: `git diff --check` → `PASSED`. Censo recomputado → `PASSED`.
- **Rollback**: revertir el commit devuelve el documento a `ACTIVE`. Ningún artefacto ejecutable depende de este PR.
- **Output**: programa certificado como `CLOSED` o con sus `accepted defer` declarados.
- **Coste**: medio.

## 32. Dependencias entre fases

El DAG siguiente es la **única** fuente de verdad de precedencia. §31.1, §34 y
§36 se leen contra él; si alguna difiere, manda este grafo y la diferencia se
corrige. La versión anterior dejaba `03`, `10` y `11` como hojas terminales
mientras §31 afirmaba que `13` dependía de todas: esa contradicción está
resuelta (`TG-A07`).

```text
01A ──► 01B ──┬──► 02 ──► 04 ─────────────────────────────┐
              │                                           │
              ├──► 03 ─────────────────────────────────┐  │
              │                                        │  │
              ├──► 11 ◄─────────────────┐              │  │
              │                         │              │  │
              └──► 05A ──┬──► 05B       │              │  │
                         │              │              │  │
                         ├──────────────┘  (11 ← 05A y 11 ← 01B)
                         │
                         ├──► 06 ──► 07 ──► 08 ──┬──► 12A ──► 12B ──┐
                         │                       │                  │
                         └──► 09 ──► 10A ──┬──► 10B ──┐              │
                                           │          │              │
                                           └──► 10C ──► 10D ──┐      │
                                                              │      │
                                    03 ──────────────────┐    │      │
                                    05B ─────────────────┤    │      │
                                    11 ──────────────────┤    │      │
                                                         ▼    ▼      ▼
                                                        ── 13 (cierre) ──
```

Relaciones, en forma de lista inequívoca:

```text
01A → 01B
01B → 02 · 03 · 05A · 11
02  → 04
05A → 05B · 06 · 09 · 11
06  → 07 → 08
09  → 10A
10A → 10B · 10C
10C → 10D
04 + 08 → 12A → 12B
03 · 04 · 05B · 07 · 08 · 10B · 10D · 11 · 12A · 12B → 13
```

- `11` tiene **dos** predecesores: `05A` (lector canónico) y `01B` (su censo
  entra en el scope de `11`, §31.2). No es una dependencia artificial: sin `01B`
  fusionada, `11` auditaría un censo que todavía no existe.
- `12B` es la única subfase cuyo default es **no ejecutarse**; si Nico no la
  autoriza, `13` depende de `12A` y registra `12B` como `accepted defer`.
- `13` depende de **todas** las subfases ejecutables, no sólo de la rama de
  `12`. `03`, `05B`, `10D` y `11` alimentan el cierre directamente.

**Paralelizables sin conflicto**: `02 ∥ 03`, `09 ∥ 11`, `10B ∥ 10C`,
y los lotes internos de `05A` entre sí, y los PRs de `04` entre sí.

**Serializadas obligatoriamente**: `01A → 01B` (alta antes que instrumentación);
`06 → 07 → 08` (comparten censos de catálogo); `05A → 05B` (no activar lint
sobre código que `05A` va a reescribir); `10A → 10B` y `10C → 10D` (no retirar
un cast cuya costura no existe).

## 33. Auditoría de auditorías anteriores

| Documento | Dato | Clase | Fundamento |
|---|---|---|---|
| `TDR-002` | 367/514 tests con `readFileSync`; 134 usos de `readdirSync` en 64 tests | **STALE** | Hoy: 410/562 y 82 archivos con `readdirSync`. Reclasificar en `TEST-GLOBAL-01A` (docs-only) |
| `TDR-002` | `Status: OPEN`, severity HIGH | **CURRENT** | Confirmado y agravado por §7.3 |
| `TDR-003` | Backend lint baseline, `RESOLVED` | **CURRENT** | Verificado en `package.json` y `eslint.config.mjs`. **No cubre `test/**`** (§25.2) |
| `TDR-004` | Coverage baseline, `RESOLVED` | **NEEDS_REVALIDATION** | `test:coverage` existe pero no corre en CI; y el número agregado sólo describe el código ejecutado, no la protección de los guards estáticos (§21) |
| `pr-test-architecture-consolidation-audit.md` | 517 archivos / 4.019 tests | **HISTORICAL** | Baseline de 2026-07-30 |
| ídem | `ACCIDENTAL_COUPLING confirmado = 0` | **NEEDS_REVALIDATION** | Ver nota metodológica abajo |
| ídem | `LEGITIMATE_GUARD` 332 / `MIXED` 38 | **HISTORICAL** | Criterio distinto del de §7.3 |
| ídem | Helper canónico `listSourceFiles` | **CURRENT** | Existe y funciona; adopción baja (**8** importadores, recomputado sobre §3.2) |
| `test/README.md` | Árbol canónico con `integration/adapters/repositories` y `integration/external-services` | **STALE** | Ambos paths **ausentes del árbol**: 0 archivos tracked y directorio inexistente (§18) |
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

```text
FASES LÓGICAS = 13   (TEST-GLOBAL-01 … 13)
SUBFASES      = 19   (splits de 01, 05, 10 y 12)
PRs           ≥ 19   (04 entrega 1 PR por contrato; 07/08, 1 por subdominio;
                      05A y 10B, por lotes)
```

**Ninguna subfase de este roadmap invoca la excepción mixed-scope.** Cada fila
tiene exactamente un scope primario, una causa y un rollback.

| Subfase | Tipo de PR (scope único) | Objeto | Riesgo | ¿Autorización de Nico? |
|---|---|---|---|---|
| 01A | docs-only | Alta documental (`TDR-002`, `docs/audit/README.md`) | R1 | No |
| 01B | test-only | Contrato de censo y tooling versionado | R1 | No |
| 02 | test-only | Registro IDOR + prueba negativa | R1 | No |
| 03 | test-only | Guard de plataforma (launcher win32) | R1 | No |
| 04 | test-only | Prueba negativa de seguridad — **1 PR por contrato** | R1 | No |
| 05A | test-only | Lector canónico y migración por lotes | R1 | No |
| 05B | config-only | `eslint.config.mjs`: alta de `test/**` | **R2** | **Sí** |
| 06 | docs-only | Adjudicación de candidatos | R1 | No |
| 07 | test-only | Remediación `unit/ui/dashboard` — 1 PR por subdominio | R1 | No |
| 08 | test-only | Remediación `unit/ui` admin/public/frontend — 1 PR por subdominio | R1 | No |
| 09 | test-only | Integración de repositorios, o declaración de bloqueo | R1 | No |
| 10A | backend-only | Costura de inyección en email/storage/`ENV` | **R2** | **Sí** |
| 10B | test-only | Retiro de `as any` de infraestructura | R1 | No |
| 10C | backend-only | Costura tipada del registro de plugins Fastify | **R2** | **Sí** |
| 10D | test-only | Retiro de `as any` de rutas + criterio `req`/`res`/`reply` | R1 | No |
| 11 | test-only | Registries y censos congelados (incluido el de `01B`) | R1 | No |
| 12A | docs-only | Baseline de coverage con salvedad metodológica | R1 | No |
| 12B | ci-only | `test:coverage` en CI, no bloqueante — **default: no ejecutar** | **R2** | **Sí** |
| 13 | docs-only | Certificación de cierre | R1 | No |

Matriz de aceptación transversal — toda fase debe cumplir:

| Criterio | Verificación |
|---|---|
| Baseline propio declarado | El PR nombra el SHA sobre el que midió (§3.3) |
| `pnpm test` sin regresión | Conteo pass ≥ baseline de la fase; 0 fallos atribuibles al PR |
| Precondición de DB | `BLOCKED` con la precondición nombrada; **nunca** `PASSED`, nunca `skip`, nunca credenciales inventadas (§31.0) |
| `pnpm validate:local` | `PASSED`, o `BLOCKED` con precondición nombrada (DB) |
| Ningún guard debilitado | Diff revisado; 0 `skip`, 0 assertion retirada sin la prueba de equivalencia de §31.6 |
| Ningún control de seguridad rebajado | Los contratos de §17 conservan o mejoran su clase; 0 `fail-closed` convertido en `fail-open` |
| Censos realineados en el mismo PR | `AGENTS.md` §4 |
| Cero artefactos | `playwright-report/`, `test-results/`, `frontend/next-env.d.ts` sin alterar |
| Prueba negativa del propio cambio | Obligatoria cuando la fase añade o modifica un guard |
| Scope único verificado | `git diff --name-only` contenido en los paths permitidos de la ficha |
| Rollback declarado | El PR enuncia su rollback y, si hay estado intermedio, el orden de reversión |

## 35. Residuales explícitos

| Residual | Motivo |
|---|---|
| Evidencia runtime de cross-tenant en staging | R3; `AGENTS.md` §17. `TEST-GLOBAL-02` cierra el oracle circular, **no** produce la evidencia de staging |
| Tests contra DB real | R3; `AGENTS.md` §14. Fuera de todo el programa |
| Mutation testing con herramienta externa | Deliberadamente descartado (§11.2) |
| Thresholds de coverage | Fuera de scope; `TDR-004` lo mantiene como decisión separada |
| Runner de componentes React | No se propone. Cambiaría la arquitectura de test del frontend; exige auditoría propia |
| `frontend/e2e/**` | `LIMPIEZA E2E` CLOSED. No se reabre |
| Fila de este documento en `docs/audit/README.md` | Resuelto por `TEST-GLOBAL-01A` (#1761): la fila existe con estado `ACTIVE` |
| Migración monorepo | `AGENTS.md` §18; política futura, no autorizada |

## 36. Criterio de cierre del programa

`LIMPIEZA TEST GLOBAL` pasa a `CLOSED` cuando, con evidencia reproducible:

Cada criterio nombra la subfase que lo cierra, de modo que ninguno pueda quedar
sin dueño (§30). **`BLOCKED` no cierra ningún criterio**: sólo declara
honestamente que un gate no pudo ejecutarse, y el criterio sigue abierto salvo
que exista un `accepted defer` explícito con owner y fecha.

| # | Criterio de cierre | Cierra |
|---|---|---|
| 1 | Los 2 **P0** (`TG-R01`, `TG-R02`) cerrados **con prueba negativa en el propio PR** | `02` |
| 2 | Los 4 **P1** (`TG-R03`, `TG-R04`, `TG-R05`, `TG-R06`) cerrados o con `accepted defer` con owner y fecha | `03`, `04`, `06`, `07`, `08` |
| 3 | El pool de candidatos adjudicado al 100 % (`KEEP` es un cierre válido) | `06` |
| 4 | Ninguno de los **ocho** contratos de la matriz de §17 permanece en `NO_NEGATIVE_PROOF` | `04` |
| 5 | **Launcher**: 0 fallos de launcher en win32 y en CI | `03` |
| 6 | **DB**: con la precondición satisfecha, `pnpm test` alcanza 0 fail; sin ella, permanece **sólo** el fallo `ENVIRONMENT_DEPENDENT` del grupo B, reportado `BLOCKED` con la precondición nombrada. Un `BLOCKED` aquí es un cierre válido **únicamente** porque el criterio está redactado para admitirlo de forma explícita y nominal | `03` |
| 7 | `test/**` con baseline de lint publicado, **o** `05B` registrada como `accepted defer` si Nico no autorizó el R2 | `05B` |
| 8 | Censos de §6 recomputados por el tooling versionado y declarados como cifras de cierre; el censo de `01B` auditado bajo §31.2 | `01B`, `11`, `13` |
| 9 | Costuras de inyección resueltas o con criterio declarado: infraestructura y rutas | `10A`–`10D` |
| 10 | Baseline de coverage **canónico** publicado con su salvedad metodológica, es decir con `pnpm test:coverage` en `PASSED` (§31, ficha `12A`); **o** `12A` registrada como `accepted defer` con la precondición ausente nombrada. Un baseline procedente de una corrida `BLOCKED` o `FAILED` **no** cierra este criterio. `12B` ejecutada o `accepted defer` | `12A`, `12B` |
| 11 | **Ningún guard de seguridad fue debilitado en todo el programa** | transversal, auditado en `13` |
| 12 | Residuales de §35 con owner y motivo; ledger de §37 cerrado | `13` |
| 13 | Este documento marcado `CLOSED` con su Anexo de cierre | `13` |

**Criterios que el cierre NO puede exigir**, por estar fuera del programa: la
evidencia runtime cross-tenant en staging (R3, §35), los tests contra DB real
(R3, §35) y el mutation testing por herramienta externa (descartado en §11.2).
Exigirlos haría el cierre inalcanzable por diseño.

## 37. Reauditoría de gobernanza — correction ledger

Una segunda auditoría independiente, ejecutada en R0 sobre `main@38fe1dfe`
(§3.2), reverificó el diagnóstico técnico y auditó este documento **como
instrumento de gobierno** de decenas de PRs. Resultado:

- **El diagnóstico técnico se sostiene.** Todas las cifras `REPRODUCIBLE_*`
  reprodujeron exactamente; los 2 P0 y los 4 P1 se confirmaron por lectura
  directa y por ejecución dirigida. Ningún `TG-Rxx` se retiró ni se rebajó.
- **La gobernanza del roadmap tenía trece defectos**, listados abajo. Todos
  están corregidos en esta revisión.

Este ledger es **trazabilidad histórica**, no backlog: un `TG-Axx` con estado
`CORRECTED_IN_THIS_REVISION` está cerrado y no cuenta como hallazgo abierto
(§28.1).

| ID | Sev. | Problema detectado | Corrección aplicada | Estado |
|---|---|---|---|---|
| `TG-A01` | P1 | `TEST-GLOBAL-05` exigía «`pnpm test` verde», inalcanzable mientras falte la DB aislada que `03` expresamente no provee | §31.0 fija la regla transversal de precondición de DB y **prohíbe** esa formulación en toda fase; la aceptación de `05A` separa launcher, DB y suite global y admite `BLOCKED` con precondición nominal | `CORRECTED_IN_THIS_REVISION` |
| `TG-A02` | P1 | Mixed-scope sin split ni justificación: `05` («test-only + config-only») y `12` («config-only + docs»), esta última bajo una columna titulada «scope único» | Split en `05A`/`05B` y `12A`/`12B`, cada subfase con ficha completa de trece campos. §31.0 declara que **ninguna** subfase invoca la excepción mixed-scope; §34 lo refleja | `CORRECTED_IN_THIS_REVISION` |
| `TG-A03` | P1 | La aceptación de `RETIRE` en `07`/`08` remitía a «§15 del encargo», un texto no versionado; también §16, §19 y A.2 citaban «el prompt» | §31.6 transcribe la prueba de equivalencia completa (8 condiciones, fail-closed). §16 y §19 transcriben el estándar de guard y la frontera de capa. A.2 y §24 reformulados. **Cero referencias normativas externas** | `CORRECTED_IN_THIS_REVISION` |
| `TG-A04` | P1 | 10 de 13 fases no declaraban rollback, pese a `AGENTS.md` §4 | Las 19 subfases declaran rollback. §31.0 exige rollback específico —no la fórmula genérica— cuando hay impacto estructural; `10A`, `10C` y `12B` declaran además el orden de reversión y el estado intermedio | `CORRECTED_IN_THIS_REVISION` |
| `TG-A05` | P2 | `10` se declaraba `backend-only` pero su aceptación (`as any` = 0) obligaba a editar `test/**`, que su propio no-scope restringía | Split en pares costura→realineación: `10A`→`10B` y `10C`→`10D`, con la regla de que una subfase `*B`/`*D` no retira un cast cuya costura no exista | `CORRECTED_IN_THIS_REVISION` |
| `TG-A06` | P2 | §30 fijaba «0 `as any` en costuras de inyección de **rutas**», pero `10` excluía rutas de su scope: el objetivo no tenía fase dueña y el programa podía cerrarse incumpliéndolo | `10C`/`10D` asumen las costuras de rutas (9 `clinicAuthNativeRoutes as any` + criterio para 47 casts de `req`/`res`/`reply`). §30 añade columna «Fase dueña» **obligatoria** para toda métrica de cierre | `CORRECTED_IN_THIS_REVISION` |
| `TG-A07` | P2 | El DAG de §32 dejaba `03`, `10` y `11` como hojas terminales, mientras §31 afirmaba que `13` dependía de todas; §36 exigía los 4 P1 cerrados, y `03` es un P1 | §32 reconstruido como DAG único con lista de relaciones explícita; `13` depende de las diez subfases terminales. §36 nombra la subfase que cierra cada criterio | `CORRECTED_IN_THIS_REVISION` |
| `TG-A08` | P2 | `01B` creaba un censo nuevo, reproduciendo el patrón `FROZEN_CENSUS`/`DUPLICATE_SOURCE_OF_TRUTH` que `11` existe para sanear, sin que ninguna fase lo revisitara | §31.2 fija la regla de fuente única del censo de `01B` (qué es cálculo, qué es guard, qué es congelable y qué no). `11` incorpora ese censo a su scope y añade `01B` a sus dependencias en §32 | `CORRECTED_IN_THIS_REVISION` |
| `TG-A09` | P3 | §6.4, §13.1 y §33 declaraban **9 importadores** del helper canónico | Recomputado sobre §3.2: son **8**, y los 8 importan realmente (no son menciones). Se añade la precisión de que 2 de ellos son además guards del propio helper | `CORRECTED_IN_THIS_REVISION` |
| `TG-A10` | P3 | §18 describía `integration/adapters/repositories/` y `integration/external-services/` como «carpetas documentadas y vacías» | Verificado: 0 archivos tracked **y directorio inexistente**. Redacción corregida a «paths canónicos documentados pero ausentes del árbol» en §18, §28 (`TG-R10`, `TG-R14`) y §33; `09` ajustada en consecuencia | `CORRECTED_IN_THIS_REVISION` |
| `TG-A11` | P3 | Todo el Anexo A asumía Git Bash (`xargs`, `awk`, `grep`), mientras `AGENTS.md` §1 fija Windows + PowerShell como entorno del proyecto | A.3c añade la **variante PowerShell canónica verificada**: 40 de 41 cifras reproducen idénticas, y la única divergencia está explicada y corregida (`TG-A13`). Los comandos Git Bash se conservan marcados como históricos | `CORRECTED_IN_THIS_REVISION` |
| `TG-A12` | P3 | §10.1 citaba el test del falso verde con el nombre truncado y sugería que tenía 3 assertions | Nombre exacto, ubicación (línea 36), constante de path y conteo real: **11 assertions, las 11 `.includes()`**, de las que se citan 3. El hallazgo técnico se conserva intacto y verificado | `CORRECTED_IN_THIS_REVISION` |
| `TG-A13` | P3 | §20 declaraba 426 assertions de censo congelado en 116 archivos, cifra obtenida con un censo line-scoped incapaz de ver las assertions formateadas en varias líneas | Recomputado leyendo el archivo completo: **498 en 134 archivos** (426 + 72). §20, §27 y `TG-R13` corregidos; la cifra operativa de `11` es la nueva | `CORRECTED_IN_THIS_REVISION` |

### 37.2 Segunda ronda de revisión — seis P2 de ejecutabilidad

Una revisión automatizada sobre el head `6fe015da` abrió seis hallazgos P2
sobre la **ejecutabilidad** del roadmap corregido. Los seis se verificaron
contra el árbol y resultaron válidos; los seis están corregidos.

| ID | Sev. | Problema detectado | Corrección aplicada | Estado |
|---|---|---|---|---|
| `TG-A15` | P2 | `12A` podía publicar un baseline canónico y cerrar §36 con `pnpm test:coverage` en `BLOCKED`. Una corrida incompleta no instrumenta los módulos que los archivos fallidos habrían importado, de modo que el porcentaje **subestima** la cobertura real y tergiversa el sistema | La ficha de `12A` condiciona la publicación a `PASSED`: con `BLOCKED` o `FAILED` no hay baseline canónico, la fase **permanece abierta** y sólo puede registrarse una medición diagnóstica **no canónica**, explícitamente marcada, que no cierra la fase ni satisface §36. §36 criterio 10 alineado; salida alternativa = `accepted defer` con la precondición nombrada | `CORRECTED_IN_THIS_REVISION` |
| `TG-A16` | P2 | La aceptación agregada de `04` exigía «los diez contratos de la matriz de §17», pero la matriz tiene **ocho** filas: el criterio era inevaluable porque nadie podía saber qué dos contratos adicionales debía cerrar | Recontadas las filas de §17: son **8**. Corregido a «los ocho contratos», **nominados uno a uno** en la ficha de `04`, con la distinción entre los cuatro que ya están en `NEGATIVE_FIXTURE_PRESENT` y los cuatro que definen el trabajo real. §36 criterio 4 alineado. No se inventó ningún contrato | `CORRECTED_IN_THIS_REVISION` |
| `TG-A17` | P2 | §31.0 declaraba obligatorios trece campos por ficha, pero varias fichas estaban incompletas, lo que volvía formalmente no ejecutables las fases de las que depende `13` | Auditadas las **19 subfases**. Completadas: `03` (Objetivo, Tipo de scope), `10B`/`10C`/`10D`/`12A`/`12B` (Output), `10D` (No-scope, Autorización). Normalizadas al formato canónico `**Campo**:` las variantes que impedían la verificación mecánica (`04` Aceptación/Gates; `05B`, `10A`, `10C`, `12B` Autorización y Riesgo). Resultado: **19/19 fichas completas**, verificable por script. §31.0 no se relajó | `CORRECTED_IN_THIS_REVISION` |
| `TG-A18` | P2 | La regla transversal de DB afirmaba «1 FAILED esperado» sin condicionarlo a que `03` estuviera fusionada, contradiciendo el baseline de nueve fallos de §3.5 con el que se ejecutan `01B` y `02`, y arrastrando los 8 rojos de launcher hacia `BLOCKED` | §31.0 reescrita con **tres estados explícitos**: PRE-03 (launcher 8 `FAILED` + DB 1 = 9 observados), POST-03 con DB ausente (launcher 0 + DB 1) y POST-03 con DB disponible (`PASSED`). Se declara que los 8 del grupo A son **`FAILED`, no `BLOCKED`**, porque se ejecutan y fallan. Separación causal launcher ≠ DB preservada. Fichas de `01B`, `02`, `03`, `04`, `05A`, `07`/`08`, `10B`, `10D` y `11` alineadas al estado que les corresponde | `CORRECTED_IN_THIS_REVISION` |
| `TG-A19` | P2 | `12B` llevaba riesgo `R2/R3` inmediatamente después de que §31.0 prohibiera las categorías compuestas, dejando ambigua la autorización | `12B` queda en **R2**, categoría única. Todo lo que la elevaría a R3 —variables productivas, secretos, environments, branch protection, settings de required checks, deploy, staging, producción— pasa a **no-scope explícito**, con una **regla de parada**: si apareciera esa necesidad, la fase se detiene y se abre tarea nueva con autorización propia. Actualizados §29, §31.1, la ficha, §34 y el veredicto. **0 categorías compuestas en todo el documento** | `CORRECTED_IN_THIS_REVISION` |
| `TG-A14` | P2 | A.0 clasificaba el mismo dato de §24 dos veces con categorías incompatibles: `HISTORICAL_EXECUTION_EVIDENCE` en una fila y `AUDIT_DERIVED_NOT_YET_REPRODUCIBLE` en otra, de modo que ninguna fase podía saber qué regla de reutilización aplicar | Separados en **dos conjuntos con nombre distinto y una sola clase cada uno**: *tiempos observados* (26.422 / 298,7 / 146.129 / 1.864 ms) = `HISTORICAL_EXECUTION_EVIDENCE`; *Pareto y ranking derivados* (50 %→33, 80 %→130, tabla de entradas caras, agregado 133,6 s) = `AUDIT_DERIVED_NOT_YET_REPRODUCIBLE`, por depender de procesamiento TAP no versionado. Fila duplicada eliminada; §24 declara la procedencia en línea | `CORRECTED_IN_THIS_REVISION` |

### 37.1 Defectos auditados y **no** corregidos, por decisión

| Observación | Decisión |
|---|---|
| §6.2 y §6.3 están clasificados `AUDIT_DERIVED_NOT_YET_REPRODUCIBLE` en A.0, pero varias de sus filas reprodujeron exactamente en la reverificación | **No se promueven** a categoría reproducible en bloque. Se marcan `CURRENT_REVERIFICATION` sólo las filas efectivamente reejecutadas. Promover el resto sin comando documentado violaría la regla de §0 |
| Las cifras de §7.2, §7.3, §8.2, §9.3 y §23 siguen dependiendo de los scratchpads de A.4 | **Se conservan como `AUDIT_DERIVED_NOT_YET_REPRODUCIBLE`.** No se recrean los scripts: versionarlos es trabajo de `01B`, y hacerlo aquí habría convertido un cambio docs-only en test-only |
| El wall time de §24 varía por host (26,4 s vs 146,1 s en la misma máquina, A.5) | **Se conserva con la advertencia existente**, y en esta revisión se separa de las cifras derivadas: tiempos observados = `HISTORICAL_EXECUTION_EVIDENCE`, Pareto y ranking = `AUDIT_DERIVED_NOT_YET_REPRODUCIBLE` (`TG-A14`). Ninguna aceptación de fase depende de un tiempo absoluto |

---

## Anexo A — Censos y su reproducibilidad

Cifras medidas sobre `main@ee8e7425` (§3.1) el 2026-09-21 y reverificadas sobre
`main@38fe1dfe` (§3.2), desde la raíz del repo.

**Entorno canónico de reproducción (`TG-A11`).** `AGENTS.md` §1 fija el entorno
del proyecto como **Windows + PowerShell**, con PNPM como gestor. Por tanto:

```text
CANÓNICO    PowerShell 7+ · Node.js · Git · pnpm      → A.1, A.3c, A.5, A.6
HISTÓRICO   Git Bash (xargs, awk, grep -E)            → A.2, A.3, A.3b
PROHIBIDO   Python · rg · WSL                          — ninguna cifra depende de ellos
```

Los comandos Git Bash de A.2, A.3 y A.3b **se conservan** porque son la
evidencia con la que se produjeron las cifras originales y retirarlos destruiría
trazabilidad. Su equivalente PowerShell verificado está en **A.3c**, que es el
mecanismo canónico para toda fase futura. Donde ambas formas divergen, A.3c lo
declara y explica la causa: no se eligió la cifra más conveniente.

Este anexo **no** afirma que todo lo medido sea reproducible desde el
repositorio. A.0 dice, cifra por cifra, cuál lo es y cuál no.

### A.0 Clasificación de reproducibilidad

| Categoría | Significado |
|---|---|
| `REPRODUCIBLE_FROM_REPO` | La cifra sale de un script o comando que ya existe en el repositorio (`package.json`), sin pasos adicionales |
| `REPRODUCIBLE_WITH_DOCUMENTED_COMMAND` | La cifra sale de un comando documentado en A.1–A.3b que **se volvió a ejecutar al corregir esta auditoría y devolvió exactamente la cifra del documento** |
| `AUDIT_DERIVED_NOT_YET_REPRODUCIBLE` | La cifra proviene de un script de scratchpad no versionado (A.4) o de un cálculo que no se volvió a ejecutar con un comando documentado. Hoy **no** puede recomputarse desde el repo con lo escrito aquí |
| `MANUAL_CLASSIFICATION` | El dato o veredicto proviene de lectura de código; se reproduce leyendo los archivos citados, no ejecutando un comando |
| `HISTORICAL_EXECUTION_EVIDENCE` | Resultado de una ejecución concreta en un host concreto. Es evidencia de que algo ocurrió, **no** una cifra estable: depende de la máquina, del momento o del entorno, y re-ejecutar puede dar otro valor legítimamente (p. ej. los tiempos de §24) |
| `CURRENT_REVERIFICATION` | La cifra se volvió a ejecutar sobre `main@38fe1dfe` (§3.2) durante la reauditoría de gobernanza (§37) y devolvió el valor que aquí figura. Es el grado más alto de confianza de este documento |

| Cifra central | Sección | Categoría | Referencia |
|---|---|---|---|
| 576 archivos, 562 specs, 4.530 `test(`, 156.887 LOC de `test/**` | §6.1 | `CURRENT_REVERIFICATION` | A.1, A.3c |
| `.only(` = 0, `describe(` = 0, `mock.*` = 0 | §6.1, §12.2 | `REPRODUCIBLE_WITH_DOCUMENTED_COMMAND` | A.3b |
| 4.590 entradas, 4.580 pass, 1 skipped | §3, §6.1 | `REPRODUCIBLE_FROM_REPO` | `pnpm test` (A.5) |
| 9 FAILED = 8 launcher win32 + 1 DB, por archivo | §3, §10.2 | `REPRODUCIBLE_FROM_REPO` (depende de plataforma y de DB) | A.5, A.5b |
| 134 tests de `architecture/security` | §9.1, §17 | `REPRODUCIBLE_FROM_REPO` | A.5 |
| Tabla de coverage vacía para el spec citado; 226 archivos en la corrida completa | §21.1 | `REPRODUCIBLE_FROM_REPO` | Comando de §21.1 y `pnpm test:coverage` |
| Producción: `server/**` 226 / 46.081, `frontend/src/**` 200 / 43.276 | §6.3 | `REPRODUCIBLE_WITH_DOCUMENTED_COMMAND` | A.3b |
| Resto de §6.2, §6.3 y §6.4 (carpetas, `e2e`, `shared`/`drizzle`/`scripts`, ratios, soporte compartido e importadores) | §6.2–§6.4 | `AUDIT_DERIVED_NOT_YET_REPRODUCIBLE` | — |
| Censo bruto: `node:fs` 410, `readFileSync` 406, `existsSync` 104, `readdirSync` 82, `child_process` 25, `statSync` 20, `js-yaml` 8, `createRequire` 8 | §7.1 | `REPRODUCIBLE_WITH_DOCUMENTED_COMMAND` | A.2, A.3b |
| Buckets fs × runtime, clasificación por oracle (137 / 1.042 …), concentración por carpeta | §7.2, §7.3 | `AUDIT_DERIVED_NOT_YET_REPRODUCIBLE` | A.4 (`classify.mjs`, `coupling.mjs`) |
| Calibración: falsos positivos del clasificador y 3 casos confirmados | §7.4, Anexo B | `MANUAL_CLASSIFICATION` | Anexo B |
| Assertions por forma, total 20.623, substring 6.262 / 1.522 | §8, §8.2 | `REPRODUCIBLE_WITH_DOCUMENTED_COMMAND` | A.3, A.3b |
| 157 archivos / 1.264 tests con ≥ 80 % substring y sin runtime; 0 archivos sin `assert.*`; 21 con wrappers | §8.1, §8.2 | `AUDIT_DERIVED_NOT_YET_REPRODUCIBLE` | A.4 |
| Oracle circular: 18 contratos, 3 con `readSource()`, 15 sin verificación | §9.1 | `MANUAL_CLASSIFICATION` | Anexo B.1 |
| 11 paths stale de `requiredTestEvidence` | §9.2 | `REPRODUCIBLE_WITH_DOCUMENTED_COMMAND` | A.3b |
| 3.229 referencias / 732 paths únicos / 109 inexistentes | §9.3 | `AUDIT_DERIVED_NOT_YET_REPRODUCIBLE` | A.4 (`stale-paths.mjs`) |
| Falso verde `statsLoadError ?` (mutación razonada, **no ejecutada**) | §10.1 | `MANUAL_CLASSIFICATION` | Anexo B.2 |
| 9 harness de mutación, 130 tests fail-closed, conteos de `rejects`/`throws`/`doesNotMatch` | §11 | `AUDIT_DERIVED_NOT_YET_REPRODUCIBLE` | — |
| Clasificación de contratos críticos y matriz de seguridad | §11.1, §17 | `MANUAL_CLASSIFICATION` | — |
| **8** importadores del helper canónico `tracked-source-files.ts` | §6.4, §13.1 | `CURRENT_REVERIFICATION` | A.3c |
| Importadores del resto de doubles y soporte compartido | §6.4, §12.1 | `AUDIT_DERIVED_NOT_YET_REPRODUCIBLE` | — |
| Los dos paths canónicos de integración ausentes del árbol | §18, §33 | `CURRENT_REVERIFICATION` | A.3c |
| Nombre, ubicación y 11 assertions del test del falso verde | §10.1, B.2 | `CURRENT_REVERIFICATION` | A.3c |
| **Tiempos observados** de ejecución: 26.422 ms y 298,7 ms (corrida original), 146.129 ms y 1.864 ms (re-ejecución en la misma máquina) | §24, §3.5, §9.1 | `HISTORICAL_EXECUTION_EVIDENCE` | A.5 |
| **Pareto y ranking de entradas caras** (50 % en 33 entradas, 80 % en 130, tabla de entradas más costosas, tiempo agregado 133,6 s) | §24 | `AUDIT_DERIVED_NOT_YET_REPRODUCIBLE` | Derivado de procesar la salida TAP con un script no versionado |
| Backend CI = success @ `ee8e7425` y @ `38fe1dfe` | §3, §29 | `CURRENT_REVERIFICATION` | A.6 |
| `as any` 659 / 64 archivos y sus contextos principales (excepto `req`/`res`/`reply` y `clinicAuthNativeRoutes`, no re-verificados) | §12.3 | `REPRODUCIBLE_WITH_DOCUMENTED_COMMAND` | A.3, A.3b |
| `Date` 22, timers 7, aleatorio 4, hooks 4 | §13 | `REPRODUCIBLE_WITH_DOCUMENTED_COMMAND` | A.3b |
| Mutación de `process.env` (11 archivos, 8 sin restaurar) | §13, §13.2 | `AUDIT_DERIVED_NOT_YET_REPRODUCIBLE` | Un `grep` simple da 9 archivos |
| Lectores propios por definición: `read(` 216, `readSource(` 65, `collectFiles(` 4, `listFiles`/`collectSourceFiles` 4 | §13.1 | `REPRODUCIBLE_WITH_DOCUMENTED_COMMAND` | A.3b |
| 283 archivos con lector propio; `walk(` 18; normalización CRLF 295 / 36 | §13.1 | `AUDIT_DERIVED_NOT_YET_REPRODUCIBLE` | Un `grep` simple da 281, 17 y 279 archivos con `\r\n` |
| **498** assertions de censo congelado en **134** archivos (cifra vigente; 426/116 es el subconjunto line-scoped) | §20 | `CURRENT_REVERIFICATION` | A.3c |
| 75 registries literales | §20 | `AUDIT_DERIVED_NOT_YET_REPRODUCIBLE` | — |
| Subcarpetas de `unit`, integración, guards, destinos de lectura, status HTTP, ownership, nombres duplicados | §14–§16, §19, §22, §23 | `AUDIT_DERIVED_NOT_YET_REPRODUCIBLE` | A.4 (`ownership.mjs` para §23) |
| `test:coverage` ausente de todo workflow | §21, §25 | `REPRODUCIBLE_WITH_DOCUMENTED_COMMAND` | A.3b |
| `test/**` fuera de `lintableFiles` | §25.2 | `MANUAL_CLASSIFICATION` | `eslint.config.mjs` |
| Proyección de coste | §27 | `AUDIT_DERIVED_NOT_YET_REPRODUCIBLE` | Extrapolación de cifras derivadas |
| Estado de CI sobre el baseline | §3, §29 | `REPRODUCIBLE_WITH_DOCUMENTED_COMMAND` (dependiente del momento) | A.6 |

Una cifra `AUDIT_DERIVED_NOT_YET_REPRODUCIBLE` **no queda invalidada** por esa
categoría: significa que hoy nadie puede recomputarla sin el scratchpad
original. Toda decisión que dependa de ella (p. ej. el pool de 137 candidatos de
`TEST-GLOBAL-06` o los 283 lectores de `TEST-GLOBAL-05A`) debe recomputarla
primero. La reproducibilidad durable de estas cifras es criterio de aceptación
de `TEST-GLOBAL-01B` (§31), no de este documento docs-only.

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

*Limitación*: presencia de `node:fs` **no** implica deuda. La clasificación se
hace por poder del oracle, no por la señal física (§4, §7.3).

### A.3 Assertions

```bash
git ls-files 'test/**/*.test.ts' | xargs grep -oE "assert\.ok\([A-Za-z0-9_.]*\.includes\(" | wc -l   # 6262
git ls-files 'test/**/*.test.ts' | xargs grep -oE "assert\.equal\([A-Za-z0-9_.]*\.includes\(" | wc -l # 1522
git ls-files 'test/**/*.test.ts' | xargs grep -oE "\.length,\s*[0-9]+" | wc -l                        # 426 — PARCIAL, ver A.3c
git ls-files 'test/**/*.ts'      | xargs grep -oE " as any" | wc -l                                   # 659
```

### A.3b Comandos adicionales verificados

Cada comando se volvió a ejecutar al corregir esta auditoría y devolvió la cifra
indicada.

```bash
S() { git ls-files 'test/**/*.test.ts'; }

# Assertions (§8): total y desglose por forma
S | xargs grep -oE 'assert\.[A-Za-z]+\(' | wc -l                                  # 20623
S | xargs grep -ohE 'assert\.[A-Za-z]+\(' | sort | uniq -c | sort -rn             # 8629 ok, 7960 equal, …

# Ausencias (§6.1, §12.2): los tres devuelven 0
S | xargs grep -lE '\.only\(' | wc -l                                             # 0
S | xargs grep -lE '^\s*describe\(' | wc -l                                       # 0
S | xargs grep -lE 'mock\.(fn|method|module|timers)' | wc -l                      # 0

# Señales de source coupling (§7.1), archivos
S | xargs grep -lE 'readFileSync' | wc -l                                         # 406
S | xargs grep -lE 'existsSync' | wc -l                                           # 104
S | xargs grep -lE 'statSync' | wc -l                                             # 20
S | xargs grep -lE 'node:child_process' | wc -l                                   # 25
S | xargs grep -lE 'js-yaml' | wc -l                                              # 8
S | xargs grep -lE 'createRequire|node:module' | wc -l                            # 8

# Lectores propios (§13.1), archivos con la definición
S | xargs grep -lE 'function read\(' | wc -l                                      # 216
S | xargs grep -lE 'function readSource\(' | wc -l                                # 65
S | xargs grep -lE 'function collectFiles\(' | wc -l                              # 4
S | xargs grep -lE 'function (listFiles|collectSourceFiles)\(' | wc -l           # 4

# Determinismo (§13), archivos
S | xargs grep -lE 'Date\.now\(\)|new Date\(\)' | wc -l                           # 22
S | xargs grep -lE 'setTimeout|setInterval|mock\.timers' | wc -l                  # 7
S | xargs grep -lE 'Math\.random|randomUUID|randomBytes' | wc -l                  # 4
S | xargs grep -lE '\b(before|beforeEach|after|afterEach)\(' | wc -l              # 4

# Escapes de tipos (§12.3), sobre git ls-files 'test/**/*.ts'
git ls-files 'test/**/*.ts' | xargs grep -lE ' as any' | wc -l                    # 64 archivos
git ls-files 'test/**/*.ts' | xargs grep -oE 'as unknown as' | wc -l              # 4
git ls-files 'test/**/*.ts' | xargs grep -oE 'ENV\.smtp as any' | wc -l          # 140
git ls-files 'test/**/*.ts' | xargs grep -oE 'ENV\.gmailApi as any' | wc -l      # 121
git ls-files 'test/**/*.ts' | xargs grep -oE 'supabase\.storage as any' | wc -l  # 63
git ls-files 'test/**/*.ts' | xargs grep -oE '\bENV as any' | wc -l              # 43
git ls-files 'test/**/*.ts' | xargs grep -oE 'nodemailer as any' | wc -l         # 36
git ls-files 'test/**/*.ts' | xargs grep -oE 'globalThis as any' | wc -l         # 22

# Volumen de producción (§6.3): archivos y LOC
git ls-files 'server/**' | grep -E '\.(ts|tsx|js|mjs)$' | wc -l                  # 226
git ls-files 'server/**' | grep -E '\.(ts|tsx|js|mjs)$' | xargs wc -l | grep -E 'total$' | awk '{s+=$1} END {print s}'   # 46081
git ls-files 'frontend/src/**' | grep -E '\.(ts|tsx|js|mjs)$' | wc -l            # 200
git ls-files 'frontend/src/**' | grep -E '\.(ts|tsx|js|mjs)$' | xargs wc -l | grep -E 'total$' | awk '{s+=$1} END {print s}'   # 43276

# Evidencia stale del registro IDOR (§9.2): paths raíz inexistentes
grep -oE '"test/[A-Za-z0-9._-]+\.test\.ts"' \
  test/architecture/security/security-cross-tenant-idor-contract.test.ts \
  | tr -d '"' | sort -u \
  | while read -r p; do git ls-files --error-unmatch "$p" >/dev/null 2>&1 || echo "MISSING $p"; done | wc -l   # 11

# test:coverage ausente de CI (§21, §25)
grep -rn 'test:coverage' .github/workflows | wc -l                                # 0
```

*Limitaciones*: `describe(` sin ancla de línea devuelve 1 por un string literal
en `public-professionals-fixture-assertions-quality-invariants.test.ts`, no por
una llamada real. Las 11 formas de assertion listadas en §8 suman 20.615; los 8
restantes son `assert.notDeepEqual(` (7) y `assert.doesNotReject(` (1).

### A.3c Variante PowerShell canónica — verificada (`TG-A11`)

Equivalente de A.1–A.3b en el entorno que `AGENTS.md` §1 declara canónico.
**Ejecutado sobre `main@38fe1dfe` (§3.2): 40 de las 41 cifras reprodujeron
exactamente el valor documentado; la única divergencia está explicada abajo y
corrigió la cifra del documento, no al revés.**

Las tres funciones auxiliares importan, porque la traducción ingenua produce
cifras distintas:

```powershell
# Guardar como scripts/… NO: este bloque es documentación, no tooling versionado.
# Versionarlo es criterio de aceptación de TEST-GLOBAL-01B.

function Specs { git ls-files 'test/**/*.test.ts' }

# Cuenta ARCHIVOS que contienen el patrón  (equivale a: grep -l | wc -l)
function CountFilesMatching([string[]]$files, [string]$pattern) {
  ($files | Where-Object { (Get-Content -LiteralPath $_ -Raw) -match $pattern }).Count
}

# Cuenta OCURRENCIAS, varias por línea  (equivale a: grep -oE | wc -l)
function CountOccurrences([string[]]$files, [string]$pattern) {
  $t = 0
  foreach ($f in $files) { $t += ([regex]::Matches((Get-Content -LiteralPath $f -Raw), $pattern)).Count }
  $t
}

# Cuenta LÍNEAS que matchean  (equivale a: grep -cE sumado por archivo)
function CountMatchingLines([string[]]$files, [string]$pattern) {
  $t = 0
  foreach ($f in $files) { $t += (@(Get-Content -LiteralPath $f) | Where-Object { $_ -match $pattern }).Count }
  $t
}

# LOC: cuenta saltos de línea, como wc -l
function SumLoc([string[]]$files) {
  $t = 0
  foreach ($f in $files) {
    $raw = Get-Content -LiteralPath $f -Raw
    if ($null -ne $raw) { $t += ([regex]::Matches($raw, "`n")).Count }
  }
  $t
}

$S = @(Specs); $all = @(git ls-files 'test/**'); $allTs = @(git ls-files 'test/**/*.ts')

$all.Count                                                   # 576
$S.Count                                                     # 562
CountMatchingLines $S '^\s*test\('                           # 4530
SumLoc $all                                                  # 156887
CountFilesMatching $S "from ['`"]node:fs"                    # 410
CountFilesMatching $S 'readFileSync'                         # 406
CountFilesMatching $S 'existsSync'                           # 104
CountFilesMatching $S 'readdirSync'                          # 82
CountFilesMatching $S 'node:child_process'                   # 25
CountFilesMatching $S 'statSync'                             # 20
CountFilesMatching $S 'js-yaml'                              # 8
CountFilesMatching $S 'createRequire|node:module'            # 8
CountOccurrences   $S 'assert\.[A-Za-z]+\('                  # 20623
CountOccurrences   $S 'assert\.ok\([A-Za-z0-9_.]*\.includes\('    # 6262
CountOccurrences   $S 'assert\.equal\([A-Za-z0-9_.]*\.includes\(' # 1522
CountFilesMatching $S '\.only\('                             # 0
CountMatchingLines $S '^\s*describe\('                       # 0
CountFilesMatching $S 'mock\.(fn|method|module|timers)'      # 0
CountFilesMatching $S 'function read\('                      # 216
CountFilesMatching $S 'function readSource\('                # 65
CountFilesMatching $S 'function collectFiles\('              # 4
CountFilesMatching $S 'function (listFiles|collectSourceFiles)\('  # 4
CountFilesMatching $S 'Date\.now\(\)|new Date\(\)'           # 22
CountFilesMatching $S 'setTimeout|setInterval|mock\.timers'  # 7
CountFilesMatching $S 'Math\.random|randomUUID|randomBytes'  # 4
CountFilesMatching $S '\b(before|beforeEach|after|afterEach)\('    # 4
CountOccurrences   $allTs ' as any'                          # 659
CountFilesMatching $allTs ' as any'                          # 64 archivos
CountOccurrences   $allTs 'as unknown as'                    # 4
CountOccurrences   $allTs 'ENV\.smtp as any'                 # 140
CountOccurrences   $allTs 'ENV\.gmailApi as any'             # 121
CountOccurrences   $allTs 'supabase\.storage as any'         # 63
CountOccurrences   $allTs '\bENV as any'                     # 43
CountOccurrences   $allTs 'nodemailer as any'                # 36
CountOccurrences   $allTs 'globalThis as any'                # 22
CountOccurrences   $allTs 'clinicAuthNativeRoutes as any'    # 9   (§30, fase 10C)

$srv = @(git ls-files 'server/**'       | Where-Object { $_ -match '\.(ts|tsx|js|mjs)$' })
$fe  = @(git ls-files 'frontend/src/**' | Where-Object { $_ -match '\.(ts|tsx|js|mjs)$' })
$srv.Count; SumLoc $srv                                      # 226 / 46081
$fe.Count;  SumLoc $fe                                       # 200 / 43276
```

Helper canónico, paths de integración y test del falso verde:

```powershell
# §6.4 / §13.1 — importadores del helper canónico
@(git ls-files 'test/**/*.ts' |
  Where-Object { (Get-Content -LiteralPath $_ -Raw) -match 'tracked-source-files' }).Count   # 8

# §18 — paths canónicos documentados pero ausentes del árbol
@(git ls-files 'test/integration/adapters/repositories/**').Count   # 0
@(git ls-files 'test/integration/external-services/**').Count       # 0
Test-Path 'test/integration/adapters/repositories'                  # False
Test-Path 'test/integration/external-services'                      # False

# §10.1 / B.2 — el test del falso verde y su mutación
$g = 'test/unit/ui/dashboard/frontend-dashboard-empty-states.test.ts'
([regex]::Matches((Get-Content -LiteralPath $g -Raw), 'assert\.[A-Za-z]+\(')).Count   # 43 en el archivo
('!statsLoadError ?').Contains('statsLoadError ?')                                     # True
```

#### Divergencia única y su resolución

```powershell
# §20 — assertions de censo congelado, a DOS alcances distintos
$line = 0; $raw = 0
foreach ($f in $S) {
  $c = Get-Content -LiteralPath $f -Raw
  $raw  += ([regex]::Matches($c, '\.length,\s*[0-9]+')).Count          # 498
  foreach ($ln in @(Get-Content -LiteralPath $f)) {
    $line += ([regex]::Matches($ln, '\.length,[ \t]*[0-9]+')).Count    # 426
  }
}
```

El comando histórico de A.3 (`grep -oE "\.length,\s*[0-9]+"`) es **line-scoped**:
no puede ver una assertion escrita en varias líneas. .NET aplicado al archivo
completo sí, porque su `\s` incluye el salto de línea. La diferencia son
exactamente **72** assertions formateadas en varias líneas (426 + 72 = 498).

**Resolución**: la cifra correcta es **498 en 134 archivos**, y así queda en §20,
§27 y `TG-R13`. No se ajustó el comando para preservar el 426: se corrigió la
cifra. Registrado como `TG-A13` en §37.

*Nota de portabilidad*: `Measure-Object -Line` **no** sirve para contar LOC —
omite las líneas vacías y da un valor distinto de `wc -l`. Por eso `SumLoc`
cuenta saltos de línea sobre el contenido crudo.

### A.4 Clasificación por capa y acoplamiento

Cuatro scripts Node de scratchpad produjeron las cifras clasificadas
`AUDIT_DERIVED_NOT_YET_REPRODUCIBLE` en A.0 (criterio documentado en §7.3).
**No están versionados**: no existe ningún archivo con esos nombres en el árbol
tracked ni en el árbol de trabajo. Esta auditoría no los recrea ni los inventa.

- `classify.mjs` — capa inferida por comportamiento, señales de determinismo, densidad de assertions.
- `coupling.mjs` — clasificación de acoplamiento por poder del oracle.
- `ownership.mjs` — difusión de ownership (guards por archivo de producción).
- `stale-paths.mjs` — referencias a paths inexistentes.

Hasta que exista una implementación versionada, las cifras que dependen de ellos
(§7.2, §7.3, §8.2, §9.3, §23) son **hallazgos de la auditoría, no censos
recomputables**. Versionarlos y verificar que reproducen (o reclasifican con la
diferencia declarada) esas cifras es criterio de aceptación de
`TEST-GLOBAL-01B` (§31); no se hace en esta PR porque introduciría `test/**` o
`scripts/**` en un cambio docs-only.

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

Notas: (1) `tests`, `pass` y `skipped` se reprodujeron idénticos al corregir esta
auditoría; `fail` = 9 depende de plataforma y de DB (§10.2). (2) `duration_ms`
**depende del host**: la corrida original midió 26.422 ms y 298,7 ms; una
re-ejecución posterior en la misma máquina midió 146.129 ms y 1.864 ms. Ninguna
cifra de tiempo (§24) debe leerse como valor estable.

### A.5b Descomposición de los 9 FAILED (§10.2)

```bash
for f in test/unit/infrastructure/e2e-completeness-workflow.test.ts \
         test/unit/infrastructure/frontend-playwright-production-runner.test.ts \
         test/integration/app/e2e-global-03b-authoritative-auth-boundary.fastify.test.ts; do
  node --experimental-strip-types --experimental-specifier-resolution=node \
       --test --test-reporter=tap "$f" | grep -E '^# (tests|fail)'
done
# e2e-completeness-workflow             tests 9  | fail 2   (grupo A)
# frontend-playwright-production-runner tests 16 | fail 6   (grupo A)
# e2e-global-03b-authoritative-auth-…   tests 1  | fail 1   (grupo B, DB)
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
| B.2 | `test/unit/ui/dashboard/frontend-dashboard-empty-states.test.ts`, test de la línea 36 *"dashboard overview clinic command center distinguishes recent list load failures from empty states"* | `FALSE_GREEN` | `.includes("statsLoadError ?")` también matchea `"!statsLoadError ?"`: invertir la condición deja pasar **las 11 assertions** del test, todas `.includes()`. Mutación razonada y verificada por contención de substring; **no ejecutada** contra `frontend/src/**` |
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
STATUS:               ACTIVE
PRIMARY_AUDIT:        COMPLETE        (diagnóstico técnico, §§6-29)
GOVERNANCE_REAUDIT:   COMPLETE        (§37, 13 hallazgos TG-A)
ROADMAP_GOVERNANCE:   CORRECTED       (13/13 TG-A en CORRECTED_IN_THIS_REVISION)
IMPLEMENTATION:       IN_PROGRESS     (verificado sobre main@247a497c, 2026-09-23)

COMPLETED:    01A #1761 · 01B #1762 · 02 #1763 · 03 #1765 (sobre el fix de launcher #1764)
IN_PROGRESS:  04  dimensión A cumplida (#1763 #1766 #1767 #1768); dimensión B: 9 guards PENDIENTES
PENDING:      05A · 05B · 06 · 07 · 08 · 09 · 10A · 10B · 10C · 10D · 11 · 12A · 12B · 13
              (12A sigue bloqueada por el DAG: exige 04 cerrada en agregado y 08)

TECHNICAL_P0: 2       TG-R01 · TG-R02                       — CERRADOS (02, #1763)
TECHNICAL_P1: 4       TG-R04                                — CERRADO  (03, #1765)
                      TG-R05                                — ABIERTO, parcial (04, dimensión B)
                      TG-R03 · TG-R06                       — ABIERTOS (06, 07, 08)
TECHNICAL_P2: 6       TG-R07 … TG-R12                       — ABIERTOS
TECHNICAL_P3: 4       TG-R13 … TG-R16                       — ABIERTOS
OPEN ACTUAL:  13 de 16

ROADMAP:  13 fases lógicas · 19 subfases · PRs >= 19
R2 FUTUROS (autorización explícita de Nico):  05B · 10A · 10C · 12B
NEXT:     TEST-GLOBAL-04 dimensión B: mutation proof de los 9 guards pendientes,
          en el orden de dominios de §11.2 (tenant isolation → auth/sesiones →
          permisos/roles → disclosure → rate limiting). Son paralelizables (§32).
          Además, adjudicar los 5 guards que quedan fuera de los seis dominios.
```

Los conteos `TECHNICAL_*` repiten el **inventario total** de §28 y no cambian.
El estado de cada riesgo está en la misma línea. Un riesgo se marca `CERRADO`
sólo si su fase dueña está fusionada con la evidencia que pide su ficha:
`TG-R01`/`TG-R02` por `02` (18 contratos dereferenciados, 0 paths stale,
negative proof en el PR) y `TG-R04` por `03` (fallos de launcher = 0 declarados
en #1765). Estas evidencias vienen de los PRs y de Backend CI `success` en sus
merge commits; este PR docs-only no las volvió a ejecutar. La reauditoría de
gobernanza no cierra ningún riesgo técnico. Las dos series se explican en §28.1. La única intersección
es `TG-A13`, que corrigió una cifra citada por `TG-R13` sin cambiar su
severidad.

Un agente que reciba este repositorio puede ejecutar el programa leyendo
únicamente `AGENTS.md` y este archivo: §31.0 fija las convenciones, §31.1 la
tabla maestra, §31.2 la regla de censo, §31.6 la prueba de equivalencia, §32 el
DAG, §34 los splits y §36 el cierre. **No necesita ningún prompt, encargo ni
conversación externa.**
