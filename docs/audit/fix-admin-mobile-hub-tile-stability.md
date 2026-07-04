# Fix admin mobile hub tile stability

- Fecha: 2026-07-04
- Rama: `visual/global-dashboard-premium-system`
- Base: `fc47594 feat(dashboard): redesign premium global dashboard system`

## Estado base

- `git status --short` inicial: limpio.
- Rama actual: `visual/global-dashboard-premium-system`.
- Test afectado reportado: `frontend/e2e/admin-mobile-module-layer-isolation.spec.ts`.
- Selector afectado: `[data-admin-mobile-hub-launcher="true"] [data-admin-mobile-hub-tile="admin-particular-tokens"]`.

## Scope incluido

- Estabilizar el click del tile mobile del Admin hub.
- Mantener data attributes, labels, rutas y modulo `admin-particular-tokens`.
- Mantener diseño premium, contrato no-scroll e isolated paint layers.
- Actualizar documentacion de implementacion existente.

## Scope excluido

- Backend, API, auth, DB, Supabase, migraciones, dependencias, lockfiles y CI.
- Cambios de permisos, rutas, logica operativa de modulos o tests.
- Commits, push y PR.

## Auditoria previa

- Hub localizado en `frontend/src/components/dashboard/AdminMobileHubLauncher.tsx`.
- Tile localizado en `frontend/src/components/dashboard/AdminMobileLauncherTile.tsx`.
- Activacion de modulo localizada en `frontend/src/app/dashboard/admin/AdminDashboardWorkspaceController.tsx`.
- CSS relacionado localizado en `frontend/src/app/globals.css`.
- No se encontro key inestable en el tile: la key usa `card.moduleId`.
- No se encontro condicion destructiva por breakpoint en el componente del tile.
- La causa fuente esta en el desmontaje sincronico del Hub al ejecutar `card.onClick` durante la accion de click.

## Cambios

- `AdminMobileLauncherTile` ahora difiere la ejecucion de `card.onClick` con `requestAnimationFrame` + `setTimeout(0)`.
- El nodo del boton queda montado durante la accion nativa de click.
- La activacion existente del modulo, URL, workspace y labels queda intacta.

## Archivos modificados

- `frontend/src/components/dashboard/AdminMobileLauncherTile.tsx`
- `docs/implementation/global-dashboard-premium-system.md`
- `docs/audit/fix-admin-mobile-hub-tile-stability.md`

## Validaciones

- `pnpm playwright test e2e/admin-mobile-module-layer-isolation.spec.ts --project=chromium --grep "admin mobile modules keep isolated paint layers"`: paso, 3/3.
- `pnpm playwright test e2e/admin-mobile-module-layer-isolation.spec.ts e2e/admin-tokens-mobile-toolbar-layout.spec.ts --project=chromium`: paso, 19/19.
- `pnpm test`: paso, 2955/2955.
- `pnpm typecheck`: paso.
- `pnpm build`: paso.
- `pnpm security:public-surface`: paso; sin hallazgos publicos, con marcadores server-only conocidos en `frontend/src/proxy.ts`.
- `pnpm --dir frontend lint`: paso.
- `pnpm --dir frontend typecheck`: paso.
- `pnpm --dir frontend build`: paso.
- `pnpm --dir frontend e2e:visual-contract`: paso, 273/273.
- `pnpm lint` en raiz: no ejecutado; el script no existe en `package.json`.

## Resultado

- El tile `admin-particular-tokens` conserva el nodo durante el click.
- La transicion Hub -> workspace sigue ocurriendo y el workspace se monta correctamente.
- No se modificaron tests ni timeouts.
- No se uso force click ni skip.

## Riesgo residual

- Bajo. La activacion desde tiles del hub mobile se posterga un frame/macrotask para respetar la estabilidad DOM del click.
- No hay cambio de datos, permisos, endpoints, cookies, auth ni persistencia.

## Estado final

- Implementacion frontend acotada.
- Documentacion actualizada en `docs/implementation` y `docs/audit`.
- Queda pendiente que Nico realice stage, commit, push, PR y checks manuales.
