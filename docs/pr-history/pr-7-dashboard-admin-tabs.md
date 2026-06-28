# PR-7 - Dashboard admin tabs

## Resumen

Se convirtió `/dashboard/admin` en una consola con sub-secciones por tabs para reducir el scroll operativo sin cambiar rutas, fetches, autenticación, endpoints ni lógica de negocio.

## Archivos modificados

- `frontend/src/app/dashboard/admin/page.tsx`
- `frontend/src/app/dashboard/admin/AdminSectionTabs.tsx`
- `test/frontend-dashboard-admin.test.ts`
- `test/frontend-dashboard-admin-command-center.test.ts`
- `test/frontend-dashboard-admin-section-tabs.test.ts`
- `test/frontend-visual-consistency.test.ts`
- `docs/pr-7-dashboard-admin-tabs.md`

## Componentes creados

- `AdminSectionTabs`: client component presentacional, aislado dentro de `frontend/src/app/dashboard/admin`, con `button` tabs, `role="tablist"`, `role="tab"`, `role="tabpanel"`, soporte de `defaultTabId`, `className`, badges opcionales y sincronización con hashes internos existentes.

## Decisiones técnicas

- `/dashboard/admin/page.tsx` sigue siendo server component.
- `DashboardPageHeader`, `StickyActionBar`, `AdminCommandCenter` y `AdminFailedLoginAlertsReadOnlyCard` permanecen arriba del fold operativo.
- Las alertas críticas quedan fuera de los tabs para mantener visibilidad inmediata.
- Las secciones inferiores quedan agrupadas en `Sistema`, `Gestión`, `Seguridad` y `Configuración/Auditoría`.
- No se introdujeron dependencias, rutas nuevas, `next/link`, anchors nativos ni librerías UI adicionales.

## Cards, ids y query params

- Se conservaron las cards existentes: health, schema health, maintenance, clinics, tokens, sessions, users/roles, pricing, notifications, role changes, event summary y audit log.
- Se mantuvieron ids existentes como `admin-health`, `admin-maintenance`, `admin-report-upload`, `admin-particular-tokens`, `admin-sessions`, `admin-users-roles`, `admin-pricing`, `admin-notifications`, `audit-role-changes`, `admin-event-summary` y `audit-log`.
- `buildAdminAuditFilterHref` y los query params `event` y `actorType` no fueron modificados.

## Validaciones ejecutadas

- `git diff --stat`: OK. Muestra cambios tracked en `page.tsx` y tests; los archivos nuevos aparecen como untracked hasta staging.
- `git diff --check`: OK. Solo warning de normalización LF/CRLF en `frontend/src/app/dashboard/admin/page.tsx`.
- `pnpm test`: OK, 2384 tests passed.
- `pnpm build`: OK, backend bundle generado correctamente.
- `pnpm security:public-surface`: OK, PASS sin exposición pública de devtools. Conserva hallazgos `server-only` existentes en `frontend/src/proxy.ts`.
- `pnpm --dir frontend lint`: OK.
- `pnpm --dir frontend typecheck`: OK.
- `pnpm --dir frontend build`: OK. Next generó cambios automáticos en `frontend/next-env.d.ts` y `frontend/tsconfig.json`; se revirtieron después de validar para respetar el scope estricto.
- `git status --short`: OK. Modificados tracked: `frontend/src/app/dashboard/admin/page.tsx`, `test/frontend-dashboard-admin-command-center.test.ts`, `test/frontend-dashboard-admin.test.ts`, `test/frontend-visual-consistency.test.ts`. Nuevos untracked: este documento, `AdminSectionTabs.tsx`, `frontend-dashboard-admin-section-tabs.test.ts`.
- `git diff --name-only`: OK. Lista solo los cuatro archivos tracked modificados.
- `git ls-files --others --exclude-standard`: OK. Lista `docs/pr-7-dashboard-admin-tabs.md`, `frontend/src/app/dashboard/admin/AdminSectionTabs.tsx`, `test/frontend-dashboard-admin-section-tabs.test.ts`.

## Riesgos residuales

- El contenido de tabs inactivos queda montado pero oculto con `hidden`, para no cambiar el montaje de cards ni sus lecturas cliente. El cambio principal es de navegación visual.
- Los hashes existentes activan el tab correspondiente en cliente después de hidratar.

## Confirmación de scope

- Sin cambios en backend.
- Sin cambios en API routes.
- Sin cambios en auth.
- Sin cambios en middleware.
- Sin cambios en SEO ni rutas públicas.
- Sin cambios en dependencias, `package.json`, `pnpm-lock.yaml` o `next-env.d.ts`.
