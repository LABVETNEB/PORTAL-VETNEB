# Dashboard Shell Frame Inset Parity

## Estado base

- Rama auditada: `fix/dashboard-shell-frame-inset-parity`.
- HEAD inicial: `9b834a1 feat(clinic): align dashboard structure with admin benchmark (#1142)`.
- Estado inicial: `git status --short` limpio.
- Entorno usado: Windows, PowerShell, PNPM.

## Scope incluido

- Frame/layout del dashboard privado compartido.
- Inset inferior del `main.dashboard-main` alineado con el inset lateral.
- Contencion del stage persistente `data-dashboard-module-stage`.
- Cobertura E2E para Admin y Clinica en desktop/mobile.
- Modulos criticos Clinica cubiertos: Resumen (`operaciones`), Informes y Tokens.

## Scope excluido

- Backend, API, DB, Drizzle, migraciones y schema.
- Auth, cookies, sesiones, CSRF, CORS, CSP y rate limits.
- Dependencias, `package.json`, lockfiles, CI y workflows.
- Pagina publica `/clinicas` y marketing publico.
- Refactors globales o redisenos de modulos fuera del frame privado.

## Auditoria previa

- Se confirmo rama esperada y base limpia.
- Se revisaron `globals.css`, `DashboardShellRouter`, `DashboardModuleWorkspace`, `DashboardModuleHub`, `ModuleSurface`, `ClinicMobileModuleFrame`, controllers Admin/Clinica y specs dashboard shell/layout/no-scroll.
- Se buscaron referencias legacy de `dashboard-main`, `dashboard-module-stage`, `overflow-y-auto`, `ModuleSurface` y contratos no-scroll.
- Riesgo identificado: el shell es compartido por Admin y Clinica; el cambio se dejo en tokens CSS del app shell y un contrato E2E por rectangulos reales.

## Problema corregido

El padding vertical del frame usaba el mismo token para top/bottom (`--dash-pad-y`), mientras el lateral usaba `--dash-pad-x`. En desktop esto dejaba el borde inferior visualmente mas pegado que los laterales. El stage compartido tampoco tenia un contrato CSS explicito de maximo ancho/alto como hijo flex contenido.

## Cambios

- `--dash-frame-inset-inline`, `--dash-frame-inset-block-start` y `--dash-frame-inset-block-end` separan ritmo vertical de inset visual.
- `padding-block-end` de `dashboard-main` ahora usa el mismo token que el lateral.
- `data-dashboard-module-stage` queda blindado como hijo flex contenido con `min/max`, `flex: 1 1 auto` y `overflow: hidden`.
- `dashboard-workspace-layout-polish.spec.ts` mide:
  - no overflow horizontal,
  - no overflow vertical efectivo en `main`,
  - paridad left/right/bottom entre `main` y stage,
  - stage y superficie dentro del viewport,
  - Admin y Clinica en desktop/mobile,
  - Clinica Resumen, Informes y Tokens.

## Archivos modificados

- `frontend/src/app/globals.css`
- `frontend/e2e/dashboard-workspace-layout-polish.spec.ts`
- `docs/implementation/dashboard-shell-frame-inset-parity.md`

## Validaciones

- `git diff --check`: ejecutado, paso.
- `pnpm --dir frontend exec playwright test e2e/dashboard-workspace-layout-polish.spec.ts`: ejecutado, paso; 16 passed.
- `pnpm --dir frontend exec playwright test e2e/dashboard-internal-no-scroll-contract.spec.ts`: ejecutado, paso; 4 passed.
- `pnpm --dir frontend exec playwright test e2e/dashboard-mobile-shell-nav-contract.spec.ts`: ejecutado, paso; 25 passed.
- `pnpm --dir frontend lint`: ejecutado, paso.
- `pnpm typecheck:test`: ejecutado, paso.
- `pnpm --dir frontend typecheck`: ejecutado, paso.
- `pnpm --dir frontend build`: ejecutado, paso.
- `pnpm test`: ejecutado, paso; 2840 passed.
- `pnpm security:public-surface`: ejecutado, paso; reporto solo hallazgos server-only esperados en `frontend/src/proxy.ts`.
- `pnpm build`: ejecutado, paso.

## Resultado

El dashboard privado queda con inset inferior alineado al lateral y el stage compartido queda contenido dentro del viewport sin convertir `main` en scroll container. Admin y Clinica conservan el contrato no-scroll y los modulos criticos de Clinica quedan cubiertos por E2E.

## Riesgo residual

- La evidencia visual mobile corresponde a Chromium/Playwright con viewports emulados; no reemplaza smoke fisico en dispositivos reales.
- Cambios futuros en `globals.css`, `DashboardShellRouter`, controllers de workspace o bottom nav deben reejecutar los specs de shell/no-scroll.

## Estado final

- Implementacion completada dentro del scope solicitado.
- Sin cambios en backend, API, auth, DB, migraciones, dependencias, lockfiles, CI, cookies ni paginas publicas.
- Sin commit, push ni PR.
