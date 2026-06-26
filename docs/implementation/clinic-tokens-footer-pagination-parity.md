# Clinic Tokens Footer Pagination Parity

## Estado base

- Rama: `fix/clinic-tokens-footer-pagination-parity`.
- HEAD inicial auditado: `11b4880 fix(clinic): match admin table action structure for reports and tokens (#1145)`.
- Estado inicial: `git status --short --untracked-files=all` limpio.
- Entorno usado: Windows, PowerShell, PNPM.

## Scope incluido

- Ajustar solo Tokens Clinica para que la paginacion cierre el modulo como footer inferior.
- Eliminar el conteo inferior izquierdo del listado de Tokens Clinica.
- Agregar continuidad visual del listado para futuras cargas mediante slots estructurales vacios.
- Mantener lista/tabla compacta con boton `Ver detalle`.
- Actualizar tests relacionados con el contrato visual y no-scroll.

## Scope excluido

- Backend, API, DB, Drizzle, migraciones, schema y endpoints.
- Auth, cookies, CORS, CSP, rate limits y seguridad de sesiones.
- Dependencias, `package.json`, lockfiles, CI y workflows.
- Cambios productivos en dashboard Admin; Admin se uso solo como referencia de lectura.
- Reintroduccion de master-detail inline o scroll interno visible.

## Auditoria previa

- Se confirmo rama esperada y base limpia.
- Se leyeron `ClinicParticularTokensCard`, `globals.css`, `CompactPager`, `ModuleSurface`, e2e indicados, test nativo de Tokens Clinica y la nota `clinic-table-action-parity.md`.
- Se confirmaron scripts reales: `pnpm test`, `pnpm typecheck:test`, `pnpm --dir frontend lint`, `pnpm --dir frontend build` y e2e Playwright solicitados.
- Se uso `AdminParticularTokensCard` solo como referencia de lectura para footer inferior y paginacion.
- Referencia legacy detectada: `dashboard-global-masked-master-detail.spec.ts` todavia esperaba el rango visible `1-4 de 6 tokens`.

## Cambios

- `ClinicParticularTokensCard`:
  - Reemplaza el `CompactPager` visible de Tokens Clinica por un footer integrado al borde inferior del panel.
  - Ubica controles `Anterior`, `Pagina N / M` y `Siguiente` abajo a la derecha.
  - Elimina el texto de rango `1-4 de N tokens`.
  - Conserva columnas `Token / Paciente`, `Estado`, `Informe`, `Ultimo acceso o creado`, `Accion`.
  - Conserva botones superiores `Actualizar` y `Generar token particular`.
  - Mantiene `Ver detalle` por fila y detalle en `ModuleDialog`.
- `globals.css`:
  - Agrega CSS scoped a superficie Clinica para pintar slots estructurales vacios debajo de las filas.
  - Mantiene `overflow: hidden` y no crea scroll containers.
- Tests:
  - El e2e movil valida footer inferior, controles a la derecha, slots estructurales, ausencia del rango y no-scroll.
  - El e2e global relacionado deja de exigir el rango legacy.
  - El test nativo actualiza el contrato fuente de Tokens Clinica.

## Archivos modificados

- `frontend/src/components/dashboard/ClinicParticularTokensCard.tsx`
- `frontend/src/app/globals.css`
- `frontend/e2e/dashboard-clinic-tokens-mobile-parity.spec.ts`
- `frontend/e2e/dashboard-global-masked-master-detail.spec.ts`
- `test/frontend-dashboard-clinic-tokens.test.ts`
- `docs/implementation/clinic-tokens-footer-pagination-parity.md`

## Validaciones

- `git diff --check`: paso. Git informo solo warnings de normalizacion LF/CRLF en archivos ya tocados.
- `pnpm --dir frontend exec playwright test e2e/dashboard-clinic-tokens-mobile-parity.spec.ts`: paso, 3/3.
- `pnpm --dir frontend exec playwright test e2e/dashboard-internal-no-scroll-contract.spec.ts`: paso, 8/8.
- `pnpm --dir frontend exec playwright test e2e/dashboard-workspace-layout-polish.spec.ts`: paso, 18/18.
- `pnpm --dir frontend lint`: paso.
- `pnpm typecheck:test`: paso.
- `pnpm --dir frontend build`: paso.
- `pnpm test`: paso, 2841/2841.
- Validacion adicional por test tocado: `pnpm --dir frontend exec playwright test e2e/dashboard-global-masked-master-detail.spec.ts`: paso, 16/16.

Nota de ejecucion: el `pnpm` primero en PATH era el wrapper del runtime de Codex y fallo al intentar `install` sin TTY. Las validaciones se ejecutaron con el PNPM del sistema (`C:\Program Files\nodejs\pnpm.CMD`) y PATH ajustado para que el webServer de Playwright use el mismo binario.

## Riesgo residual

- Bajo: cambio acotado a presentacion y tests de Tokens Clinica.
- La referencia Admin no se modifica.
- No se tocan rutas, contratos API, auth, DB, dependencias ni CI.

## Estado final

- Working tree sin stage, con cambios acotados a frontend/test/doc del scope.
- Sin cambios en backend, API, auth, DB, migraciones, dependencias, lockfiles, CI ni Admin productivo.
