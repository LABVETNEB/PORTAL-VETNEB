# Clinic Port Admin Layout Metrics

## Estado base

- Rama: `fix/clinic-port-admin-layout-metrics`.
- HEAD inicial auditado: `102eebc fix(dashboard): align shell frame insets and viewport fit (#1143)`.
- Estado inicial: `git status --short --untracked-files=all` limpio.
- Entorno usado: Windows, PowerShell, PNPM.

## Scope incluido

- Portar metricas estructurales del dashboard Admin a modulos Clinica.
- Reestructurar Tokens Clinica sin duplicar funciones Admin.
- Reestructurar Perfil Clinica sin convertirlo en formulario largo con scroll.
- Mantener funciones clinicas actuales: operaciones, informes, tokens particulares, logistica y perfil publico.
- Reforzar tests e2e y tests nativos del contrato no-scroll y de estructura.

## Scope excluido

- Backend, API, DB, Drizzle, migraciones, schema y endpoints.
- Auth, cookies, CORS, CSP, rate limits y seguridad de sesiones.
- Dependencias, `package.json`, lockfiles, CI y workflows.
- Pagina publica `/clinicas`.
- Cambios productivos en dashboard Admin; Admin se uso solo como referencia de lectura.
- Copia de textos, permisos, modulos o funciones administrativas en Clinica.

## Auditoria previa

- Se confirmo base limpia, rama esperada y ultimo commit.
- Se confirmaron scripts reales en `package.json` y `frontend/package.json`.
- Se leyeron referencias Admin: `DashboardModuleWorkspace`, `ModuleSurface`, `ModuleTabs`, `AdminDashboardWorkspaceController`, `AdminCommandCenter`, `AdminParticularTokensCard` y `globals.css`.
- Se leyeron superficies Clinica: controller, Tokens, Perfil, mobile frame, command center, Informes y Logistica.
- Se revisaron specs e2e indicados y tests fuente relacionados.
- Referencias legacy detectadas en el scope: `dashboard-inline-scroll` en Tokens Clinica y `overflow-y-auto` en Perfil Clinica.

## Metricas Admin extraidas

- Stage/frame: `dashboard-main` usa `--dash-frame-inset-inline`, `--dash-frame-inset-block-start` y `--dash-frame-inset-block-end`.
- Padding base: `--dash-pad-x: clamp(0.75rem, 0.45rem + 1vw, 2rem)`.
- Padding vertical base: `--dash-pad-y: clamp(0.6rem, 0.4rem + 0.7vh, 1.5rem)`.
- Rhythm entre secciones: `--dash-rhythm: clamp(0.6rem, 0.4rem + 0.7vh, 1.5rem)`.
- Gap de modulo: `--dash-gap: clamp(0.55rem, 0.35rem + 0.55vh, 1rem)`.
- Superficie de modulo: `dashboard-module-surface` es `flex`, `min-height: 0`, `flex: 1 1 auto`, `overflow: hidden`.
- Toolbar: `dashboard-module-toolbar` es fija, `flex-wrap`, `gap: 0.5rem 0.75rem`.
- Body: `dashboard-module-body` crece con `flex: 1 1 auto`, `min-height: 0` y `overflow: hidden`.
- Tabs: `dashboard-module-tabs` y `dashboard-module-tabpanel` mantienen `flex: 1 1 auto`, `min-height: 0`.
- Altura tabs: `--dash-tab-h: clamp(1.9rem, 1.6rem + 0.7vh, 2.25rem)`.
- Paneles: `--dash-panel-min: clamp(6rem, 1rem + 18vh, 18rem)`.
- Densidad de filas: `--dash-list-pad-y: clamp(0.4rem, 0.3rem + 0.25vh, 0.65rem)`.
- Footer/paginacion: `dashboard-compact-pager` queda `flex-shrink: 0` y visible en el cuerpo del modulo.

## Valores portados a Clinica

- Tokens y Perfil ahora usan `ModuleSurface`, por lo tanto heredan `dashboard-module-surface`, `dashboard-module-toolbar`, `dashboard-module-body`, `--dash-gap` y la cadena `min-h-0 + overflow hidden`.
- `globals.css` agrega reglas acotadas a `[data-vetneb-app-shell-surface="clinic"]` para toolbar de Tokens/Perfil y cuerpos no-scroll.
- Tokens reemplaza lista scrollable por lista paginada bounded con `data-clinic-access-list-body`.
- Perfil reemplaza formulario largo por tabs internos `Estado`, `Datos`, `Contacto` y `Contenido`.
- Las acciones primarias quedan en toolbar: `Generar token particular`, `Actualizar` y `Guardar perfil publico`.
- La paginacion de Tokens queda visible con `CompactPager`.

## Cambios

- `ClinicParticularTokensCard`:
  - Migra de `Card` a `ModuleSurface`.
  - Mueve metricas y acciones a toolbar compacta.
  - Elimina `dashboard-inline-scroll`.
  - Separa lista paginada y detalle compacto.
  - Conserva alta de token en `ModuleDialog`.
  - Conserva estado activo/inactivo, informe vinculado, seguimiento, detalle y paginacion.
- `ClinicPublicProfileCard`:
  - Migra de `Card` a `ModuleSurface`.
  - Mueve `Guardar perfil publico` a toolbar del modulo.
  - Divide campos en tabs compactos para evitar scroll largo.
  - Elimina `overflow-y-auto`.
  - Conserva avatar/logo, visibilidad, calidad, datos, contenido y guardado.
- `globals.css`:
  - Agrega reglas Clinica scoped para toolbars y cuerpos bounded no-scroll.
- Tests:
  - Tokens mobile valida lista sin scroll interno, toolbar, accion primaria, paginador y ausencia de modulos Admin.
  - Perfil mobile valida tabs, accion primaria visible y cero contenedores scroll internos.
  - Layout polish e internal no-scroll cubren `perfil` y `tokens`.
  - Tests fuente actualizan contratos de Tokens y Perfil.

## Archivos modificados

- `frontend/src/app/globals.css`
- `frontend/src/components/dashboard/ClinicParticularTokensCard.tsx`
- `frontend/src/components/dashboard/ClinicPublicProfileCard.tsx`
- `frontend/e2e/dashboard-clinic-tokens-mobile-parity.spec.ts`
- `frontend/e2e/dashboard-clinic-perfil-mobile-operability.spec.ts`
- `frontend/e2e/dashboard-workspace-layout-polish.spec.ts`
- `frontend/e2e/dashboard-internal-no-scroll-contract.spec.ts`
- `test/frontend-dashboard-clinic-tokens.test.ts`
- `test/frontend-clinic-public-profile.test.ts`
- `docs/implementation/clinic-port-admin-layout-metrics.md`

## Funciones clinicas preservadas

- Generar token particular.
- Actualizar tokens.
- Listar tokens de la clinica.
- Ver estado activo/inactivo.
- Ver si el token tiene informe.
- Ver detalle y seguimiento del token clinico.
- Paginacion de tokens.
- Publicar/actualizar perfil publico.
- Estado de visibilidad, calidad/completitud, avatar/logo, datos, contenido y guardado.

## Confirmacion de no duplicar Admin

- No se importaron helpers Admin en Clinica.
- No se agregaron permisos, modulos ni textos administrativos a Clinica.
- No se copiaron acciones Admin como eliminar tokens, gestionar clinicas, usuarios, auditoria, precios, sesiones o mantenimiento.
- Los tests e2e verifican ausencia de `Usuarios y roles`, `Auditoria` y `Mantenimiento` en Tokens/Perfil Clinica.

## Scroll eliminado

- Tokens Clinica: se removio `dashboard-inline-scroll` del modulo.
- Perfil Clinica: se removio `overflow-y-auto` de los paneles.
- Se agregaron assertions e2e para detectar `overflow-y: auto/scroll` dentro de Tokens y Perfil.
- `body`, `html` y `main.dashboard-main` siguen bajo contrato no-scroll.

## Validaciones

- `git diff --check`: ejecutado, paso; solo avisos CRLF de Git en Windows.
- `pnpm --dir frontend typecheck`: ejecutado, paso.
- `pnpm --dir frontend exec playwright test e2e/dashboard-clinic-tokens-mobile-parity.spec.ts`: ejecutado, paso; 3/3.
- `pnpm --dir frontend exec playwright test e2e/dashboard-clinic-perfil-mobile-operability.spec.ts`: ejecutado, paso; 3/3.
- `pnpm --dir frontend exec playwright test e2e/dashboard-workspace-layout-polish.spec.ts`: ejecutado, paso; 18/18.
- `pnpm --dir frontend exec playwright test e2e/dashboard-internal-no-scroll-contract.spec.ts`: ejecutado, paso; 8/8.
- `pnpm --dir frontend exec playwright test e2e/admin-mobile-bottom-navigation-no-scroll.spec.ts`: ejecutado, paso; 4/4.
- `pnpm --dir frontend lint`: ejecutado, paso.
- `pnpm typecheck:test`: ejecutado, paso.
- `pnpm --dir frontend build`: ejecutado, paso.
- `pnpm test`: ejecutado, paso; 2840/2840.
- `pnpm security:public-surface`: ejecutado, paso; solo reporto hallazgos `server-only` existentes en `frontend/src/proxy.ts`.
- `pnpm build`: ejecutado, paso.

## Riesgo residual

- La evidencia visual/no-scroll depende de Playwright Chromium; no reemplaza smoke en dispositivo fisico.
- Informes y Logistica conservan `dashboard-inline-scroll` existente porque el pedido duro de eliminacion aplica a Tokens y Perfil; cambiarlos globalmente podria romper contratos fuera del scope.

## Estado final

- Implementacion completada y validada.
- Sin cambios en backend, API, auth, DB, migraciones, dependencias, lockfiles, CI ni workflows.
