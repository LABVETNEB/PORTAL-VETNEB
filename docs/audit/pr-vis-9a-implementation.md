# PR-VIS-9a implementation report

## Relación con PR-VIS-9 observatory

Este reporte implementa el primer corte autorizado desde `docs/audit/pr-vis-9-observatory.md`: regresión visual pública primero con Playwright nativo, baselines Linux generados desde WSL y sin gate CI.

## Scope exacto

- PR-VIS-9a.
- Rutas públicas únicamente.
- `toHaveScreenshot` nativo de `@playwright/test`.
- Viewports `320`, `768`, `1024`, `1536` y `1920`.
- Screenshots de viewport.
- Animaciones estabilizadas sólo dentro del test.
- Baselines PNG Linux generados desde WSL Ubuntu.

## Rutas cubiertas

- `/`
- `/login`

## Viewports cubiertos

- `320x720`
- `768x1024`
- `1024x768`
- `1536x960`
- `1920x1080`

## Ubicación de baselines PNG Linux

- `frontend/e2e/visual-regression-public.spec.ts-snapshots/public-home-320-chromium-linux.png`
- `frontend/e2e/visual-regression-public.spec.ts-snapshots/public-login-320-chromium-linux.png`
- `frontend/e2e/visual-regression-public.spec.ts-snapshots/public-home-768-chromium-linux.png`
- `frontend/e2e/visual-regression-public.spec.ts-snapshots/public-login-768-chromium-linux.png`
- `frontend/e2e/visual-regression-public.spec.ts-snapshots/public-home-1024-chromium-linux.png`
- `frontend/e2e/visual-regression-public.spec.ts-snapshots/public-login-1024-chromium-linux.png`
- `frontend/e2e/visual-regression-public.spec.ts-snapshots/public-home-1536-chromium-linux.png`
- `frontend/e2e/visual-regression-public.spec.ts-snapshots/public-login-1536-chromium-linux.png`
- `frontend/e2e/visual-regression-public.spec.ts-snapshots/public-home-1920-chromium-linux.png`
- `frontend/e2e/visual-regression-public.spec.ts-snapshots/public-login-1920-chromium-linux.png`

## Confirmación de cero PNG win32

Confirmado con `Get-ChildItem -Recurse frontend\e2e -Filter *win32*.png -ErrorAction SilentlyContinue`: cero resultados.

## Estabilización de animaciones y datos

- `page.emulateMedia({ reducedMotion: "reduce" })`.
- CSS local del test para anular `animation-*`, `transition-*`, `scroll-behavior` y caret.
- `toHaveScreenshot` con `animations: "disabled"`, `caret: "hide"` y `fullPage: false`.
- Espera de `document.fonts.status === "loaded"`.
- Espera acotada de imágenes no lazy.
- Doble `requestAnimationFrame` antes de capturar.
- Sólo rutas públicas, sin auth ni fixtures dinámicos.

## Validaciones ejecutadas

- `git branch --show-current`: pasó, rama `chore/pr-vis-9-visual-baseline-observatory`.
- `git status --short`: base inicial limpia.
- `git log -1 --oneline`: pasó, `aaefa37 docs(audit): add visual regression observatory`.
- `wsl -d Ubuntu --cd /mnt/c/PORTAL-VETNEB -- bash -lc 'node -p "process.platform"'`: pasó, `linux`.
- `wsl -d Ubuntu --cd /mnt/c/PORTAL-VETNEB -- bash -lc 'corepack pnpm --version'`: pasó, `10.8.1`.
- `wsl -d Ubuntu --cd /mnt/c/PORTAL-VETNEB -- bash -lc 'corepack pnpm install --frozen-lockfile'`: primer intento quedó atascado; se detuvo el proceso.
- `wsl -d Ubuntu --cd /mnt/c/PORTAL-VETNEB -- bash -lc 'CI=true corepack pnpm install --frozen-lockfile --reporter=append-only'`: pasó; reconstruyó `node_modules` para Linux sin tocar manifests ni lockfile.
- `wsl -d Ubuntu --cd /mnt/c/PORTAL-VETNEB -- bash -lc 'corepack pnpm --dir frontend exec playwright install-deps chromium'`: falló por `sudo` interactivo (`sudo: timed out`).
- `wsl -d Ubuntu --cd /mnt/c/PORTAL-VETNEB -- bash -lc 'corepack pnpm --dir frontend exec playwright install chromium'`: pasó; instaló Chromium Linux en cache de usuario WSL.
- `ldd` inicial del Chromium WSL: detectó faltantes `libnspr4.so`, `libnss3.so`, `libnssutil3.so` y `libasound.so.2`.
- Cache de usuario WSL: se descargaron y extrajeron con `apt download` + `dpkg-deb -x` `libnspr4`, `libnss3`, `libasound2t64` y `libasound2-data` en `~/.cache/vetneb-playwright-linux-libs`; no se tocó el repo.
- `ldd` con `LD_LIBRARY_PATH=$HOME/.cache/vetneb-playwright-linux-libs/extracted/usr/lib/x86_64-linux-gnu`: pasó, cero librerías faltantes.
- `wsl -d Ubuntu --cd /mnt/c/PORTAL-VETNEB -- bash -lc 'LD_LIBRARY_PATH=$HOME/.cache/vetneb-playwright-linux-libs/extracted/usr/lib/x86_64-linux-gnu corepack pnpm --dir frontend exec playwright test e2e/visual-regression-public.spec.ts --update-snapshots'`: pasó, 10/10; generó PNG Linux.
- Rerun 1 sin `--update-snapshots` con el mismo `LD_LIBRARY_PATH`: pasó, 10/10.
- Rerun 2 sin `--update-snapshots` con el mismo `LD_LIBRARY_PATH`: pasó, 10/10.
- `corepack pnpm install --frozen-lockfile`: se reejecutó en Windows para restaurar `node_modules` Windows; pasó sin tocar lockfile.
- `corepack pnpm --filter portal-vetneb-frontend lint`: pasó.
- `corepack pnpm --filter portal-vetneb-frontend typecheck`: pasó.
- `corepack pnpm --filter portal-vetneb-frontend build`: pasó.
- `corepack pnpm --dir frontend build`: pasó.
- `corepack pnpm test`: pasó, 2905/2905 tests.
- `corepack pnpm build`: pasó.
- `corepack pnpm security:public-surface`: pasó, sin findings de exposición pública; mantiene notas server-only existentes para `CLINIC_SESSION_COOKIE_NAME` y `ADMIN_SESSION_COOKIE_NAME` en `frontend/src/proxy.ts`.
- `git diff --check`: pasó.
- `Get-ChildItem -Recurse frontend\e2e -Filter *.png | Select-Object FullName`: 10 PNG, todos `chromium-linux`.
- `Get-ChildItem -Recurse frontend\e2e -Filter *win32*.png -ErrorAction SilentlyContinue | Select-Object FullName`: pasó, cero resultados.

## Riesgos residuales

- Baselines Chromium-only porque `frontend/playwright.config.ts` mantiene un solo proyecto `chromium`.
- Baselines contra `next dev`, no `next start`; prod-mode queda fuera de PR-VIS-9a.
- En este WSL, Playwright necesita `LD_LIBRARY_PATH` con librerías extraídas en cache de usuario porque `install-deps chromium` requiere `sudo` interactivo.
- El threshold `maxDiffPixelRatio: 0.001` queda estable en dos reruns, pero debe revisarse si se activa gate CI en otro entorno Linux.

## Qué queda fuera para 9b/9c

- 9b: rutas autenticadas `/dashboard` y `/dashboard/admin` con cookies existentes y mock poblado.
- 9c: fixtures de estrés con datos largos, N filas y estados de error.
- Gate CI separado una vez que los baselines sean estables.

## Confirmación de exclusiones

No se tocó backend, API, auth, DB, migraciones, dependencias, lockfiles, CI/workflows ni UI/CSS/tokens/componentes. No se modificaron rutas, query params, permisos, estados ni datos.
