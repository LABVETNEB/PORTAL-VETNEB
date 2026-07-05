# fix(dashboard): targeted zero-scroll E2E rescue

## Estado base
- Rama observada: `fix/dashboard-zero-scroll-adaptive-density`.
- Base HEAD observada: `b0631df docs(audit): add global dashboard redesign engineering audit (#1285)`.
- Worktree recibido con cambios previos sin commit en frontend/test/e2e; no se descartaron ni revirtieron cambios ajenos.

## Scope incluido
- Corrección focal de los 11 fallos targeted zero-scroll reportados.
- Superficies tocadas: informes mobile detail, logística visitas mobile, logística métricas mobile y particulares autenticado.
- Ajustes de documentación de entrega/auditoría.

## Scope excluido
- Sin backend, DB, migraciones, endpoints, auth, cookies, CORS, CSP, rate limits, dependencias, lockfiles, CI, workflows, commits, push ni PR.
- No se debilitaron tests ni se eliminaron selectores existentes.
- `frontend/next-env.d.ts` fue restaurado tras la mutación automática de Next dev.

## Auditoría previa
- `git status --short` mostró trabajo previo en frontend/test/e2e.
- La rama activa coincidió con `fix/dashboard-zero-scroll-adaptive-density`.
- Los scripts nativos existen: `pnpm test`, `pnpm build`, `pnpm security:public-surface`, `pnpm --dir frontend lint`, `pnpm --dir frontend typecheck`, `pnpm --dir frontend build`.
- El `pnpm` del runtime de Codex intentaba instalar y fallaba por mismatch de overrides; se usó `C:\Program Files\nodejs\pnpm.CMD` con `npm_config_overrides` temporal y `--frozen-lockfile` para reconstruir solo `node_modules`, sin modificar lockfiles.

## Cambios
- Informes: el dock de acciones expone `data-informes-detail-action-dock="true"` solo en el contexto activo (`panel` o `dialog`), evitando duplicado strict-mode en mobile.
- Visitas: filas mobile cerradas con ancho máximo, `min-w-0` y clamp de texto con envoltura segura para eliminar `scrollWidth > clientWidth`.
- Métricas: cards y bloques mobile mantienen los literales de clase testeados y delegan la contención a CSS scoped para evitar overflow horizontal.
- Particulares autenticado: layout operacional fijo por viewport, resumen duplicado oculto solo en modo autenticado, tracking/reporte en grid compacto y logout siempre dentro del viewport.

## Archivos modificados en esta pasada
- `frontend/src/app/dashboard/informes/InformesReportsList.tsx`
- `frontend/src/app/dashboard/logistica/visitas/page.tsx`
- `frontend/src/app/dashboard/logistica/metricas/page.tsx`
- `frontend/src/components/public/ParticularesContent.tsx`
- `frontend/src/app/globals.css`
- `docs/implementation/targeted-zero-scroll-e2e-rescue.md`
- `docs/audit/targeted-zero-scroll-e2e-rescue-audit.md`

## Validaciones
- Targeted Playwright E2E: `33 passed`.
- `pnpm --dir frontend typecheck`: PASS.
- `pnpm --dir frontend lint`: PASS.
- `pnpm test`: PASS, `2955/2955`.
- `pnpm build`: PASS.
- `pnpm --dir frontend build`: PASS.
- `pnpm security:public-surface`: PASS, sin findings públicos; solo marcadores `[server-only]` esperados en `frontend/src/proxy.ts`.

## Resultado
- Los 11 fallos targeted quedaron corregidos.
- `frontend/next-env.d.ts` queda sin diff esperado tras restauración manual.
- No se realizaron stage, commit, push ni PR.

## Riesgo residual
- Bajo. El cambio es CSS/layout y selector activo, acotado a las superficies E2E fallidas.
- Playwright/Next dev vuelve a mutar `frontend/next-env.d.ts` durante corridas locales; se debe revisar y restaurar si se vuelve a ejecutar dev server antes de commitear.

