# PR-2 - Admin Command Center + Sticky Action Bar

## Resumen

Se reorganizo `/dashboard/admin` como un command center privado y conservador. La pantalla ahora prioriza acciones operativas arriba del fold, resumen/KPIs con datos ya disponibles, alertas criticas cerca del top y agrupacion posterior por sistema, gestion, configuracion secundaria y auditoria.

## Archivos modificados

- `frontend/src/app/dashboard/admin/page.tsx`
- `test/frontend-dashboard-admin.test.ts`
- `test/unit/ui/frontend/frontend-visual-consistency.test.ts`

## Componentes creados

- `frontend/src/components/dashboard/StickyActionBar.tsx`
- `frontend/src/app/dashboard/admin/AdminCommandCenter.tsx`
- `test/frontend-dashboard-admin-command-center.test.ts`

## Decisiones tecnicas

- `StickyActionBar` es un componente client reusable, sin logica de negocio, con acciones de texto visible, soporte `href`/`onClick`, `visible=false`, foco visible y comportamiento fixed bottom en mobile/sticky en desktop.
- La navegacion por `href` usa boton y `window.location.assign` para respetar el contrato existente del repo que evita `next/link`, `<Link>` y tags `<a>` en `frontend/src`.
- `AdminCommandCenter` vive junto a las cards admin porque consume labels y composicion propios de esa superficie privada.
- Los KPIs usan solo datos existentes en la pagina: cantidad de eventos de auditoria, cantidad de tipos de evento y status real del sistema.
- `AdminFailedLoginAlertsReadOnlyCard` quedo antes de sistema/gestion/configuracion para que alertas criticas no queden enterradas en una pagina larga.

## Logica existente preservada

- No se cambiaron fetches, endpoints, auth, middleware, backend, SEO, rutas publicas ni calculos de fechas.
- Se mantuvieron las cards existentes: clinicas, alertas de login fallido, schema health, maintenance dry-run, tokens particulares, pricing, sesiones y roles.
- Se conservaron los ids usados por sidebar/anclas (`admin-report-upload`, `admin-health`, `admin-clinics`, `admin-particular-tokens`, `admin-pricing`, `admin-sessions`, `admin-users-roles`, `admin-maintenance`, `audit-log`).
- La carga de informes sigue delegada al flujo real desde tokens administrados.

## Validaciones ejecutadas

- `git diff --check`: PASS, sin errores de whitespace. Git aviso que `frontend/src/app/dashboard/admin/page.tsx` sera normalizado CRLF cuando Git lo toque.
- `pnpm test`: PASS, 2314 tests pass, 1 skipped.
- `pnpm build`: PASS, backend bundle generado correctamente.
- `pnpm security:public-surface`: PASS, sin findings publicos. Se mantuvieron solo notas server-only existentes en `frontend/src/proxy.ts`.
- `pnpm --dir frontend lint`: PASS.
- `pnpm --dir frontend typecheck`: PASS.
- `pnpm --dir frontend build`: PASS, Next build completo.

## Riesgos residuales

- La barra sticky usa `window.location.assign` para hashes/paths porque el contrato global bloquea anchors y `next/link`; esto evita ampliar superficie publica, aunque no usa navegacion SPA.
- La validacion visual fue de contrato/build, no de screenshot interactivo.

## Confirmacion de scope

- Sin cambios en backend/server.
- Sin cambios en API routes.
- Sin cambios en auth.
- Sin cambios en middleware.
- Sin cambios en SEO, sitemap o robots.
- Sin cambios en rutas publicas.
- Sin cambios en `package.json`, `pnpm-lock.yaml`, `next-env.d.ts` ni dependencias.
- No se implemento MasterDetailWorkspace, StudyTimeline, FilterDrawer, clinic command center, logistica hub ni tabs admin.
