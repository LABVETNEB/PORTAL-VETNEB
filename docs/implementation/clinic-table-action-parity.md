# Clinic Table Action Parity

## Estado base

- Rama: `fix/clinic-table-action-parity`.
- HEAD inicial auditado: `6670f81 fix(clinic): port admin dashboard layout metrics to clinic modules (#1144)`.
- Estado inicial: `git status --short` limpio.
- Entorno usado: Windows, PowerShell, PNPM.

## Scope incluido

- Reestructurar Tokens Clinica como tabla/lista compacta con accion por fila.
- Reestructurar Informes Clinica como tabla/lista compacta con accion por fila.
- Mantener funciones clinicas existentes sin convertir Clinica en Admin.
- Actualizar tests e2e y tests nativos relacionados.
- Documentar la implementacion en `docs/implementation`.

## Scope excluido

- Backend, API, DB, Drizzle, migraciones, schema y endpoints.
- Auth, cookies, CORS, CSP, rate limits y seguridad de sesiones.
- Dependencias, `package.json`, lockfiles, CI y workflows.
- Pagina publica `/clinicas`.
- Cambios productivos en dashboard Admin; Admin se uso solo como referencia de lectura.
- Copia de textos, permisos, modulos, filtros o acciones administrativas en Clinica.

## Auditoria previa

- Se confirmo rama esperada y base limpia.
- Se confirmaron scripts reales en `package.json` y `frontend/package.json`.
- Se leyeron referencias Admin: `AdminParticularTokensCard`, `AdminReportsCard`, `DashboardModuleWorkspace`, `ModuleSurface`, `CompactPager` y `globals.css`.
- Se leyeron superficies Clinica: `ClinicParticularTokensCard`, `ClinicInformesWorkspaceSummary` y `ClinicDashboardWorkspaceController`.
- Se ubicaron tests e2e obligatorios y tests nativos relacionados.
- Referencias legacy detectadas en el scope: Tokens e Informes Clinica usaban detalle inline con `dashboard-inline-detail` y `data-detail-state="selected"`.

## Estructura Admin extraida

- Toolbar superior fija con metricas y acciones.
- Tabla o lista compacta full-width.
- Filas densas con columnas operativas.
- Boton de accion por fila.
- Paginacion o footer visible al pie del modulo.
- Detalle controlado en dialogo, no expandido dentro de la lista principal.

## Cambios

- `ClinicParticularTokensCard`:
  - Reemplaza el master-detail inline por tabla desktop y lista mobile.
  - Agrega boton `Ver detalle` por fila.
  - Mueve el detalle clinico a `ModuleDialog`.
  - Conserva generacion de token, actualizacion, listado, estado activo/inactivo, informe vinculado, seguimiento, detalle y paginacion.
- `ClinicInformesWorkspaceSummary`:
  - Reemplaza el detalle inline por tabla/lista compacta.
  - Agrega boton `Ver` por fila.
  - Mueve el detalle a `ModuleDialog`.
  - Conserva `Abrir modulo completo`, datos de caso/paciente, estudio, estado, fecha y archivo/informe.
- Tests:
  - E2E de Tokens/Informes validan filas compactas, accion por fila, ausencia de detalle inline y footer visible.
  - El contrato global de no-scroll valida detalle en dialogo para Tokens.
  - Tests nativos actualizan el contrato fuente de Tokens e Informes Clinica.

## Archivos modificados

- `frontend/src/components/dashboard/ClinicParticularTokensCard.tsx`
- `frontend/src/app/dashboard/ClinicInformesWorkspaceSummary.tsx`
- `frontend/e2e/dashboard-clinic-tokens-mobile-parity.spec.ts`
- `frontend/e2e/dashboard-clinic-informes-mobile-parity.spec.ts`
- `frontend/e2e/dashboard-global-masked-master-detail.spec.ts`
- `test/frontend-dashboard-clinic-tokens.test.ts`
- `test/frontend-dashboard-home.test.ts`
- `docs/implementation/clinic-table-action-parity.md`

## Funciones clinicas preservadas

- Tokens: generar token particular, actualizar, listar tokens de la clinica, ver activo/inactivo, ver informe vinculado, ver detalle clinico y paginar.
- Informes: consultar informes recientes, ver caso/paciente, estudio, estado, fecha, archivo/informe, abrir detalle y abrir el modulo completo.

## Confirmacion de no duplicar Admin

- No se importaron helpers Admin en Clinica.
- No se agregaron acciones administrativas como eliminar tokens, gestionar clinicas, usuarios, auditoria, sesiones o mantenimiento.
- No se copiaron filtros, permisos, datos ni textos administrativos.
- Admin productivo solo se leyo como referencia visual y estructural.

## Validaciones

- `pnpm install --frozen-lockfile --ignore-scripts`: ejecutado como precondicion para restaurar `node_modules`; paso sin modificar lockfile.
- `git diff --check`: paso. Git informo solo warnings de normalizacion LF/CRLF en dos archivos TSX.
- `pnpm --dir frontend exec playwright test e2e/dashboard-clinic-tokens-mobile-parity.spec.ts e2e/dashboard-clinic-informes-mobile-parity.spec.ts e2e/dashboard-global-masked-master-detail.spec.ts e2e/dashboard-internal-no-scroll-contract.spec.ts e2e/dashboard-workspace-layout-polish.spec.ts`: paso, 48/48.
- `pnpm --dir frontend lint`: paso.
- `pnpm typecheck:test`: paso.
- `pnpm --dir frontend typecheck`: paso.
- `pnpm build`: paso.
- `pnpm security:public-surface`: paso; el script reporto notas/finding server-only existentes sobre identificadores de cookies en `frontend/src/proxy.ts`.
- `pnpm --dir frontend build`: paso.
- `pnpm test`: paso, 2841/2841.

Nota de ejecucion: el `pnpm` primero en PATH era el wrapper del runtime de Codex y bloqueaba la ejecucion por preflight de install. Para validar se uso el PNPM del sistema (`C:\Program Files\nodejs\pnpm.CMD`, version 10.8.1), que coincide con `packageManager`.

## Riesgo residual

- Bajo: el cambio queda acotado a presentacion y tests del dashboard Clinica.
- El detalle de Informes usa acciones de archivo existentes para scope `clinic`; no agrega endpoints.

## Estado final

- Working tree con cambios solo en archivos frontend/test/doc del scope.
- Sin cambios en backend, API, auth, DB, migraciones, dependencias, lockfiles, CI ni Admin productivo.
- `git status --short --untracked-files=all` muestra los archivos modificados y esta nota nueva sin stage.
