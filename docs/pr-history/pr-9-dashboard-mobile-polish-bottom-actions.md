# PR-9 - Dashboard mobile polish and bottom action bar

## Resumen

Se pulió la experiencia móvil/tablet de dashboards privados reforzando el comportamiento inferior de `StickyActionBar`, el safe-area, el scroll interno de filtros/tabs/drawers y el resguardo inferior de contenido donde hay acciones fixed en mobile.

## Archivos modificados

- `frontend/src/app/dashboard/page.tsx`
- `frontend/src/app/dashboard/admin/AdminSectionTabs.tsx`
- `frontend/src/components/dashboard/FilterDrawer.tsx`
- `frontend/src/components/dashboard/MasterDetailWorkspace.tsx`
- `frontend/src/components/dashboard/StickyActionBar.tsx`
- `frontend/src/components/dashboard/StickyFilterBar.tsx`
- `test/frontend-dashboard-mobile-polish-bottom-actions.test.ts`
- `docs/pr-9-dashboard-mobile-polish-bottom-actions.md`

## Mejoras mobile/safe-area por componente

- `StickyActionBar`: conserva mobile fixed bottom y desktop sticky, suma padding inferior con `env(safe-area-inset-bottom)`, pointer-events controlado, botones más altos y legibles, grid mobile de una columna con paso a dos columnas desde 420px.
- `StickyFilterBar`: mantiene sticky, acota ancho máximo, evita overflow de página y mueve los chips a scroll horizontal interno con `overscroll-x-contain`.
- `FilterDrawer`: panel acotado a `h-dvh`/`max-h-dvh`, overlay sin overflow de página, scroll interno con overscroll contenido y footer/header sin colapsar; footer respeta safe-area.
- `MasterDetailWorkspace`: refuerza `max-w-full`, `overflow-x-hidden` y `scroll-mt` móvil para navegación hacia detalle sin quedar bajo barras sticky.
- `AdminSectionTabs`: tablist con scroll horizontal interno, contenedor sin overflow-x de página y tabs `whitespace-nowrap`.
- `/dashboard`: agrega spacer móvil inferior como las otras páginas privadas con `StickyActionBar`.

## Decisiones técnicas

- No se creó `BottomActionBar`: `StickyActionBar` ya centralizaba el comportamiento bottom/sticky y era más seguro reforzarlo allí.
- Los cambios son de clases/resguardos responsivos y no alteran datos, fetches, handlers, rutas ni layout macro.
- Desktop queda con el patrón existente `md:sticky`.

## Validaciones ejecutadas

- `git diff --check`: OK, sin errores de whitespace. Git emitio avisos esperados de normalizacion LF/CRLF en archivos frontend tocados.
- `pnpm test`: OK, 2396 tests passed.
- `pnpm build`: OK.
- `pnpm security:public-surface`: OK, sin public devtools exposure findings. La auditoria solo reporto marcadores server-only existentes en `frontend/src/proxy.ts`.
- `pnpm --dir frontend lint`: OK.
- `pnpm --dir frontend typecheck`: OK.
- `pnpm --dir frontend build`: OK. Next genero cambios automaticos en `frontend/next-env.d.ts` y `frontend/tsconfig.json`; se restauraron ambos para mantener el scope de PR-9.

## Riesgos residuales

- El safe-area depende del soporte del navegador para `env(safe-area-inset-bottom)`; en navegadores sin notch se resuelve como padding base por el `calc`.
- Los chips de filtros ahora priorizan no generar scroll de página y pueden requerir scroll horizontal interno cuando hay valores largos.

## Confirmación de scope

- Sin cambios en backend.
- Sin cambios en API routes.
- Sin cambios en auth.
- Sin cambios en middleware.
- Sin cambios en SEO ni rutas públicas.
- Sin cambios en dependencias, `package.json`, `pnpm-lock.yaml`, `next-env.d.ts` o `tsconfig.json`.
