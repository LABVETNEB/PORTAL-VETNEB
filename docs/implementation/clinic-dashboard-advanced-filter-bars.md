# Clinic dashboard advanced filter bars

## Estado base

- Repo: `C:\PORTAL-VETNEB`.
- Rama: `feat/clinic-dashboard-advanced-filter-bars`.
- HEAD inspeccionado: `6117d06 feat(admin): add report upload advanced filters (#1190)`.
- Working tree inicial: limpio.

## Objetivo

Aplicar el patron de barra de filtros avanzada ya consolidado en Dashboard
Administracion a Dashboard Clinica, limitado a:

- Clinica -> Informes: `/dashboard?module=informes`.
- Clinica -> Tokens: `/dashboard?module=tokens`.

## Scope incluido

- Frontend de Dashboard Clinica.
- Modulos `informes` y `tokens`.
- Filtros sobre datos reales visibles en tablas/listas actuales.
- Tests nativos de contrato fuente para los dos modulos.

## Scope excluido

- Backend, DB, migraciones y contratos API.
- Dependencias, `package.json`, `pnpm-lock.yaml`.
- Auth, cookies, permisos, CSRF, CSP, rate limits.
- Workflows, CI, Dependabot.
- Dashboard Administracion, salvo lectura del patron existente.
- Navegacion global, sidebar y layout global del dashboard.
- Commit, push y PR.

## Auditoria previa

- Base limpia confirmada con `git status --short`.
- Rama actual confirmada con `git branch --show-current`.
- HEAD local coincide con la base obligatoria indicada.
- Patron Admin inspeccionado:
  - `frontend/src/app/dashboard/admin/AdminAuditFilterBar.tsx`
  - `frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx`
  - `frontend/src/app/dashboard/admin/AdminReportsCard.tsx`
- Modulos reales de Clinica identificados:
  - `frontend/src/app/dashboard/ClinicInformesWorkspaceSummary.tsx`
  - `frontend/src/components/dashboard/ClinicParticularTokensCard.tsx`
- Tests nativos existentes identificados:
  - `test/frontend-dashboard-home.test.ts`
  - `test/frontend-dashboard-clinic-tokens.test.ts`
  - `test/frontend-dashboard-informes.test.ts`
- E2E relacionados identificados:
  - `frontend/e2e/dashboard-clinic-informes-mobile-parity.spec.ts`
  - `frontend/e2e/dashboard-clinic-tokens-mobile-parity.spec.ts`
  - `frontend/e2e/dashboard-real-app-shell-no-scroll-contract.spec.ts`
  - `frontend/e2e/dashboard-internal-no-scroll-contract.spec.ts`
  - `frontend/e2e/dashboard-accessibility-keyboard.spec.ts`

## Columnas y datos reales detectados

### Informes

- Informe / ID: `Informe #{report.id}`.
- Paciente: `report.patientName`.
- Estudio: `report.studyType`.
- Estado: `report.status`.
- Fecha visible: `report.uploadDate`.
- Archivo / informe: `report.fileName` o estado derivado de `report.hasFile`.
- Accion existente: `Ver`, detalle y `ReportFileActions`.

### Tokens

- Token: `token.tokenLast4`.
- Paciente: `token.petName`.
- Tutor: `token.tutorLastName`.
- Estado: `token.isActive`.
- Informe vinculado: `token.reportId` / `token.hasLinkedReport`.
- Fecha visible: `token.lastLoginAt` o `token.createdAt`.
- Accion existente: `Ver detalle`, dialog de detalle, copia/generacion de token.

## Campos filtrados

### Informes

- Informe.
- Paciente.
- Estado.
- Estudio.
- Archivo.
- Desde.
- Hasta.

### Tokens

- Token.
- Informe.
- Paciente / tutor.
- Estado.
- Desde.
- Hasta.

## Decision de fecha

- Informes: `uploadDate`, porque es la fecha principal visible en tabla/lista.
- Tokens: `lastLoginAt ?? createdAt`, porque la columna visible dice
  "Ultimo acceso o creado" y mobile muestra la misma fecha operativa.

## Cambios

- Se agregaron filtros avanzados in-memory sobre los datos ya cargados.
- La paginacion ahora opera sobre el resultado filtrado en ambos modulos.
- Mobile usa boton `Filtros` con `ModuleDialog` para no aumentar alto permanente.
- Desktop/tablet usa barra compacta horizontal con wrap controlado.
- Se preservaron acciones, estados vacios, detalle, descarga/visualizacion,
  generacion y copia de token.

## Archivos modificados

- `frontend/src/app/dashboard/ClinicInformesWorkspaceSummary.tsx`
- `frontend/src/components/dashboard/ClinicParticularTokensCard.tsx`
- `test/frontend-dashboard-home.test.ts`
- `test/frontend-dashboard-clinic-tokens.test.ts`
- `docs/implementation/clinic-dashboard-advanced-filter-bars.md`

## Comportamiento responsive

- Desktop: barra compacta `md+`, alineada al patron Admin.
- Tablet: grilla con wrap controlado.
- Mobile Android/iOS: boton `Filtros` y dialog compacto con `Aplicar` y
  `Limpiar` visibles.
- Sin uso de scroll interno artificial para resolver filtros.

## Validaciones

- `git diff --check`: OK.
- `node --experimental-strip-types --experimental-specifier-resolution=node --test test/frontend-dashboard-home.test.ts`: OK, 12/12.
- `node --experimental-strip-types --experimental-specifier-resolution=node --test test/frontend-dashboard-clinic-tokens.test.ts`: OK, 13/13.
- `node --experimental-strip-types --experimental-specifier-resolution=node --test test/frontend-public-devtools-exposure-contract.test.ts`: OK, 9/9 tras renombrar el hook `data-*` de tokens a `data-clinic-access-filter-bar`.
- `corepack pnpm --dir frontend typecheck`: OK.
- `corepack pnpm --dir frontend lint`: OK.
- `corepack pnpm test`: OK, 2896/2896.
- `corepack pnpm --dir frontend build`: OK.
- `corepack pnpm build`: OK.
- `corepack pnpm security:public-surface`: OK, sin findings publicos; mantiene notas server-only existentes de `frontend/src/proxy.ts`.
- `corepack pnpm --dir frontend exec playwright test e2e/dashboard-clinic-informes-mobile-parity.spec.ts e2e/dashboard-clinic-tokens-mobile-parity.spec.ts e2e/dashboard-real-app-shell-no-scroll-contract.spec.ts e2e/dashboard-internal-no-scroll-contract.spec.ts --workers=1`: OK, 51/51.

Nota de entorno:

- `pnpm --dir frontend typecheck` y `pnpm --dir frontend lint` con el PNPM global del runtime fallaron antes de ejecutar scripts porque era PNPM `11.7.0` y no respetaba el lockfile con la configuracion del repo.
- Se uso `corepack pnpm` para respetar `packageManager: pnpm@10.8.1`.
- Para Playwright se antepuso `C:\Program Files\nodejs` al `PATH` para que el `webServer` de la config use el shim de Corepack en `pnpm dev`.

## Riesgos y regresion

- Los filtros operan sobre datos ya cargados; no amplian el universo server-side.
- No se modificaron contratos API ni paginacion backend.
- Riesgo principal: densidad mobile/no-scroll. Mitigacion: dialog mobile en vez
  de barra completa permanente.

## Verificacion visual

Realizada por E2E mobile parity y no-scroll:

- Informes mobile parity Android/iOS: OK.
- Tokens mobile parity Android/iOS: OK.
- No-scroll real App Shell 1440x900 y 1366x768: OK.
- No-scroll interno desktop/mobile: OK.

## Resultado

Implementacion lista para revision manual. Filtros avanzados agregados en los
dos modulos solicitados sin cambios de backend ni contratos API.

## Estado final

Pendiente de revision manual de Nico, stage, commit, push y PR.
