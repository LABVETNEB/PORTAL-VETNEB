# PR-VIS-9c - Visual Stress Fixtures

## Objetivo

Agregar baselines visuales autenticados de stress para detectar regresiones de layout en escenarios extremos de produccion, complementando PR-VIS-9a y PR-VIS-9b sin modificar producto, backend, CI, dependencias ni configuracion productiva.

## Alcance

Incluido:

- Nuevo spec E2E visual: `frontend/e2e/visual-regression-stress.spec.ts`.
- Snapshots Chromium Linux para `/dashboard` y `/dashboard/admin` en cinco viewports.
- Mocks locales dentro del spec con datos falsos de stress.
- Documento de auditoria e implementacion: `docs/audit/pr-vis-9c-implementation.md`.

Excluido:

- Cambios en `server/`, `frontend/src/`, DB, migraciones, auth, API productiva, dependencias, lockfiles, CI y workflows.
- Gate CI nuevo.
- Fixes visuales de producto.
- Snapshots Windows o Darwin.

## Auditoria previa

Base local verificada:

- Rama: `chore/pr-vis-9c-visual-stress-fixtures`.
- Commit base: `34d0784 test(frontend): add authenticated visual regression baselines (#1206)`.
- Working tree inicial: limpio.
- `git diff --check` inicial: sin errores.

Archivos inspeccionados:

- `frontend/e2e/visual-regression-public.spec.ts`.
- `frontend/e2e/visual-regression-authenticated.spec.ts`.
- `frontend/e2e/accessibility-axe-key-routes.spec.ts`.
- `frontend/e2e/fixtures/admin-populated-api-server.mjs`.
- `frontend/playwright.config.ts`.
- Specs existentes con `/dashboard` y `/dashboard/admin`.
- Contratos de lectura de dashboard en `frontend/src/app/dashboard/page.tsx`, `frontend/src/app/dashboard/admin/page.tsx` y `frontend/src/lib/api.ts`.

## Rutas cubiertas

- `/dashboard`.
- `/dashboard/admin`.

## Viewports cubiertos

- `320x720`.
- `768x1024`.
- `1024x768`.
- `1536x960`.
- `1920x1080`.

## Datos de stress simulados

El spec instala mocks deterministas con `page.route("**/api/**")` antes de navegar y reutiliza las cookies E2E existentes:

- `app_session_id=e2e_populated_clinic_session`.
- `admin_session_id=e2e_populated_admin_session`.

Datos simulados:

- Nombres de clinicas muy largos.
- Emails y usernames largos.
- Responsables con nombres compuestos.
- Valores numericos grandes en auditoria, salud, memoria, totales y metricas.
- Muchos registros visibles en informes, visitas, rutas, tokens, usuarios y auditoria.
- Estados mixtos: `pending`, `uploaded`, `processing`, `delivered`, `error`, `completed`, `scheduled`, `in_progress`, `done`, `cancelled`, `degraded`.
- Textos largos en archivos, direcciones, notas, detalles de lesion, rutas, metadata y origenes CORS falsos.
- Fechas variadas y deterministicas.
- Datos `.example.test`, sin datos reales sensibles.

## Snapshots esperados

- `frontend/e2e/visual-regression-stress.spec.ts-snapshots/stress-dashboard-320-chromium-linux.png`
- `frontend/e2e/visual-regression-stress.spec.ts-snapshots/stress-dashboard-768-chromium-linux.png`
- `frontend/e2e/visual-regression-stress.spec.ts-snapshots/stress-dashboard-1024-chromium-linux.png`
- `frontend/e2e/visual-regression-stress.spec.ts-snapshots/stress-dashboard-1536-chromium-linux.png`
- `frontend/e2e/visual-regression-stress.spec.ts-snapshots/stress-dashboard-1920-chromium-linux.png`
- `frontend/e2e/visual-regression-stress.spec.ts-snapshots/stress-admin-dashboard-320-chromium-linux.png`
- `frontend/e2e/visual-regression-stress.spec.ts-snapshots/stress-admin-dashboard-768-chromium-linux.png`
- `frontend/e2e/visual-regression-stress.spec.ts-snapshots/stress-admin-dashboard-1024-chromium-linux.png`
- `frontend/e2e/visual-regression-stress.spec.ts-snapshots/stress-admin-dashboard-1536-chromium-linux.png`
- `frontend/e2e/visual-regression-stress.spec.ts-snapshots/stress-admin-dashboard-1920-chromium-linux.png`

## Generacion en WSL/Linux

Comandos requeridos desde `/mnt/c/PORTAL-VETNEB`:

```bash
CI=true corepack pnpm install --frozen-lockfile --reporter=append-only
corepack pnpm --dir frontend exec playwright test e2e/visual-regression-stress.spec.ts --update-snapshots
corepack pnpm --dir frontend exec playwright test e2e/visual-regression-stress.spec.ts
corepack pnpm --dir frontend exec playwright test e2e/visual-regression-stress.spec.ts
```

## Validaciones

Ejecutadas y pasaron:

- WSL: `CI=true corepack pnpm install --frozen-lockfile --reporter=append-only`.
- WSL: `corepack pnpm --dir frontend exec playwright test e2e/visual-regression-stress.spec.ts --update-snapshots`.
- WSL: `corepack pnpm --dir frontend exec playwright test e2e/visual-regression-stress.spec.ts`.
- WSL: segundo rerun `corepack pnpm --dir frontend exec playwright test e2e/visual-regression-stress.spec.ts`.
- Windows: `$env:CI='true'; corepack pnpm install --frozen-lockfile --reporter=append-only`.
- Windows: `corepack pnpm --filter portal-vetneb-frontend lint`.
- Windows: `corepack pnpm --filter portal-vetneb-frontend typecheck`.
- Windows: `corepack pnpm --filter portal-vetneb-frontend build`.
- Windows: `corepack pnpm --dir frontend build`.
- Windows: `corepack pnpm test` (`2905` tests passed).
- Windows: `corepack pnpm build`.
- Windows: `corepack pnpm security:public-surface`.
- Windows: `git diff --check`.

Incidencias de entorno resueltas:

- Chromium Linux fallo inicialmente por `libnspr4.so` faltante. Se uso la cache local existente `/home/nico/.cache/vetneb-playwright-linux-libs/extracted/usr/lib/x86_64-linux-gnu` via `LD_LIBRARY_PATH`.
- La primera instalacion WSL fallo por `EACCES` en `node_modules`; se eliminaron solo `node_modules` y `frontend/node_modules` dentro de `C:\PORTAL-VETNEB` y se reinstalo con frozen lockfile.
- El primer rerun Linux fallo por cache generada `.next/dev` inconsistente despues del reinstall WSL; se elimino solo `frontend/.next` y el rerun posterior paso.
- La primera reinstalacion Windows fallo por permisos en `node_modules`; se eliminaron solo `node_modules` y `frontend/node_modules`, y la reinstalacion Windows posterior paso.

## Restricciones respetadas

- No agrega gate CI.
- No toca backend, DB, migraciones, auth, API productiva, dependencias, lockfiles, workflows ni `frontend/src`.
- No usa login real ni credenciales reales.
- No usa backend real externo.
- No agrega snapshots Windows o Darwin.

## Hallazgos visuales

- No se observo overflow horizontal visible en los snapshots mobile 320 inspeccionados.
- `/dashboard/admin` mobile mantiene el hub administrativo paginado; el stress queda versionado como baseline, sin aplicar fixes visuales.
- Durante los runs Linux aparecieron warnings existentes de fixture para `getRoutePlans` (`endpoint no disponible` / `E2E populated session required`). No fallan el spec y no se modifico el fixture compartido ni producto.

## Resultado

- Se agrego un spec visual stress autenticado con mocks deterministas locales al spec.
- Se generaron 10 snapshots nuevos `chromium-linux`.
- Los dos reruns Linux del spec pasaron.
- Las validaciones Windows obligatorias pasaron.

## Riesgo residual

- Los mocks de stress viven dentro del spec y no alteran fixtures compartidos; el riesgo principal es que datos servidos durante SSR por el fixture Playwright existente puedan emitir warnings no bloqueantes para endpoints no cubiertos por ese fixture.
- No se agrega gate CI en este PR, por lo que la proteccion queda lista para activacion futura.

## Estado final

- Working tree final esperado: 1 spec nuevo, 10 snapshots Linux nuevos y 1 documento de auditoria.
- Sin cambios en backend, DB, migraciones, auth, API productiva, dependencias, lockfiles, workflows ni `frontend/src`.
- Sin snapshots `win32` o `darwin`.

Nota explicita: este PR no agrega gate CI; solo agrega fixtures y baselines de stress para futura proteccion visual.
