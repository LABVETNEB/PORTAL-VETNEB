# E2E-ORG-2 runtime stability follow-up

Fecha: 2026-07-15

## Estado base

- Rama: `test/e2e-organize-admin-domain`.
- HEAD inicial: `d665b25bd29e534ee8f66fb845fe2d195d762fd4`.
- Worktree inicial limpio.

## Scope incluido

- Estabilización concurrente de workspace admin/clinica, theme-color, navegación pública y final polish móvil.
- Ajuste de `public-routes.spec.ts` para validar un único click real.
- Ajuste de `admin-mobile-final-polish-no-scroll.spec.ts` para esperar convergencia real entre lista adaptativa y paginador.
- Documentación de auditoría e implementación.

## Scope excluido

- Backend, API, auth, DB, migraciones, dependencias, lockfiles, CI/workflows.
- Cambios estructurales adicionales sobre las 18 specs admin reorganizadas.

## Cambios

- `AdminDashboardWorkspaceController.tsx`: la intención optimista queda pendiente hasta que la URL confirma el módulo objetivo; commits stale ya no desmontan el módulo activo.
- `ClinicDashboardWorkspaceController.tsx`: aplica la misma convergencia URL/intención/módulo para evitar workspaces stale en la navegación clínica.
- `AdminMobileBottomNav.tsx`: el menú móvil `Más` dispara la activación real del módulo admin, no solo el estado visual del bottom nav.
- `admin-mobile-final-polish-no-scroll.spec.ts`: espera que items y paginador converjan antes de validar clipping, evitando leer nodos remonteados por el layout adaptativo.
- `theme-color`: se conserva el meta autoritativo existente y el runtime solo sincroniza/deduplica el contenido.
- `theme-init.js`: sincroniza `data-theme`, `theme-color`, deduplica metas con guard reentrante y agrega navegación pública pre-hidratación por delegado capture.
- `theme.ts` y `ThemeModeToggle.tsx`: sincronizan el meta tras cambios de tema y después del commit del toggle.
- `PublicRouteControl.tsx`: expone atributos `data-public-route-*` solo para rutas públicas, excluyendo `/dashboard`.
- `public-routes.spec.ts`: elimina retry de click; la navegación debe ocurrir con una interacción.

## Archivos modificados

- `frontend/src/app/dashboard/admin/AdminDashboardWorkspaceController.tsx`
- `frontend/src/components/dashboard/ClinicDashboardWorkspaceController.tsx`
- `frontend/src/components/dashboard/AdminMobileBottomNav.tsx`
- `frontend/public/theme-init.js`
- `frontend/src/lib/theme.ts`
- `frontend/src/components/theme/ThemeModeToggle.tsx`
- `frontend/src/components/public/PublicRouteControl.tsx`
- `frontend/e2e/admin/shell/admin-mobile-final-polish-no-scroll.spec.ts`
- `frontend/e2e/public-routes.spec.ts`
- `docs/audit/e2e-org-2-runtime-stability-follow-up-audit.md`
- `docs/implementation/e2e-org-2-runtime-stability-follow-up.md`

## Validaciones

Targeted ejecutado con retries 0 y 10 workers:

- `pnpm --dir frontend exec playwright test e2e/admin/shell/admin-mobile-core-modules-no-scroll.spec.ts e2e/admin/shell/admin-mobile-final-polish-no-scroll.spec.ts e2e/theme-mode.spec.ts e2e/public-routes.spec.ts --retries=0`
- Resultado: 34 passed, repetido verde varias veces bajo concurrencia.

- `pnpm test`: 3107 passed.
- `pnpm build`: passed.
- `pnpm security:public-surface`: passed, con findings server-only existentes en `frontend/src/proxy.ts`.
- `pnpm --dir frontend lint`: passed.
- `pnpm --dir frontend typecheck`: passed.
- `pnpm --dir frontend build`: passed.
- `pnpm --dir frontend e2e:admin-mobile`: 132 passed.
- `pnpm --dir frontend exec playwright test e2e/dashboard-card-navigation-shell.spec.ts --retries=0`: 66 passed.
- `pnpm --dir frontend e2e:visual-contract`: 273 passed.
- `pnpm --dir frontend e2e:ci`: 562 passed.

## Resultado

Las fallas targeted reproducidas quedaron corregidas localmente bajo concurrencia real. No se observaron nuevos `pageerror` ni `removeChild(null)` en las corridas verdes.

## Riesgo residual

Bajo. La navegación pre-hidratación usa `window.location` solo para controles públicos anotados y excluye `/dashboard`; el comportamiento SPA hidratado sigue disponible para el resto de superficies.

## Estado final

Validado localmente. Pendiente de commit y push al momento de redactar esta nota.
