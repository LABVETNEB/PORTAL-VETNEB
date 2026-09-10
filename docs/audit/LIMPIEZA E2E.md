# LIMPIEZA E2E

## Auditoría global E2E de caja blanca — PORTAL-VETNEB

| Campo | Valor |
|---|---|
| Documento | LIMPIEZA E2E |
| Tipo | Auditoría técnica global de caja blanca del subsistema E2E |
| Repositorio | PORTAL-VETNEB |
| Alcance | E2E global del repositorio |
| Estado | ACTIVE |
| Propósito | Fuente rectora para saneamiento, estabilización y evolución de la infraestructura E2E |
| Implementación | No realizada por esta auditoría |
| Fuente | Auditoría global E2E completada inmediatamente antes de crear este documento |

---

## 0. Naturaleza de `LIMPIEZA E2E`

`LIMPIEZA E2E` es el nombre permanente del documento y del programa de saneamiento derivado de esta auditoría.

Queda inequívocamente documentado que **`LIMPIEZA E2E`**:

- **NO** es una auditoría exclusiva del dashboard;
- **NO** pertenece a B14;
- **NO** pertenece a B15;
- **NO** pertenece a B16;
- **NO** corresponde a un PR concreto;
- **NO** corresponde a un único fallo de CI.

Es un **programa transversal de calidad** que cubre:

frontend E2E · admin · clínica · particular · público · platform · regression · Playwright · fixtures · helpers · catálogo · cohortes · CI · visual regression · geometría · seguridad · auth · performance · determinismo · cobertura.

El dashboard es solamente uno de los dominios consumidores de la infraestructura E2E auditada.

---

## Relación con el programa Dashboard

Esta auditoría es transversal al repositorio y no forma parte del Programa B del dashboard.

El roadmap del dashboard se encuentra actualmente pausado después de B14 para permitir la evaluación y eventual estabilización global del subsistema E2E.

La continuación de B15/B16 deberá decidirse utilizando los criterios y bloqueantes establecidos por esta auditoría, sin convertir LIMPIEZA E2E en una auditoría específica del dashboard.

---

## Procedencia y metodología

`[OBSERVADO]` Esta auditoría se ejecutó como **auditoría de caja blanca de sólo lectura (R0)** sobre el árbol de trabajo en el HEAD declarado en §2, bajo el contrato operativo de `AGENTS.md` (leído íntegro, 837 líneas, sin `AGENTS.md` anidados en el repositorio).

Métodos de evidencia empleados:

- inspección directa de código, configuración y workflows (Read/Grep/Glob y comandos `git` de sólo lectura, §5.1 de `AGENTS.md`);
- descubrimiento de tests con `node node_modules/@playwright/test/cli.js test --list --reporter=json` desde `frontend/` (no ejecuta la suite, no levanta webServers);
- evaluación programática del catálogo mediante importación de `frontend/e2e/suites/catalog.ts` con `node --experimental-strip-types`;
- extracción de duraciones y resultados reales desde logs de CI vía `gh run list` y `gh run view <id> [--log|--log-failed|--json]` (lecturas R0 de `AGENTS.md` §5.1).

**No se ejecutó ninguna cohorte E2E localmente.** `AGENTS.md` §7 fija `Playwright completo por defecto = 0` y §8 limita las tareas pesadas concurrentes; la evidencia de performance y de resultados proviene de corridas reales de CI, identificadas por su `run id`.

Las cifras históricas encontradas en la documentación del repositorio se trataron **exclusivamente como precedente**; todo número reportado aquí fue recalculado contra el estado real del HEAD auditado.

Este documento **persiste** la auditoría; no la re-ejecuta. Ningún hallazgo, criticidad, métrica, evidencia ni conclusión fue alterado al documentarla.

---

# AUDITORÍA GLOBAL E2E DE CAJA BLANCA — PORTAL-VETNEB

## 1. Resumen ejecutivo

**La suite E2E de PORTAL-VETNEB es, en su gobernanza, una de las mejor construidas que se pueden encontrar en un repo de este tamaño; y en su *alcance semántico*, mucho más estrecha de lo que su nombre, su volumen y su documentación sugieren.**

Los tres hechos que dominan el diagnóstico:

1. **`[OBSERVADO]` Ningún E2E del repositorio atraviesa el backend real.** `playwright.config.ts:60-74` levanta exactamente dos procesos: un servidor HTTP mock de 1.194 líneas (`frontend/e2e/fixtures/admin-populated-api-server.mjs`) y Next.js. `server/**` (48.092 LOC de Fastify) nunca arranca. Además 29 de 95 specs interceptan y sintetizan respuestas en el browser (`page.route`, 75 call sites). Lo que el repo llama "E2E" es **system testing de frontend contra una API stubbeada**, y no existe ningún guard que reconcilie el stub con el contrato real del backend.

2. **`[OBSERVADO]` Ningún E2E autentica.** Las 95 specs fabrican sesión con `context.addCookies` (92 call sites en 67 specs) contra un fixture que valida la sesión por comparación literal de string (`admin-populated-api-server.mjs:806-818`). `login-hydration.spec.ts` nunca hace submit del formulario. El fixture **jamás emite 401** (emite 200/404/405). El `proxy.ts:1-19` documenta explícitamente que es *navigation gating, no authorization boundary*, y que la frontera real es Fastify. Conclusión: **el E2E cubre la mitad cosmética de la frontera de seguridad y ninguna E2E prueba la mitad autoritativa**. No existe ninguna spec cross-rol (sesión de clínica → `/dashboard/admin`).

3. **`[OBSERVADO]` La suite es masivamente un contrato de geometría, no de comportamiento.** De 3.088 `expect()`: 1.087 son presencia/visibilidad, 565 comparaciones numéricas de píxeles, 640 igualdad exacta (mayormente de mediciones), y sólo **184 (6%) verifican texto o valor de datos**. `toHaveScreenshot` aparece 3 veces.

**Qué está realmente bien** (y hay que preservarlo): el catálogo (`frontend/e2e/suites/catalog.ts`) es fuente única real, con partición exacta `ci ∪ extended ∪ evidence ∪ visual-linux = full`, verificada fail-closed por `test/architecture/e2e-suite-catalog-completeness.test.ts` (418 líneas) que corre dentro del gate **required** `validate-backend`. Reconcilia 1:1 con el filesystem: 95 specs físicos = 95 entradas = 95 archivos descubiertos por Playwright. Cero specs huérfanos, cero snapshots huérfanos (40/40), cero helpers muertos. El runner (`run-cohort.mjs`) falla cerrado con códigos distintos (2/3/4/5). `retries` es 0 en el gate required. La disciplina de sincronización es buena: 118 bloques `toPass()` contra sólo 17 `waitForTimeout`.

**Riesgo dominante:** no es flakiness (medida: **1 flaky en 1.322 tests**). Es **falso verde estructural**: la suite puede estar completamente verde mientras el login, la validación de sesión, el 401, la autorización por rol, el aislamiento tenant y el contrato real de la API están rotos, porque nada de eso está bajo prueba. Y el bundle que los usuarios reciben sólo se valida en 61 de 95 specs.

**¿Es seguro seguir desarrollando grandes cambios apoyándose en ella?** Sí para trabajo de **layout, navegación y densidad del dashboard** — ahí la señal es excelente y de altísima resolución. No para trabajo que toque **auth, sesiones, roles, contrato HTTP o datos**: ahí la suite no da señal, y su verde puede leerse erróneamente como cobertura.

---

## 2. Baseline actual

`[OBSERVADO]` Capturado según AGENTS.md §2 (`CAPTURAR_BASELINE`).

| Ítem | Valor |
|---|---|
| Repositorio | `C:\PORTAL-VETNEB` |
| Rama | `main` |
| HEAD | `2683f39ab865d0c3cfcf26c2489a801115b58320` |
| Fecha HEAD | 2026-09-09 17:10:21 -0300 |
| Asunto | `fix(frontend): sync next-env with Next.js codegen (#1703)` |
| Relación con `origin/main` | `0 0` (idéntico) |
| `git status --short -uall` | vacío |
| `git stash list` | vacío |
| `git worktree list` | sólo `C:/PORTAL-VETNEB` |
| AGENTS.md anidados | **ninguno** (`git ls-files \| grep AGENTS.md` → 1 archivo, raíz) |
| Node local | v24.15.0 · CI: v24.20.0 |
| PNPM | 11.13.0 (`packageManager` = `pnpm@11.13.0`) |
| Playwright | `@playwright/test` 1.61.0 (declarado `^1.61.0`, instalado 1.61.0) |
| Proyectos Playwright | **1** — `chromium` (`devices["Desktop Chrome"]`) |
| Browsers | Chromium únicamente |
| `retries` | **0** (config no lo declara; JSON reporter confirma `projects[0].retries=0`) |
| `workers` | no declarado → 2 en esta máquina, 2 en CI (runner de 4 vCPU) |
| `fullyParallel` | `true` |
| `timeout` / `expect.timeout` | 30.000 ms / 5.000 ms |
| `globalTimeout` | 1.800.000 ms (30 min), override `E2E_GLOBAL_TIMEOUT_MS` |
| `forbidOnly` | **`false`** |
| `reporter` | `[["list"], ["html", {open:"never"}]]` |
| `use.trace` | `on-first-retry`; `screenshot`/`video` sin declarar (= `off`) |
| `outputDir` | default `test-results/` (gitignored en `frontend/.gitignore:31-33`) |
| `globalTeardown` | `./e2e/helpers/restore-next-env-hygiene.mjs` |
| webServers | 2 — fixture API `127.0.0.1:3107`, app `127.0.0.1:3000` |
| Comando app | `pnpm start` sólo si `CI=true && VETNEB_E2E_PRODUCTION_RUNNER=1`; si no `pnpm dev` |
| Snapshots | 40 PNG, todos `-chromium-linux` |
| Workflows E2E | `frontend-ci.yml`, `e2e-completeness.yml`, `visual-regression-manual.yml` |

Nota de reproducción: cifras de descubrimiento obtenidas con `node node_modules/@playwright/test/cli.js test --list --reporter=json` desde `frontend/`; cifras de duración extraídas de logs reales de CI vía `gh run view <id> --log` (R0, §5.1).

---

## 3. Skills utilizadas

`[OBSERVADO]` Declaración honesta: se revisó el inventario de skills instaladas y **no se cargó el cuerpo de ninguna con la herramienta `Skill`**. La auditoría se condujo bajo la precedencia que fija AGENTS.md: `AGENTS.md → evidencia real del repositorio → documentación normativa → skills`. Las skills se aplicaron como **checklist derivada de su scope declarado**, no como texto cargado. Se registra así en lugar de afirmar un uso que no ocurrió.

| Skill | Estado | Motivo | Ámbito donde actuó |
|---|---|---|---|
| `vetneb-web-end-to-end-global` | **RECTORA** (scope aplicado, cuerpo no cargado) | Impedir que la auditoría colapse en el dashboard | Forzó §5/§9: reconciliación de las 21 rutas del producto contra `goto()` reales; detección de 6 rutas sin cobertura; separación explícita de dominios `public/particular` frente a `admin/clinic` |
| `vetneb-staff-senior-full-stack-engineer` | **RECTORA** (ídem) | Analizar Playwright dentro del sistema que valida | Origen del hallazgo P0-1/P0-2: trazar `E2E → proxy.ts → api.ts → fixture` y comprobar que `server/**` nunca arranca |
| `vetneb-briefing-planificacion-diseno-desarrollo-pruebas` | **RECTORA** (ídem) | Delimitación y anti-deriva | Estructura de §23 (estado objetivo) y §24 (roadmap) con scope/no-scope/rollback por fase; ninguna implementación ejecutada |
| `vetneb-production-web-optimization-engineer` | **RECTORA** (ídem) | Deuda técnica y calidad productiva | §16 (Pareto de performance medido), §17 (duplicación), §18 (muerto); principio *diagnosticar antes de implementar* respetado literalmente |
| `vetneb-security-production-invariants` | **RECTORA** (ídem) | Invariantes que el E2E debe proteger | §13 completo: verificación de que `admin_session_id`/`app_session_id`, 401, roles y `no-store` no están realmente probados; barrido de secretos en `frontend/e2e/**` |
| `vetneb-bugs-errores-optimizacion-rutas` | **RECTORA** (ídem) | Taxonomía y causa raíz | Clasificación del flaky de `admin-users-workspace-5000` y del rojo actual de E2E Completeness (`ENVIRONMENT_DEFECT`, no `PRODUCT_DEFECT`) |
| `vetneb-protocolos-comunicacion` | **CONDICIONAL — ACTIVADA** | Se inspeccionó frontera HTTP concreta | §12: métodos/status/headers del fixture, `credentials: include`, `no-store`, rewrites de `next.config.ts` |
| `vetneb-admin-dashboard-operational-actions` | **CONDICIONAL — PARCIAL** | Sólo para medir cobertura de acciones admin | Confirmó que las 19 specs admin son de shell/layout; ninguna ejerce una acción administrativa con persistencia real |
| `vetneb-lanzamiento-mantenimiento` | **CONDICIONAL — ACTIVADA** | CI, artifacts, readiness del pipeline | §15: fail-closed de `frontend-check`, retención de artefactos, rojo activo del schedule semanal |
| `vetneb-pwa-end-to-end` | **NO USADA** | No hay specs de service worker, manifest ni offline en `frontend/e2e/**`; `/offline` no tiene ningún `goto()` | — (la ausencia es en sí un hallazgo: §9, COVERAGE_GAP) |
| `vetneb-global-web-security-senior` | **NO USADA** | Solapa con `security-production-invariants` para este scope; activarla habría duplicado checklist sin aportar superficie nueva | — |

---

## 4. Inventario E2E actual

`[OBSERVADO]` Todas las cifras son reproducibles con los comandos indicados.

### 4.1 Físico

| Métrica | Valor | Comando |
|---|---|---|
| Archivos tracked bajo `frontend/e2e/**` | **149** | `git ls-files frontend/e2e \| wc -l` |
| — `.ts` | 103 | idem + `sed 's/.*\.//' \| sort \| uniq -c` |
| — `.png` (snapshots) | 40 | idem |
| — `.mjs` | 6 | idem |
| Specs `.spec.ts` (tracked = en disco) | **95 = 95** | `git ls-files 'frontend/e2e/**/*.spec.ts'` / `find` |
| Tests descubiertos por Playwright | **1.322** | `playwright test --list --reporter=json` |
| Archivos con ≥1 test | **95** (ninguno vacío) | idem |
| Entradas de catálogo | **95** | `E2E_SUITE_CATALOG.length` |
| Helpers (`e2e/helpers/`) | 8 (6 `.ts` + 2 `.mjs`) | `ls frontend/e2e/helpers` |
| Fixtures (`e2e/fixtures/`) | 3 (1 servidor `.mjs` + 2 baselines `.ts`) | `ls frontend/e2e/fixtures` |
| Scripts (`e2e/scripts/`) | 2 (`run-cohort.mjs`, `compare-visual-artifacts.mjs`) | `ls frontend/e2e/scripts` |
| Untracked bajo `frontend/e2e` | **0** | `git status --porcelain -uall frontend/e2e` |

### 4.2 Volumen de código

| Superficie | LOC | Ratio vs producto |
|---|---|---|
| `frontend/e2e/**` (`.ts` + `.mjs`) | **42.123** | — |
| — sólo specs | 33.223 | — |
| — helpers + fixtures + scripts | 8.900 | — |
| `frontend/src/**` | 49.511 | **0,85 : 1** |
| `server/**` | 48.092 | — |
| `test/**` (backend/unit/arquitectura) | 32.695 | — |

`[INFERIDO]` Un ratio E2E/producto de 0,85:1 es extraordinariamente alto. Es la firma de una suite que se usa como *instrumento de medición geométrica* además de como red de regresión.

### 4.3 Distribución de tamaño de spec

`>800 LOC`: 6 · `401–800`: 22 · `201–400`: 34 · `≤200`: 33.

Mayores: `dashboard-clinic-tokens-mobile-parity.spec.ts` (1.529), `dashboard-b09-…` (1.218), `admin-users-visual-quality-gate.spec.ts` (1.164), `dashboard-card-navigation-shell.spec.ts` (1.150), `dashboard-b08-…` (1.122), `dashboard-viewport-zoom-adaptability.spec.ts` (1.088).

### 4.4 Patrones inventariados

| Patrón | Ocurrencias | Specs afectados |
|---|---|---|
| `test.only` / `describe.only` | **0** | 0 |
| `test.skip` (condicional) | **3** (+1 en comentario) | `visual-regression-authenticated`, `visual-regression-stress`, `dashboard-b05-surface-inversion` |
| `test.fail` / `test.fixme` | **0** | 0 |
| `test.describe.configure` | 4 | A03 (`serial, retries:0`) + 3 visual (`serial`) |
| `test.setTimeout` | 44 | máx. 900.000 ms (A03), 300.000 ms (B04/B06) |
| `page.waitForTimeout` | **17 reales** | 12 specs |
| `setTimeout` crudo en `page.evaluate`/Promise | 3 | `dashboard-card-navigation-shell` (2× **4.000 ms**), `dashboard-clinic-module-state-parity` (700 ms) |
| `networkidle` | **39** | 2 con `.catch(() => {})` |
| `waitUntil` | 26 `domcontentloaded`, 1 `networkidle`, 1 `commit` | — |
| `page/context.route` | 75 | **29 specs** (fulfill 47, continue 36, fallback 30) |
| `context.addCookies` | **92** | **67 specs** |
| `page.screenshot` | 8 | 8 specs (todos a `test-results/` o `testInfo.outputPath`) |
| Escrituras a FS | 2 helpers/scripts | `restore-next-env-hygiene.mjs`, `compare-visual-artifacts.mjs` |
| `http://127.0.0.1:3000` hardcodeado | **88** | ~67 specs |
| `http://127.0.0.1:3107` hardcodeado | 4 | — |
| `localhost` | 0 | — |
| Cookies sintéticas distintas | 5 valores | `e2e_populated_*` (32), `e2e_test_*` (35) |

---

## 5. Arquitectura actual (diagrama textual)

```text
                     ┌─────────────────────────────────────────────┐
   pnpm e2e:<coh> ──▶│ frontend/e2e/scripts/run-cohort.mjs         │
                     │  · lee catalog.ts (fuente única)            │
                     │  · exit 2 cohorte inválida                  │
                     │  · exit 3 selección vacía                   │
                     │  · exit 4 spec catalogado inexistente       │
                     │  · exit 5 visual-linux fuera de Linux       │
                     │  · finally → restoreNextEnvHygiene()        │
                     └───────────────────┬─────────────────────────┘
                                         ▼
                     ┌─────────────────────────────────────────────┐
                     │ playwright.config.ts — 1 proyecto: chromium │
                     │ retries 0 · workers 2 · fullyParallel       │
                     └───────┬─────────────────────────┬───────────┘
                             ▼                         ▼
              ┌──────────────────────┐   ┌──────────────────────────────┐
              │ webServer #1  :3107  │   │ webServer #2  :3000          │
              │ admin-populated-     │   │ CI+PROD_RUNNER → next start  │
              │ api-server.mjs       │   │ resto          → next dev    │
              │ (1.194 LOC, GET-only)│   │ NEXT_PUBLIC_API_URL=:3107    │
              └──────────┬───────────┘   └───────────┬──────────────────┘
                         │                           │
       ┌─────────────────┴───────────┐               │
       │ 12 rutas GET · 200/404/405  │               │
       │ sesión = string literal     │               │
       │ NUNCA emite 401             │               │
       └─────────────────────────────┘               │
                                                     ▼
                                    ┌────────────────────────────────┐
                                    │ Browser (Chromium)             │
                                    │ · addCookies (92 call sites)   │
                                    │ · page.route en 29/95 specs ───┼─▶ respuesta
                                    │   (intercepta ANTES de salir)  │    sintética
                                    └────────────────────────────────┘

   ╔══════════════════════════════════════════════════════════════════╗
   ║  server/**  (Fastify, 48.092 LOC)  ──  NUNCA ARRANCA EN E2E      ║
   ║  DB Postgres              ──  NUNCA PARTICIPA EN E2E             ║
   ╚══════════════════════════════════════════════════════════════════╝

   Doble mecanismo de mock coexistiendo:
     · Server Components  ─fetch server-side─▶ fixture :3107   (page.route NO lo ve)
     · Client Components  ─fetch en browser─▶ page.route       (fixture NO lo ve)
```

`[OBSERVADO]` La coexistencia de dos mecanismos de mock está documentada en el propio fixture (`admin-populated-api-server.mjs:4-8`: *"those two are rendered by SERVER components: their payload never leaves the Next process, so Playwright's `page.route` cannot substitute it"*). Es correcta técnicamente y **no hay guard que impida que ambos declaren payloads distintos para el mismo endpoint**.

---

## 6. Cobertura global por dominio y feature

### 6.1 Volumen

| Dominio | Specs | Tests | % tests | En CI | Fuera de CI |
|---|---:|---:|---:|---:|---:|
| `platform` | 19 | 349 | 26,4% | 17 | 2 |
| `clinic` | 26 | 346 | 26,2% | 10 | 16 |
| `regression` | 20 | 309 | 23,4% | 12 | 8 |
| `admin` | 19 | 166 | 12,6% | 14 | 5 |
| `public` | 8 | 119 | 9,0% | 8 | 0 |
| `particular` | 3 | 33 | 2,5% | 1 | 2 |
| **Total** | **95** | **1.322** | 100% | **61** | **34** |

### 6.2 Cobertura por ruta del producto

`[OBSERVADO]` 21 `page.tsx` en `frontend/src/app`. Rutas con `goto()` directo en algún spec:

`/` (16) · `/dashboard` (101) · `/dashboard/admin` (100) · `/dashboard/informes` (20) · `/precios` (9) · `/particulares` (9) · `/servicios` (7) · `/clinicas` (4) · `/ruta-institucional-inexistente` (3) · `/dashboard/logistica{,/rutas,/visitas,/metricas}` (9) · `/login` (2) · `/contacto` (2) · `/profesionales` (vía lista en `public-routes.spec.ts:28`).

**Sin ninguna cobertura E2E** `[OBSERVADO]`:

| Ruta | Naturaleza | Comentario |
|---|---|---|
| `/citologia-veterinaria` | landing SEO | 0 tests |
| `/histopatologia-veterinaria` | landing SEO | 0 tests |
| `/informes-veterinarios` | landing SEO | 0 tests |
| `/laboratorio-patologico-veterinario` | landing SEO | 0 tests |
| `/profesionales/[clinicId]` | detalle de profesional | 0 tests — y memoria de sesión registra que en prod el buscador devuelve 0 resultados |
| `/offline` | PWA offline | 0 tests; ninguna spec de service worker/manifest |

### 6.3 Contratos de producto realmente protegidos

| Contrato | Estado | Evidencia |
|---|---|---|
| Zero-scroll app shell (21×13) | ✅ **fuerte** (0 px exacto) | `dashboard-zero-scroll-baseline.spec.ts` (A08), 273 combinaciones |
| Geometría congelada (21×13) | ✅ fuerte pero **fuera de CI** | `dashboard-geometry-baseline.spec.ts` (A02) |
| Paginación adaptativa (15×13) | ✅ fuerte pero **fuera de CI** | A03 + A05 |
| Navegación / deep links / Back-Forward | ✅ fuerte | B08/B09/B10/B13, `dashboard-card-navigation-shell` (68 tests) |
| Responsive 6 viewports phone + 13 canónicos | ✅ muy fuerte | matriz canónica compartida por 14 specs |
| Redirect de superficie privada sin cookie | ⚠️ parcial (sólo el proxy) | `dashboard-auth-redirect.spec.ts` — 3 tests |
| **Login (clínica / admin / particular)** | ❌ **ninguno** | `login-hydration.spec.ts` no hace submit |
| **Validación de sesión servidor / expiración / revocación** | ❌ **ninguno** | fixture compara string literal |
| **401 → redirect a login** | ❌ **ninguno** | fixture nunca emite 401; `redirectToLoginOnUnauthorized` sin cobertura |
| **Autorización por rol (cross-rol)** | ❌ **ninguno** | 0 specs con `app_session_id` sobre `/dashboard/admin` |
| **Aislamiento tenant (Clinic A / B)** | ❌ **ninguno** | fixture no modela tenants |
| **Persistencia real (escritura → relectura)** | ❌ **ninguno** | fixture responde 405 a todo lo que no sea GET |
| **CSRF / rate limits / CSP** | ❌ **ninguno** en E2E | cubierto sólo en `test/unit/infrastructure/**` |
| `no-store` en superficie privada | ⚠️ débil | asserta `no-cache` y `not public`, deliberadamente relajado (`dashboard-logout-private-cache.spec.ts:140-144`) |
| Accesibilidad axe WCAG 2.1 AA | ⚠️ 4 rutas × 2 viewports, **fuera de CI** | `accessibility-axe-key-routes.spec.ts` |
| Regresión visual por píxel | ⚠️ 40 baselines, **fuera de todo gate automático** | sólo `workflow_dispatch` |
| PWA / offline / service worker | ❌ **ninguno** | — |

---

## 7. Hallazgos P0 — Crítico

### P0-1 · `[BLOQUEANTE]` La frontera de autenticación autoritativa no tiene ninguna cobertura E2E, y el diseño de fixture hace estructuralmente imposible obtenerla

| Campo | Contenido |
|---|---|
| **Síntoma** | La cohorte `smoke` incluye dos specs marcados P1 `"Security boundary; do not demote"` (`dashboard-auth-redirect`, `dashboard-logout-private-cache`). Ambos pasan verdes sin ejercer ninguna verificación de sesión real. |
| **Evidencia** | `frontend/src/proxy.ts:1-19` — *"navigation gating, not an authorization boundary… does not verify a signature, decode a token, check expiry, look up a user, or evaluate a role… The authoritative boundary is the Fastify backend"*. · `admin-populated-api-server.mjs:806-818` — sesión = `cookie.includes("admin_session_id=e2e_populated_admin_session")`. · Status emitidos por el fixture: `200`×12, `404`×3, `405`×1, **`401`×0**. · `frontend/src/lib/dashboard-server-auth.ts:8-11` (`redirectToLoginOnUnauthorized`) sin ningún consumidor de prueba E2E. |
| **Causa inmediata** | El fixture hermético fue diseñado para *poblar datos*, no para *modelar identidad*. |
| **Causa raíz** | Decisión arquitectónica de no arrancar el backend en E2E. Sin backend, no hay store de sesión; sin store, la sesión sólo puede ser un string constante. |
| **Impacto** | Una regresión en `server/lib/auth*`, en el middleware de sesión, en la emisión de `Set-Cookie`, en la expiración o en la resolución de rol **pasa los cuatro required checks sin ninguna señal E2E**. |
| **Probabilidad** | Alta — auth es de las superficies que más cambian (memoria de sesión: `app version gate`, `TRUST_PROXY`, `session-cookie-name-contract`). |
| **Criticidad** | P0 |
| **Blast radius** | Todo `/dashboard`, `/dashboard/admin`, portal de particulares (token → informe clínico). |
| **Solución recomendada** | `[PROPUESTO]` Añadir al fixture un modelo de sesión mínimo (tabla en memoria: valor → rol → expiración) que emita **401** para sesión ausente/inválida/expirada y **403** para rol insuficiente; luego 3 specs nuevos: (a) 401 en carga de datos → redirect a login; (b) `app_session_id` sobre `/dashboard/admin` → denegado; (c) sesión expirada durante la navegación → redirect. Fase separada: un smoke contra el backend real levantado en CI con Postgres (ya existe el service en `backend-ci.yml:105-118`). |
| **Riesgo de la solución** | Medio: tocar el fixture es `SHARED_E2E_PREFIXES` → `e2e:affected` cae a `ci` completo (por diseño). Debe ser un PR test-only aislado. |
| **Pruebas necesarias** | `e2e:smoke` + `e2e:ci`; `pnpm test` (el guard de catálogo censa 95/61 y hay que realinearlo en el mismo PR, §4 AGENTS.md). |
| **Criterio de cierre** | Existe al menos un test que falla si se elimina la validación de sesión en el backend simulado, y otro que falla si se retira la separación de roles. |

### P0-2 · `[BLOQUEANTE]` El único gate que ejecuta el catálogo completo está en rojo desde 2026-09-09 14:42 UTC

| Campo | Contenido |
|---|---|
| **Síntoma** | 4 fallos consecutivos de `E2E Completeness` en ~0,4–0,9 min. |
| **Evidencia** | Runs `34365419421` (14:42), `34379465111` (16:52), `34385169532` (17:48), `34409140047` (21:50) — todos `failure`. Paso fallido: **9 · `Install Playwright system dependencies`**. Log (`gh run view 34385169532 --log`): `Err:29 https://dl.google.com/linux/chrome-stable/deb stable/main amd64 Packages / Hash Sum mismatch`. |
| **Causa inmediata** | `playwright install-deps chromium` ejecuta `apt-get update`, que falla duro por un repo APT **irrelevante para Playwright** (Google Chrome estable) preinstalado en la imagen `ubuntu-24.04`. |
| **Causa raíz** | `ENVIRONMENT_DEFECT` externo. El paso no aísla su `apt-get update` de fuentes ajenas al scope. El PR de remediación en vuelo (`fix(ci): harden E2E completeness apt dependency setup`) **también falla**, con `Unsupported Deb822 APT source containing targeted URI: /etc/apt/sources.list.d/google-chrome.sources`: el script de saneamiento sólo contempla el formato `deb`/`deb-src` clásico, no Deb822. |
| **Impacto** | Mientras dure, **34 specs / 315 tests — incluidos 5 P1** — no se ejecutan en ningún lugar. Es exactamente el 44,5 % del coste (y de la resolución) de la suite. |
| **Probabilidad** | Ya ocurrió: 100 %. |
| **Criticidad** | P0 operativo (no bloquea merges: `E2E Completeness` no es required, §6 AGENTS.md). |
| **Blast radius** | A02, A03, A05, reachability de pagers admin y clínica, axe, visual-linux, evidence. |
| **Solución recomendada** | `[PROPUESTO]` Extender el saneamiento al formato Deb822 (`.sources`) y mantener `playwright install-deps chromium`; `playwright install --with-deps chromium` no sustituye esta remediación porque también instala dependencias del sistema. |
| **Riesgo de la solución** | Bajo, `ci-only`. |
| **Criterio de cierre** | Dos runs consecutivos de `E2E Completeness` alcanzando el paso 11 (`Run complete cataloged E2E suite`). |

### P0-3 · `[RIESGO]` `forbidOnly: false` — un `test.only` commiteado reduciría CI a un test y seguiría en verde

| Campo | Contenido |
|---|---|
| **Síntoma** | Latente. Hoy hay **0** `test.only` (verificado con `grep -rno "test\.only"` → 0). |
| **Evidencia** | `playwright.config.ts:46-80` no declara `forbidOnly`; JSON reporter: `forbidOnly: false`. `run-cohort.mjs:199` no añade `--forbid-only`. `frontend/eslint.config.mjs` usa `eslint-config-next/core-web-vitals`, **sin `eslint-plugin-playwright`** → ninguna regla `no-focused-tests`. El root `eslint.config.mjs:15-19` sólo lintea `server/**`, `scripts/**`, `drizzle/**`. |
| **Causa raíz** | Ausencia del patrón estándar `forbidOnly: !!process.env.CI`. |
| **Impacto** | Un `.only` accidental convierte `validate-frontend` (required) en un gate que ejecuta 1 de 1.007 tests y reporta SUCCESS. Es el modo de fallo más silencioso posible en un gate de merge. |
| **Probabilidad** | Media (el `.only` es el atajo de depuración local por excelencia). |
| **Criticidad** | P0 por consecuencia, aunque hoy no esté materializado. |
| **Solución** | `[PROPUESTO]` `forbidOnly: isCi` en `playwright.config.ts`. Una línea. Verificable por `test/unit/infrastructure/frontend-playwright-production-runner.test.ts`, que ya lee la config. |
| **Criterio de cierre** | Un spec con `.only` hace fallar `e2e:ci` con `Error: focused item found`. |

---

## 8. Hallazgos P1 — Alto

### P1-1 · `[OBSERVADO]` El gate required nunca produce trazas, screenshots ni vídeo de un fallo

`use.trace = "on-first-retry"` (`playwright.config.ts:58`) combinado con `retries = 0` en el gate required ⇒ **jamás se captura una traza**. `screenshot` y `video` no se declaran (default `off`). `frontend-ci.yml:147-153` sube sólo `frontend/playwright-report/` — no `test-results/`.

**Consecuencia medida:** en el run `34409140069` el paso E2E duró 571 s; si hubiera fallado, el diagnóstico disponible sería el stack del `expect` y nada más. Comparar con `e2e-completeness.yml:124-133`, que sí sube `test-results/` y, por tener `--retries=2`, sí generó `trace.zip` para el flaky (log del run `34357768243`).

**Solución `[PROPUESTO]`:** `trace: "retain-on-failure"`, `screenshot: "only-on-failure"`, y añadir `frontend/test-results/` al upload de `frontend-ci.yml`. Coste ~0 en runs verdes.

### P1-2 · `[OBSERVADO]` Los dos gates E2E validan bundles distintos, y el completo valida el que los usuarios nunca reciben

- `frontend-ci.yml:143-145` → `VETNEB_E2E_PRODUCTION_RUNNER: "1"` → `next start` (bundle productivo).
- `e2e-completeness.yml:108-122` → **no** define esa variable → `next dev`, pese a ejecutar `pnpm --dir frontend build` en el paso 7 (usado sólo por `security:public-surface`).

**Coste medido de esa divergencia:** los mismos 61 specs de la cohorte `ci` cuestan **18,3 min** de trabajo bajo `next start` (run `34409140069`) y **30,0 min** bajo `next dev` (run `34357768243`): **+64 %**. Y los 34 specs que sólo corren ahí **nunca han visto el bundle de producción**.

`docs/ops/CI_PR_CHECKS_RUNBOOK.md:242-246` documenta la causa: *"Ejecuta `e2e:full` con `next dev` porque los baselines Linux versionados fueron creados con ese runner y incluyen su indicador visual."* Es decir: **los 40 baselines de píxel están atados al modo dev**, y por eso arrastran a todo el catálogo completo con ellos.

### P1-3 · `[OBSERVADO]` `E2E Completeness` enmascara flakes por diseño y no falla por ellos

`e2e-completeness.yml:110` → `e2e:full -- --workers=2 --retries=2`. `failOnFlakyTests` no se declara (default `false`).

**Evidencia dura del último run verde (`34357768243`, PR, 34,0 min):** `1 flaky · 1 skipped · 1320 passed (32.7m)`. El flaky es:

```text
[chromium] › e2e/admin/users/admin-users-workspace-5000.spec.ts:229:3
  › pagination advances and returns without rendering the full fixture
  Expected: "13–24 de 5000"   Received: "1–12 de 5000"
  Timeout 10000ms exceeded while waiting on the predicate  (línea 257, toPass)
```

Falló en el intento 1 **y en el retry 1**, pasó en el retry 2. El workflow reportó `success`. Clasificación: `RACE_CONDITION` real (el click en el pager no propaga al estado dentro de 10 s bajo `next dev` con 2 workers), no `TEST_DEFECT`.

El comentario del workflow (`e2e-completeness.yml:109`) — *"Bounded retries rerun complete callbacks; they never skip or relax assertions"* — es cierto sobre las assertions y **engañoso sobre la señal**: un retry sí convierte rojo en verde.

**Solución `[PROPUESTO]`:** `failOnFlakyTests: true` en config, o `--fail-on-flaky-tests` en el workflow, de modo que el enmascaramiento sea explícito y no un default.

### P1-4 · `[OBSERVADO]` `dashboard-logout-private-cache.spec.ts` afirma más de lo que prueba

El `describe` se llama **"dashboard logout — server session invalidation"** (línea 45). Lo que ocurre:

- líneas 52-59 / 88-95: `page.route("**/api/admin/auth/logout")` devuelve `{success:true}` **sin llegar a ningún servidor**;
- la única assertion sobre el servidor es `expect(adminLogoutCalled).toBe(true)` — *se llamó al endpoint*, no *se invalidó la sesión*;
- línea 73: `await page.context().clearCookies()` con el comentario `// Simulate the server having cleared the httpOnly session cookie`.

`[RIESGO]` Un lector (o un agente futuro) que consulte el catálogo verá `feature: "logout and private no-store"`, `criticality: P1`, `"Security boundary promoted to the effective CI gate; do not demote"` y concluirá que la invalidación de sesión está cubierta. **No lo está.** Renombrar el describe a lo que realmente prueba (*"logout calls the correct endpoint and leaves the private surface"*) es un cambio de 2 líneas con alto valor de honestidad.

Segundo hallazgo en el mismo archivo: el test de las líneas 127-138 **importa `nextConfig` y ejecuta `headers()` en el proceso Node** — es un test unitario de configuración ocupando un worker de browser dentro del gate required. Pertenece a `test/unit/infrastructure/`.

Tercero: las líneas 145-169 asertan `no-cache` y `not public` en vez de `no-store`, deliberadamente relajado para ser determinista entre dev y prod (comentario en 140-144). Bajo el gate required (que corre `next start`) **podría** asertar `no-store` real.

### P1-5 · `[OBSERVADO]` 5 specs P1 y el 44,5 % del coste de la suite viven fuera del gate de merge

| Spec | Tests | Coste en full | Cohorte |
|---|---:|---:|---|
| `regression/dashboard-limit-invariance.spec.ts` (A05) | 15 | **942 s (24,3 %)** | extended |
| `regression/dashboard-adaptive-limit-baseline.spec.ts` (A03) | 16 | **435 s (11,2 %)** | extended |
| `regression/dashboard-geometry-baseline.spec.ts` (A02) | 21 | **348 s (9,0 %)** | extended |
| `clinic/logistics/dashboard-logistica-mobile-action-bar-reachability.spec.ts` | 6 | 48 s | extended |
| `admin/users/admin-users-roles-pager-reachability.spec.ts` | 3 | 5 s | extended |

`[OBSERVADO]` Agravante: `e2e-completeness.yml:4-22` **filtra por paths**. Sólo dispara si el PR toca `frontend/e2e/**`, `playwright.config.ts`, manifiestos, workflows o los tests de infraestructura enumerados. **Un PR que cambia únicamente `frontend/src/**` no ejecuta ninguno de esos 5 P1.** La única red restante es el `schedule: cron '17 3 * * 2'` — semanal — que hoy además está en rojo (P0-2).

### P1-6 · `[OBSERVADO]` La regresión visual está fuera de todo gate automático y el camino de "actualizar baseline" es un clic

`visual-regression-manual.yml:5-6` → **sólo `workflow_dispatch`**. No hay trigger `pull_request` ni `schedule`. Los 40 PNG (`-chromium-linux`) no se comparan en ningún PR.

El input `update_snapshots` (líneas 18-22) añade `--update-snapshots` (línea 104) y el paso 124-131 sube los PNG regenerados. Mitigación real: el workspace es efímero y el commit del PNG es manual. **Pero no existe ningún control que exija causa demostrada** antes de reemplazar un baseline. Antipatrón `test falla → actualizar snapshot → verde` habilitado, aunque con un paso humano de por medio.

Además, `[OBSERVADO]` **el workflow mantiene una lista manual paralela al catálogo**: `visual-regression-manual.yml:80-99` hardcodea las 3 rutas de spec. El catálogo declara `visual-linux` = esas mismas 3, pero **nada reconcilia ambas**; `test/unit/infrastructure/workflow-security-policy-contract.test.ts:98` sólo fija el digest SHA-256 del archivo. Un cuarto spec visual añadido al catálogo **no se ejecutaría** en ese workflow y ningún guard lo detectaría.

### P1-7 · `[OBSERVADO]` Asimetría en el guard de plataforma de los specs visuales

`visual-regression-authenticated.spec.ts:26-29` y `visual-regression-stress.spec.ts:5-8` declaran `test.skip(({browserName}) => browserName !== "chromium" || process.platform !== "linux", …)`.

`visual-regression-public.spec.ts` **no tiene ningún `test.skip` de plataforma** — el catálogo lo reconoce literalmente (*"public spec has no platform skip"*). Su única protección es el preflight de `run-cohort.mjs:246-257` (exit 5). Invocar `playwright test e2e/regression/visual/visual-regression-public.spec.ts` directamente en Windows **falla** con 10 baselines ausentes en lugar de saltarse, produciendo un rojo que no es una regresión.

---

## 9. Hallazgos P2 — Medio

### P2-1 · `[OBSERVADO]` 26 specs "autenticados" corren contra una API que devuelve 404 a todo

Dos familias de valor de cookie coexisten:

| Valor | Ocurrencias | Efecto en el fixture |
|---|---:|---|
| `e2e_populated_clinic_session` / `e2e_populated_admin_session` | 32 | datos poblados |
| `e2e_test_clinic_session` / `e2e_test_admin_session` / `e2e_test_session` | 35 | **`404 {"error":"E2E populated session required"}`** en toda ruta |

**26 specs** usan exclusivamente la familia `e2e_test_*`. Salvo que instalen `page.route` propio, miden layout sobre estados vacíos/error permanentes. Es legítimo para contratos de shell, pero significa que esos specs **no pueden detectar ninguna regresión de renderizado de datos**, y su nombre no lo advierte. Concuerda con la memoria de sesión sobre `admin-sessions` y `clinic-tokens` rindiendo estados vacíos.

### P2-2 · `[OBSERVADO]` Dos regímenes de tolerancia coexisten para el mismo invariante zero-scroll

`dashboard-zero-scroll-baseline.spec.ts:37-53` fija `MAX_SCROLL_DELTA_PX = 0` y documenta explícitamente: *"The older zero-scroll specs in `frontend/e2e/platform/app-shell/` keep their 2 px allowance; A08 is the freeze and does not inherit it."*

13 specs llevan `no-scroll`/`zero-scroll` en el nombre y 15 asertan métricas de scroll del documento. `[RIESGO]` Una regresión de 1–2 px pasa en los specs antiguos y falla en A08 — que además es el único con la matriz completa. La convergencia a 0 px está pendiente y no tiene owner declarado.

### P2-3 · `[OBSERVADO]` Anclas de chrome que no resuelven a nada y no se detectan

`helpers/dashboard-geometry-matrix.ts:650-660` (`DASHBOARD_PERSISTENT_CHROME`) contiene 9 anclas, de las cuales **2 están retiradas del producto** y resuelven a 0 elementos en todos los viewports:

- `horizontal-nav` → `[data-dashboard-horizontal-nav-shell]` (retirado por B08, comentario en 619-622)
- `module-rail` → `[data-dashboard-module-rail]` (retirado por B08+B09, comentario en 623-625)

Verificado: `grep -rno "dashboardModuleRail\|data-dashboard-module-rail" frontend/src` → **0**.

`dashboard-b04-surface-token-migration.spec.ts:165-176` recorre `querySelectorAll(probe.selector)` y salta invisibles. **No existe assertion de observaciones mínimas *por ancla***, sólo la global `measured.length > 0` (líneas 281-285), que el pseudo-elemento `shell-frame::before` satisface por sí solo.

Alcance honesto: la retención de las anclas es **deliberada y documentada** (mantener estable la *forma* del registro A02). El riesgo residual es que una tercera ancla deje de renderizar por otra causa y B04 siga verde midiendo menos. No es un falso verde actual; es un modo de degradación silenciosa. La preocupación es concreta porque ya hay un precedente vivo: el catálogo documenta que S7 (`clinic-tokens`) queda BLOCKED en B05 porque *"the hermetic fixture implements no /api/particular-tokens handler, so its FilterBar never mounts"*.

### P2-4 · `[OBSERVADO]` Un spec de 10 tests con **cero assertions**

`regression/evidence/remove-home-unified-workspace-screenshots.spec.ts` — `grep -c "expect\|assert"` → **0**. Los 10 tests hacen `setClinicSession` → `goto(waitUntil:"networkidle")` → 2 `waitForSelector` → `waitForTimeout(900)` → `page.screenshot(testInfo.outputPath(...))`. La captura va a `test-results/`, que Playwright borra al inicio de cada corrida y `e2e-completeness.yml:144` borra explícitamente al final. **La evidencia que produce se descarta siempre.** Coste: 21 s por corrida completa. Clasificación: `OBSOLETE_TEST`.

### P2-5 · `[OBSERVADO]` Duplicación textual masiva del setup de sesión y del origen

- 92 llamadas a `addCookies` en 67 specs, cada una repitiendo el literal `url: "http://127.0.0.1:3000"`.
- 88 ocurrencias de `http://127.0.0.1:3000` hardcodeado, con `use.baseURL` ya definido en la config.
- Al menos 4 implementaciones distintas de `setAdminSession`/`setClinicSession` (en `dashboard-logout-private-cache`, `dashboard-interaction-foundation`, `admin-mobile-contracts.ts`, `dashboard-geometry-matrix.ts`), con valores de cookie divergentes (P2-1).

`[RIESGO]` Cambiar el puerto de la app exige tocar ~67 archivos. Existe ya el helper canónico `DASHBOARD_GEOMETRY_SESSION_COOKIE` — la consolidación es posible sin abstracción nueva.

### P2-6 · `[OBSERVADO]` Patrones de sincronización frágiles concentrados y localizables

| Patrón | Cantidad | Peor caso |
|---|---:|---|
| `waitForLoadState("networkidle")` | 39 | 2 con `.catch(() => {})` → traga el timeout silenciosamente (`clinic-mobile-admin-parity-contract.spec.ts:32`, `dashboard-clinic-module-card-parity.spec.ts:106,164`) |
| `page.waitForTimeout` | 17 | `remove-home-unified-workspace-screenshots.spec.ts:96` → **900 ms**; `dashboard-real-app-shell-no-scroll-contract.spec.ts:191,219` → **500 ms** ×2 |
| `setTimeout` crudo | 3 | `dashboard-card-navigation-shell.spec.ts:536,678` → **4.000 ms** ×2 = 8 s de sleep duro |
| `waitForTimeout` como assertion negativa | 1 | `dashboard-auth-redirect.spec.ts:37-38` — espera 250 ms y comprueba que sigue en `/login`. Un redirect tardío a 300 ms pasaría. |

Contraste positivo: **118 bloques `toPass()`** y el helper canónico `waitForLayoutSettled` (`dashboard-geometry-matrix.ts:787-798`), que usa `document.fonts.ready` + doble `requestAnimationFrame` — *"no timeout-based readiness"*. La ratio 118:17 a favor del patrón correcto es buena; la deuda es residual y puntual.

### P2-7 · `[OBSERVADO]` Selectores posicionales

`.first()` ×125, `.nth()` ×45, `>> nth=` ×2, `xpath=` ×2 (`dashboard-b14-metrics-relocation.spec.ts:172` usa `xpath=ancestor::div[contains(@class,'border-b')]` — acoplado a una clase Tailwind). Selectores por clase CSS: 21 ocurrencias. Concentración: `dashboard-detail-text-integrity` (12), `dashboard-real-app-shell-no-scroll-contract` (8), `public-perspective-scroll` (7).

Contexto favorable: `getByTestId` = **0**; el repo usa atributos `data-*` contractuales (253 `[data-dashboard-module-workspace`, 210 `[data-dashboard-module-viewport`, …) más `getByRole` ×345. Es un modelo de selector robusto y coherente con AGENTS.md §9 (stems sensibles bloqueados por `security:public-surface`).

### P2-8 · `[OBSERVADO]` Metadatos de catálogo desalineados con el contenido de los specs

`catalog.ts` declara para `e2e/platform/auth/dashboard-auth-redirect.spec.ts` la feature **`"private redirect and admin 404"`**. El spec (41 líneas, 3 tests) **no contiene ningún test de 404 admin ni ninguna prueba cross-rol**: itera 3 rutas y verifica el redirect a `/login`. El guard de catálogo valida cardinalidades, particiones, orden, unicidad y ownership — **no valida que `feature` describa lo que el spec hace**.

---

## 10. Hallazgos P3 — Bajo

- `[OBSERVADO]` **`globalTimeout` es config muerta en el gate required.** `playwright.config.ts:44` fija 30 min; `frontend-ci.yml:102` fija `timeout-minutes: 20` para todo el job (que además consume ~85 s en install/lint/typecheck/build/browsers). GitHub cancelaría antes de que el guard de Playwright actúe. No es peligroso (`frontend-check` falla cerrado), pero la intención declarada no se cumple.
- `[OBSERVADO]` **`frontend-ci.yml` push-paths incompleto:** el detector de PR incluye `shared/*` (línea 88) pero `on.push.paths` (líneas 7-13) no. Un push directo a `main` que toque sólo `shared/**` no dispara Frontend CI. Irrelevante bajo branch protection; es una inconsistencia entre dos declaraciones del mismo criterio.
- `[OBSERVADO]` **`compare-visual-artifacts.mjs` (605 LOC) sin consumidor automático:** referenciado sólo por `frontend/package.json` (script `e2e:compare-visual-artifacts`) y por su propio contrato `test/architecture/visual-artifact-comparator-contract.test.ts`. `grep -rn "compare-visual-artifacts" .github/` → 0. Clasificación: `INTENTIONAL` (herramienta manual, coherente con la memoria de sesión sobre la rama `tooling/visual-determinism-comparator`), pero sin ruta operativa.
- `[OBSERVADO]` **`verify-teardown.mjs` sólo comprueba puertos** (3000, 3107). No detecta procesos Chromium huérfanos ni ficheros residuales.
- `[OBSERVADO]` `[EMAIL_INSTITUCIONAL_REDACTADO]` aparece asertado en `contacto-hydration.spec.ts:153` y `public-navigation-footer.spec.ts:64`. Es el correo institucional publicado en el sitio público — contenido de producto, **no una fuga**. Se registra por completitud del barrido de §9 AGENTS.md.

---

## 11. Flakiness y determinismo

`[OBSERVADO]` **Medición real, no estimación.**

| Métrica | Valor | Fuente |
|---|---|---|
| Último run verde del catálogo completo | `1320 passed · 1 flaky · 1 skipped (32.7m)` | run `34357768243` |
| Tasa de flaky observada | **1 / 1.322 = 0,076 %** | idem |
| Skip observado | 1 (S7 `clinic-tokens` en B05, declarado en catálogo) | idem |
| Retries en gate required | **0** | config |
| Retries en E2E Completeness | **2** | `e2e-completeness.yml:110` |
| Tasa de éxito `Frontend CI` (últimos 20) | 18/20 (los 2 fallos, de 0,7 min, son de instalación en PRs Dependabot) | `gh run list` |
| Tasa de éxito `E2E Completeness` (últimos 20) | 9/20 — pero 4 de los 11 fallos son el `install-deps` de P0-2 | `gh run list` |

**El flaky identificado, clasificado:**

| Campo | Valor |
|---|---|
| Test | `e2e/admin/users/admin-users-workspace-5000.spec.ts:229` |
| Clasificación | **`RACE_CONDITION`** (no `TEST_DEFECT`, no `FLAKY_TEST` genérico) |
| Síntoma | `Expected "13–24 de 5000" / Received "1–12 de 5000"`, `toPass({timeout:10_000})` agotado, línea 257 |
| Reproducibilidad | 2 fallos consecutivos (intento + retry 1), pase en retry 2 |
| Interpretación | El click en el pager no propaga al estado observable en ≤10 s bajo `next dev` + 2 workers. Es una latencia real de la aplicación en modo dev, no un selector equivocado. |
| Deuda diagnóstica | La traza existe (`test-results/…-retry1/trace.zip`) pero se subió sólo porque el run acabó en `failure`… **y no acabó en failure**. Por tanto la traza **se perdió**. |

**Nueva evidencia de no-determinismo sub-píxel, no clasificada hasta ahora** `[OBSERVADO]`: en el mismo log, A05 registra `PAGER_BLOCK_SIZE=43.188` para `admin-failed-login-alerts::w360x800::hot-b` mientras las otras 12 observaciones de esa misma superficie reportan `40`. El test pasó. Es una desviación real de layout absorbida por la tolerancia. `[NO CONFIRMADO]` si es transitorio o sistemático; requiere repetición dirigida.

**Concordancia con memoria de sesión** `[OBSERVADO]`: la memoria registra que el comparador PNG exacto encontró **36 px de diferencia real en `stress-1536`** entre dos corridas. Con `maxDiffPixelRatio: 0.001` sobre 1536×960 = 1.474.560 px, la tolerancia es de **1.474 px**. Los 36 px caen dentro. Es decir: **el gate visual actual no es un gate de determinismo**, y la afirmación de determinismo pixel-perfect que E2E-ORG-6 hacía era inexacta, como la memoria ya registra.

**Preguntas del §11 del encargo, respondidas para los patrones dudosos:**

| Patrón | Sincronización buscada | Condición observable correcta | Falso positivo | Falso negativo | Determinista | Dependiente de máquina |
|---|---|---|---|---|---|---|
| `waitForTimeout(250)` en `dashboard-auth-redirect:37` | "no hay redirect tardío" | esperar a `networkidle` + assert de URL, o `page.waitForURL` con timeout negado | No | **Sí** (redirect a 300 ms pasa) | No | Sí |
| `waitForTimeout(900)` en `remove-home-…:96` | densidad adaptativa asentada | `waitForLayoutSettled()` (ya existe) | No | Sí | No | Sí |
| `setTimeout(4_000)` en `dashboard-card-navigation-shell:536,678` | ¿? sin comentario | condición de DOM explícita | No | Sí | No | Sí |
| `networkidle().catch(()=>{})` ×3 | asentamiento best-effort | `toPass` sobre el marcador de carga | No | **Sí** (traga el timeout) | Parcial | Sí |
| `waitForLayoutSettled` (fonts.ready + 2×rAF) | pintura estabilizada | **es la condición correcta** | No | No | **Sí** | No |
| `assertSurfaceLoaded` (`toPass`, 25 s) | estado LOADED real, prohíbe banners de error | **es la condición correcta** | No | No | **Sí** | No |

---

## 12. Fixtures

### 12.1 Inventario y responsabilidad

| Fixture / helper | LOC | Consumidores | Responsabilidad | Estado mutable | Reset |
|---|---:|---:|---|---|---|
| `fixtures/admin-populated-api-server.mjs` | 1.194 | 23 specs (catálogo) | servidor HTTP GET-only en :3107 | **ninguno** (datasets constantes) | no necesario |
| `fixtures/dashboard-adaptive-limit-baseline.ts` | 891 | 1 (A03) | baseline congelada 15×13 | no | — |
| `fixtures/dashboard-geometry-baseline.ts` | 636 | 1 (A02) | baseline congelada 21×13 | no | — |
| `helpers/dashboard-adaptive-limit-matrix.ts` | 2.191 | 2 (A03, A05) | matriz + medición adaptativa | no | — |
| `helpers/dashboard-geometry-matrix.ts` | 1.116 | **15** | matriz canónica 21×13, mocks, sync | no | contexto nuevo por estado |
| `helpers/mobile-parity-matrix.ts` | 566 | 2 | matriz CMP phone | no | — |
| `helpers/particular-session-contracts.ts` | 586 | 3 | sesión particular **100 % mockeada** | no | — |
| `helpers/admin-mobile-contracts.ts` | 268 | 11 | contrato no-scroll admin mobile | no | — |
| `helpers/long-text-dataset.mjs` | 66 | 2 | dataset de texto largo PR-TRUNC | no | — |

### 12.2 ¿Contrato relevante o realidad artificial?

`[OBSERVADO]` **Aislamiento: excelente.** El fixture es *stateless*: datasets constantes, sin escritura, `405` a todo método ≠ GET (`admin-populated-api-server.mjs:940-943`). Las variantes opt-in (A03, long-text) son **estrictamente conjuntivas** — exigen sesión poblada **y** cookie auxiliar (líneas 826-849), con el comentario explícito de que la cookie auxiliar sola nunca activa nada. Cero fugas de estado entre tests posibles por construcción. Teardown con `closeAllConnections` + timer `unref` (líneas 1176-1194). Esto es diseño de fixture de primer nivel.

`[OBSERVADO]` **Fidelidad de contrato: parcial y no verificada.** `sliceA03Dataset` (líneas 894-913) declara explícitamente que espeja `server/routes/logistics-field-visits.fastify.ts` (`parsePositiveInt(request.query.limit, 50, 100)`). Es una **copia manual**. El único guard existente (`test/unit/infrastructure/frontend-playwright-production-runner.test.ts:232-259`) es **textual** (`source.indexOf('url.pathname === "/api/app-version"')`), no contractual. **Ningún test compara el fixture con el schema real del backend.**

**Veredicto:** `hermetic fixture` en aislamiento y determinismo; `mock que oculta defectos de integración` en fidelidad. Las 12 rutas del fixture pueden divergir de las de Fastify sin que ningún gate lo note.

`[OBSERVADO]` **La fixture del dominio `particular` va más lejos:** `particular-session-contracts.ts:3-8` documenta que *"The cookie value itself is never validated… via page.route() below — the cookie only documents the real transport contract"*. Los 3 specs / 33 tests de particulares son **100 % browser-mock**: ni siquiera tocan el fixture HTTP. El acceso por token a un informe clínico — la superficie pública más sensible del producto — no tiene ni un solo test de la validación del token.

---

## 13. Auth / security

Aplicando `vetneb-security-production-invariants`:

### 13.1 Higiene de la evidencia — **APROBADO**

`[OBSERVADO]` Barrido completo de `frontend/e2e/**`:

| Verificación | Resultado |
|---|---|
| Passwords reales | ninguno — sólo `"ClaveInicialSintetica42"`, `"ClaveReemplazoSintetica42"`, `"secreto-estable"` (todos sintéticos y autodescriptivos) |
| Hashes de credenciales / sesiones | **0** |
| Tokens reales, `Bearer`, `sk_`, `pk_`, `ghp_`, JWT (`eyJ`) | **0** |
| Signed URLs / connection strings / paths privados de storage | **0** |
| Cookies reales | **0** — todas `e2e_*` sintéticas |
| Datos clínicos reales | **0** — pacientes `"Paciente E2E 0001"`, `"Mora"`, `"Simón"`; estudios genéricos |
| Emails | 11× `@example.test`, 2× `@example.com`, 3× `@clinica.vet`, 1× `test@clinica.com` — todos sintéticos; 2× `[EMAIL_INSTITUCIONAL_REDACTADO]` = contacto institucional publicado |
| Screenshots | 8 call sites, todos a `test-results/` o `testInfo.outputPath()`; `frontend/.gitignore:31-33` ignora `test-results/`, `playwright-report/`, `blob-report/` |
| Artefactos en el árbol | `git status --short -uall` vacío |
| Retención de artifacts CI | 14 días (`e2e-completeness.yml:133`, `visual-regression-manual.yml:122,131`) |

**Conclusión:** el subsistema E2E cumple íntegramente §9 y §17 de AGENTS.md en materia de evidencia sanitizada. No hay hallazgo de seguridad en el *código* de las pruebas.

### 13.2 Invariantes de seguridad realmente protegidas — **REPROBADO**

| Invariante productiva (AGENTS.md §9) | Cubierta por E2E |
|---|---|
| `admin_session_id` (Admin) válida/expirada/revocada | ❌ (string constante) |
| `app_session_id` (Clínica) válida/expirada/revocada | ❌ (ídem) |
| `particular_session_id` | ❌ (`page.route` puro) |
| auth (login) | ❌ (nunca se hace submit) |
| roles / permisos | ❌ (0 specs cross-rol) |
| CSRF | ❌ |
| rate limits | ❌ |
| CSP | ❌ (`Content-Security-Policy-Report-Only` en `next.config.ts` sin spec E2E) |
| `no-store` en superficie privada | ⚠️ parcial y relajado (P1-4) |
| no filtración de errores de DB / stack traces | ⚠️ sólo indirecto: `public-routes.spec.ts:162-170` prohíbe `"stack trace"`/`"Internal Server Error"` en la 404 |
| no mocks silenciosos en producción | ✅ **sí**, y bien: `api.ts:57-63` + `frontend-playwright-production-runner.test.ts` confinan `VETNEB_E2E_ALLOW_LOCAL_API` al production runner |

`[RIESGO]` La combinación *"higiene impecable + cobertura nula"* es peligrosa porque produce la impresión contraria: un auditor que revise el código de las pruebas de auth concluirá que hay disciplina de seguridad; sólo mirando el fixture descubre que no hay verificación.

---

## 14. Visual y geometría

`[OBSERVADO]` Los cuatro contratos están **correctamente separados** en el catálogo — esto está bien resuelto:

| Contrato | Owner | Matriz | Tolerancia | Gate |
|---|---|---|---|---|
| Visual screenshot (píxel) | 3 specs `regression/visual/**` | 2 rutas × 5 viewports (×2 temas en authenticated) | `maxDiffPixelRatio: 0.001` | **ninguno automático** |
| Geometry contract | A02 `dashboard-geometry-baseline` | 21 × 13 = 273 | 2 px / 4 px texto / 1 % ratio | extended |
| Zero-scroll contract | A08 `dashboard-zero-scroll-baseline` | 21 × 13 = 273 | **0 px exacto** | ci (`visual-contract`) |
| Adaptive limit contract | A03 + A05 | 15 × 13 | exacto | extended |
| Responsive/no-scroll mobile | B09, `dashboard-zero-scroll-mobile-boundary`, 8 specs admin-mobile | 6 viewports phone canónicos | variada | ci / extended |

**Snapshots — reconciliación exacta:**

- `visual-regression-authenticated.spec.ts-snapshots/` → 20 (2 rutas × 5 viewports × 2 temas) ✅
- `visual-regression-public.spec.ts-snapshots/` → 10 (2 × 5) ✅
- `visual-regression-stress.spec.ts-snapshots/` → 10 (2 × 5) ✅
- **Total 40 = 40 tests visuales descubiertos. Cero huérfanos.**

**Supresión de dinamismo:** los 3 specs aplican `emulateMedia({reducedMotion:"reduce"})`, `addStyleTag` con `animation-duration: 0s / transition-duration: 0s / caret-color: transparent`, esperan `document.fonts.status === "loaded"`, resuelven imágenes no-lazy con carrera contra 2.500 ms y luego doble `requestAnimationFrame` (`visual-regression-public.spec.ts:27-73`). Es una implementación correcta y cuidadosa.

**Problemas estructurales:**

1. `[OBSERVADO]` **Los baselines son artefactos de `next dev`.** `docs/ops/CI_PR_CHECKS_RUNBOOK.md:242-246` lo dice explícitamente e incluye el indicador visual de dev. `docs/audit/pr-vis-9-observatory.md:170` lo registra como riesgo R4 aceptado. Consecuencia: **la regresión visual no aporta ninguna evidencia sobre el bundle que reciben los usuarios**, y arrastra a todo `e2e:full` al modo dev (P1-2).
2. `[OBSERVADO]` **Windows no puede correr ninguno.** Los 40 baselines son `-chromium-linux`; `snapshotPathTemplate` no está configurado, así que en win32 Playwright buscaría `-chromium-win32`. El preflight (`run-cohort.mjs:246-257`, exit 5) es correcto y concordante con la memoria de sesión (`visual-linux` BLOCKED en win32). Efecto real: **la mitad de los agentes/desarrolladores no puede validar visual localmente en absoluto**.
3. P1-6 (fuera de gate) y P1-7 (asimetría de skip), arriba.

`[OBSERVADO]` **Sobre diferencias geométricas Windows/Linux:** no se detectó ningún baseline geométrico (A02/A03/A05) con dependencia de plataforma — `platform: "linux"` sólo lo declaran los 3 specs visuales (`by platform: {any: 92, linux: 3}`). A02/A03/A05 son `any` y corren en ambas. La memoria de sesión registra drift win32 en A03 dentro del cohorte extendido; `[NO CONFIRMADO]` si persiste en el HEAD actual — no se ejecutó localmente para no incumplir §8 sin necesidad.

---

## 15. CI y cohortes

### 15.1 Camino completo, auditado extremo a extremo

```text
PR → main
 ├─ PR Governance         [REQUIRED] · sin path filter · valida metadatos y scope
 ├─ QGA Governance        [REQUIRED] · pull_request_target · política de workflows
 ├─ Backend CI            [REQUIRED]
 │    detect-backend-impact: cualquier path NO docs/*|*.md ⇒ should_run=true
 │    validate-backend → pnpm test ⊃ test/architecture/e2e-suite-catalog-completeness.test.ts
 │    ⇒ LA INTEGRIDAD DEL CATÁLOGO E2E ESTÁ FAIL-CLOSED EN UN GATE REQUIRED ✅
 └─ Frontend CI           [REQUIRED]
      detect-frontend-impact: frontend/*|shared/*|lock|workspace|package.json|2 workflows
      validate-frontend (timeout 20m)
        install 7s → lint 15s → typecheck 11s → build 20s → public-surface 1s
        → playwright install --with-deps 21s → e2e:ci 571s  (61 specs / 1007 tests)
        → upload playwright-report SOLO if:failure()  (sin test-results, sin trazas)
      frontend-check [if: always()] → máquina de estados explícita, exit 1 en estado inesperado ✅

E2E Completeness        [NO REQUIRED] · timeout 60m
  ⚠ path filter: sólo dispara si el PR toca frontend/e2e/**, config, manifiestos o
    los tests de infraestructura enumerados → un PR de frontend/src/** NO lo dispara
  schedule '17 3 * * 2' (semanal)  ·  workflow_dispatch
  verify-catalog → build → public-surface → install-deps ⛔ROJO(P0-2) → e2e:full --retries=2
  → upload report+test-results if:failure() → verify-teardown if:always()
  → git diff --exit-code -- frontend/next-env.d.ts frontend/e2e   ✅ higiene fail-closed

Visual Regression Manual [NO REQUIRED] · SOLO workflow_dispatch · lista de specs hardcodeada
```

### 15.2 ¿Puede un E2E relevante quedar fuera de CI silenciosamente?

`[OBSERVADO]` **Análisis fail-closed, respondido con precisión:**

| Vía | ¿Posible? | Justificación |
|---|---|---|
| Spec nuevo sin catalogar | **No** | `e2e-suite-catalog-completeness.test.ts:196-214` compara el barrido del filesystem con el catálogo y falla; corre en `validate-backend` (required) |
| Spec catalogado pero borrado del disco | **No** | `run-cohort.mjs:259-265` → exit 4 |
| Cohorte con 0 specs | **No** | `run-cohort.mjs:238-244` → exit 3 |
| Cohorte inexistente | **No** | exit 2 |
| Script `e2e:*` con lista literal de specs | **No** | guard: *"must not contain literal spec lists"* |
| `ci ≠ unión de las 4 cohortes actuales` | **No** | guard `currentUnion.length === 61` + `deepEqual` |
| Solapamiento entre cohortes | **No** | guard de partición; verificado: 0 solapamientos |
| **Spec catalogado en `extended` que nunca corre en PRs de `frontend/src/**`** | **SÍ** | path filter de `e2e-completeness.yml:7-22` — **34 specs / 315 tests / 5 P1** |
| **Spec visual añadido al catálogo pero no al workflow manual** | **SÍ** | lista hardcodeada en `visual-regression-manual.yml:80-99`, sólo protegida por digest |
| `.only` reduciendo el gate required | **SÍ** | `forbidOnly: false` (P0-3) |
| Job pesado `skipped` con contexto final SUCCESS | **No** | `frontend-check` (líneas 174-190) exige `should_run==false && heavy==skipped`, si no exit 1 |

### 15.3 Matriz de cohortes

| Cohorte | Specs | Tests | Coste medido | En required | Nota |
|---|---:|---:|---:|:---:|---|
| `smoke` | 9 | 49 | — | ✅ | subconjunto de `ci` |
| `admin-mobile` | 14 | 136 | — | ✅ | subconjunto de `ci` |
| `visual-contract` | 22 | 516 | — | ✅ | subconjunto de `ci` |
| `public-clinic` | 16 | 306 | — | ✅ | subconjunto de `ci` |
| **`ci`** = unión exacta de las 4 | **61** | **1.007** | **571 s wall / 18,3 min work** | ✅ | `next start` |
| `extended` | 29 | 264 | ~34,6 min work | ❌ | `next dev` |
| `evidence` | 2 | 11 | 26 s | ❌ | |
| `visual-linux` | 3 | 40 | 55 s | ❌ | sólo dispatch manual |
| **`full`** | **95** | **1.322** | **32,7 min wall / 64,6 min work** | ❌ | |
| `affected` | dinámico | — | — | local-only | fail-closed a `ci` |

Las 4 cohortes actuales son una **partición perfecta** de `ci` (0 solapamientos, unión = 61 = `ci`), y `{ci, extended, evidence, visual-linux}` una partición perfecta de `full`. Esto es raro y valioso; conservarlo.

---

## 16. Performance de la suite

`[OBSERVADO]` Todo medido sobre logs reales de CI, no estimado.

### 16.1 Costes globales

| Ejecución | Wall clock | Trabajo agregado | Workers | Eficiencia paralela |
|---|---:|---:|---:|---:|
| `e2e:ci` (`next start`, run `34409140069`) | **571 s (9,5 min)** | 18,3 min | 2 | **96 %** |
| `e2e:full` (`next dev`, run `34357768243`) | **32,7 min** | 64,6 min | 2 | **99 %** |
| Job `frontend-heavy-validation` completo | 11,0 min | — | — | E2E = **87 %** del job |
| Todo lo demás del gate frontend | ~85 s | — | — | 13 % |

`[INFERIDO]` La eficiencia de paralelización (96–99 %) es prácticamente óptima. **No hay margen de mejora por paralelismo**: la única palanca real es reducir trabajo.

### 16.2 Pareto — catálogo completo

| # | Spec | Coste | % acum. | En CI |
|---|---|---:|---:|:---:|
| 1 | `regression/dashboard-limit-invariance.spec.ts` (A05) | 15,70 min | 24,3 % | — |
| 2 | `regression/dashboard-adaptive-limit-baseline.spec.ts` (A03) | 7,25 min | 35,5 % | — |
| 3 | `regression/dashboard-geometry-baseline.spec.ts` (A02) | 5,81 min | **44,5 %** | — |
| 4 | `regression/dashboard-zero-scroll-baseline.spec.ts` (A08) | 4,68 min | 51,8 % | ✅ |
| 5 | `clinic/shell/clinic-mobile-admin-parity-contract.spec.ts` | 3,24 min | 56,8 % | ✅ |
| 6 | `regression/dashboard-b06-workspace-app-bar.spec.ts` | 2,27 min | 60,3 % | ✅ |
| 7 | `regression/dashboard-b04-surface-token-migration.spec.ts` | 1,71 min | 63,0 % | ✅ |
| 8 | `regression/dashboard-b10-clinic-shell-unification.spec.ts` | 1,26 min | 64,9 % | ✅ |
| 9 | `clinic/shell/dashboard-clinic-module-card-parity.spec.ts` | 1,00 min | 66,5 % | ✅ |
| 10 | `platform/app-shell/dashboard-card-navigation-shell.spec.ts` | 0,99 min | 68,0 % | ✅ |
| 11-20 | (b09, viewport-zoom, action-bar-reachability, metric-run, real-app-shell, detail-text, full-route-stage, b12, final-polish, visual-authenticated) | — | 78,7 % | mixto |
| 21-25 | (b08, tokens-toolbar, b05, workspace-5000, status-modules) | — | **82,5 %** | mixto |

**Tres specs = 28,8 min = 44,5 % del catálogo, y los tres están fuera del gate de merge.**

### 16.3 Pareto — cohorte `ci` (lo que realmente bloquea merges)

| # | Spec | Coste | % acum. |
|---|---|---:|---:|
| 1 | `dashboard-zero-scroll-baseline` (A08) | 188,8 s | **17,2 %** |
| 2 | `clinic-mobile-admin-parity-contract` | 127,5 s | 28,9 % |
| 3 | `dashboard-b06-workspace-app-bar` | 90,9 s | 37,2 % |
| 4 | `dashboard-b04-surface-token-migration` | 65,8 s | 43,2 % |
| 5 | `dashboard-clinic-module-card-parity` | 41,5 s | 47,0 % |
| … | top 20 | — | **79,2 %** |

### 16.4 Distribución de duración por test

| Rango | `ci` (1.006) | `full` (1.323) |
|---|---:|---:|
| `<1 s` | 777 (77 %) | 567 (43 %) |
| `1–5 s` | 201 | 638 |
| `5–15 s` | 28 | 64 |
| `15–60 s` | 0 | 50 |
| `60–300 s` | 0 | **4** |
| `>300 s` | 0 | 0 |

Tests individuales más caros (todos en `extended`): A05 `logistics-*` **174,0 s** y **132,0 s**; A03 `logistics-recent-*` **78,0 s** y `logistics-bounded-*` **60,0 s**. Playwright emite explícitamente `Slow test file: dashboard-adaptive-limit-baseline.spec.ts (7.3m)`.

### 16.5 Causas del coste, no síntomas

`[INFERIDO]` El coste NO viene de esperas mal puestas (sólo 17 `waitForTimeout`, 8 s de sleep duro total). Viene de:

1. **Navegaciones redundantes sobre la misma matriz canónica.** 14 specs consumen `dashboard-geometry-matrix`: A02, A03, A05, A08, B04, B05, B06, B08, B10, B11, B12, B14, `admin-tokens-mobile-toolbar-layout`, `dashboard-detail-text-integrity`. Cada uno re-navega el mismo conjunto de 21 superficies con su propio contexto. `[PROPUESTO]` Un modelo de "una navegación → N mediciones" reduciría el coste dominante sin perder ninguna assertion.
2. **`browser.newContext()` por estado.** B04 (`spec:239-243`) crea un contexto nuevo por cada combinación tema×viewport — justificado (el tema se escribe pre-paint) pero caro: 21 superficies × 4 estados = 84 arranques de contexto.
3. **Modo `next dev` en `full`** (+64 % medido).
4. **A05 con transiciones A-B-A calientes**: 15 tests, 13 viewports, 3 alturas de control cada uno.

**Ninguna recomendación de esta auditoría propone subir un timeout.**

---

## 17. Duplicación

### 17.1 Textual

| Patrón duplicado | Ocurrencias | Consolidable |
|---|---:|---|
| Setup de sesión (`addCookies` con `url` hardcodeado) | 92 en 67 specs | **Sí** — `DASHBOARD_GEOMETRY_SESSION_COOKIE` ya existe |
| Literal `http://127.0.0.1:3000` | 88 | **Sí** — `use.baseURL` ya definido |
| Guardas de retiro (`[data-dashboard-module-rail]` → count 0) | ≥6 specs | Parcial — es cobertura legítima repetida por dominio |
| Supresión del dev overlay | centralizada ✅ | ya resuelto (`suppressNextDevChrome`) |
| Lectura de scroll del documento | 15 specs con implementaciones propias | **Sí** |

### 17.2 Semántica (la que importa)

| Contrato | Owners | Veredicto |
|---|---|---|
| **Zero-scroll del documento** | A08 (0 px, 273 combinaciones) + `dashboard-internal-no-scroll-contract` + `dashboard-real-app-shell-no-scroll-contract` + `dashboard-single-viewport-app-shell` + `dashboard-zero-scroll-mobile-boundary` + 8 `admin-mobile-*-no-scroll` + `clinic-informes-zero-internal-scroll` + `particular-authenticated-no-scroll` | **Consolidar tolerancia** (P2-2): A08 es el owner canónico y exacto; los demás retienen 2 px. Consolidar el *régimen*, no borrar los specs (cubren superficies que A08 no toca). |
| **Paridad clínica ↔ admin mobile** | `clinic-mobile-admin-parity-contract` (CMP-12, 60 tests) + `dashboard-clinic-metric-run-parity` (CMP-05, 60) + `dashboard-clinic-module-card-parity` (CMP-04, 30) + `dashboard-clinic-full-route-stage-parity` (CMP-06, 30) + `dashboard-clinic-controller-workspace-parity` (26) | **Parametrizar.** 206 tests, 4,3 min. CMP-12 declara cubrir *"all 10 clinic mobile surfaces × 6 canonical phone viewports"*: es un superconjunto de CMP-04/05/06. Evaluar si los tres específicos siguen aportando resolución de fallo. |
| **App-bar / header band** | B06 (21×13) + B11 (representativos) | **Conservar ambos** — B11 mide 40 px del `WorkspaceHeader`, B06 mide 56 px del `WorkspaceAppBar`. Distintos. |
| **Navegación lateral** | B08 (migración) + B09 (unificación mobile) + B10 (shell clínica) + `dashboard-mobile-shell-nav-contract` | **Conservar** — B08/B09/B10 son fases con retirements asimétricos documentados; el solape es histórico y trazado. |
| **Capacidad adaptativa** | A03 (baseline limit/offset) + A05 (invarianza) | **Conservar** — A03 congela valores, A05 prueba invarianza bajo transición. Ortogonales. Pero **22,95 min combinados (35,5 %)** justifican revisar si A05 necesita 13 viewports. |

`[INFERIDO]` La duplicación semántica más costosa está en la familia CMP (paridad clínica). No es duplicación accidental: es acumulación de fases sucesivas cada una con su propio spec. Es el patrón típico de un repo que usa el spec como **acta de PR** además de como red de regresión — visible también en los nombres (`dashboard-b04…`, `dashboard-b14…`, `remove-dashboard-home-…`).

---

## 18. Código E2E muerto

| Candidato | Clasificación | Evidencia |
|---|---|---|
| `regression/evidence/remove-home-unified-workspace-screenshots.spec.ts` (10 tests, 0 assertions, 21 s) | **`OBSOLETE_TEST`** | Sus capturas van a `test-results/`, borrado por Playwright al inicio y por `e2e-completeness.yml:144` al final |
| `scripts/compare-visual-artifacts.mjs` (605 LOC) | **`INTENTIONAL`** (sin ruta operativa) | 0 referencias en `.github/`; sólo script npm + su contrato |
| Ancla `horizontal-nav` en `DASHBOARD_PERSISTENT_CHROME` | **`INTENTIONAL`** (documentado) | resuelve a 0 elementos; retención deliberada para estabilidad del registro A02 |
| Ancla `module-rail` en `DASHBOARD_PERSISTENT_CHROME` | **`INTENTIONAL`** (documentado) | ídem |
| Selector `[data-dashboard-module-rail]` en 6 specs | **`LEGACY_REQUIRED`** | usado como `toHaveCount(0)` — guarda de retiro válida |
| `[data-clinic-cockpit-modules]`, `[data-hero-system-diagram]` | **`LEGACY_REQUIRED`** | ídem, negativos |
| `helpers/verify-teardown.mjs` | **`INTENTIONAL`** | 0 consumidores en `e2e/**`, pero script npm + paso de workflow |
| `helpers/mobile-parity-matrix.ts` (566 LOC) | **`SUSPECT`** | sólo 2 consumidores; si CMP se consolida (§17) puede quedar sobre-dimensionado |
| Snapshots huérfanos | **ninguno** | 40 PNG = 40 tests visuales, reconciliación exacta |
| Helpers huérfanos | **ninguno** | los 8 tienen consumidor |
| Fixtures huérfanas | **ninguna** | las 3 tienen consumidor |
| Specs huérfanos | **ninguno** | 95 = 95 = 95 |
| Entradas de catálogo muertas | **ninguna** | `E2E_MANUAL_ONLY_SPECS = []` |

**Nada se eliminó durante esta auditoría.**

---

## 19. Documentación obsoleta

`[OBSERVADO]` Reconciliación contra la realidad medida (95 specs / 1.322 tests / ci 61 / extended 29):

| Documento | Afirmación | Estado |
|---|---|---|
| `docs/ops/CI_PR_CHECKS_RUNBOOK.md:235` | `e2e:ci → 43 specs` | **DESACTUALIZADO** (61) |
| `docs/ops/CI_PR_CHECKS_RUNBOOK.md:238` | `e2e:full → 72 specs` | **DESACTUALIZADO** (95) |
| `docs/ops/CI_PR_CHECKS_RUNBOOK.md:246` | `Frontend CI (e2e:ci, 43 specs)` | **DESACTUALIZADO** |
| `docs/ops/CI_PR_CHECKS_RUNBOOK.md:253-255` | `tope duro de 55 minutos` · `E2E_GLOBAL_TIMEOUT_MS: "2400000"` | **DESACTUALIZADO** — real: `timeout-minutes: 60` y `2700000` |
| `docs/ops/CI_PR_CHECKS_RUNBOOK.md:239` | `full == ci ∪ extended ∪ evidence ∪ visual-linux` | **VIGENTE** ✅ (verificado por guard) |
| `docs/ops/CI_PR_CHECKS_RUNBOOK.md:242-246` | `e2e:full` con `next dev` por los baselines | **VIGENTE** ✅ |
| `docs/SOURCES_OF_TRUTH.md:68` | `72 specs / 786 tests · 782 pases directos y 4 tras retry` | **DESACTUALIZADO** (95/1.322; 1 flaky en el último run) |
| `docs/audit/e2e-enterprise-organization-audit.md:19-26` | `72 specs / 785 tests` · `CI 42 specs (562 tests)` · `30 specs (223 tests) fuera de CI` | **SUPERSEDED** (95/1.322; ci 61/1.007; fuera 34/315) |
| `docs/audit/e2e-enterprise-organization-audit.md:21` | *"La organización física es plana: 72 specs en la raíz"* | **SUPERSEDED** — hoy hay 6 dominios en subdirectorios |
| `docs/audit/test-suite-enterprise-architecture-audit.md:73-76` | cohortes de 7 / 13 / 11 / 11 specs; scripts como `playwright test <N specs>` | **SUPERSEDED** — 9/14/22/16, y los scripts delegan en `run-cohort.mjs` (guard lo exige) |
| `docs/audit/pr-vis-9-observatory.md:170` | riesgo R4 `next dev` vs `next start` en baselines | **VIGENTE** ✅ — y sigue sin cerrarse |
| `docs/qa/regression-strategy.md:52-66` | mapeo cambio → cohorte | **VIGENTE** ✅ |

`[RIESGO]` **`CI_PR_CHECKS_RUNBOOK.md` es la fuente que AGENTS.md §5.8 y §6 nombran como mapa operativo de las precondiciones de merge.** Que declare cifras y presupuestos de tiempo que ya no existen degrada un contrato operativo, no sólo una nota. Es el documento a corregir primero.

---

## 20. Matriz completa de specs (95/95)

`s(full)` = segundos agregados de ese spec en el run `34357768243` (`next dev`, 2 workers).

| # | Spec (`frontend/e2e/…`) | Dominio | Feature | Tipo de contrato | Tests | Fixture | Cohorte | Crit | CI | s(full) |
|---|---|---|---|---|---:|---|---|---|:---:|---:|
| 1 | admin/clinics/admin-clinic-edit-drawer | admin | clinics | admin isolation edit drawer | 12 | — | admin-mobile | P1 | ✅ | 22 |
| 2 | admin/clinics/admin-clinics-mobile-card-layout | admin | clinics | mobile card layout | 4 | — | admin-mobile | P1 | ✅ | 6 |
| 3 | admin/pricing/admin-pricing-multi-form-measurement | admin | pricing | multi-form measurement | 1 | — | extended | P2 | — | 1 |
| 4 | admin/shell/admin-mobile-app-shell-absolute-no-scroll | admin | shell | absolute no-scroll app shell | 6 | — | admin-mobile | P1 | ✅ | 4 |
| 5 | admin/shell/admin-mobile-bottom-navigation-no-scroll | admin | shell | bottom navigation no-scroll | 4 | — | admin-mobile | P1 | ✅ | 6 |
| 6 | admin/shell/admin-mobile-config-modules-no-scroll | admin | shell | config modules no-scroll | 22 | — | admin-mobile | P1 | ✅ | 26 |
| 7 | admin/shell/admin-mobile-core-modules-no-scroll | admin | shell | core modules no-scroll | 14 | admin-mobile-contracts | admin-mobile | P1 | ✅ | 21 |
| 8 | admin/shell/admin-mobile-final-polish-no-scroll | admin | shell | final polish no-scroll | 4 | admin-mobile-contracts | admin-mobile | P1 | ✅ | 36 |
| 9 | admin/shell/admin-mobile-hub-launcher-no-scroll | admin | shell | hub launcher no-scroll | 7 | — | admin-mobile | P1 | ✅ | 10 |
| 10 | admin/shell/admin-mobile-hub-stale-layer-stage | admin | shell | stale layer stage | 4 | — | admin-mobile | P1 | ✅ | 4 |
| 11 | admin/shell/admin-mobile-module-layer-isolation | admin | shell | module layer isolation | 7 | — | admin-mobile | P1 | ✅ | 10 |
| 12 | admin/shell/admin-mobile-ops-modules-no-scroll | admin | shell | ops modules no-scroll | 13 | admin-mobile-contracts | admin-mobile | P1 | ✅ | 21 |
| 13 | admin/shell/admin-mobile-status-modules-no-scroll | admin | shell | status modules no-scroll | 23 | admin-mobile-contracts | admin-mobile | P1 | ✅ | 28 |
| 14 | admin/tokens/admin-tokens-mobile-toolbar-layout | admin | tokens | mobile toolbar layout | 13 | — | admin-mobile | P1 | ✅ | 30 |
| 15 | admin/users/admin-users-fixture-pagination | admin | users | fixture pagination | 4 | admin-populated-api-server | extended | P2 | — | 0 |
| 16 | admin/users/admin-users-roles-pager-reachability | admin | users | pager reachability adaptativa | 3 | admin-populated-api-server | extended | **P1** | — | 5 |
| 17 | admin/users/admin-users-visual-quality-gate | admin | users | visual quality capacity | 15 | admin-mobile-contracts | extended | P2 | — | 21 |
| 18 | admin/users/admin-users-workspace-5000 | admin | users | workspace capacity 5000 | 4 | — | extended | P2 | — | 29 |
| 19 | admin/users/admin-users-workspace-mobile-5000 | admin | users | mobile workspace capacity 5000 | 6 | admin-mobile-contracts | extended | P2 | — | 7 |
| 20 | clinic/logistics/dashboard-clinic-logistica-mobile-parity | clinic | logistics | mobile logistics parity | 3 | — | public-clinic | P1 | ✅ | 3 |
| 21 | clinic/logistics/dashboard-logistica-metricas-full-route-adaptive | clinic | logistics | metrics full route adaptive | 5 | — | extended | P2 | — | 3 |
| 22 | clinic/logistics/dashboard-logistica-mobile-action-bar-reachability | clinic | logistics | bottom chrome reachability | 6 | admin-populated-api-server | extended | **P1** | — | 48 |
| 23 | clinic/logistics/dashboard-logistica-rutas-full-route-adaptive | clinic | logistics | routes full route adaptive | 4 | — | extended | P2 | — | 6 |
| 24 | clinic/logistics/dashboard-logistica-visitas-full-route-adaptive | clinic | logistics | visits full route adaptive | 4 | — | extended | P2 | — | 4 |
| 25 | clinic/logistics/logistics-mobile-no-horizontal-table | clinic | logistics | mobile no horizontal table | 9 | — | extended | P2 | — | 7 |
| 26 | clinic/profile/dashboard-clinic-perfil-mobile-operability | clinic | profile | mobile profile operability | 3 | — | public-clinic | P1 | ✅ | 3 |
| 27 | clinic/reports/clinic-informes-zero-internal-scroll | clinic | reports | internal no-scroll | 4 | — | extended | P2 | — | 5 |
| 28 | clinic/reports/clinic-reports-fixture-pagination | clinic | reports | fixture pagination | 4 | admin-populated-api-server | extended | P2 | — | 1 |
| 29 | clinic/reports/clinic-reports-workspace-1000 | clinic | reports | capacity 1000 + P1 guards | 5 | — | extended | P2 | — | 5 |
| 30 | clinic/reports/dashboard-clinic-informes-mobile-parity | clinic | reports | mobile reports parity | 5 | — | public-clinic | P1 | ✅ | 6 |
| 31 | clinic/reports/dashboard-informes-server-adaptive-pagination | clinic | reports | server adaptive pagination | 5 | — | extended | P2 | — | 5 |
| 32 | clinic/shell/clinic-mobile-admin-parity-contract | clinic | shell | CMP-12 cross-role parity | 60 | admin-populated-api-server | public-clinic | P1 | ✅ | **195** |
| 33 | clinic/shell/dashboard-adaptive-rows | clinic | shell | adaptive rows | 3 | — | extended | P2 | — | 3 |
| 34 | clinic/shell/dashboard-centered-pager | clinic | shell | centered pager | 5 | — | extended | P2 | — | 4 |
| 35 | clinic/shell/dashboard-clinic-controller-workspace-parity | clinic | shell | controller rail parity | 26 | — | extended | P2 | — | 19 |
| 36 | clinic/shell/dashboard-clinic-full-route-stage-parity | clinic | shell | CMP-06 stage parity | 30 | admin-populated-api-server | public-clinic | P1 | ✅ | 38 |
| 37 | clinic/shell/dashboard-clinic-metric-run-parity | clinic | shell | CMP-05 metric run parity | 60 | admin-populated-api-server | public-clinic | P1 | ✅ | 42 |
| 38 | clinic/shell/dashboard-clinic-mobile-content-reachability | clinic | shell | mobile content reachability | 5 | — | extended | P2 | — | 4 |
| 39 | clinic/shell/dashboard-clinic-mobile-operational-density | clinic | shell | mobile operational density | 19 | — | extended | P2 | — | 19 |
| 40 | clinic/shell/dashboard-clinic-module-card-parity | clinic | shell | CMP-04 module card parity | 30 | admin-populated-api-server | public-clinic | P1 | ✅ | 60 |
| 41 | clinic/shell/dashboard-clinic-module-state-parity | clinic | shell | module state parity | 14 | — | extended | P2 | — | 13 |
| 42 | clinic/shell/dashboard-interaction-foundation | clinic | shell | interaction foundation | 9 | — | smoke | P1 | ✅ | 6 |
| 43 | clinic/shell/dashboard-master-detail-state-polish | clinic | shell | master-detail state polish | 6 | — | visual-contract | P1 | ✅ | 4 |
| 44 | clinic/shell/remove-dashboard-home-unified-workspace | clinic | shell | post hub removal behavior | 13 | — | extended | P2 | — | 13 |
| 45 | clinic/tokens/dashboard-clinic-tokens-mobile-parity | clinic | tokens | mobile tokens parity | 9 | — | public-clinic | P1 | ✅ | 15 |
| 46 | particular/auth/particular-authenticated-no-scroll | particular | auth | authenticated no-scroll | 30 | particular-session-contracts | extended | P2 | — | 26 |
| 47 | particular/auth/particular-authenticated-session-fixture | particular | auth | authenticated session fixture | 2 | particular-session-contracts | extended | P2 | — | 2 |
| 48 | particular/auth/particular-authenticated-zoom-sentinel | particular | auth | authenticated zoom sentinel | 1 | particular-session-contracts | public-clinic | P1 | ✅ | 1 |
| 49 | platform/accessibility/accessibility-axe-key-routes | platform | accessibility | axe WCAG 2.1 AA | 8 | — | extended | P2 | — | 11 |
| 50 | platform/accessibility/dashboard-accessibility-keyboard | platform | accessibility | keyboard accessibility | 14 | — | visual-contract | P1 | ✅ | 10 |
| 51 | platform/app-shell/dashboard-app-shell-visibility-contract | platform | app-shell | app shell visibility | 4 | — | visual-contract | P1 | ✅ | 3 |
| 52 | platform/app-shell/dashboard-card-navigation-shell | platform | app-shell | navigation + deep links | 68 | — | visual-contract | P1 | ✅ | 59 |
| 53 | platform/app-shell/dashboard-detail-text-integrity | platform | app-shell | detail text integrity | 35 | admin-populated-api-server | visual-contract | P1 | ✅ | 40 |
| 54 | platform/app-shell/dashboard-global-masked-master-detail | platform | app-shell | masked master detail | 16 | — | visual-contract | P1 | ✅ | 15 |
| 55 | platform/app-shell/dashboard-internal-no-scroll-contract | platform | app-shell | internal no-scroll | 8 | — | visual-contract | P1 | ✅ | 5 |
| 56 | platform/app-shell/dashboard-mobile-shell-nav-contract | platform | app-shell | mobile shell navigation | 25 | — | visual-contract | P1 | ✅ | 17 |
| 57 | platform/app-shell/dashboard-real-app-shell-no-scroll-contract | platform | app-shell | real app shell no-scroll | 37 | — | visual-contract | P1 | ✅ | 40 |
| 58 | platform/app-shell/dashboard-single-viewport-app-shell | platform | app-shell | single viewport app shell | 18 | — | visual-contract | P1 | ✅ | 14 |
| 59 | platform/app-shell/dashboard-viewport-zoom-adaptability | platform | app-shell | viewport zoom adaptability | 64 | — | visual-contract | P1 | ✅ | 52 |
| 60 | platform/app-shell/dashboard-workspace-layout-polish | platform | app-shell | workspace layout polish | 19 | — | visual-contract | P1 | ✅ | 14 |
| 61 | platform/app-shell/dashboard-zero-scroll-mobile-boundary | platform | app-shell | mobile zero-scroll boundary | 8 | — | extended | P2 | — | 6 |
| 62 | platform/auth/dashboard-auth-redirect | platform | auth | private redirect (+"admin 404"⚠) | 3 | — | smoke | P1 | ✅ | 3 |
| 63 | platform/auth/dashboard-logout-private-cache | platform | auth | logout + private no-store | 6 | — | smoke | P1 | ✅ | 5 |
| 64 | platform/hydration/contacto-hydration | platform | hydration | contact page hydration | 2 | — | smoke | P1 | ✅ | 3 |
| 65 | platform/hydration/login-hydration | platform | hydration | login page hydration (sin submit) | 2 | — | smoke | P1 | ✅ | 1 |
| 66 | platform/smoke/visual-smoke | platform | smoke | multi-surface render sanity | 10 | — | smoke | P1 | ✅ | 11 |
| 67 | platform/theme/theme-mode | platform | theme | light/dark toggle | 2 | — | smoke | P1 | ✅ | 3 |
| 68 | public/clinics/public-clinics-b2b-operations | public | clinics | B2B operations landing | 24 | — | public-clinic | P1 | ✅ | 27 |
| 69 | public/home/home-hero-evidence-first | public | home | hero evidence-first | 8 | — | public-clinic | P1 | ✅ | 7 |
| 70 | public/home/public-perspective-scroll | public | home | perspective scroll | 16 | — | public-clinic | P1 | ✅ | 18 |
| 71 | public/navigation/public-navigation-footer | public | navigation | navigation + footer | 7 | — | public-clinic | P1 | ✅ | 10 |
| 72 | public/pricing/public-pricing-actionable | public | pricing | actionable pricing | 9 | — | public-clinic | P1 | ✅ | 12 |
| 73 | public/reports/public-report-preview | public | reports | public report preview | 21 | — | public-clinic | P1 | ✅ | 23 |
| 74 | public/routes/public-routes | public | routes | public routes + 404 branded | 14 | — | smoke | P1 | ✅ | 15 |
| 75 | public/services/public-service-bento-specimen-journey | public | services | service bento journey | 20 | — | public-clinic | P1 | ✅ | 22 |
| 76 | regression/dashboard-adaptive-limit-baseline | regression | dashboard | A03 limit/offset 15×13 | 16 | admin-populated-api-server | extended | **P1** | — | **435** |
| 77 | regression/dashboard-b04-surface-token-migration | regression | dashboard | persistent chrome elevation | 21 | admin-populated-api-server | visual-contract | P1 | ✅ | 103 |
| 78 | regression/dashboard-b05-surface-inversion | regression | dashboard | filter-field surface inversion | 7 | admin-populated-api-server | visual-contract | P1 | ✅ | 30 |
| 79 | regression/dashboard-b06-workspace-app-bar | regression | dashboard | app bar band 21×13 | 24 | admin-populated-api-server | visual-contract | P1 | ✅ | 136 |
| 80 | regression/dashboard-b08-navigation-migration | regression | dash/nav | lateral navigation migration | 16 | admin-populated-api-server | visual-contract | P1 | ✅ | 30 |
| 81 | regression/dashboard-b09-mobile-navigation-unification | regression | dash/nav | mobile nav unification | 31 | admin-populated-api-server | visual-contract | P1 | ✅ | 50 |
| 82 | regression/dashboard-b10-clinic-shell-unification | regression | dash/shell | clinic app shell unification | 36 | admin-populated-api-server | visual-contract | P1 | ✅ | 76 |
| 83 | regression/dashboard-b11-workspace-header | regression | dashboard | workspace header 40 px | 4 | admin-populated-api-server | visual-contract | P1 | ✅ | 6 |
| 84 | regression/dashboard-b12-module-card-removal | regression | dashboard | module card removal | 30 | admin-populated-api-server | visual-contract | P1 | ✅ | 37 |
| 85 | regression/dashboard-b13-admin-entry | regression | dash/nav | durable admin entry | 12 | admin-populated-api-server | visual-contract | P1 | ✅ | 12 |
| 86 | regression/dashboard-b14-metrics-relocation | regression | dashboard | metrics relocation | 3 | admin-populated-api-server | admin-mobile | P1 | ✅ | 10 |
| 87 | regression/dashboard-geometry-baseline | regression | dashboard | A02 geometry 21×13 | 21 | admin-populated-api-server | extended | **P1** | — | **348** |
| 88 | regression/dashboard-limit-invariance | regression | dashboard | A05 limit invariance 15×13 | 15 | admin-populated-api-server | extended | **P1** | — | **942** |
| 89 | regression/dashboard-operational-contract | regression | dashboard | A01 operational contract S1 | 1 | — | smoke | P1 | ✅ | 2 |
| 90 | regression/dashboard-zero-scroll-baseline | regression | dashboard | A08 zero-scroll 21×13 (0 px) | 21 | admin-populated-api-server | visual-contract | P1 | ✅ | 281 |
| 91 | regression/evidence/dashboard-runtime-post-ux1-visual-evidence | regression | evidence | runtime visual evidence | 1 | — | evidence | P2 | — | 5 |
| 92 | regression/evidence/remove-home-unified-workspace-screenshots | regression | evidence | screenshots (**0 assertions**) | 10 | — | evidence | P2 | — | 21 |
| 93 | regression/visual/visual-regression-authenticated | regression | visual | dual-theme pixel baseline | 20 | — | visual-linux | P2 | — | 30 |
| 94 | regression/visual/visual-regression-public | regression | visual | public pixel baseline (sin skip⚠) | 10 | — | visual-linux | P2 | — | 11 |
| 95 | regression/visual/visual-regression-stress | regression | visual | stress pixel baseline | 10 | — | visual-linux | P2 | — | 14 |

**Ningún spec quedó sin clasificar.** 95 filas = 95 archivos = 95 entradas de catálogo.

---

## 21. Matriz de cobertura (dominio × flujo × tipo)

Leyenda: ✅ cubierto · ⚠️ parcial/superficial · ❌ ausente · n/a no aplica

| Dominio | Happy | Error | Unauth | Forbidden | Empty | Loading | Persist. | Reload | History | Responsive | Security | Sanitiz. |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `public` | ✅ | ✅ (404) | n/a | n/a | ⚠️ | ❌ | n/a | ⚠️ | ⚠️ | ✅ | n/a | ✅ |
| `public` → buscador profesionales | ❌ | ❌ | n/a | n/a | ❌ | ❌ | n/a | ❌ | ❌ | ❌ | n/a | ❌ |
| `public` → landings SEO (×4) | ❌ | ❌ | n/a | n/a | n/a | n/a | n/a | ❌ | ❌ | ❌ | n/a | ❌ |
| `clinic` (dashboard) | ✅ | ⚠️ | ⚠️ | ❌ | ✅ | ⚠️ | ❌ | ✅ | ✅ | ✅ | ⚠️ | ✅ |
| `admin` (dashboard) | ✅ | ⚠️ | ⚠️ | ❌ | ✅ | ⚠️ | ❌ | ✅ | ✅ | ✅ | ⚠️ | ✅ |
| `particular` | ⚠️ | ⚠️ | ❌ | ❌ | ⚠️ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ⚠️ |
| `auth` (login) | ❌ | ❌ | ✅ | ❌ | n/a | ❌ | n/a | ❌ | ❌ | ⚠️ | ⚠️ | ⚠️ |
| `platform` (shell/nav/theme/a11y) | ✅ | ⚠️ | ✅ | ❌ | ✅ | ⚠️ | ✅ (módulo) | ✅ | ✅ | ✅ | ⚠️ | ✅ |
| `API contract` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | n/a | n/a | n/a | ❌ | ❌ |
| `PWA / offline` | ❌ | ❌ | n/a | n/a | ❌ | ❌ | ❌ | ❌ | n/a | ❌ | ❌ | ❌ |

**Perfil de assertion (3.088 `expect()`)** — evidencia del sesgo geométrico:

| Familia | Ocurrencias | % |
|---|---:|---:|
| Presencia/visibilidad (`toBeVisible` 797 + `toHaveCount` 290) | 1.087 | 35,2 % |
| Igualdad exacta (`toBe` 550 + `toEqual` 90) | 640 | 20,7 % |
| Comparación numérica (`toBeLessThanOrEqual` 356 + `toBeGreaterThan` 209) | 565 | 18,3 % |
| **Contenido de texto/valor** (`toContainText` 127 + `toHaveText` 31 + `toHaveValue` 26) | **184** | **6,0 %** |
| Atributo (`toHaveAttribute`) | 103 | 3,3 % |
| Navegación (`toHaveURL`) | 72 | 2,3 % |
| Foco/estado (`toBeFocused` 5 + `toBeEnabled` 44 + `toBeInViewport` 4) | 53 | 1,7 % |
| Píxel (`toHaveScreenshot`) | 3 | 0,1 % |
| Polling (`toPass`) | 118 | — |

---

## 22. Matriz de riesgos

| ID | Riesgo | Taxonomía | Prob. | Impacto | Blast radius | Prio |
|---|---|---|:-:|:-:|---|:-:|
| R-01 | Regresión de auth/sesión no detectada por E2E | `COVERAGE_GAP` + seguridad | Alta | Crítico | Todo `/dashboard`, portal particular | **P0** |
| R-02 | Deriva fixture↔backend real sin guard | `FIXTURE_DEFECT` | Alta | Alto | Todos los specs de datos | **P0** |
| R-03 | `E2E Completeness` en rojo → 34 specs / 5 P1 sin ejecutar | `CI_INFRA_DEFECT` / `ENVIRONMENT_DEFECT` | Ocurrido | Alto | A02/A03/A05, axe, visual, reachability | **P0** |
| R-04 | `.only` reduce el gate required a 1 test en verde | `CI_INFRA_DEFECT` | Media | Crítico | Todo el gate frontend | **P0** |
| R-05 | Fallo en CI sin traza/screenshot → diagnóstico ciego | `PLAYWRIGHT_INFRA` | Alta | Medio | Velocidad de resolución | **P1** |
| R-06 | El catálogo completo valida un bundle (dev) distinto del productivo | `TEST_ARCHITECTURE` | Ocurrido | Alto | 34 specs + 40 baselines | **P1** |
| R-07 | Retries enmascaran flakes reales sin fallar el run | `FLAKY_TEST` | Ocurrido | Medio | Confianza en `full` | **P1** |
| R-08 | Specs P1 fuera del gate por path filter | `COVERAGE_GAP` | Alta | Alto | 5 contratos P1 | **P1** |
| R-09 | Baselines visuales fuera de todo gate + actualización de un clic | `VISUAL_BASELINE` | Media | Medio | 40 PNG | **P1** |
| R-10 | Spec de seguridad que afirma más de lo que prueba | `TEST_DEFECT` (nombre) | Ocurrido | Medio | Lectura del catálogo | **P1** |
| R-11 | 26 specs miden layout sobre API 404 permanente | `FIXTURE_DEFECT` | Ocurrido | Medio | Regresiones de render de datos | **P2** |
| R-12 | Dos regímenes de tolerancia zero-scroll (0 px vs 2 px) | `GEOMETRY_BASELINE` | Media | Medio | 13 specs no-scroll | **P2** |
| R-13 | Anclas de chrome que no resuelven, sin detección por ancla | `TEST_DEFECT` | Baja | Medio | B04 | **P2** |
| R-14 | Lista manual de specs visuales paralela al catálogo | `TEST_ARCHITECTURE` | Media | Medio | visual-linux | **P2** |
| R-15 | Duplicación semántica CMP (206 tests, 4,3 min) | `DUPLICATE_COVERAGE` | Ocurrido | Bajo | tiempo de CI | **P2** |
| R-16 | Spec de 10 tests sin assertions | `OBSOLETE_TEST` | Ocurrido | Bajo | 21 s/corrida | **P2** |
| R-17 | Duplicación textual de setup de sesión (92 sitios) | `TEST_ARCHITECTURE` | Ocurrido | Bajo | mantenibilidad | **P2** |
| R-18 | Runbook operativo con cifras obsoletas | documentación | Ocurrido | Medio | decisiones de merge | **P2** |
| R-19 | No-determinismo sub-píxel absorbido por tolerancia (A05: 43,188 vs 40) | `PLATFORM_VARIANCE` | `[NO CONFIRMADO]` | Bajo | A05 | **P3** |
| R-20 | `globalTimeout` inalcanzable bajo `timeout-minutes: 20` | config muerta | Baja | Bajo | claridad | **P3** |

---

## 23. Estado objetivo `[PROPUESTO]`

Diseño, **sin implementar**, bajo los principios exigidos: fuente única, fail-closed, determinismo, aislamiento, mínimo acoplamiento, mínimo tiempo, máxima señal, cobertura crítica explícita.

**Organización física** — conservar la actual. Los 6 dominios y el catálogo funcionan. Añadir un séptimo dominio sólo si aparece `integration` (ver abajo).

**Ownership** — conservar `owner = domain`. Añadir dos campos al `E2eCatalogEntry`:

- `layer: "mocked" | "fixture" | "integration"` — hace explícito qué atraviesa realmente cada spec. Hoy es invisible y es la causa raíz de la mala lectura de cobertura.
- `proves: string` — una frase de lo que el spec demuestra, verificable en revisión contra el `describe`. Cerraría P2-8 y P1-4.

**Catálogo** — sigue siendo la fuente única. Añadir al guard: (a) reconciliación de la lista de specs de `visual-regression-manual.yml` con la cohorte `visual-linux`; (b) invariante de que ninguna entrada `criticality: "P1"` quede fuera de `ci` sin un campo explícito `p1OutsideGateReason`.

**Cohortes** — el objetivo es que `ci` cubra el 100 % de los P1. Dos vías, no excluyentes:

- promover al gate los 2 P1 baratos (`admin-users-roles-pager-reachability` 5 s, `dashboard-logistica-mobile-action-bar-reachability` 48 s): **+53 s sobre 571 s = +9 %**, aceptable;
- para A02/A03/A05 (28,8 min) no promover: en su lugar, **quitar el path filter de `e2e-completeness.yml`** para que corra en todo PR con impacto frontend, y hacerlo `required` sólo cuando su tiempo baje del presupuesto.

**Fixtures** — un solo mecanismo por superficie. `page.route` para componentes cliente; fixture HTTP para server components; y una regla explícita: **ninguna ruta puede estar declarada en ambos**. Un guard estático puede comprobarlo cruzando los `urlPattern` de los helpers con las rutas del fixture.

**Helpers** — un único `session.ts` que exporte `setAdminSession`/`setClinicSession`/`setParticularSession`, tome el origen de `use.baseURL` y sea la única fuente de valores de cookie. Elimina 92 duplicaciones y el problema `e2e_test_*` vs `e2e_populated_*`.

**Seguridad** — el fixture modela sesiones con estado mínimo (valor → rol → expiración) y emite 401/403. Cohorte `smoke` gana 3 specs de frontera.

**Visual** — dos decisiones acopladas: recapturar los 40 baselines bajo `next start` y, con eso, `e2e:full` puede pasar a production runner. Elimina R-06 y P1-2 de una vez. Después, `visual-linux` puede entrar en un workflow `schedule` diario o en PRs que toquen `frontend/src/styles/**`.

**Geometría** — convergencia a `MAX_SCROLL_DELTA_PX = 0` en los specs `platform/app-shell/**` que hoy toleran 2 px, o declaración explícita de por qué esa tolerancia es contractual allí.

**Artifacts** — `trace: "retain-on-failure"`, `screenshot: "only-on-failure"`, `test-results/` subido en ambos gates.

**CI** — `forbidOnly: !!CI`, `failOnFlakyTests: true`, `install --with-deps` unificado.

**Desarrollo local** — no cambia (`e2e:affected` es correcto y fail-closed). Documentar que `visual-linux` está BLOCKED en Windows por diseño, no por avería.

**Guards** — los existentes se conservan íntegros; los nuevos son 3 invariantes añadidas al guard de catálogo, no un sistema nuevo.

---

## 24. Roadmap recomendado `[PROPUESTO]`

La numeración la determinó la evidencia, no una plantilla. Cada fase es un PR mínimo con un scope primario, una causa y un rollback (AGENTS.md §4).

Este documento (`LIMPIEZA E2E`) es la fuente documental de estas fases. Cada futura implementación debe referenciarlo. **Ninguna fase fue ejecutada por esta auditoría.**

### `E2E-GLOBAL-01` — Restaurar el gate completo *(ci-only, urgente)*

- **Objetivo:** `E2E Completeness` vuelve a alcanzar el paso 11.
- **Problema:** P0-2 / R-03.
- **Scope:** `.github/workflows/e2e-completeness.yml`.
- **No-scope:** cualquier cambio de specs, config de Playwright o catálogo.
- **Dependencias:** ninguna. **Va primero.**
- **Riesgo:** bajo.
- **Archivos:** 1.
- **Tests:** `test/unit/infrastructure/e2e-completeness-workflow.test.ts` (realinear en el mismo PR), `workflow-security-policy-contract.test.ts` (digest).
- **Gates:** `pnpm test`, `qga-governance`.
- **Rollback:** revertir 1 archivo.
- **Aceptación:** 2 runs consecutivos con el paso 11 ejecutado.

### `E2E-GLOBAL-02` — Cerrar los falsos verdes de configuración *(02A config-only → 02B ci-only)*

- **Objetivo:** `forbidOnly`, `failOnFlakyTests`, `trace`, `screenshot`, upload de `test-results/`.
- **Problema:** P0-3, P1-1, P1-3 / R-04, R-05, R-07.
- **PR 02A — config-only:** `frontend/playwright.config.ts` — `forbidOnly`, `failOnFlakyTests`, `trace`, `screenshot`.
- **PR 02B — ci-only:** `.github/workflows/frontend-ci.yml` — upload de `test-results/` del gate required.
- **No-scope:** specs, catálogo, fixture.
- **Dependencias:** ninguna (paralelizable con 01).
- **Riesgo:** bajo — `failOnFlakyTests: true` puede poner en rojo `E2E Completeness` por el flaky conocido; **es el resultado deseado** y debe anunciarse.
- **Tests:** `frontend-playwright-production-runner.test.ts`, `frontend-ci-workflow.test.ts`.
- **Aceptación:** un `.only` hace fallar `e2e:ci`; un fallo produce `trace.zip` en el artifact del gate required.

### `E2E-GLOBAL-03` — Frontera de auth simulada y señal 401/403 *(test-only, alto valor)*

- **Objetivo:** el fixture modela sesión con estado y emite 401/403; 3 specs nuevos de frontera en `smoke`.
- **Problema:** P0-1 / R-01 — mitigación parcial; no cierra la frontera autoritativa.
- **Scope:** `frontend/e2e/fixtures/admin-populated-api-server.mjs`, `frontend/e2e/platform/auth/**`, `catalog.ts`, guard de catálogo.
- **No-scope:** `frontend/src/**`, `server/**`, arranque del backend real.
- **Fase 03B obligatoria para cerrar P0-1/R-01:** smoke separado contra Fastify real + Postgres. Hasta entonces el riesgo de auth autoritativa permanece abierto.
- **Dependencias:** 01 (para poder validar en `full`).
- **Riesgo:** **medio-alto** — tocar el fixture es `SHARED_E2E_PREFIXES`; hay que verificar que las 23 specs consumidoras sigan recibiendo payloads idénticos. La técnica ya está probada en el repo: las variantes A03 y long-text son estrictamente conjuntivas por esa misma razón.
- **Gates:** `e2e:ci`, `e2e:full`, `pnpm test`.
- **Aceptación:** eliminar la validación de sesión del fixture hace fallar ≥1 test; una sesión de clínica sobre `/dashboard/admin` es rechazada por un test.

### `E2E-GLOBAL-04` — Honestidad de nombres y clasificación *(test-only, barato)*

- **Objetivo:** renombrar el `describe` de logout; corregir `feature` de `dashboard-auth-redirect`; mover el test de `nextConfig.headers()` a `test/unit/infrastructure/`; añadir `layer` y `proves` al catálogo.
- **Problema:** P1-4, P2-8 / R-10.
- **Riesgo:** bajo. **Alto valor por coste.**
- **Aceptación:** ningún `describe` afirma un contrato que su cuerpo no ejerce.

### `E2E-GLOBAL-05` — Reconciliar el bundle y los baselines *(test-only + ci)*

- **Objetivo:** recapturar los 40 baselines bajo `next start`; `e2e:full` pasa a production runner.
- **Problema:** P1-2, P1-6 / R-06, R-09.
- **Dependencias:** 01, 02.
- **Riesgo:** **alto** — 40 PNG cambian a la vez. Exige acta con evidencia (AGENTS.md §11/§17): commit exacto, run, y comparación explícita dev-vs-prod de cada baseline. **No debe hacerse con `--update-snapshots` a ciegas.**
- **Aceptación:** `e2e:full` corre bajo `next start`; el coste de `ci` dentro de `full` baja de 30,0 a ~18,3 min.

### `E2E-GLOBAL-06` — Cerrar la brecha de ejecución de los P1 *(ci-only)*

- **Objetivo:** promover a `ci` los 2 P1 baratos; retirar el path filter de `e2e-completeness.yml`.
- **Problema:** P1-5 / R-08.
- **Dependencias:** 01, 05 (el filtro sólo puede caer cuando el coste sea sostenible).
- **Aceptación:** ningún spec P1 depende del schedule semanal.

### `E2E-GLOBAL-07` — Fuente única del setup de sesión y del origen *(test-only)*

- **Objetivo:** `helpers/session.ts`; eliminar 92 duplicaciones y 88 literales de origen; unificar `e2e_test_*` / `e2e_populated_*`.
- **Problema:** P2-1, P2-5 / R-11, R-17.
- **Riesgo:** medio por volumen (67 archivos), bajo por naturaleza. **Debe ser mecánico y sin cambios de comportamiento**, con conteo verde idéntico como criterio.

### `E2E-GLOBAL-08` — Determinismo residual *(test-only)*

- **Objetivo:** sustituir los 17 `waitForTimeout` y los 3 `setTimeout` crudos por condiciones observables (`waitForLayoutSettled`, `toPass`); retirar los `.catch(() => {})` sobre `networkidle`; reducir los 39 `networkidle`.
- **Problema:** P2-6 / flakiness latente.
- **Ahorro estimado** `[INFERIDO]`: ~12 s por corrida de `full`, y eliminación de 4 falsos negativos identificados.

### `E2E-GLOBAL-09` — Performance de la matriz canónica *(test-only)*

- **Objetivo:** modelo "una navegación → N mediciones" para los 14 consumidores de `dashboard-geometry-matrix`; revisar la cardinalidad de A05 (13 viewports).
- **Problema:** §16.5 / R-15.
- **Riesgo:** **alto** — toca el helper del que dependen 15 specs, incluido A08 (gate required). Requiere fase propia y evidencia de equivalencia de mediciones.
- **Objetivo cuantificado:** reducir el coste de `full` por debajo de 40 min de trabajo (hoy 64,6).

### `E2E-GLOBAL-10` — Limpieza y gobernanza *(test-only)*

- **Objetivo:** decidir sobre `remove-home-unified-workspace-screenshots` (0 assertions); convergencia de tolerancia zero-scroll; assertion de observaciones mínimas por ancla en B04; reconciliación catálogo↔workflow visual; actualización de `CI_PR_CHECKS_RUNBOOK.md`, `SOURCES_OF_TRUTH.md` y los dos audits obsoletos.
- **Problema:** P2-2, P2-3, P2-4, P1-6 (2ª parte), §19 / R-12, R-13, R-14, R-16, R-18.
- **Nota AGENTS.md §4:** el ajuste documental va **separado** del cambio de código.

**Orden mínimo obligatorio:** `01 → 02 → {03, 04}` antes de cualquier campaña estructural. El resto es secuenciable por capacidad.

---

## 25. Bloqueantes antes de continuar desarrollo estructural

`[BLOQUEANTE]` **B-1 · `E2E Completeness` en rojo.** Mientras el paso `Install Playwright system dependencies` falle, el 36 % de los specs y el 44,5 % del coste de la suite no se ejecutan en ninguna parte. Cualquier cambio estructural que toque el dashboard avanzaría sin A02, A03 ni A05. *(E2E-GLOBAL-01)*

`[BLOQUEANTE]` **B-2 · `forbidOnly: false` en el gate required.** Un único `.only` filtrado convierte el gate de merge en un no-gate que reporta SUCCESS. Es una línea de config y no puede quedar abierta durante una campaña de cambios grandes. *(E2E-GLOBAL-02)*

`[BLOQUEANTE]` **B-3 · Cero cobertura de la frontera de auth autoritativa.** Para trabajo estructural que toque sesiones, roles, cookies, `/dashboard/admin` o el portal de particulares, la suite **no da señal**. No es bloqueante para trabajo de layout puro; sí lo es para cualquier fase que roce identidad o autorización. *(E2E-GLOBAL-03)*

`[BLOQUEANTE]` **B-4 · Ausencia de trazas en el gate required.** Sin traza, screenshot ni vídeo, un fallo E2E exclusivo de CI durante una campaña grande se convierte en un ciclo de reintentos a ciegas. Coste de cierre: dos líneas de config. *(E2E-GLOBAL-02)*

**No bloqueante pero condicionante:** los baselines visuales dev-mode (E2E-GLOBAL-05) bloquean cualquier objetivo de reducción del coste de `full`, porque son la razón declarada de que todo el catálogo corra en `next dev`.

---

## 26. Deuda aceptable / DEFER

`[OBSERVADO]` Lo siguiente es deuda **consciente y correctamente gestionada**; no debe entrar en el roadmap de saneamiento:

- **Retención de anclas retiradas** (`horizontal-nav`, `module-rail`) en `DASHBOARD_PERSISTENT_CHROME`: documentada en el propio helper, con motivo explícito (estabilidad de la forma del registro A02). Sólo añadir la detección por ancla (E2E-GLOBAL-10), no eliminarlas.
- **Skip declarado de S7 `clinic-tokens` en B05:** el catálogo documenta la causa exacta (el fixture no implementa `/api/particular-tokens`) y la clasifica como gap pre-B05 fuera de scope. Es un `test.skip` con razón, owner y condición de eliminación. Correcto.
- **`visual-linux` BLOCKED en Windows:** es una decisión de plataforma, no una avería. El preflight con exit 5 y el mensaje explicativo son la implementación correcta.
- **`compare-visual-artifacts.mjs` sin ruta de CI:** herramienta de diagnóstico manual, con su propio contrato. Conservar.
- **Divergencia `retries` 0 (required) vs 2 (completeness):** el diseño es defendible — el gate de merge no perdona, el barrido completo tolera. Lo que hay que cerrar no es la divergencia sino el silencio (`failOnFlakyTests`).
- **Duplicación de guardas de retiro** (`toHaveCount(0)` del rail en 6 specs): es cobertura repetida a propósito por dominio, no copia-pega ocioso.
- **Los 44 `test.setTimeout`:** en `full` hay 4 tests entre 60 y 300 s, todos en A03/A05, todos con causa medida. No son *timeout inflation*: son mediciones caras declaradas.

**DEFER explícito:** `E2E-GLOBAL-09` (performance de la matriz canónica). Es el mayor ahorro posible (~25 min) pero toca el helper del que depende A08, que es gate required. No debe intentarse hasta que 01–06 estén cerrados y la suite tenga trazas para diagnosticar la regresión que un refactor así puede introducir.

---

## 27. Criterios de cierre de esta auditoría (§38)

| # | Verificación | Estado |
|---|---|---|
| 1 | Reconciliación de archivos | ✅ 149 tracked bajo `frontend/e2e/**` = 103 `.ts` + 40 `.png` + 6 `.mjs` |
| 2 | Reconciliación de specs | ✅ 95 en disco = 95 tracked = 95 descubiertos por Playwright |
| 3 | Reconciliación de tests | ✅ 1.322 descubiertos = 1.320 passed + 1 flaky + 1 skipped en el run `34357768243` |
| 4 | Reconciliación de catálogo | ✅ 95 entradas; 0 descubiertos sin catalogar; 0 catalogados sin descubrir; `E2E_MANUAL_ONLY_SPECS = []` |
| 5 | Reconciliación de cohortes | ✅ `ci ∪ extended ∪ evidence ∪ visual-linux = full` (95); las 4 cohortes actuales particionan `ci` (61) sin solapamiento |
| 6 | Reconciliación de CI | ✅ 61 specs / 1.007 tests en el gate required; 34 / 315 fuera, enumerados uno a uno |
| 7 | Ningún spec sin clasificar | ✅ los 95 aparecen en la matriz de §20 con dominio, feature, tipo, tests, fixture, cohorte, criticidad, gate y coste |
| 8 | Cada hallazgo con evidencia | ✅ archivo + línea o run/job de CI en todos los P0/P1/P2; lo no verificable se marcó `[NO CONFIRMADO]` |
| 9 | Ninguna recomendación contradice AGENTS.md | ✅ nada propone subir timeouts, activar retries como parche, serializar para pasar, ni bajar tolerancias; el orden de fases respeta §4 (un scope primario por PR) |
| 10 | Estado del working tree | ✅ `git status --short --untracked-files=all` vacío; HEAD `2683f39a` sin cambios; `frontend/test-results` y `frontend/playwright-report` preexistentes (07-sep, de Nico) **preservados** conforme a §3.3 |
| 11 | Estados canónicos | ✅ ver §28 |

---

## 28. Veredicto final

### Estados canónicos (AGENTS.md §6 y §13)

**Gates de validación:**

| Gate | Estado | Motivo |
|---|---|---|
| `playwright test --list` (descubrimiento) | **PASSED** | exit 0; 95 specs / 1.322 tests |
| `git diff --check` | **PASSED** | árbol limpio, sin cambios |
| `pnpm --dir frontend e2e:ci` | **NOT_RUN** | auditoría de sólo lectura; §7 fija Playwright completo por defecto = 0 y §8 limita tareas pesadas. Evidencia equivalente tomada de runs reales de CI (`34409140069`) |
| `pnpm --dir frontend e2e:full` | **NOT_RUN** | ídem; evidencia de `34357768243` |
| `pnpm --dir frontend e2e:visual-linux` | **BLOCKED** | precondición ausente: plataforma Linux. Los 40 baselines son `-chromium-linux`; `run-cohort.mjs` sale con 5 en win32 |
| `pnpm test` (incluye el guard de catálogo) | **NOT_RUN** | no seleccionado: esta tarea no modifica código |
| `pnpm --dir frontend lint` / `typecheck` / `build` | **NOT_RUN** | ídem |

**Operaciones:** ninguna operación Git/GitHub de escritura fue ejecutada, delegada ni requerida durante la auditoría. Sin `EXECUTED`, sin `PENDING`, sin `[MANUAL-NICO]`, sin `BLOCKED` operativo. Lecturas R0 utilizadas (§5.1): `git status/log/rev-parse/rev-list/branch/ls-files/stash list/worktree list`, `gh run list`, `gh run view [--log|--log-failed|--json]`.

**Documentación (§11):** la auditoría se entregó como respuesta; su persistencia documental en este archivo se realizó posteriormente por pedido explícito de Nico.

**No-alcance declarado:** no se ejecutó ninguna cohorte E2E localmente; no se midió drift geométrico win32 vs linux en A03 (`[NO CONFIRMADO]`); no se auditó `test/**` (32.695 LOC de tests de backend) salvo los guards que gobiernan E2E; no se inspeccionaron `.env` reales; no se modificó nada.

**Riesgos residuales conocidos:** las cifras de duración proceden de dos runs concretos de CI y no de una distribución; la tasa de flaky (1/1.322) es una muestra de un run, no un histórico; el hallazgo A05 `43,188 px` no se reprodujo.

---

### Respuesta a la pregunta obligatoria

> **¿La suite E2E actual de PORTAL-VETNEB constituye una fuente de señal suficientemente confiable para soportar las siguientes etapas de desarrollo estructural, o debe estabilizarse primero?**

# `GO CON CONDICIONES`

**Fundamento.** La suite es **excepcionalmente confiable dentro de su dominio real** — layout, geometría, navegación, densidad adaptativa y zero-scroll del dashboard — y ese dominio está protegido con una resolución que muy pocos productos alcanzan: 273 combinaciones canónicas congeladas a 0 px exactos, gobernanza de catálogo fail-closed dentro de un gate required, 0,076 % de flakiness medida, 96–99 % de eficiencia paralela, cero secretos, cero specs huérfanos, cero snapshots huérfanos.

Y es **estructuralmente incapaz de dar señal fuera de él**: no autentica, no atraviesa el backend, no ejerce autorización, no valida el contrato HTTP real y sólo el 6 % de sus assertions miran contenido. Eso no la invalida: la delimita. El problema no es que la suite mienta — es que su tamaño (42.123 LOC, 0,85:1 contra el producto) y su nomenclatura invitan a leerla como si cubriera más de lo que cubre.

Por eso no es `NO-GO`: la señal que da es real, reproducible y accionable. Y por eso no es `GO` limpio: hay cuatro defectos que hacen que el *propio gate* pueda mentir, y esos sí deben cerrarse antes.

### Condiciones que deben cerrarse primero — en este orden

**Bloqueantes (antes de iniciar cualquier fase estructural):**

1. **`E2E-GLOBAL-01`** — Restaurar `E2E Completeness`. Hoy 34 specs / 315 tests / 5 P1 no se ejecutan en ningún lugar. Un solo archivo de workflow.
2. **`E2E-GLOBAL-02`** — `forbidOnly: !!CI`, `failOnFlakyTests: true`, `trace: "retain-on-failure"`, `screenshot: "only-on-failure"`, subir `test-results/` en el gate required. Dos archivos, ~6 líneas. Cierra los dos modos en que el gate puede reportar verde sin serlo, y el motivo por el que hoy un fallo en CI es indiagnosticable.

**Bloqueante condicional (sólo si la fase estructural toca identidad):**

3. **`E2E-GLOBAL-03`** — Frontera de auth real en el fixture (401/403 + estado de sesión) y 3 specs de frontera en `smoke`. Si la próxima etapa es exclusivamente layout/dashboard, esto puede correr en paralelo; si toca sesiones, roles, cookies o el portal de particulares, es **previo e ineludible**.

**Recomendado en el mismo tramo (coste trivial, valor alto):**

4. **`E2E-GLOBAL-04`** — Honestidad de nombres: renombrar `"dashboard logout — server session invalidation"`, corregir la `feature` de `dashboard-auth-redirect`, mover el test de `nextConfig.headers()` fuera del gate de browser, y añadir `layer` + `proves` al catálogo. Es lo que impide que la próxima persona — o el próximo agente — vuelva a leer cobertura donde no la hay.

Cerradas 1, 2 y 4 —y 3 si el scope lo exige— la afirmación **"si un E2E falla, ese fallo representa una señal real, reproducible, clasificable y accionable"** pasa a ser cierta para todo lo que la suite efectivamente cubre, y las fronteras de lo que no cubre quedan declaradas en el propio catálogo en lugar de inferirse leyendo 1.194 líneas de fixture.

---

## Anexo A — Estado documental de `LIMPIEZA E2E`

| Campo | Valor |
|---|---|
| HEAD auditado | `2683f39ab865d0c3cfcf26c2489a801115b58320` |
| Rama | `main` |
| Fecha del HEAD | 2026-09-09 17:10:21 -0300 |
| Working tree en el momento de la auditoría | limpio (`git status --short --untracked-files=all` vacío) |
| Runs de CI usados como evidencia | `34409140069` (Frontend CI, verde, `next start`) · `34357768243` (E2E Completeness, verde, `next dev`) · `34385169532`, `34365419421`, `34379465111`, `34409140047` (E2E Completeness, rojos por `install-deps`) |
| Implementación derivada | **ninguna ejecutada** |
| Naturaleza de este documento | fuente rectora de la campaña `LIMPIEZA E2E`; no autoriza por sí mismo ninguna operación R2/R3 |
| Autorización requerida para cada fase | explícita y por fase, conforme a AGENTS.md §3.2 |

**Fin del documento.**
