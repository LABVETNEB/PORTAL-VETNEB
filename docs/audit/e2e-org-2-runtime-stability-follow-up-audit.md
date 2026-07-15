# E2E-ORG-2 runtime stability follow-up audit

Fecha: 2026-07-15

## Estado base

- Rama: `test/e2e-organize-admin-domain`.
- HEAD inicial: `d665b25bd29e534ee8f66fb845fe2d195d762fd4`.
- Worktree inicial: limpio.
- PR: #1471, abierto, draft, base `main`.

## Scope incluido

- Runtime frontend público de tema y navegación pública.
- Sincronización cliente del workspace admin/clinica y activación móvil desde el menú `Más`.
- Specs E2E afectadas solo para remover retry de navegación pública y estabilizar lecturas móviles bajo remount.

## Scope excluido

- Backend, API, auth, DB, migraciones, dependencias, lockfiles y workflows.
- Reorganización adicional de E2E-ORG-2.
- Reducción de workers, retries, skips, timeouts o assertions.

## Auditoría previa

Claude y el comentario técnico del PR señalaban cinco líneas de investigación: stale workspace admin, clipping en final polish, doble `theme-color`, navegación pública pre-hidratación y `removeChild(null)`.

Evidencia local confirmada:

| Fallo | Hallazgo Claude | Evidencia local | Causa raíz confirmada | Archivo responsable | Corrección |
| --- | --- | --- | --- | --- | --- |
| Reports stale workspace | Confirmado | Cohorte targeted inicial pasó admin, pero el código consumía intención pendiente en el primer commit URL aunque fuera stale | Intento optimista se consumía antes del commit del módulo objetivo | `AdminDashboardWorkspaceController.tsx` | Mantener intención hasta que `nextModule === target` |
| Clinic stale workspace | Confirmado por CI | `validate-frontend` falló en `dashboard-card-navigation-shell.spec.ts` al esperar `[data-dashboard-module-workspace="perfil"]` | El controller clínico tenía la misma consumición anticipada de intención pendiente | `ClinicDashboardWorkspaceController.tsx` | Mantener intención hasta URL objetivo y remount por módulo |
| Final polish/clipping | Parcialmente confirmado | Final polish pasó en reproducción inicial, pero luego expuso lecturas stale al estabilizar toda la suite admin móvil | Riesgo de contenido stale bajo layout móvil y race entre pager/lista adaptativa | `AdminDashboardWorkspaceController.tsx`, `AdminMobileBottomNav.tsx`, `admin-mobile-final-polish-no-scroll.spec.ts` | Misma convergencia URL/intención/módulo, activación real desde menú móvil y espera de convergencia lista/pager |
| `theme-color` duplicado | Confirmado | `theme-mode.spec.ts` falló con dos metas | Doble ownership entre meta manual/dinámica y reconciliación del head | `theme-init.js`, `theme.ts`, `ThemeModeToggle.tsx` | Se conserva el meta autoritativo existente; bootstrap/runtime sincronizan contenido y deduplican |
| Navegación pública | Confirmado | `public-routes.spec.ts` tenía retry de click por handlers no hidratados | Botones públicos dependían solo de React para navegar | `PublicRouteControl.tsx`, `theme-init.js` | Delegado capture pre-hidratación para rutas públicas, un solo click |
| `removeChild(null)` | Confirmado | Reproducción inicial emitió `Uncaught TypeError: Cannot read properties of null (reading 'removeChild')` | Limpieza/remoción de head durante reconciliación con ownership ambiguo | `theme-init.js`, `theme.ts` | Guard reentrante y owner único; no se reprodujo en targeted verde |

## Cambios rechazados

- No se usó el SHA previo `4b47c08871cd5da2418302a331203996fe8b1f33`; no existe como objeto local.
- No se sustituyó navegación por `page.goto`.
- No se mantuvo retry de click en `public-routes.spec.ts`.
- No se redujeron workers ni se agregaron retries.

## Pruebas necesarias

- Targeted concurrente de las cuatro specs afectadas, varias repeticiones: ejecutado y verde.
- `dashboard-card-navigation-shell.spec.ts` y `e2e:visual-contract` por fallo CI clínico: ejecutados y verdes.
- `e2e:admin-mobile`: ejecutado y verde.
- `e2e:ci`: ejecutado y verde.
- Suite root/frontend/security según protocolo del PR: ejecutada y verde.

## Riesgo residual

Bajo. La parte más sensible es el bootstrap externo: queda limitado a un único script ya permitido (`/theme-init.js`), con rutas públicas excluyendo `/dashboard` y sin tocar auth/API/DB.
