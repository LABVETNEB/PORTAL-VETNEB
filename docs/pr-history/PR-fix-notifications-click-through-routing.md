# PR fix notifications click-through routing

## Resumen

Las notificaciones globales ahora navegan al contexto correcto al hacer click, tanto en desktop como en mobile. Si la notificación no está leída, primero se intenta marcar como leída; si esa operación falla, se informa el error y la navegación contextual continúa.

No se hizo `git add`, `commit`, `push`, creación de PR ni merge.

## Archivos tocados

- `frontend/src/lib/notification-destinations.ts`
- `frontend/src/components/dashboard/DashboardNotificationsBell.tsx`
- `frontend/src/app/dashboard/informes/page.tsx`
- `frontend/src/components/dashboard/ClinicParticularTokensCard.tsx`
- `frontend/src/components/public/ParticularesContent.tsx`
- `test/frontend-notification-destinations.test.ts`
- `test/frontend-notification-click-anchors.test.ts`
- `test/frontend-notifications-bell.test.ts`
- `PR-fix-notifications-click-through-routing.md`

## Implementación realizada

- Se agregó `buildNotificationDestination(surface, notification)` como helper puro y testeable.
- La campana usa `useRouter` y `router.push(destination)` para navegar sin abrir pestañas nuevas.
- Las notificaciones leídas ya no quedan deshabilitadas: solo se bloquea doble click mientras `updatingNotificationId === notification.id`.
- Desktop y mobile comparten el mismo handler de click.
- El dropdown desktop y el banner mobile se cierran al navegar.
- Si la ruta actual coincide con un destino con hash, se aplica fallback SSR-safe con `window.location.hash` y `scrollIntoView`.
- No se agregaron querystrings para IDs; se usan hashes internos.

## Anchors agregados/verificados

- `report-${report.id}` en filas de `/dashboard/informes`.
- `clinic-particular-token-${token.id}` en cada card de tokens de clínica.
- `particular-study-tracking` en el bloque de seguimiento particular.
- `particular-report` en el bloque de informe vinculado particular.
- `admin-particular-tokens` ya existía en la página admin.
- `admin-notifications` ya existía en la página admin.

## Tests agregados/modificados

- Contratos de routing para `buildNotificationDestination`.
- Contrato de anchors para las superficies clinic, particular y admin.
- Contratos de `DashboardNotificationsBell` para:
  - no deshabilitar notificaciones leídas,
  - navegar con destino contextual,
  - compartir comportamiento desktop/mobile,
  - conservar la garantía de no marcar como leído por auto-show.

## Comandos ejecutados

- `node --experimental-strip-types --experimental-specifier-resolution=node --test test/frontend-notification-destinations.test.ts test/frontend-notification-click-anchors.test.ts test/frontend-notifications-bell.test.ts`
  - Resultado: OK, 18 tests passing.
- `pnpm --dir frontend build`
  - Resultado: OK. Warning existente: unused eslint-disable en `frontend/src/app/api/security/csp-report/route.ts:177`.
- `pnpm typecheck`
  - Resultado: OK.
- `pnpm typecheck:test`
  - Resultado: OK.
- `pnpm test`
  - Resultado: OK, 2133 passing, 1 skipped, 0 failures.
- `pnpm build`
  - Resultado: OK.
- `pnpm security:public-surface`
  - Resultado: OK. Reportó findings `[server-only]` esperados sobre nombres de cookies en `frontend/src/middleware.ts`, sin exposición pública de devtools.

## Riesgos

- El fallback de hash usa `scrollIntoView` solo cuando el destino está en la misma ruta actual; en navegación entre rutas se delega el scroll inicial a Next/browser.
- Si falla el mark-as-read y la navegación cambia de página, el mensaje puede desmontarse junto con la campana, pero la navegación no se bloquea.

## Rollback

Revertir los cambios en los archivos listados arriba restaura el comportamiento anterior: click de notificación solo marcaba como leída y no navegaba por contexto.

## Estado final

Implementación completa, tests actualizados y validación obligatoria ejecutada correctamente. No se realizaron acciones de git ni publicación.
