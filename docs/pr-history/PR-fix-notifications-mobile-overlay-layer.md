# PR fix notifications mobile overlay layer

## Resumen

Se corrigio la apertura manual de notificaciones en mobile para que el panel se renderice como overlay fijo y portaleado a `document.body`, por encima del dashboard de particulares. Desktop conserva el dropdown anclado a la campana.

## Causa probable

El banner mobile de auto-show ya estaba portaleado, pero el panel que se abre al tocar la campana seguia usando el dropdown absoluto dentro del wrapper local. En `/particulares`, ese wrapper queda dentro del panel de sesion y de sus reglas mobile de overflow, contain, isolation y z-index, por lo que el dropdown podia quedar mezclado visualmente con el resumen del caso o atrapado por stacking contexts.

## Por que #810 no era suficiente

#810 estabilizo el resumen mobile de la sesion particular, pero no cambiaba la capa donde se monta el panel manual de `DashboardNotificationsBell`. El origen restante no era el resumen en si, sino el dropdown de notificaciones renderizado dentro del layout particular.

## Implementacion

- `DashboardNotificationsBell` ahora comparte el contenido del panel en `renderPanelContent`.
- Desktop mantiene el dropdown absoluto existente, oculto bajo `sm`.
- Mobile monta el panel manual con `createPortal` hacia `document.body`.
- El overlay mobile usa `position: fixed`, `z-[90]`, fondo opaco para el sheet y selector estable `data-dashboard-notifications-mobile-overlay`.
- El panel mobile incluye boton de cierre accesible, cierre por backdrop y cierre por Escape.
- Al abrir manualmente el panel se oculta el banner mobile para evitar capas superpuestas.
- El panel manual se monta solo con `isOpen`; al cerrar se desmonta.
- El banner mobile de auto-show conserva la navegacion existente y sube a `z-[80]`.

## Archivos tocados

- `frontend/src/components/dashboard/DashboardNotificationsBell.tsx`
- `test/frontend-notifications-bell.test.ts`
- `test/frontend-admin-report-workflow.test.ts`
- `docs/pr-history/PR-fix-notifications-mobile-overlay-layer.md`

## Tests y comandos

- `node --experimental-strip-types --experimental-specifier-resolution=node --test test/frontend-notifications-bell.test.ts test/frontend-particulares-content.test.ts test/frontend-notification-click-anchors.test.ts test/frontend-particulares-mobile-session-card-render.test.ts`
- `node --experimental-strip-types --experimental-specifier-resolution=node --test test/frontend-admin-report-workflow.test.ts test/frontend-notifications-bell.test.ts`
- `pnpm --dir frontend lint`
- `pnpm --dir frontend typecheck`
- `pnpm typecheck`
- `pnpm typecheck:test`
- `pnpm test`
- `pnpm build`
- `pnpm security:public-surface`
- Browser local en `http://127.0.0.1:3000/particulares` con viewport mobile `390x844`

## Resultados

- Tests focalizados de notificaciones y particulares: pass.
- Frontend lint: pass.
- Frontend typecheck: pass.
- Typecheck raiz: pass.
- Typecheck de tests: pass.
- Suite completa: pass, `2153` tests pasados y `1` skip existente.
- Build raiz: pass.
- Auditoria `security:public-surface`: pass, sin findings de exposicion publica; mantiene los avisos esperados `server-only` en `frontend/src/middleware.ts`.
- Browser local: `/particulares` compilo y respondio `200`, sin errores de consola en el cliente; la verificacion quedo limitada al render publico sin sesion porque el backend/proxy de `/api/particular/auth/me` no estaba disponible localmente.
- No se ejecuto `pnpm --dir frontend build`.

## Riesgos

- El panel mobile manual ahora es modal. Si en el futuro se necesita interaccion simultanea con contenido del dashboard mientras esta abierto, habria que ajustar el comportamiento de backdrop.
- El contenido del panel se comparte entre desktop y mobile; cambios futuros en acciones o lista impactan ambas superficies.

## Rollback

Revertir los cambios de `DashboardNotificationsBell.tsx` y restaurar el dropdown absoluto unico para `isOpen`. Luego revertir los tests agregados/actualizados y eliminar este documento.

## Estado final

- Mobile usa overlay/sheet fijo portaleado sobre el dashboard.
- El close desmonta u oculta completamente el panel al cambiar `isOpen` a `false`.
- La navegacion contextual de notificaciones se mantiene.
- Abrir el panel no marca notificaciones como leidas.
- Particular, clinica y admin mantienen la campana funcional.
- No se tocaron backend, API, auth, cookies, CSRF, CORS, CSP, storage, signed URLs, DB schema, indices, WebAuthn, Navbar ni Footer.
