# Clinic Admin Structure Parity

## Estado base

- Rama: `feat/clinic-admin-structure-parity`.
- HEAD inicial auditado: `e700feb fix(clinic): clear token retry errors (#1141)`.
- Estado inicial: `git status --short --untracked-files=all` limpio.
- Entorno usado: Windows, PowerShell, PNPM.

## Scope incluido

- Paridad estructural del dashboard Clinica frente al benchmark Admin.
- Cockpit operativo en el hub de `/dashboard`.
- Stage unico y persistente para hub/modulos Clinica.
- Bottom navigation mobile propia de Clinica.
- Sincronizacion entre bottom nav, nav horizontal desktop y controller.
- Estados de carga, error, vacio y retry en modulos Clinica dentro del dashboard.
- Cobertura E2E y tests nativos afectados por el cambio.

## Scope excluido

- Backend, API, DB, Drizzle, migraciones y schema.
- Auth, cookies, CORS, CSP, rate limits y seguridad de sesiones.
- Dependencias, `package.json`, lockfiles, CI y workflows.
- Publico `/clinicas`.
- Cambios funcionales en Admin productivo fuera de mantener contratos compartidos del shell.
- Rutas completas Clinica fuera de confirmar que siguen vivas.

## Auditoria previa

- Se confirmo base limpia y rama esperada.
- Se revisaron auditorias y orden operativo existentes en `docs/audit`.
- Se reviso el benchmark Admin: controller, hub, stage, mobile bottom nav y shell.
- Se revisaron superficies Clinica reales: `/dashboard`, command center, resumenes de Informes/Logistica, Perfil publico y Tokens.
- Se buscaron referencias legacy relacionadas con hub, nav, mobile shell, last module y rutas completas.
- Riesgo principal identificado: tocar el shell compartido podia impactar Admin; los cambios quedaron limitados a mantener la misma intencion mobile existente y agregar la nav Clinica.

## Cambios

- `ClinicDashboardWorkspaceController` ahora renderiza un cockpit operativo Clinica con secciones de estado, atencion, continuidad, actividad, modulos y acciones primarias.
- El controller mantiene un stage persistente con `data-dashboard-module-stage` y `data-clinic-dashboard-stage`.
- Se agrego `ClinicMobileBottomNav` con Inicio, Operaciones, Informes, Logistica, Perfil y Tokens.
- Se agrego `clinic-hub-reset` para senales client-side clinic-scoped de reset de hub y activacion de modulo.
- Se agrego `ClinicMobileModuleFrame` para aislar modulos en mobile.
- Se agrego `DashboardRefreshButton` para retry SSR mediante `router.refresh()`.
- Command center, resumenes de Informes/Logistica, Perfil publico y Tokens exponen estados de retry/loading/empty mas claros.
- `DashboardShellRouter` monta bottom nav Admin solo en Admin y bottom nav Clinica en superficies Clinica.
- `DashboardHorizontalNav` sincroniza activacion con el controller Clinica y queda oculto en mobile mediante contrato de componente.
- CSS mobile Clinica agrega no-scroll shell, stage opaco/aislado y bottom nav propia.
- Specs Playwright y tests nativos se actualizaron para cubrir cockpit, stage persistente, bottom nav Clinica, estados y contratos mobile.

## Archivos modificados

- `frontend/src/components/dashboard/ClinicDashboardWorkspaceController.tsx`
- `frontend/src/components/dashboard/ClinicMobileBottomNav.tsx`
- `frontend/src/components/dashboard/ClinicMobileModuleFrame.tsx`
- `frontend/src/components/dashboard/DashboardRefreshButton.tsx`
- `frontend/src/components/dashboard/DashboardHorizontalNav.tsx`
- `frontend/src/components/dashboard/DashboardShellRouter.tsx`
- `frontend/src/lib/clinic-hub-reset.ts`
- `frontend/src/app/dashboard/page.tsx`
- `frontend/src/app/dashboard/ClinicCommandCenter.tsx`
- `frontend/src/app/dashboard/ClinicInformesWorkspaceSummary.tsx`
- `frontend/src/app/dashboard/ClinicLogisticaWorkspaceSummary.tsx`
- `frontend/src/components/dashboard/ClinicParticularTokensCard.tsx`
- `frontend/src/components/dashboard/ClinicPublicProfileCard.tsx`
- `frontend/src/app/globals.css`
- `frontend/e2e/dashboard-clinic-controller-workspace-parity.spec.ts`
- `frontend/e2e/dashboard-clinic-mobile-nav-stage-parity.spec.ts`
- `frontend/e2e/dashboard-clinic-module-state-parity.spec.ts`
- `frontend/e2e/dashboard-clinic-informes-mobile-parity.spec.ts`
- `frontend/e2e/dashboard-clinic-logistica-mobile-parity.spec.ts`
- `frontend/e2e/dashboard-clinic-perfil-mobile-operability.spec.ts`
- `frontend/e2e/dashboard-clinic-tokens-mobile-parity.spec.ts`
- `frontend/e2e/dashboard-mobile-shell-nav-contract.spec.ts`
- `test/frontend-dashboard-horizontal-nav.test.ts`
- `test/frontend-dashboard-hub-hero.test.ts`
- `docs/implementation/clinic-admin-structure-parity.md`

## Validaciones

- `pnpm typecheck:test`: ejecutado, paso.
- `pnpm --dir frontend typecheck`: ejecutado, paso.
- `pnpm --dir frontend lint`: ejecutado, paso.
- `pnpm test`: ejecutado, paso con 2840 tests.
- `pnpm security:public-surface`: ejecutado, paso; reporto solo hallazgos server-only existentes en `frontend/src/proxy.ts`.
- `pnpm build`: ejecutado, paso.
- `pnpm --dir frontend build`: ejecutado, paso.
- Playwright Clinica + shell mobile:
  - `dashboard-clinic-controller-workspace-parity.spec.ts`
  - `dashboard-clinic-mobile-nav-stage-parity.spec.ts`
  - `dashboard-clinic-module-state-parity.spec.ts`
  - `dashboard-clinic-informes-mobile-parity.spec.ts`
  - `dashboard-clinic-logistica-mobile-parity.spec.ts`
  - `dashboard-clinic-perfil-mobile-operability.spec.ts`
  - `dashboard-clinic-tokens-mobile-parity.spec.ts`
  - `dashboard-mobile-shell-nav-contract.spec.ts`
  - Resultado: 83 passed.

## Resultado

La Clinica queda con estructura de dashboard alineada al benchmark Admin: hub operativo, stage persistente, navegacion mobile propia, sincronizacion con desktop y estados de recuperacion en los modulos incluidos.

Las rutas completas `/dashboard/informes`, `/dashboard/logistica`, `/dashboard/logistica/metricas`, `/dashboard/logistica/rutas` y `/dashboard/logistica/visitas` se preservan.

## Riesgo residual

- La evidencia mobile corresponde a Playwright en Chromium con viewports emulados; no reemplaza smoke fisico Android/iOS.
- El shell es compartido; cambios futuros en `DashboardTopbar`, `DashboardHorizontalNav`, `DashboardShellRouter` o `globals.css` deben reejecutar los specs mobile Clinica y Admin relacionados.

## Estado final

- Implementacion completada dentro del scope PR-CL7.
- Sin cambios en backend, API, DB, migraciones, dependencias, lockfiles, auth, CI ni workflows.
- Stage, navegacion y estados Clinica quedan cubiertos por tests nativos y Playwright.
