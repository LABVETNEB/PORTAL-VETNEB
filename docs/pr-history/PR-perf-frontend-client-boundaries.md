# PR: perf/frontend-client-boundaries

## Resumen

Optimización chica y segura de boundaries cliente en frontend público, sin cambios visibles de diseño, rutas, API, auth, sesiones ni cookies.

## Hallazgos

- `Navbar` y `Footer` estaban marcados como client components solo para usar `useRouter` en navegación pública.
- La navegación pública mantiene un contrato de seguridad sin `<a>` ni `next/link`; por eso se conservaron `PublicRouteControl` y `PublicExternalControl`.
- `ParticularesContent` cargaba estáticamente `DashboardNotificationsBell`, aunque la campana solo se renderiza con sesión particular activa.
- Los paneles admin y report actions tienen contratos fuente existentes y flujos interactivos sensibles; se revisaron y no se hicieron dynamic imports allí para mantener el PR pequeño.
- Los imports de `lucide-react` ya son named imports; solo se consolidó el import duplicado de `Bell` y `X`.

## Archivos Tocados

- `frontend/src/components/layout/Navbar.tsx`
- `frontend/src/components/layout/Footer.tsx`
- `frontend/src/components/public/ParticularesContent.tsx`
- `frontend/src/components/dashboard/DashboardNotificationsBell.tsx`
- `test/frontend-public-layout-navigation.test.ts`
- `test/frontend-particulares-content.test.ts`
- `test/frontend-notifications-bell.test.ts`
- `test/frontend-admin-report-workflow.test.ts`

## Implementación

- Se removió `"use client"` de `Navbar` y `Footer`.
- Se reemplazó navegación local con `useRouter` por `PublicRouteControl`, manteniendo botones y clases visuales existentes.
- Se mantuvo `PublicExternalControl` para navegación externa del footer y el contrato sin anchors.
- Se agregó `next/dynamic` para cargar `DashboardNotificationsBell` en `ParticularesContent` solo cuando existe sesión particular activa.
- Se agregó placeholder reservado de `9x9` para evitar salto visual mientras carga la campana.
- Se consolidó el import de iconos de notificaciones en una sola línea.
- Se actualizaron tests fuente para reflejar que el contrato ahora prefiere boundaries parciales en vez de hidratar navbar/footer completos.

## Tests/Comandos

- `pnpm --dir frontend lint`
- `pnpm --dir frontend typecheck`
- `pnpm typecheck`
- `pnpm typecheck:test`
- `pnpm test`
- `pnpm build`
- `pnpm security:public-surface`

No se ejecutó `pnpm --dir frontend build`; no hubo bloqueo por Google Fonts.

## Resultados

- `pnpm --dir frontend lint`: PASS
- `pnpm --dir frontend typecheck`: PASS
- `pnpm typecheck`: PASS
- `pnpm typecheck:test`: PASS
- `pnpm test`: PASS, 2146 pass / 1 skipped / 0 fail
- `pnpm build`: PASS
- `pnpm security:public-surface`: PASS, sin findings públicos

## Riesgos

- `ParticularNotificationsBell` puede mostrarse con un placeholder breve hasta cargar el chunk cliente.
- `Navbar` y `Footer` siguen usando boundaries cliente para botones puntuales por el contrato `PublicRouteControl`, pero ya no hidratan el componente completo.
- No se cambió lazy loading de paneles admin por riesgo de ampliar contratos y comportamiento operativo.

## Rollback

Revertir los cambios de los archivos listados en este documento. El rollback vuelve a importar `useRouter` en `Navbar`/`Footer`, restaura el import estático de `DashboardNotificationsBell` en `ParticularesContent` y revierte los contratos fuente actualizados.

## Estado Final

Listo para revisión local. No se hizo `git add`, commit, push, PR, merge ni cambios de backend.

Se confirma que no cambia contratos API, auth, sesiones, cookies, CSP, CORS, CSRF, DB schema, índices, storagePath, signed URLs ni WebAuthn.
