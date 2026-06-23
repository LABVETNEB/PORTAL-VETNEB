# E2E CI Layering Strategy — Audit

> Documento de auditoría **docs-only** (PR-C / PR-C1). **No modifica** código productivo,
> `frontend/src`, specs, helpers, fixtures, `.github/workflows`, `package.json`,
> `frontend/package.json`, `pnpm-lock.yaml`, Playwright config, backend, API, auth, DB, migrations,
> deps, lockfiles, screenshots ni CI. Solo audita el estado actual y propone una estrategia de
> capas para PRs posteriores, sin implementarla.

## 1. Resumen ejecutivo

**Estado actual de la suite E2E.** El frontend tiene **42 specs Playwright** en `frontend/e2e/`
que cubren público, clínica, admin (desktop y mobile-densa) y contratos de layout no-scroll del
dashboard. CI ejecuta **toda** la suite en un **único step** (`pnpm --dir frontend e2e` →
`playwright test` sin filtros), dentro del job `validate-frontend` de
`.github/workflows/frontend-ci.yml`. El step está **etiquetado "Run frontend E2E smoke tests"**,
pero **no es smoke**: corre la regresión completa (smoke + admin-mobile densa + contratos de
layout + público/clínica pesado) en un solo bloque, con un solo project `chromium`,
`fullyParallel: true`, sin `grep`, sin `projects` de capa y sin tags.

**Problema principal.** Hay **un único nivel de ejecución** ("todo o nada"). Specs **smoke de
1 test** (p. ej. `dashboard-auth-redirect`) conviven en el mismo bloque indivisible con specs
**pesadas de 27–75 tests** (`dashboard-card-navigation-shell` = 75, `public-clinics-b2b-operations`
= 32, `public-report-preview` = 31, `public-service-bento-specimen-journey` = 27). No hay forma de
correr solo smoke para feedback rápido, ni de aislar la familia admin-mobile, ni de separar los
contratos de layout. El nombre del step ("smoke") **induce a error** sobre lo que realmente corre.

**Por qué NO tocar CI/scripts todavía.** Hoy `full` (toda la suite) **es** el gate de PR y de
push a `main`. Cualquier reparto en capas mal hecho puede **excluir specs silenciosamente** del
check de PR (pérdida de cobertura invisible), **esconder fallos reales** detrás de una capa
demovida a nightly/manual, o **sacar del gate la smoke de seguridad** (`dashboard-auth-redirect`:
privado sin sesión → redirect; admin sin sesión → 404). Además, los bumps **Dependabot** abiertos
(incl. `@playwright/test 1.60→1.61`, `eslint 10`, varios Radix) hoy validan contra la suite
completa; cambiar el gate cambia contra qué se validan esos bumps. **No existe** todavía el mapa
spec→capa **validado** que garantice que la unión de capas == suite completa. Cambiar scripts o
workflows sin ese mapa es prematuro.

**Recomendación de capas futuras.** Diseñar (sin implementar aún) **cinco capas**: `e2e:smoke`
(rápida, bloquea todo PR), `e2e:admin-mobile` (familia admin densa), `e2e:visual-contract`
(contratos estructurales de no-scroll/app-shell del dashboard), `e2e:public-clinic`
(landing público + paridad mobile de clínica) y `e2e:full` (regresión = unión de todo, estado
actual). La separación debe ser **aditiva primero** (scripts que seleccionan subconjuntos por
ruta/`testMatch`, sin tocar specs ni CI), y solo después tocar CI, manteniendo `full` como gate
hasta probar que **la unión de capas reproduce exactamente la cobertura actual**.

> **Dictamen anticipado:** PR-C debe ser **docs-only** (este archivo). El siguiente paso seguro
> es **scripts-only sin tocar CI**. **No** modificar workflows hasta tener el mapa spec→capa
> validado localmente (unión == `full`).

## 2. Base auditada

| Campo | Valor |
| --- | --- |
| Branch de trabajo | `docs/e2e-ci-layering-strategy-audit` |
| Branch base | `main` |
| HEAD (`git log -1 --oneline`) | `a5c736b docs(admin): close mobile e2e helper optimization (#1094)` |
| `origin/main` / `origin/HEAD` | `a5c736b` (idéntico al HEAD local) |
| `git status --short --untracked-files=all` | **limpio** antes de crear este archivo |
| Fecha | 2026-06-23 |
| Plataforma | Windows / PowerShell / PNPM 10.8.1 |
| Worktree | único (`C:/PORTAL-VETNEB`) |

**Open PRs relevantes.** **Solo Dependabot** (#1018–#1038): bumps de deps en raíz y `/frontend`
(Radix UI, `lucide-react`, `@supabase/supabase-js`, `tailwindcss`/`@tailwindcss/postcss`,
`react-hook-form`, `eslint 9→10`, **`@playwright/test 1.60→1.61`**). **Ninguna** PR funcional del
bloque previo queda abierta. El bloque *Admin Mobile E2E Helper Optimization* (#1089→#1094) ya
está cerrado y mergeado en `main` (ver `docs/audit/admin-mobile-e2e-helper-optimization-closeout.md`),
y dejó explícitamente trazado **este** PR-C como próximo paso.

## 3. Inventario actual de CI y scripts

| Archivo | Comando / script / workflow | Qué ejecuta | Alcance real | Riesgo |
| --- | --- | --- | --- | --- |
| `.github/workflows/frontend-ci.yml` (job `validate-frontend`) | step `Run frontend E2E smoke tests`: `pnpm --dir frontend e2e` | `playwright test` (toda la suite, 42 specs) | **Regresión completa**, no smoke. Único gate E2E de PR/push a `main` | **Alto**: nombre engañoso ("smoke") vs. ejecución total; tiempo de CI dominado por specs pesadas; cualquier flake de cualquier spec rojea el único check E2E |
| `.github/workflows/frontend-ci.yml` | trigger `paths: frontend/**, pnpm-lock.yaml, pnpm-workspace.yaml, package.json, .github/workflows/frontend-ci.yml` | corre solo si el PR toca esas rutas | Un PR **docs-only bajo `docs/`** **no** dispara frontend-ci | **Medio**: este PR-C (solo `docs/`) **no** ejecuta la suite E2E; sí ejecuta `backend-ci` (sin `paths`) |
| `.github/workflows/frontend-ci.yml` | steps previos: `lint`, `typecheck`, `build`, `security:public-surface`, `playwright install --with-deps chromium` | gates de calidad + auditoría de superficie pública + browsers | Pre-requisitos del E2E | **Bajo**: ortogonales a la separación de capas; deben preservarse |
| `.github/workflows/backend-ci.yml` (job `validate-backend`) | `pnpm audit`, `db:migrate`, `typecheck`, `typecheck:test`, `test`, `build` (Postgres service) | backend: sin E2E Playwright | Gate de PR backend; **se dispara en todo PR a `main`** (sin `paths`) | **Bajo** para E2E (no corre Playwright); relevante porque **sí** corre en este PR docs-only |
| `package.json` (raíz) | `test`, `validate:local`, `smoke:*`, `security:public-surface`, `schema:verify` | backend/node `--test` + smokes de prod/staging (PowerShell/mjs) | No incluye E2E frontend | **Bajo**: fuera del alcance de capas E2E; `smoke:*` aquí son smokes HTTP de prod/staging, **no** Playwright |
| `frontend/package.json` | `"e2e": "playwright test"` | toda la suite | **Único** entrypoint E2E; sin capas | **Alto**: no hay `e2e:smoke` / `e2e:admin-mobile` / `e2e:visual-contract` / `e2e:public-clinic` / `e2e:full`. La capa = inexistente |
| `frontend/package.json` | `"e2e:ui": "playwright test --ui"`, `"e2e:report": "playwright show-report"` | runner UI / visor de reporte | Dev local | **Bajo**: utilidades dev, no afectan CI |
| `frontend/playwright.config.ts` | `testDir: ./e2e`, `timeout 30s`, `expect 5s`, `fullyParallel: true`, `reporter: [list, html]`, `trace: on-first-retry`, `projects: [chromium]` | un solo project, paralelo, sin grep/tags/`testMatch` de capa | Determina que **no** hay segmentación nativa | **Medio**: sin `projects`/`grep` de capa, separar requiere scripts por ruta o nuevos `projects`/`testMatch` |
| `frontend/playwright.config.ts` (`webServer`) | (1) `node e2e/fixtures/admin-populated-api-server.mjs` (`:3107/__e2e/health`); (2) `pnpm dev --hostname 127.0.0.1` con `NEXT_PUBLIC_API_URL` al mock | **toda** corrida E2E levanta el fixture API mock + `next dev` | Infra compartida por todos los specs; `reuseExistingServer: !CI` | **Medio**: `next dev` reescribe `frontend/next-env.d.ts` (ensucia el árbol); arranque de `next dev` ~120s domina el costo de cada job que lo levante |

**Notas de costo/arranque.** En CI cada job que ejecute Playwright debe: `pnpm install`,
`playwright install chromium`, levantar fixture mock + `next dev` (timeout config 120s) y luego
correr specs. **Multiplicar jobs multiplica ese arranque fijo**; conviene que la ganancia de
paralelizar capas supere el costo de N arranques de `next dev`.

## 4. Inventario de specs E2E

> `tests` = ocurrencias estáticas de `test(`/`test.describe(` por archivo (los specs con bucles
> `for (viewport …)` o `for (route …)` generan **más** tests en runtime que el conteo estático;
> marcados con `×loop`). `screenshot` = usa `page.screenshot(...)` de **evidencia** (no hay
> `toHaveScreenshot`/`toMatchSnapshot` versionados en ninguna spec).

| Spec | Categoría propuesta | Superficie | Screenshots | Ámbito | Criticidad | Costo CI | Riesgo flake |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `visual-smoke.spec.ts` | smoke | rutas públicas + `/dashboard` (200 + render PNG sanity) | sí (sanity bytes, no baseline) | global (desktop+mobile ×loop) | **alta** | bajo | bajo |
| `public-routes.spec.ts` | smoke | rutas públicas resuelven | no | public (incl. mobile vp) | **alta** | bajo | bajo |
| `dashboard-auth-redirect.spec.ts` | smoke | privado sin sesión → redirect; admin sin sesión → 404 | no | global (seguridad) | **crítica** | bajo | bajo |
| `login-hydration.spec.ts` | smoke | hidratación `/login` | no | public | media | bajo | bajo |
| `contacto-hydration.spec.ts` | smoke | hidratación `/contacto` | no | public | media | bajo | bajo |
| `theme-mode.spec.ts` | smoke | toggle de tema light/dark | no | global | media | bajo | bajo |
| `dashboard-interaction-foundation.spec.ts` | smoke | fundamentos de interacción dashboard (PR-1) | no | dashboard | media | medio | medio |
| `admin-mobile-app-shell-absolute-no-scroll.spec.ts` | admin-mobile | app-shell admin mobile no-scroll | no | admin/mobile | alta | medio | medio |
| `admin-mobile-bottom-navigation-no-scroll.spec.ts` | admin-mobile | bottom-nav admin mobile no-scroll | no | admin/mobile | alta | medio | medio |
| `admin-mobile-core-modules-no-scroll.spec.ts` | admin-mobile | familia core no-scroll | no | admin/mobile | alta | medio | medio |
| `admin-mobile-ops-modules-no-scroll.spec.ts` | admin-mobile | familia ops no-scroll | no | admin/mobile | alta | medio | medio |
| `admin-mobile-status-modules-no-scroll.spec.ts` | admin-mobile | familia status no-scroll (light/dark) | sí (evidencia) | admin/mobile | alta | alto | medio |
| `admin-mobile-config-modules-no-scroll.spec.ts` | admin-mobile | familia config no-scroll (light/dark) | sí (evidencia) | admin/mobile | alta | alto | medio |
| `admin-mobile-final-polish-no-scroll.spec.ts` | admin-mobile | barrido integral + content-band + clipping | sí (~40 PNG/corrida) | admin/mobile | alta | **alto** | medio |
| `admin-mobile-hub-launcher-no-scroll.spec.ts` | admin-mobile | launcher hub admin mobile | no | admin/mobile | alta | medio | medio |
| `admin-mobile-hub-stale-layer-stage.spec.ts` | admin-mobile | stage de capa stale del hub | sí (evidencia) | admin/mobile | alta | medio | medio |
| `admin-mobile-module-layer-isolation.spec.ts` | admin-mobile | aislamiento de capas de módulo | sí (evidencia) | admin/mobile | alta | alto | medio |
| `admin-clinics-mobile-card-layout.spec.ts` | admin-mobile | layout de tarjetas clínicas (mobile) | no | admin/mobile | alta | medio | medio |
| `admin-tokens-mobile-toolbar-layout.spec.ts` | admin-mobile | toolbar tokens (mobile) | no | admin/mobile | alta | medio | medio |
| `admin-clinic-edit-drawer.spec.ts` | admin-mobile (functional/desktop) | drawer edición clínica + scope guard | no | admin (desktop) | **alta** (operativo) | medio | bajo |
| `dashboard-card-navigation-shell.spec.ts` | visual-contract | navegación por tarjetas / deep-links (admin+clínica) | no | dashboard | alta | **alto** (75 tests) | medio |
| `dashboard-accessibility-keyboard.spec.ts` | visual-contract | a11y teclado dashboard | no | dashboard | alta | alto (20) | medio |
| `dashboard-app-shell-visibility-contract.spec.ts` | visual-contract | contrato de visibilidad app-shell | no | dashboard (desktop+mobile ×loop) | alta | medio | medio |
| `dashboard-real-app-shell-no-scroll-contract.spec.ts` | visual-contract | app-shell real no-scroll | no | dashboard (desktop+mobile ×loop) | alta | medio | medio |
| `dashboard-internal-no-scroll-contract.spec.ts` | visual-contract | no-scroll interno | no | dashboard (desktop+mobile ×loop) | alta | medio | medio |
| `dashboard-single-viewport-app-shell.spec.ts` | visual-contract | app-shell single-viewport | no | dashboard (desktop+mobile ×loop) | alta | medio | medio |
| `dashboard-global-masked-master-detail.spec.ts` | visual-contract | master-detail enmascarado no-scroll | no | dashboard (desktop+mobile ×loop) | alta | medio | medio |
| `dashboard-master-detail-state-polish.spec.ts` | visual-contract | pulido de estado master-detail | no | dashboard | media | medio | medio |
| `dashboard-workspace-layout-polish.spec.ts` | visual-contract | pulido de layout workspace (PR-2) | no | dashboard | media | medio | medio |
| `dashboard-viewport-zoom-adaptability.spec.ts` | visual-contract | adaptabilidad viewport/zoom | no | dashboard (desktop+mobile ×loop) | alta | medio | medio |
| `dashboard-mobile-shell-nav-contract.spec.ts` | visual-contract | shell/nav mobile contract | no | dashboard/mobile (×loop) | alta | medio | medio |
| `public-clinics-b2b-operations.spec.ts` | public/clinic | landing clínicas B2B | no | public | alta | **alto** (32) | medio |
| `public-report-preview.spec.ts` | public/clinic | preview de informe público | no | public | alta | **alto** (31) | medio |
| `public-service-bento-specimen-journey.spec.ts` | public/clinic | bento de servicios + journey | no | public | alta | **alto** (27) | medio |
| `public-pricing-actionable.spec.ts` | public/clinic | precios accionables (PR-11) | no | public | alta | medio (11) | bajo |
| `public-perspective-scroll.spec.ts` | public/clinic | scroll de perspectiva | no | public | media | medio | medio |
| `public-navigation-footer.spec.ts` | public/clinic | navegación + footer | no | public | media | bajo | bajo |
| `home-hero-evidence-first.spec.ts` | public/clinic | hero home evidence-first (PR-10) | no | public | media | medio | bajo |
| `dashboard-clinic-informes-mobile-parity.spec.ts` | public/clinic | paridad mobile informes (clínica) | no | clinic/mobile | alta | bajo | bajo |
| `dashboard-clinic-logistica-mobile-parity.spec.ts` | public/clinic | paridad mobile logística (clínica) | no | clinic/mobile | alta | bajo | bajo |
| `dashboard-clinic-tokens-mobile-parity.spec.ts` | public/clinic | paridad mobile tokens (clínica) | no | clinic/mobile | alta | bajo | bajo |
| `dashboard-clinic-perfil-mobile-operability.spec.ts` | public/clinic | operabilidad perfil mobile (clínica) | no | clinic/mobile | alta | bajo | bajo |

**Infra compartida (no son specs, no clasificar como capa):**

| Archivo | Rol |
| --- | --- |
| `frontend/e2e/helpers/admin-mobile-contracts.ts` (268 líneas) | Helper compartido de la familia admin-mobile (resultado de #1090/#1091/#1093). Import por specs admin-mobile |
| `frontend/e2e/fixtures/admin-populated-api-server.mjs` (521 líneas) | **Fixture API mock** levantado por `webServer` en **toda** corrida. Infra global; tocarlo afecta a todos los specs que consumen datos |

**Categorías presentes:** `smoke` (7), `admin-mobile` (13, incl. `admin-clinic-edit-drawer` como
functional/desktop), `visual-contract` (11, estructural/no-scroll — **no** golden images),
`public/clinic` (11). **No** se detecta `legacy/unclear`: los 42 specs son atribuibles a una
categoría. Total: **42 specs** + 1 helper + 1 fixture.

## 5. Hallazgos principales

1. **CI ejecuta todo en un solo bloque.** El único step E2E corre `playwright test` completo, sin
   `grep`/`projects`/`testMatch` de capa. No hay separación; el único check E2E de PR es "todo o
   nada".
2. **El nombre miente.** El step se llama "Run frontend E2E smoke tests" pero ejecuta la
   **regresión completa** (42 specs). Riesgo de interpretación: parece que CI solo corre smoke.
3. **Specs pesadas mezcladas con smoke.** `dashboard-card-navigation-shell` (75),
   `public-clinics-b2b-operations` (32), `public-report-preview` (31),
   `public-service-bento-specimen-journey` (27) y `dashboard-accessibility-keyboard` (20) corren
   en el **mismo** bloque indivisible que specs smoke de 1 test (`dashboard-auth-redirect`). No hay
   feedback rápido posible.
4. **No hay golden-images / "visual contract" en sentido pixel.** **Ningún** spec usa
   `toHaveScreenshot` ni `toMatchSnapshot`. Las `page.screenshot(...)` (en 6 specs admin-mobile +
   `visual-smoke`) son **evidencia/diagnóstico**, no baseline versionado. Lo que el proyecto llama
   informalmente "visual contract" son **contratos estructurales de no-scroll/app-shell** (DOM +
   bounding boxes), no comparación de imágenes. **Importante** para la capa propuesta
   `e2e:visual-contract`: hoy guarda invariantes **estructurales**, no diffs de píxeles.
5. **La familia admin-mobile ya está agrupada conceptualmente.** 12 specs `admin-mobile-*` +
   `admin-clinics-mobile-card-layout` + `admin-tokens-mobile-toolbar-layout` comparten
   `helpers/admin-mobile-contracts.ts`. Es el candidato más limpio a capa propia (`e2e:admin-mobile`),
   y la familia más densa/cara (light/dark + screenshots de evidencia en varias).
6. **Specs globales/seguridad que deben mantenerse siempre.** `dashboard-auth-redirect`
   (privado→redirect, admin→404), `visual-smoke` (rutas 200) y `public-routes` son la frontera de
   seguridad/disponibilidad mínima; **nunca** deben salir del gate de PR, vayan a la capa que vayan.
7. **Riesgos de paralelismo/flakiness.** `fullyParallel: true` con un solo pool de workers, un
   **fixture mock compartido** (`admin-populated-api-server.mjs`) y `next dev` (timing de
   hidratación) implican riesgo de flake en specs con clicks/transiciones encadenados (admin-mobile,
   card-navigation). Separar en jobs **no** elimina el flake; lo aísla. Tratar el flake
   reproduciendo localmente, no relajando aserciones.
8. **Acoplamiento con Dependabot.** Los bumps abiertos (incl. `@playwright/test 1.61`, `eslint 10`,
   Radix) hoy validan contra la suite completa vía frontend-ci. Cambiar el gate cambia qué valida
   cada bump (especialmente el de Playwright, que puede alterar API/comportamiento del runner).
9. **`next-env.d.ts` como ruido.** `webServer` levanta `next dev`, que **reescribe**
   `frontend/next-env.d.ts`. En corridas locales ensucia el árbol y choca con los guardrails de
   árbol limpio. Guardrail permanente al separar scripts/CI.

## 6. Propuesta de capas futuras

> Diseño, **no** implementación. Estrategia **aditiva**: primero scripts que seleccionan
> subconjuntos por ruta/`testMatch` (sin tocar specs); la **unión** de capas debe reproducir
> exactamente `e2e:full`.

### e2e:smoke

- **Objetivo:** feedback rápido + frontera de seguridad/disponibilidad mínima. Debe correr en
  **todo** PR (incl. Dependabot) como gate barato.
- **Specs candidatos:** `dashboard-auth-redirect` (seguridad, **obligatoria**), `visual-smoke`,
  `public-routes`, `login-hydration`, `contacto-hydration`, `theme-mode`,
  `dashboard-interaction-foundation`.
- **Cuándo corre:** siempre, primer check E2E de cualquier PR. **Bloquea PR.**

### e2e:admin-mobile

- **Objetivo:** proteger las 3 familias del Dashboard Admin mobile (core/ops/status-config) y los
  invariantes no-scroll/pager canónico (ver memoria de proyecto), más el operativo admin desktop.
- **Specs candidatos:** los 12 `admin-mobile-*` + `admin-clinics-mobile-card-layout` +
  `admin-tokens-mobile-toolbar-layout` + `admin-clinic-edit-drawer` (functional/desktop, dentro del
  job "admin").
- **Cuándo corre:** PR que toque admin (frontend admin surface) o, por simplicidad inicial, todo PR
  frontend. **Bloquea PR** cuando toca admin.

### e2e:visual-contract

- **Objetivo:** invariantes **estructurales** de no-scroll/app-shell/master-detail del cockpit del
  dashboard (no pixel-baseline). Guarda la arquitectura no-scroll documentada del HUB.
- **Specs candidatos:** `dashboard-card-navigation-shell`, `dashboard-accessibility-keyboard`,
  `dashboard-app-shell-visibility-contract`, `dashboard-real-app-shell-no-scroll-contract`,
  `dashboard-internal-no-scroll-contract`, `dashboard-single-viewport-app-shell`,
  `dashboard-global-masked-master-detail`, `dashboard-master-detail-state-polish`,
  `dashboard-workspace-layout-polish`, `dashboard-viewport-zoom-adaptability`,
  `dashboard-mobile-shell-nav-contract`.
- **Cuándo corre:** PR que toque `frontend/src` del dashboard/app-shell. **Bloquea PR** (invariantes
  críticos del proyecto). *Aclaración:* el nombre se conserva por convención del proyecto, pero la
  capa es **estructural**, no de imágenes.

### e2e:public-clinic

- **Objetivo:** landing público (servicios/clínicas/precios/informe) + paridad mobile de los módulos
  de clínica.
- **Specs candidatos:** `public-clinics-b2b-operations`, `public-report-preview`,
  `public-service-bento-specimen-journey`, `public-pricing-actionable`, `public-perspective-scroll`,
  `public-navigation-footer`, `home-hero-evidence-first`, `dashboard-clinic-informes-mobile-parity`,
  `dashboard-clinic-logistica-mobile-parity`, `dashboard-clinic-tokens-mobile-parity`,
  `dashboard-clinic-perfil-mobile-operability`.
- **Cuándo corre:** PR que toque público o módulos de clínica. **Bloquea PR** cuando toca esas
  superficies.

### e2e:full

- **Objetivo:** regresión completa = **unión** de las 4 capas (estado actual exacto). Red de
  seguridad contra exclusiones accidentales.
- **Specs candidatos:** **todos** los 42.
- **Cuándo corre:** push a `main` + **nightly/manual**. **Mientras no esté validado el mapa
  spec→capa, `full` sigue siendo el gate de PR** (status quo).

**Qué bloquea PR vs. nightly/manual.** Capa de seguridad (`smoke`) **siempre** bloquea. Las capas
por superficie (`admin-mobile`, `visual-contract`, `public-clinic`) bloquean PRs que tocan su
superficie. `full` permanece como gate hasta que la unión esté probada; entonces puede pasar a
**nightly + push-a-`main`** como red de seguridad, nunca como reemplazo silencioso del gate.

## 7. Matriz spec → capa propuesta

| Spec | Capa primaria | Capa secundaria | Razón | Bloquear PR | Notas |
| --- | --- | --- | --- | --- | --- |
| `dashboard-auth-redirect.spec.ts` | smoke | — | frontera seguridad (redirect/404 admin) | **sí** | nunca demover a nightly |
| `visual-smoke.spec.ts` | smoke | public-clinic | rutas 200 + render sanity (público+dashboard) | **sí** | barato, cubre disponibilidad global |
| `public-routes.spec.ts` | smoke | public-clinic | rutas públicas resuelven | **sí** | — |
| `login-hydration.spec.ts` | smoke | public-clinic | hidratación login | sí | — |
| `contacto-hydration.spec.ts` | smoke | public-clinic | hidratación contacto | sí | — |
| `theme-mode.spec.ts` | smoke | visual-contract | toggle tema global | sí | — |
| `dashboard-interaction-foundation.spec.ts` | smoke | visual-contract | fundamentos interacción (PR-1) | sí | 8 tests; borde smoke/contract |
| `admin-mobile-app-shell-absolute-no-scroll.spec.ts` | admin-mobile | visual-contract | app-shell admin no-scroll | sí (admin) | helper compartido |
| `admin-mobile-bottom-navigation-no-scroll.spec.ts` | admin-mobile | visual-contract | bottom-nav admin no-scroll | sí (admin) | — |
| `admin-mobile-core-modules-no-scroll.spec.ts` | admin-mobile | — | familia core | sí (admin) | — |
| `admin-mobile-ops-modules-no-scroll.spec.ts` | admin-mobile | — | familia ops | sí (admin) | — |
| `admin-mobile-status-modules-no-scroll.spec.ts` | admin-mobile | — | familia status (light/dark) | sí (admin) | evidencia PNG; costo alto |
| `admin-mobile-config-modules-no-scroll.spec.ts` | admin-mobile | — | familia config (light/dark) | sí (admin) | evidencia PNG; costo alto |
| `admin-mobile-final-polish-no-scroll.spec.ts` | admin-mobile | — | barrido integral + clipping | sí (admin) | ~40 PNG/corrida; el más caro |
| `admin-mobile-hub-launcher-no-scroll.spec.ts` | admin-mobile | — | launcher hub | sí (admin) | — |
| `admin-mobile-hub-stale-layer-stage.spec.ts` | admin-mobile | — | stage capa stale | sí (admin) | evidencia PNG |
| `admin-mobile-module-layer-isolation.spec.ts` | admin-mobile | — | aislamiento de capas | sí (admin) | evidencia PNG |
| `admin-clinics-mobile-card-layout.spec.ts` | admin-mobile | — | tarjetas clínicas mobile | sí (admin) | — |
| `admin-tokens-mobile-toolbar-layout.spec.ts` | admin-mobile | — | toolbar tokens mobile | sí (admin) | — |
| `admin-clinic-edit-drawer.spec.ts` | admin-mobile | smoke | drawer edición + **scope guard** admin | **sí** | functional/desktop; scope guard es seguridad |
| `dashboard-card-navigation-shell.spec.ts` | visual-contract | — | navegación tarjetas/deep-links | sí | **75 tests**; mayor costo de la capa |
| `dashboard-accessibility-keyboard.spec.ts` | visual-contract | smoke | a11y teclado | sí | 20 tests |
| `dashboard-app-shell-visibility-contract.spec.ts` | visual-contract | — | visibilidad app-shell | sí | desktop+mobile ×loop |
| `dashboard-real-app-shell-no-scroll-contract.spec.ts` | visual-contract | — | app-shell real no-scroll | sí | ×loop |
| `dashboard-internal-no-scroll-contract.spec.ts` | visual-contract | — | no-scroll interno | sí | ×loop |
| `dashboard-single-viewport-app-shell.spec.ts` | visual-contract | — | single-viewport | sí | ×loop |
| `dashboard-global-masked-master-detail.spec.ts` | visual-contract | — | master-detail enmascarado | sí | ×loop |
| `dashboard-master-detail-state-polish.spec.ts` | visual-contract | — | pulido master-detail | sí | — |
| `dashboard-workspace-layout-polish.spec.ts` | visual-contract | — | pulido workspace (PR-2) | sí | — |
| `dashboard-viewport-zoom-adaptability.spec.ts` | visual-contract | — | adaptabilidad viewport/zoom | sí | ×loop; invariante densidad global |
| `dashboard-mobile-shell-nav-contract.spec.ts` | visual-contract | admin-mobile | shell/nav mobile | sí | ×loop |
| `public-clinics-b2b-operations.spec.ts` | public-clinic | — | landing clínicas B2B | sí | 32 tests |
| `public-report-preview.spec.ts` | public-clinic | — | preview informe | sí | 31 tests |
| `public-service-bento-specimen-journey.spec.ts` | public-clinic | — | bento servicios + journey | sí | 27 tests |
| `public-pricing-actionable.spec.ts` | public-clinic | smoke | precios accionables | sí | 11 tests; precios es crítico |
| `public-perspective-scroll.spec.ts` | public-clinic | — | scroll perspectiva | sí | — |
| `public-navigation-footer.spec.ts` | public-clinic | — | navegación + footer | sí | — |
| `home-hero-evidence-first.spec.ts` | public-clinic | — | hero home | sí | — |
| `dashboard-clinic-informes-mobile-parity.spec.ts` | public-clinic | visual-contract | paridad mobile informes | sí | clínica |
| `dashboard-clinic-logistica-mobile-parity.spec.ts` | public-clinic | visual-contract | paridad mobile logística | sí | clínica |
| `dashboard-clinic-tokens-mobile-parity.spec.ts` | public-clinic | visual-contract | paridad mobile tokens | sí | clínica |
| `dashboard-clinic-perfil-mobile-operability.spec.ts` | public-clinic | visual-contract | operabilidad perfil mobile | sí | clínica |

> **Invariante de cobertura:** la **unión** de las capas primarias == los 42 specs == `e2e:full`.
> Ninguna spec queda sin capa primaria. Ninguna queda fuera de "bloquear PR" en su superficie.

## 8. Plan de PRs posteriores

> PRs **chicos, reversibles y de un solo eje**. Cada uno con scope, archivos, validación y rollback.

### PR-C1 — docs-only audit actual (este PR)

- **Scope permitido:** crear esta auditoría. Sin tocar nada más.
- **Archivos:** `docs/audit/e2e-ci-layering-strategy-audit.md` (único, untracked).
- **Validación:** `git status --short`, `git diff --check`; lectura humana. **No** dispara
  frontend-ci (ruta `docs/`); sí `backend-ci`.
- **Rollback:** borrar el archivo (`git clean`/descartar). Cero efecto sobre CI/specs/prod.

### PR-C2 — scripts-only (sin tocar CI)

- **Scope permitido:** agregar scripts de capa en `frontend/package.json`. **No** tocar specs,
  helpers, Playwright config (salvo `projects`/`testMatch` si se elige esa vía) ni CI.
- **Archivos:** `frontend/package.json` (scripts `e2e:smoke`, `e2e:admin-mobile`,
  `e2e:visual-contract`, `e2e:public-clinic`, `e2e:full`). Preferir **selección por ruta/`testMatch`**
  (sin editar specs); evitar `@tags` porque obliga a tocar specs.
- **Validación:** correr cada script local; **probar que la suma de conteos == `e2e:full`** (sin
  specs huérfanas ni duplicadas); `lint`/`typecheck` intactos. Documentar el conteo por capa.
- **Rollback:** revertir los scripts en `frontend/package.json`. `full`/CI siguen igual.

### PR-C3 — CI-only (usar capa smoke/admin-mobile)

- **Scope permitido:** `.github/workflows/frontend-ci.yml`. Agregar un job/step **adicional** de
  `e2e:smoke` (feedback rápido) **manteniendo** el step `full` como gate. Opcionalmente paralelizar
  por capa en una matriz cuya **unión == full**.
- **Archivos:** `.github/workflows/frontend-ci.yml`.
- **Validación:** CI verde; **probar que la unión de jobs cubre los 42 specs** (sin pérdida);
  renombrar el step "smoke" engañoso. Mantener `security:public-surface` y la frontera de seguridad.
- **Rollback:** revertir el workflow al step único actual.

### PR-C4 — full/nightly/manual (si corresponde)

- **Scope permitido:** mover `e2e:full` a schedule **nightly** + push-a-`main`, dejando las capas
  por superficie como gate de PR — **solo** tras validar unión == full en PR-C2/PR-C3.
- **Archivos:** `.github/workflows/frontend-ci.yml` (+ posible workflow nightly).
- **Validación:** demostrar que ninguna spec crítica quedó solo en nightly; que `smoke` +
  superficie cubren todo PR.
- **Rollback:** volver `full` a gate de PR.

### PR-C5 — cleanup / reducción (solo con evidencia)

- **Scope permitido:** consolidar o reducir **solo** si hay evidencia documentada de redundancia
  real (p. ej. dos specs que asertan exactamente lo mismo). **No** reducir por costo sin evidencia.
- **Archivos:** specs concretas (con auditoría previa por spec, estilo bloque #1089–#1094).
- **Validación:** conteo antes/después; misma cobertura efectiva; auditoría que justifique cada
  eliminación.
- **Rollback:** restaurar specs.

## 9. Riesgos y guardrails

- **No reducir cobertura por accidente.** Toda separación debe probar **unión == 42 specs**. Una
  spec sin capa primaria = agujero silencioso. PR-C2 debe imprimir el conteo por capa.
- **No ocultar fallos reales detrás de capas.** Nada crítico puede vivir **solo** en nightly/manual.
  `full` no se demueve hasta que las capas de PR cubran su superficie.
- **No dejar specs críticas fuera de PR checks.** `dashboard-auth-redirect` y el scope guard de
  `admin-clinic-edit-drawer` (seguridad) deben estar en `smoke`/gate **siempre**.
- **Mantener seguridad pública/privada.** Conservar `security:public-surface` en CI; no exponer
  privados; admin sin sesión → 404; privado sin sesión → redirect. Las capas no alteran estas
  fronteras.
- **No mezclar Dependabot.** El reparto de capas es un eje propio; no acoplarlo a bumps de deps.
  Recordar que `@playwright/test 1.61` y `eslint 10` abiertos pueden cambiar comportamiento del
  runner/lint y deben validar contra una suite estable.
- **Controlar `frontend/next-env.d.ts`.** `next dev` (vía `webServer`) lo reescribe; regenerar/
  restaurar para mantener el árbol limpio y diffs acotados. No versionar ese ruido.
- **No tocar el fixture compartido.** `admin-populated-api-server.mjs` y
  `helpers/admin-mobile-contracts.ts` son infra global; cambiarlos al separar capas tiene blast
  radius sobre toda la suite — fuera de scope de PR-C2/C3.
- **No tocar producción ni secretos.** Ningún paso de este plan toca prod, `.env`, cookies, tokens,
  DB ni migrations. Git lo ejecuta Nico manualmente.

## 10. Recomendación final

**Dictamen explícito:**

- **PR-C actual debe ser docs-only.** Este archivo es el entregable; no toca specs, helpers,
  fixtures, productivo, backend, API, auth, DB, deps, lockfiles, CI, scripts de package ni Playwright
  config.
- **Próximo paso seguro: scripts-only sin tocar CI** (PR-C2), porque la auditoría lo justifica:
  hoy existe un único entrypoint `e2e` y el mapa spec→capa de §7 ya está propuesto. Los scripts de
  capa deben **probar unión == `full`** antes de avanzar.
- **No modificar workflows hasta tener el mapa spec→capa validado.** Solo cuando PR-C2 demuestre
  localmente que la unión de capas reproduce los 42 specs, PR-C3 puede tocar
  `.github/workflows/frontend-ci.yml` — y siempre de forma **aditiva** (smoke como feedback rápido,
  `full` como gate hasta validar la matriz).

**Qué NO hacer (recordatorio):** no separar scripts ni tocar CI en este PR; no reducir specs; no
recortar viewports/loops; no convertir las `page.screenshot` de evidencia en baseline; no demover
seguridad a nightly; no tocar productivo/backend/API/auth/DB/deps/lockfiles/fixtures.

---

### Anexo — Comandos read-only ejecutados (evidencia)

```
git branch --show-current
git status --short --untracked-files=all
git log -1 --oneline
git log --oneline --decorate -n 15
git ls-files ".github/workflows/*" "package.json" "frontend/package.json" \
  "frontend/playwright.config.*" "frontend/e2e/*.spec.ts" "frontend/e2e/**/*.ts" \
  "frontend/e2e/**/*.mjs"
rg -n "toHaveScreenshot|page.screenshot|screenshot\(|toMatchSnapshot" frontend/e2e
rg -n "setViewportSize|viewport|390|414|360" frontend/e2e
rg -n "test\(|test.describe\(" frontend/e2e   # conteo por spec
gh pr list --state open
# lecturas: frontend-ci.yml, backend-ci.yml, playwright.config.ts,
#           package.json, frontend/package.json, visual-smoke.spec.ts,
#           admin-mobile-e2e-helper-optimization-closeout.md
```
