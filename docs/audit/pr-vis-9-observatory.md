# PR-VIS-9 observatory report

> **Tipo:** Observatorio / definición de alcance docs-only. **NO** implementa.
> **PR:** PR-VIS-9 / Fase 2 (F2), lote 2 (blindaje del pipeline).
> **Hallazgos rectores:** VIS-P0-002 (core), VIS-P2-005 (viewports), VIS-P2-010 (estados extremos).
> **Gate objetivo:** Gate 6 — Visual regression baseline (también alimenta Gate 3).
> **Naturaleza:** Este documento sólo audita y define alcance. No toca frontend, backend, API, auth, DB, migraciones, tests, dependencias, lockfiles, CI/workflows, Playwright, CSS, tokens ni componentes. Subordinado a los tres rectores (`total-visual-engineering-audit.md`, `total-software-engineering-audit.md`, `total-engineering-roadmap.md`) y al contrato `design-system-contract.md` (PR-VIS-0).

---

## 0. Confirmación de base

- Rama actual: `chore/pr-vis-9-visual-baseline-observatory` (correcta).
- `git status --short --untracked-files=all`: limpio antes de crear este archivo.
- HEAD: `ad57a84 test(frontend): add axe accessibility checks for key routes (#1204)` (esperado).
- `git diff --stat`: vacío antes de crear este archivo.
- Bloque visual cerrado verificado: PR-VIS-0..8 = `#1196..#1204` presentes en el log y en docs.

---

## 1. Scope documental detectado

PR-VIS-9 es el PR de **regresión visual** del roadmap. Su definición es explícita y consistente en los tres documentos rectores. No es interpretación: es un contrato ya escrito.

**Definición canónica (roadmap §matriz, fila 19):**

> PR-VIS-9 · Regresión visual: **baselines + viewports + fixtures estrés** · VIS · VIS-P0-002, VIS-P2-005, VIS-P2-010 · F2 · `test+CI` · **⚠ CI (baselines)** · Riesgo **Medio (flake)** · validación `toHaveScreenshot` + job separado · aceptación: **Baselines estables; diff>threshold bloquea P0/P1**.

**Definición §28 (backlog autorización):**

> Regresión visual `toHaveScreenshot` (**baseline público primero**) + viewports **320/768/1024/1536/1920** + fixtures estrés.

**Definición §16.1 (matriz de ejecución):**

> Scope `test+CI`; autorización **⚠ CI (baselines)**; tests `toHaveScreenshot` + job separado; aceptación "**Baselines estables (públicas primero); diff>threshold bloquea P0/P1**"; rollback "**Borrar baselines + job**".

El PR descompone en **tres sub-objetivos** atados 1:1 a tres hallazgos:

| Sub-objetivo | Hallazgo | Severidad | Qué pide | Esfuerzo / riesgo |
| --- | --- | --- | --- | --- |
| A. Baselines de apariencia | **VIS-P0-002** | P0 (proceso) | `toHaveScreenshot` con baselines estables (animaciones off, datos fixture) en rutas/módulos clave; gate de merge | M-L · Medio (flake) |
| B. Cobertura responsive extrema | **VIS-P2-005** | P2 | Sumar viewports **320 / 768 / 1024 / 1536 / 1920** al smoke visual | S · Bajo |
| C. Estados extremos / estrés | **VIS-P2-010** | P2 | Fixtures de estrés (datos largos / N filas / error API) + capturas en regresión | M · Bajo-Medio (flake) |

---

## 2. Evidencia documental exacta encontrada

- `docs/audit/total-engineering-roadmap.md`
  - Fila 19: contrato PR-VIS-9 (citado arriba).
  - §28: "baseline público primero" + viewports `320/768/1024/1536/1920` + fixtures estrés.
  - Línea 251 (backlog autorización): idéntica definición.
  - §29 (Authorization Matrix): **`PR-VIS-9 | Requires authorization (⚠ CI)`**.
  - Gate 3 ("CI/test hardening active") y Gate 6 lógico dependen de PR-VIS-9.
  - Precedencia **dura**: PR-VIS-9 habilita "cambios globales de CSS (PR-VIS-CSS-1)"; `PR-VIS-CSS-1 | Deferred (post-baseline PR-VIS-9)`.
  - Coordinación: PR-VIS-9 (regresión) ≠ PR-VIS-10 (cross-browser, WebKit/Firefox) ≠ PR-E2E-1 (prod-mode `next start`). Son raíces distintas; no fusionar.
- `docs/audit/total-visual-engineering-audit.md`
  - Auditoría 7 (Visual Regression Testing): "**0** baselines PNG, **0** `toHaveScreenshot`"; los `page.screenshot()` son evidencia o validación de bytes; severidad **P0** (VIS-P0-002).
  - §6 P0 Findings — VIS-P0-002: "`0` PNG commiteados, `0` `toHaveScreenshot`; `visual-smoke` valida bytes, no apariencia". Recomendación: "Introducir `toHaveScreenshot` con baselines estables (animaciones desactivadas, datos fixture) para rutas/módulos clave; gate de merge".
  - §8 P2 — VIS-P2-005: "Sin 320/1536/1920; tablet 768/1024 mínima → sumar 320, 768, 1024, 1536, 1920 al smoke visual".
  - §8 P2 — VIS-P2-010: "Sin matriz visual de datos largos/N filas/error API → Fixtures de estrés + capturas en regresión visual".
  - §16.1 fila PR-VIS-9: aceptación "Baselines estables (públicas primero); diff>threshold bloquea P0/P1"; rollback "Borrar baselines + job".
  - Reglas de ejecución (§"Do/Reglas"): "No activar reglas CI visuales sin **baseline estable**"; "No cambiar **CSS global amplio** sin screenshots/control de regresión"; "No mover CSS global amplio sin PR-VIS-9".
- `docs/audit/design-system-contract.md` (PR-VIS-0): "No cambios globales de CSS antes de **baseline/regresión** cuando aplique" → PR-VIS-9 es la red que ese contrato presupone.
- `docs/audit/pr-vis-8-implementation.md` (precedente directo): patrón de implementación por Codex; **VIS-8 sí agregó dependencia** (`@axe-core/playwright` → `frontend/package.json` + `pnpm-lock.yaml`) y **explícitamente dejó CI fuera de scope** ("No se agregó gate CI porque CI/workflows quedó fuera de scope").

---

## 3. Estado real del entorno (verificado en repo, no sólo documental)

| Comprobación | Resultado | Implicación para PR-VIS-9 |
| --- | --- | --- |
| `toHaveScreenshot` / `toMatchSnapshot` en `frontend/` | **0 ocurrencias** | Confirma VIS-P0-002; punto de partida limpio. |
| Directorios `*-snapshots/` | **0** | No hay baselines previos que migrar. |
| PNG versionados en `frontend/` | **8**, todos assets (`public/icons/*`, `og-vetneb.png`); **0 baselines** | Cualquier PNG de baseline será nuevo y revisable. |
| `frontend/playwright.config.ts` | **1 solo proyecto `chromium`**; `webServer` = mock API (`admin-populated-api-server.mjs`, :3107) + `pnpm dev` (:3000) | Baselines nacerían **Chromium-only** y contra **`next dev`** (no `next start`). |
| `frontend/e2e/visual-smoke.spec.ts` | Screenshot de **5 rutas × 2 viewports** (desktop 1440×1000, mobile 390×844) con animaciones desactivadas, pero **sólo valida bytes** (magic number PNG + longitud) | **Punto de extensión natural** de `toHaveScreenshot`. La mecánica (disable animations, fullPage) ya existe. |
| Auth en e2e | `accessibility-axe-key-routes.spec.ts` ya autentica con **cookies** `admin_session_id=e2e_populated_admin_session` / `app_session_id=e2e_populated_clinic_session` vía `applySession()`, y renderiza hubs poblados (`[data-dashboard-module-hub="true"]`) | **La infraestructura de baselines autenticados YA EXISTE y está probada.** No hace falta crear auth/storageState nuevo. |
| Mock API poblado | `frontend/e2e/fixtures/admin-populated-api-server.mjs` sirve datos de admin/clínica deterministas | Habilita baselines autenticados deterministas; base para fixtures de estrés (sub-objetivo C). |
| `.gitignore` | Ignora `test-results/` y `playwright-report/`; **NO** ignora `*-snapshots/` | Los baselines `toHaveScreenshot` **se commitearían** (comportamiento correcto y esperado). |
| `.github/workflows/frontend-ci.yml` | 4 capas e2e (`e2e:smoke`, `e2e:admin-mobile`, `e2e:visual-contract`, `e2e:public-clinic`), **Chromium-only**, `ubuntu-latest` | **No existe job de regresión visual.** Baselines deberían generarse para **Linux** (plataforma CI), no Windows local. |

---

## 4. Superficies candidatas

Por valor/riesgo y por el mandato "**público primero**":

1. **Público** (sin auth, menor flake) — prioridad 1. Es lo que el roadmap llama "baseline público primero".
2. **Autenticado clínica** (`/dashboard`) — prioridad 2. Cookie `app_session_id` + mock poblado (patrón ya probado por VIS-8).
3. **Autenticado admin** (`/dashboard/admin`) — prioridad 2. Cookie `admin_session_id` + mock poblado.
4. **Estados extremos / estrés** (datos largos, N filas, error API) — prioridad 3 (sub-objetivo C, el más pesado y flake-prone).

No-superficie en este PR: cross-browser WebKit/Firefox (es **PR-VIS-10**), prod-mode `next start` (es **PR-E2E-1**), CWV/Lighthouse (es **PR-VIS-11**).

---

## 5. Rutas candidatas

Heredadas de `visual-smoke.spec.ts` + rutas autenticadas ya probadas por el spec axe:

- Público: `/`, `/contacto`, `/particulares`, `/login` (y opcional `/clinicas`, `/precios` si se quiere cubrir landing comercial).
- Autenticado: `/dashboard` (hub clínica), `/dashboard/admin` (hub admin).
- Estrés (sub-objetivo C): mismas rutas autenticadas con el mock sirviendo estados extremos (no rutas nuevas; mismos paths, datos distintos).

> El alcance exacto de rutas debe acotarse en el PR para no inflar el repo con PNGs (ver Riesgos §11).

---

## 6. Viewports candidatos

Contrato VIS-P2-005 (explícito): **320, 768, 1024, 1536, 1920**.
Estado actual del smoke visual: sólo **1440** (desktop) y **390** (mobile).

Matriz candidata (a confirmar en el PR para controlar peso): los 5 de VIS-P2-005 como base, conservando 390 como mobile real representativo. Combinatoria rutas × viewports × superficies es el principal driver de peso del repo y de tiempo CI → debe acotarse, no maximizarse.

---

## 7. ¿Hay screenshots / baselines existentes?

- **Baselines de regresión:** **NO.** 0 directorios `*-snapshots/`, 0 `toHaveScreenshot`, 0 PNG de baseline versionados.
- **Screenshots de evidencia:** sí, pero son **otra cosa**: `page.screenshot()` que escribe a `docs/audit/evidence/*` / `test-results/` como evidencia o validación de bytes, no como baseline comparativo. `visual-smoke.spec.ts` toma fullPage screenshot pero sólo verifica magic-number + longitud.
- Conclusión: PR-VIS-9 parte de cero en baselines. No hay migración; hay creación.

---

## 8. ¿Hay CI visual existente?

- **NO** hay job de regresión visual. `frontend-ci.yml` corre 4 capas e2e en Chromium sobre `ubuntu-latest`, sin `toHaveScreenshot` ni comparación de snapshots.
- Implicación crítica: los baselines `toHaveScreenshot` son **específicos de plataforma/navegador** (sufijo tipo `...-chromium-linux.png` vs `-win32.png`). Generados en **Windows local** NO coinciden con el render de **Linux CI** (hinting/antialias de fuentes difiere). Para que el gate sea autoritativo, los baselines deben generarse **para Linux** (contenedor Linux o el propio runner), no desde la máquina de Nico.

---

## 9. ¿PR-VIS-9 requiere dependencias / lockfile?

**NO.** Hallazgo de des-riesgo clave:

- `toHaveScreenshot` es **nativo de `@playwright/test`**, que **ya está instalado** (lo usan los 50+ specs e2e actuales).
- A diferencia de **PR-VIS-8**, que sí necesitó `@axe-core/playwright` (tocó `frontend/package.json` + `pnpm-lock.yaml`), **PR-VIS-9 no introduce ninguna dependencia nueva**.
- Por tanto **no hay autorización de deps/lockfile** requerida para el core. (Opcional y sin dep: un script npm `e2e:visual` en `frontend/package.json`, que es edición de scripts, no de dependencias.)

---

## 10. ¿PR-VIS-9 requiere CI / workflows?

**SÍ — y aquí está la única autorización dura.** Dos dimensiones, ambas marcadas **⚠ CI (baselines)** en §29:

1. **Artefactos de baseline en el repo:** commitear PNGs de baseline (específicos de Linux). Es modificación del contenido versionado del repo a partir de generación en CI/contenedor.
2. **Gate / job de regresión:** un job (nuevo o dentro de `frontend-ci.yml`) que ejecute `toHaveScreenshot` y bloquee con `diff > threshold`. El roadmap pide **"job separado"** y **"baseline estable antes de activar el gate"**.

> El protocolo de esta sesión prohíbe tocar CI/workflows. Por lo tanto **la parte 1 y 2 NO pueden ejecutarse sin autorización explícita de Nico** y quedan fuera de esta fase observatorio.

---

## 11. ¿PR-VIS-9 requiere cambios visuales?

**NO.** Es un PR de **test + infraestructura**. Captura la apariencia **actual** como baseline; no cambia tokens, CSS, componentes ni copy. Es "sin cambio visual" por definición.

- Salvedad: si al **revisar** los baselines generados se descubre un defecto visual real, **no se corrige aquí** — se registra como hallazgo separado (no ampliar scope). El PR sólo congela el estado actual como referencia.

---

## 12. Riesgos

| # | Riesgo | Severidad | Mitigación |
| --- | --- | --- | --- |
| R1 | **Flake** (roadmap lo tipifica "Medio (flake)"): fuentes, animaciones, datos dinámicos, timestamps, caret/cursor, scrollbars, hidratación | Alta | `animations:"disabled"`, `prefers-reduced-motion`, datos fixture deterministas, ocultar elementos volátiles, `maxDiffPixelRatio`/threshold calibrado, re-correr 2× para confirmar diff cero. |
| R2 | **Baselines OS/navegador-específicos**: Windows local ≠ Linux CI | Alta | Generar baselines en/para Linux (contenedor `mcr.microsoft.com/playwright` o el runner). **No** commitear baselines `-win32`. |
| R3 | **Sub-objetivo C (estrés)**: requiere extender `admin-populated-api-server.mjs` con estados extremos → la pieza más pesada y flake-prone | Media | Diferir C a un PR/lote propio (el roadmap empareja VIS-P2-010 también con PR-QA-PROD-1, F7). Empezar por A+B. |
| R4 | **`next dev` vs `next start`**: baselines contra dev server pueden divergir de prod (overlays, no minificado) | Media | Aceptable para baseline interno; coordinar con **PR-E2E-1** (prod-mode) para no duplicar. Documentar que el baseline es dev-mode. |
| R5 | **Peso del repo / tiempo CI**: rutas × viewports × superficies infla PNGs y minutos CI | Media | Acotar la matriz (no maximizar); empezar con público + 5 viewports; expandir por evidencia. |
| R6 | **Gate prematuro**: activar bloqueo antes de baselines estables genera ruido y rojos falsos | Media | Regla §6 rectora: "no activar reglas CI visuales sin baseline estable". Generar y estabilizar **antes** de hacer el job bloqueante. |
| R7 | **Determinismo del mock**: baselines autenticados dependen de que el mock no varíe (sin random/timestamps) | Baja-Media | Verificar que `admin-populated-api-server.mjs` sirve datos fijos; fijar fechas/orden. |

---

## 13. Autorizaciones requeridas

| Concepto | ¿Autorización? | Detalle |
| --- | --- | --- |
| Dependencias / lockfile | **NO** | `toHaveScreenshot` nativo; sin dep nueva (ver §9). |
| Cambios visuales / UI / tokens / CSS | **NO** | El PR no cambia apariencia (ver §11). |
| Auth / storageState nuevo | **NO** | Patrón cookie ya existe y está probado (ver §3). |
| **Commit de baselines PNG (Linux)** | **SÍ — ⚠ CI (baselines)** | Artefactos versionados generados en CI/contenedor. |
| **Job / gate de regresión en `.github/workflows/`** | **SÍ — ⚠ CI (baselines)** | `frontend-ci.yml` o workflow nuevo; "job separado"; bloqueo por threshold. |
| Extender mock para estrés (sub-objetivo C) | **Recomendado separar** | Test-fixture; mayor flake; mejor en PR/lote propio. |

**Resumen:** PR-VIS-9 está marcado en §29 como **`Requires authorization (⚠ CI)`**. La autorización es **sólo por la dimensión CI/baselines**, no por deps ni por UI. Coincide con que VIS-8 dejó CI fuera de scope: el gate CI **no se había introducido todavía** y aterriza aquí.

---

## 14. Recomendación de implementación

### 14.1 Estrategia de alcance (recomendada): partir en capas

- **VIS-9a — público + viewports (menor riesgo, primero):** `toHaveScreenshot` sobre rutas públicas (`/`, `/contacto`, `/particulares`, `/login`) en viewports `320/768/1024/1536/1920` (+390 mobile), animaciones off. Cierra VIS-P0-002 (baseline público) + VIS-P2-005. **Sin auth, sin estrés, sin dep.**
- **VIS-9b — autenticado:** añadir `/dashboard` (clínica) y `/dashboard/admin` reusando el patrón `applySession` (cookies) + mock poblado. Determinista, infraestructura ya existente.
- **VIS-9c — estrés (VIS-P2-010):** fixtures de datos largos / N filas / error API extendiendo el mock. **El más pesado/flake** → candidato a PR/lote propio o a F7 con PR-QA-PROD-1.

> El **gate CI bloqueante** se activa **después** de que los baselines de 9a (y opcionalmente 9b) estén estables (regla §6). Generación de baselines y activación del gate pueden separarse en dos pasos del mismo PR o en dos PRs.

### 14.2 ¿Codex o Claude?

- **Implementación mecánica (spec + config + scripts + generación de baselines): Codex**, consistente con el patrón de PR-VIS-5..8 (Codex implementa; Nico hace Git).
- **Revisión de baselines + calibración de threshold/flake + diseño del gate CISeparado: requiere criterio** → conviene revisión de Claude/Nico sobre el resultado, especialmente R1/R2/R6.

### 14.3 Nivel de razonamiento recomendado

**MEDIO-ALTO.**

- Por encima de PR-VIS-8 (que fue MEDIO) porque suma: estabilidad/flake de baselines, generación específica de plataforma (Linux), política de threshold y **diseño de gate CI** (decisión de proceso reversible pero sensible).
- Sube a **ALTO** si se incluye el sub-objetivo C (estrés) en el mismo PR.
- Para sólo VIS-9a (público + viewports, sin gate bloqueante todavía): **MEDIO** es suficiente.

### 14.4 Archivos candidatos (para el PR, NO para esta fase)

| Archivo | Acción | Autorización |
| --- | --- | --- |
| `frontend/e2e/visual-smoke.spec.ts` **o** nuevo `frontend/e2e/visual-regression.spec.ts` | Añadir `toHaveScreenshot` + matriz de viewports | frontend/test (no) |
| `frontend/e2e/__screenshots__/` o `*-snapshots/` (PNG generados) | Crear baselines (Linux) | **⚠ CI (baselines)** |
| `frontend/playwright.config.ts` | Opcional: `expect.toHaveScreenshot` (threshold, `maxDiffPixelRatio`, `animations:"disabled"`) | frontend/test (no) |
| `frontend/package.json` | Opcional: script `e2e:visual` / helper `--update-snapshots` (**sin dep**) | frontend (no) |
| `frontend/e2e/fixtures/admin-populated-api-server.mjs` | Sólo si VIS-9c: estados de estrés | test-fixture (separar) |
| `.github/workflows/frontend-ci.yml` (o workflow nuevo) | Job/gate de regresión visual | **⚠ CI** |
| `docs/audit/pr-vis-9-implementation.md` | Reporte (precedente PR-VIS-5..8) | docs (no) |

### 14.5 Validaciones candidatas (para el PR)

- `pnpm --dir frontend exec playwright test <spec visual> --update-snapshots` (generación inicial, en Linux/contenedor).
- `pnpm --dir frontend exec playwright test <spec visual>` ejecutado **2×** → diff cero (verificación anti-flake).
- `pnpm --dir frontend lint` · `typecheck` · `build`.
- `pnpm test` · `pnpm build` · `pnpm security:public-surface`.
- `git diff --check`; revisión visual manual de cada baseline antes de aceptarlo.

---

## 15. Confirmación de exclusiones (esta fase observatorio)

En esta fase **no se modificó**: backend, API, auth, DB, migraciones, dependencias, `package.json`, lockfiles, CI/workflows, Playwright config, código fuente de la app, CSS, tokens, componentes, copy de UI ni ningún test.
**No se ejecutó:** `git add`, `git commit`, `git push`, creación/merge de PR, `pnpm install/add/test/build`, `playwright test` ni ningún comando que genere screenshots/baselines.
**Único cambio en disco:** creación de `docs/audit/pr-vis-9-observatory.md` (este archivo).
Conteos de auditorías rectoras intactos (2 P0 · 8 P1 · 10 P2 · 6 P3 = 26 VIS). No se introdujo auditoría nueva ni se re-derivaron hallazgos.

---

## 16. Estado final

PR-VIS-9 queda definido como PR de **regresión visual `toHaveScreenshot`** (VIS-P0-002 + VIS-P2-005 + VIS-P2-010), **sin dependencias nuevas**, **sin cambios visuales**, con la única autorización dura en **CI/baselines (⚠)**. Recomendación: **Codex**, **razonamiento MEDIO-ALTO**, partido en capas **9a (público+viewports) → 9b (autenticado) → 9c (estrés, separable)**, activando el gate CI **sólo tras baselines estables**.
