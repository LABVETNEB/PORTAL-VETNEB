# PR-VIS-9b implementation report

## Objetivo

Agregar cobertura de visual regression autenticada para las rutas principales del dashboard, siguiendo el modelo de PR-VIS-9a y sin activar un gate nuevo en CI.

## Estado base

- Rama: `chore/pr-vis-9b-authenticated-visual-baselines`.
- Base obligatoria: `3fa3870 test(frontend): add public visual regression baselines (#1205)`.
- Working tree inicial limpio.
- `git diff --stat`, `git diff --check` y `git diff --name-only` iniciales sin salida.

## Alcance incluido

- Nuevo spec Playwright visual autenticado.
- Baselines PNG Chromium Linux para `/dashboard` y `/dashboard/admin`.
- Documento de auditoría/implementación.

## Scope excluido

- Sin cambios en UI/producto.
- Sin cambios en `frontend/src`.
- Sin cambios en backend, API, auth, DB, migraciones, dependencias, lockfiles ni workflows.
- Sin snapshots Windows o Darwin.
- Sin gate CI nuevo.

## Auditoría previa

- `frontend/e2e/visual-regression-public.spec.ts`: patrón PR-VIS-9a para matriz de viewports, estabilización visual local al test y `toHaveScreenshot`.
- `frontend/e2e/accessibility-axe-key-routes.spec.ts`: patrón de sesiones autenticadas con `admin_session_id` y `app_session_id` usando fixtures poblados.
- `frontend/e2e/fixtures/admin-populated-api-server.mjs`: fixture API existente para sesiones `e2e_populated_admin_session` y `e2e_populated_clinic_session`.
- `frontend/playwright.config.ts`: webServer existente levanta fixture API en `127.0.0.1:3107`, Next en `127.0.0.1:3000`, y proyecto único `chromium`.
- Specs de dashboard existentes confirman readiness con `[data-dashboard-module-hub="true"]`.

## Rutas cubiertas

- `/dashboard` con cookie `app_session_id=e2e_populated_clinic_session`.
- `/dashboard/admin` con cookie `admin_session_id=e2e_populated_admin_session`.

## Viewports cubiertos

- `320x720`
- `768x1024`
- `1024x768`
- `1536x960`
- `1920x1080`

## Snapshots

- `frontend/e2e/visual-regression-authenticated.spec.ts-snapshots/dashboard-320-chromium-linux.png`
- `frontend/e2e/visual-regression-authenticated.spec.ts-snapshots/dashboard-768-chromium-linux.png`
- `frontend/e2e/visual-regression-authenticated.spec.ts-snapshots/dashboard-1024-chromium-linux.png`
- `frontend/e2e/visual-regression-authenticated.spec.ts-snapshots/dashboard-1536-chromium-linux.png`
- `frontend/e2e/visual-regression-authenticated.spec.ts-snapshots/dashboard-1920-chromium-linux.png`
- `frontend/e2e/visual-regression-authenticated.spec.ts-snapshots/admin-dashboard-320-chromium-linux.png`
- `frontend/e2e/visual-regression-authenticated.spec.ts-snapshots/admin-dashboard-768-chromium-linux.png`
- `frontend/e2e/visual-regression-authenticated.spec.ts-snapshots/admin-dashboard-1024-chromium-linux.png`
- `frontend/e2e/visual-regression-authenticated.spec.ts-snapshots/admin-dashboard-1536-chromium-linux.png`
- `frontend/e2e/visual-regression-authenticated.spec.ts-snapshots/admin-dashboard-1920-chromium-linux.png`

## Estabilización visual

- `page.emulateMedia({ reducedMotion: "reduce" })`.
- CSS local del test para anular animaciones, transiciones, scroll smooth y caret.
- Espera de hub visible antes de capturar.
- Espera acotada de `networkidle`.
- Espera de fuentes cargadas.
- Espera acotada de imágenes no lazy.
- Doble `requestAnimationFrame` antes del screenshot.
- `toHaveScreenshot` con `animations: "disabled"`, `caret: "hide"`, `fullPage: false` y `maxDiffPixelRatio: 0.001`.

## Cómo se generaron en WSL/Linux

- Primer intento de `CI=true corepack pnpm install --frozen-lockfile --reporter=append-only`: quedó sin salida y se detuvo el proceso WSL colgado.
- Segundo intento de instalación WSL: falló por `ERR_PNPM_EACCES` al renombrar un paquete dentro de `node_modules`.
- Tercer intento de instalación WSL: pasó con lockfile frozen.
- `corepack pnpm --dir frontend exec playwright install chromium`: pasó; descargó Chromium Linux `1228` en cache de usuario WSL.
- Se reconstruyó cache local WSL de librerías Chromium con `apt download` + `dpkg-deb -x` para `libnspr4`, `libnss3`, `libasound2t64` y `libasound2-data` en `$HOME/.cache/vetneb-playwright-linux-libs`; no se instaló nada en el sistema ni se tocó el repo.
- `ldd` con `LD_LIBRARY_PATH=$HOME/.cache/vetneb-playwright-linux-libs/extracted/usr/lib/x86_64-linux-gnu`: pasó, cero librerías faltantes.
- `LD_LIBRARY_PATH=$HOME/.cache/vetneb-playwright-linux-libs/extracted/usr/lib/x86_64-linux-gnu corepack pnpm --dir frontend exec playwright test e2e/visual-regression-authenticated.spec.ts --update-snapshots`: pasó, 10/10; generó PNG Linux.
- Rerun 1 sin `--update-snapshots` con el mismo `LD_LIBRARY_PATH`: pasó, 10/10.
- Rerun 2 sin `--update-snapshots` con el mismo `LD_LIBRARY_PATH`: pasó, 10/10.
- Restauración Windows: fue necesario eliminar sólo `C:\PORTAL-VETNEB\node_modules` y `C:\PORTAL-VETNEB\frontend\node_modules` por permisos cruzados WSL/Windows; luego `$env:CI='true'; corepack pnpm install --frozen-lockfile --reporter=append-only` pasó.

## Validaciones ejecutadas

- `git status --short`: base inicial limpia.
- `git branch --show-current`: pasó, rama `chore/pr-vis-9b-authenticated-visual-baselines`.
- `git log -1 --oneline`: pasó, `3fa3870 test(frontend): add public visual regression baselines (#1205)`.
- `git diff --stat`: inicial sin salida.
- `git diff --check`: inicial sin salida.
- `git diff --name-only`: inicial sin salida.
- `CI=true corepack pnpm install --frozen-lockfile --reporter=append-only` en WSL: pasó después de un intento colgado detenido y un intento fallido por `EACCES`.
- `corepack pnpm --dir frontend exec playwright install chromium` en WSL: pasó.
- Generación snapshots Linux con `--update-snapshots`: pasó, 10/10.
- Rerun Linux 1 sin `--update-snapshots`: pasó, 10/10.
- Rerun Linux 2 sin `--update-snapshots`: pasó, 10/10.
- `$env:CI='true'; corepack pnpm install --frozen-lockfile --reporter=append-only` en Windows: pasó tras limpiar sólo `node_modules`.
- `corepack pnpm --filter portal-vetneb-frontend lint`: pasó.
- `corepack pnpm --filter portal-vetneb-frontend typecheck`: pasó.
- `corepack pnpm --filter portal-vetneb-frontend build`: pasó.
- `corepack pnpm --dir frontend build`: pasó.
- `corepack pnpm test`: pasó, 2905/2905.
- `corepack pnpm build`: pasó.
- `corepack pnpm security:public-surface`: pasó, sin findings de exposición pública; mantiene notas server-only existentes para `CLINIC_SESSION_COOKIE_NAME` y `ADMIN_SESSION_COOKIE_NAME` en `frontend/src/proxy.ts`.
- `git diff --check`: pasó.
- `git status --short --untracked-files=all`: muestra sólo 12 archivos esperados.
- `git diff --stat`: sin salida porque los archivos están untracked y no staged.
- `git diff --name-only`: sin salida porque los archivos están untracked y no staged.
- `Get-ChildItem -Recurse frontend\e2e -Filter *.png | Select-Object FullName`: 20 PNG totales; 10 públicos preexistentes y 10 autenticados nuevos.
- `Get-ChildItem -Recurse frontend\e2e -Filter *win32*.png -ErrorAction SilentlyContinue | Select-Object FullName`: pasó, cero resultados.
- Guardrail de paths prohibidos sobre `git status`: sólo marcó falsos positivos por la palabra `auth` en `visual-regression-authenticated`, que pertenece al spec permitido; no hay `server/`, `frontend/src`, lockfiles, packages, workflows, DB, migrations, supabase ni `.claude`.

## Restricciones respetadas

- El spec salta fuera de Chromium Linux para evitar baselines `win32` o `darwin`.
- No se agregan scripts, dependencias ni configuración Playwright.
- No se modifica producto ni código fuente de aplicación.
- No se agregan gates CI.

## Nota CI

PR-VIS-9b no agrega gate CI; sólo versiona baselines para futura protección visual.

## Riesgo residual

- Los baselines son Chromium Linux y pueden requerir el mismo entorno Linux/WSL usado en PR-VIS-9a para reproducibilidad.
- El fixture autenticado cubre datos E2E poblados, no datos reales externos.
- En este entorno WSL, Chromium requiere `LD_LIBRARY_PATH` hacia la cache local de librerías extraídas.

## Estado final

Implementación y validaciones obligatorias completadas. Working tree final sólo con el spec permitido, 10 snapshots Chromium Linux y este reporte.
