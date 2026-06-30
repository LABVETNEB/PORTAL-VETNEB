# PR-VIS-4 - Scope User Selection To Chrome

> **Tipo:** Implementation evidence.
> **PR:** PR-VIS-4.
> **Hallazgo rector:** VIS-P1-008.
> **Scope:** frontend global selection CSS + native contract test + implementation documentation.
> **Razonamiento Codex:** MEDIO.

## Estado Base

- Rama: `fix/frontend-scope-user-select`.
- Base local: `28cfa2b chore(admin): tokenize report status badge colors (#1198)`.
- Working tree inicial: limpio.

## Scope Incluido

- Auditar usos de `user-select`, `select-none`, `select-text` y `-webkit-user-select`.
- Reemplazar la regla global `user-select:none` por scoping acotado a chrome.
- Mantener selección de texto en contenido público, informes, tablas, cards, superficies operativas y controles editables.
- Actualizar el test nativo que protegía el contrato global anterior.
- Agregar esta evidencia mínima de implementación.

## Scope Excluido

- Backend, API, auth, DB, migraciones, storage y emails.
- Dependencias, lockfiles, package scripts, workflows, CI y Playwright config.
- Layout, densidad, paginación, filtros, navegación, badges, tokens y no-scroll.
- PR-VIS-3, PR-VIS-5, PR-VIS-6 y PR-VIS-7.
- Reordenamiento amplio o extracción de `globals.css`.

## Auditoría Previa

- `docs/audit/total-visual-engineering-audit.md` identifica VIS-P1-008: `* { user-select:none }` global en `globals.css`, con impacto en copia de informes, IDs y nombres.
- `docs/audit/total-engineering-roadmap.md` define PR-VIS-4 como scoping de `user-select:none` al chrome, con verificación manual de copia y E2E no-scroll.
- `docs/audit/design-system-contract.md` preserva el App Shell single-viewport/no-scroll como activo productivo.
- `docs/implementation/IMPLEMENTATION_PR_VIS_2_STATUS_BADGE_TOKENS.md` se revisó sólo como antecedente inmediato.

La búsqueda confirmó usos productivos en `frontend/src/app/globals.css` y un uso backend/email fuera de scope con `user-select:text`. También confirmó tests nativos que protegían el contrato anterior.

## Cambios

- `*` conserva sólo `border-border` y `-webkit-tap-highlight-color: transparent`.
- `user-select:none` y `-webkit-touch-callout:none` quedan acotados a chrome: botones, roles interactivos, navegación, tabs, CTAs y controles del App Shell.
- Contenido público/operativo queda explícitamente seleccionable en `main`, `article`, tablas, `code`, `pre`, copy público y superficies dashboard.
- Inputs, textareas, selects y contenteditable conservan selección de texto.
- El test nativo de consistencia visual ahora valida que no exista `user-select:none` universal y que existan reglas separadas para chrome y contenido.

## Archivos Modificados

- `frontend/src/app/globals.css`
- `test/frontend-visual-consistency.test.ts`
- `docs/implementation/IMPLEMENTATION_PR_VIS_4_USER_SELECT_CHROME.md`

## Validaciones

- `pnpm test`: no ejecutó tests; PNPM abortó antes por `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`.
- `CI=true; pnpm install --frozen-lockfile`: no rehidrató dependencias; PNPM abortó por `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH` entre overrides actuales y lockfile.
- `node --experimental-strip-types --experimental-specifier-resolution=node --test test/frontend-visual-consistency.test.ts`: PASS, 14/14.
- `CI=true; pnpm --dir frontend typecheck`: no ejecutó TypeScript; PNPM abortó antes por `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`.
- `CI=true; pnpm --dir frontend lint`: no ejecutó ESLint; PNPM abortó antes por `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`.
- `CI=true; pnpm --dir frontend build`: no ejecutó Next build; PNPM abortó antes por `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`.
- `CI=true; pnpm build`: no ejecutó backend build; PNPM abortó antes por `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`.
- `CI=true; pnpm security:public-surface`: no ejecutó el script; PNPM abortó antes por `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`.
- `CI=true; pnpm --dir frontend exec playwright test e2e/admin-mobile-core-modules-no-scroll.spec.ts --grep "Admin mobile reports pagination" --project=chromium`: no ejecutó Playwright; PNPM abortó antes por `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`.
- Prueba estática PowerShell de contrato de selección: PASS para `universal_without_user_select_none`, `chrome_scoped_user_select_none`, `content_tables_reports_select_text` y `editable_controls_select_text`.
- `git diff --check`: PASS; sólo warning de line endings CRLF futuro en `frontend/src/app/globals.css`.
- `git diff --name-only`: `frontend/src/app/globals.css`, `test/frontend-visual-consistency.test.ts`.
- `git status --short --untracked-files=all`: dos modificados y esta nota nueva.

## Prueba de Selección/Copia

- Documentada por contrato CSS estático porque PNPM no permitió levantar frontend/E2E sin `--no-frozen-lockfile`, fuera de scope.
- Contenido público/operativo: `main`, `article`, tablas, `code`, `pre`, `.public-copy`, `.dashboard-surface`, `.dashboard-list-row`, `.surface-soft`, `.surface-empty` y `.surface-note-info` quedan con `user-select:text`.
- Informes/datos operativos: tablas y superficies dashboard quedan con `user-select:text`; botones de acción quedan dentro de chrome.
- Chrome/nav/botones: `button`, roles interactivos, `nav`, tabs, CTAs y controles del App Shell quedan con `user-select:none`.

## Resultado

VIS-P1-008 queda mitigado a nivel CSS: no existe `user-select:none` universal en `globals.css`; el bloqueo de selección queda acotado a chrome y el contenido queda seleccionable.

## Riesgo Residual

Bajo. El cambio queda en CSS base y test de contrato, sin tocar no-scroll, layout, datos, auth, API ni dependencias.

## Estado Final

- `M frontend/src/app/globals.css`
- `M test/frontend-visual-consistency.test.ts`
- `?? docs/implementation/IMPLEMENTATION_PR_VIS_4_USER_SELECT_CHROME.md`
