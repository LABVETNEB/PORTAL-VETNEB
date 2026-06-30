# PR-VIS-2 - Tokenize Admin Report Status Badge

> **Tipo:** Implementation evidence.
> **PR:** PR-VIS-2.
> **Hallazgo rector:** VIS-P1-004.
> **Scope:** frontend admin reports status badge + implementation documentation.
> **Razonamiento Codex:** MEDIO.

## Estado Base

- Rama: `chore/tokenize-status-badge-colors`.
- Base local: `03563c3 chore(theme): remove dead dark mode wiring (#1197)`.
- Working tree inicial: limpio.

## Scope Incluido

- Auditar el origen del badge de estado off-token en Admin Reports.
- Reemplazar colores Tailwind crudos por tokens existentes del design system.
- Conservar estados, labels, comportamiento, estructura y densidad del badge.
- Agregar esta evidencia mínima de implementación.

## Scope Excluido

- Backend, API, auth, DB, migraciones y storage.
- Dependencias, lockfiles, package scripts, workflows, CI y Playwright config.
- Rediseño de dashboard, layout, paginación, filtros, copy o navegación.
- Unificación global de todos los badges.
- PR-VIS-3, PR-VIS-4, PR-VIS-5, PR-VIS-6 y PR-VIS-7.

## Auditoría Previa

- `docs/audit/total-visual-engineering-audit.md` identifica VIS-P1-004 en `AdminReportStatusBadge.tsx:7-27`.
- `docs/audit/total-engineering-roadmap.md` define PR-VIS-2 como tokenización del badge admin off-token con 0 colores crudos en el componente.
- `docs/audit/design-system-contract.md` exige no usar colores crudos fuera de tokens.
- `docs/implementation/IMPLEMENTATION_THEME_REMOVE_DEAD_DARK_MODE.md` se revisó sólo como antecedente inmediato.

La búsqueda en frontend confirmó que `AdminReportStatusBadge.tsx` contenía `slate`, `sky`, `amber`, `violet` y `emerald` crudos, y que el componente se consume en `AdminReportsCard.tsx`.

## Cambios

- `sample_received`: de slate crudo a `vetneb-line`, `vetneb-surface-muted` y `vetneb-ink`.
- `processing`: de sky crudo a `vetneb-cyan` y `vetneb-navy`.
- `evaluation`: de amber crudo a `vetneb-amber`.
- `report_development`: de violet crudo a `vetneb-navy`.
- `delivered`: de emerald crudo a `vetneb-teal`.

No se cambió el wrapper `<span>`, altura, padding, tipografía, labels ni taxonomía de estados.

## Archivos Modificados

- `frontend/src/app/dashboard/admin/AdminReportStatusBadge.tsx`
- `docs/implementation/IMPLEMENTATION_PR_VIS_2_STATUS_BADGE_TOKENS.md`

## Validaciones

- `pnpm --dir frontend typecheck`: no ejecutó TypeScript; pnpm abortó antes por `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`.
- `CI=true; pnpm --dir frontend typecheck`: no ejecutó TypeScript; pnpm abortó antes por `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH` en instalación frozen.
- `frontend/node_modules/.bin/tsc.CMD --noEmit`: falló antes de compilar por `MODULE_NOT_FOUND` (`frontend/node_modules/typescript/bin/tsc` ausente).
- `frontend/node_modules/.bin/eslint.CMD .`: falló antes de lint por `MODULE_NOT_FOUND` (`frontend/node_modules/eslint/bin/eslint.js` ausente).
- `frontend/node_modules/.bin/next.CMD build`: falló antes de build por `MODULE_NOT_FOUND` (`frontend/node_modules/next/dist/bin/next` ausente).
- `frontend/node_modules/.bin/playwright.CMD test e2e/admin-mobile-core-modules-no-scroll.spec.ts --grep "Admin mobile reports pagination" --project=chromium`: falló antes de Playwright por `MODULE_NOT_FOUND` (`frontend/node_modules/@playwright/test/cli.js` ausente).
- `rg -n "(border|bg|text)-(slate|sky|violet|purple|indigo|emerald|amber)-" frontend/src/app/dashboard/admin/AdminReportStatusBadge.tsx`: sin coincidencias.
- `git diff --check`: PASS; sólo aviso de line endings CRLF para `AdminReportStatusBadge.tsx`.

No se ejecutó `pnpm install --no-frozen-lockfile` porque modificar instalación/lockfile queda fuera del scope de PR-VIS-2.

## Resultado

El badge de estado de Admin Reports dejó de depender de colores Tailwind crudos/off-token y ahora usa tokens existentes del design system.

## Riesgo Residual

Bajo. El cambio queda limitado al mapa visual del badge y no altera datos, API, comportamiento ni layout. El contraste automatizado queda fuera de este PR según roadmap posterior.

## Estado Final

Working tree final esperado para este PR:

- `M frontend/src/app/dashboard/admin/AdminReportStatusBadge.tsx`
- `?? docs/implementation/IMPLEMENTATION_PR_VIS_2_STATUS_BADGE_TOKENS.md`
