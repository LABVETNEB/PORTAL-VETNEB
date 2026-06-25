# Clinic Cockpit E2E CI Fix

## Estado base

- Rama auditada: `feat/clinic-admin-structure-parity`.
- HEAD inicial auditado: `dea3911 feat(clinic): align dashboard structure with admin benchmark`.
- `main` local ya estaba actualizado con `origin/main` en `e700feb fix(clinic): clear token retry errors (#1141)`.
- `git merge --no-edit origin/main`: ya informado como `Already up to date`.
- Estado inicial informado y revalidado: working tree limpio antes del cambio.
- Entorno usado: Windows, PowerShell, PNPM.

## Scope incluido

- Fix estricto del Frontend CI fallido en `frontend/e2e/dashboard-card-navigation-shell.spec.ts`.
- Actualizacion del contrato E2E de Clinica desde hub/cards legacy hacia cockpit operativo PR-CL7.
- Cobertura de acciones/modulos Clinica, estructura cockpit, activacion de workspaces, retorno a `Vista general`, no-scroll global y aislamiento entre workspaces.
- Documentacion de entrega requerida por el protocolo del repositorio.

## Scope excluido

- No se revirtio PR-CL7.
- No se reintrodujo el hub viejo, hero ni launcher de cards de Clinica.
- No se modifico implementacion productiva de Clinica.
- No se modifico Admin productivo ni su contrato de cards.
- No se tocaron backend, API, auth, DB, migraciones, dependencias, lockfiles, CI, workflows ni scripts de package.
- No se toco la pagina publica `/clinicas`.
- No se cambiaron rutas full existentes.

## Auditoria previa

- Se confirmo rama `feat/clinic-admin-structure-parity`, HEAD `dea3911` y ausencia de diff inicial.
- Se confirmo que existen los scripts reales pedidos: `pnpm test`, `pnpm typecheck:test` y `pnpm --dir frontend lint`.
- Se leyo el spec fallido `dashboard-card-navigation-shell.spec.ts`.
- Se leyeron los componentes reales de cockpit, mobile nav, horizontal nav y shell router de Clinica.
- Se leyeron los specs PR-CL7 relacionados para mantener paridad de contrato.
- Se busco legado de cards y selectores `.rounded-lg.bg-gradient-to-br` dentro del scope.
- Riesgo identificado: el spec combina Clinica y Admin; el cambio debia limitarse a Clinica sin debilitar el contrato Admin.

## Cambios

- Se agregaron helpers E2E de cockpit Clinica:
  - `clinicCockpit`
  - `clinicCockpitModule`
  - `clinicCockpitAction`
- Los tests iniciales de Clinica dejaron de validar cards legacy y ahora validan:
  - `[data-clinic-cockpit="true"]`
  - `[data-clinic-cockpit-status="true"]`
  - `[data-clinic-cockpit-attention="true"]`
  - `[data-clinic-cockpit-continuity="true"]`
  - `[data-clinic-cockpit-activity="true"]`
  - `[data-clinic-cockpit-modules="true"]`
  - `[data-clinic-cockpit-primary-actions="true"]`
- Los accesos de Clinica ahora usan acciones reales:
  - `Abrir operaciones`
  - `Abrir informes`
  - `Abrir logistica`
  - `Abrir perfil`
  - `Generar o abrir tokens`
- La activacion de workspaces Clinica ahora valida URL `?module=` y workspace visible por `data-dashboard-module-workspace`.
- Los tests de no-scroll y aislamiento Clinica abren modulos desde el cockpit, no desde cards legacy.
- Admin conserva el helper de cards porque su contrato productivo sigue basado en hub/cards.

## Archivos modificados

- `frontend/e2e/dashboard-card-navigation-shell.spec.ts`
- `docs/implementation/clinic-cockpit-e2e-ci-fix.md`

## Validaciones

- `git diff --check`: ejecutado, paso.
- `pnpm --dir frontend exec playwright test e2e/dashboard-card-navigation-shell.spec.ts`: ejecutado, paso con `67 passed`.
- `pnpm --dir frontend exec playwright test e2e/dashboard-card-navigation-shell.spec.ts e2e/dashboard-clinic-controller-workspace-parity.spec.ts e2e/dashboard-clinic-mobile-nav-stage-parity.spec.ts e2e/dashboard-clinic-module-state-parity.spec.ts`: ejecutado, paso con `113 tests`.
- `pnpm --dir frontend lint`: ejecutado, paso.
- `pnpm typecheck:test`: ejecutado, paso.
- `pnpm test`: primera ejecucion fallo porque Next/Playwright habia mutado `frontend/next-env.d.ts` a `./.next/dev/types/routes.d.ts`; se retiro esa mutacion generada y se reejecuto.
- `pnpm test`: segunda ejecucion paso con `2840 passed`.

## Resultado

El spec de Frontend CI queda alineado al cockpit operativo real de Clinica. La cobertura ya no espera el launcher viejo de cards y valida acciones, estructura y navegacion del cockpit PR-CL7.

## Riesgo residual

- Playwright levanta Next dev y puede volver a mutar `frontend/next-env.d.ts` hacia `.next/dev/types/routes.d.ts`; se verifico y retiro esa mutacion generada antes de cerrar.
- No se tocaron componentes productivos porque el DOM real ya exponia nombres accesibles suficientes por texto visible.

## Estado final

- Implementacion completada dentro del scope del fix CI frontend.
- Sin cambios en backend, API, auth, DB, migraciones, dependencias, lockfiles, CI ni workflows.
- Cockpit Clinica preservado.
- Admin preservado.
