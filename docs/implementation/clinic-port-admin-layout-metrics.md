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

## Fix CI Tokens mobile inline detail

### Estado base

- Fecha: 2026-06-26.
- Rama: `fix/clinic-port-admin-layout-metrics`.
- HEAD auditado: `0ae6fa4 fix(clinic): port admin dashboard layout metrics to clinic modules`.
- Estado inicial del fix: `git status --short --untracked-files=all` limpio.
- Entorno: Windows, PowerShell, PNPM 10.8.1.

### Scope incluido

- Corregir exclusivamente Tokens Clinica mobile para mantener visible la lista al seleccionar un token.
- Mantener visibles `#clinic-particular-token-1` y `#clinic-particular-token-2` despues de abrir el detalle de token 2.
- Compactar lista y detalle dentro de `ModuleSurface` sin scroll interno visible.
- Reforzar tests e2e y nativo del contrato de lista visible.
- Actualizar esta evidencia de implementacion.

### Scope excluido

- Dashboard Admin productivo, salvo lectura y validacion opcional.
- Backend, API, auth, DB, migraciones, dependencias, lockfiles, CI y workflows.
- Cambios globales de CSS o refactors fuera del modulo Tokens Clinica.

### Auditoria previa

- Base limpia y rama esperada confirmadas.
- Scripts reales confirmados: `pnpm test`, `pnpm build`, `pnpm security:public-surface`, `pnpm --dir frontend lint`, `pnpm --dir frontend typecheck`, `pnpm --dir frontend build`, `pnpm typecheck:test`.
- Archivos leidos del scope: componente Tokens Clinica, `globals.css`, specs e2e indicados, test nativo de Tokens y este documento.
- Referencia legacy vinculada al fallo: el componente aplicaba `hasOpenDetail && !isSelected && "hidden sm:block"` en cada fila no seleccionada.

### Causa raiz

- Al abrir detalle mobile, Tokens Clinica ocultaba las filas no seleccionadas para reducir altura.
- Eso dejaba `#clinic-particular-token-1` en estado hidden despues de seleccionar `#clinic-particular-token-2`, rompiendo el contrato de lista visible.

### Cambios

- `ClinicParticularTokensCard`:
  - Reemplaza el ocultamiento mobile de filas no seleccionadas por una compactacion visual (`opacity-90`).
  - Mantiene la lista en flujo con 4 filas visibles y `min-h-[12rem]` mobile en el cuerpo de lista.
  - Ajusta panel de lista y detalle a `flex-none` en mobile y `sm:flex-1` en viewports mayores.
  - Compacta el detalle mobile: menos padding/gap, heading menor, badges densos y grilla de 3 columnas.
  - No agrega `overflow-y-auto`, `overflow-y: auto`, `overflow-y: scroll` ni `dashboard-inline-scroll`.
- Specs e2e:
  - `dashboard-global-masked-master-detail.spec.ts` ahora verifica que token 2 tambien siga visible tras el click.
  - `dashboard-clinic-tokens-mobile-parity.spec.ts` ahora verifica token 1 y token 2 visibles con detalle abierto.
- Test nativo:
  - `frontend-dashboard-clinic-tokens.test.ts` blinda que no vuelva el patron `hidden sm:block` para filas no seleccionadas.

### Archivos modificados

- `frontend/src/components/dashboard/ClinicParticularTokensCard.tsx`
- `frontend/e2e/dashboard-global-masked-master-detail.spec.ts`
- `frontend/e2e/dashboard-clinic-tokens-mobile-parity.spec.ts`
- `test/frontend-dashboard-clinic-tokens.test.ts`
- `docs/implementation/clinic-port-admin-layout-metrics.md`

### Validaciones

- `git diff --check`: ejecutado, paso; solo avisos CRLF de Git en Windows.
- `pnpm --dir frontend exec playwright test e2e/dashboard-global-masked-master-detail.spec.ts`: ejecutado, paso; 16/16.
- `pnpm --dir frontend exec playwright test e2e/dashboard-global-masked-master-detail.spec.ts e2e/dashboard-clinic-tokens-mobile-parity.spec.ts e2e/dashboard-internal-no-scroll-contract.spec.ts e2e/dashboard-workspace-layout-polish.spec.ts`: ejecutado, paso; 45/45.
- `pnpm --dir frontend lint`: ejecutado, paso.
- `pnpm typecheck:test`: ejecutado, paso.
- `pnpm --dir frontend build`: ejecutado, paso.
- `pnpm test`: ejecutado, paso; 2840/2840.
- `pnpm --dir frontend typecheck`: ejecutado, paso.
- `pnpm security:public-surface`: ejecutado, paso; sin exposicion publica, solo findings informativos `server-only` existentes en `frontend/src/proxy.ts`.
- `pnpm build`: ejecutado, paso.
- `pnpm --dir frontend exec playwright test e2e/admin-mobile-bottom-navigation-no-scroll.spec.ts`: ejecutado, paso; 4/4.

### Resultado

- Tokens Clinica mobile mantiene la lista visible al seleccionar token 2.
- `#clinic-particular-token-1` y `#clinic-particular-token-2` quedan visibles con detalle abierto.
- El detalle sigue inline compacto dentro del modulo.
- No se restauro scroll interno visible.

### Riesgo residual

- La evidencia visual/no-scroll se valido en Chromium Playwright; no reemplaza prueba manual en dispositivo fisico.

### Estado final del fix

- Implementacion completada y validada.
- Sin cambios en Admin productivo, backend, API, auth, DB, migraciones, dependencias, lockfiles, CI ni workflows.
