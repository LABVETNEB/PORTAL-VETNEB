# PR fix particulares mobile safe session summary

## Resumen

Implementa un resumen de sesion particular mobile-safe en `/particulares`.
En mobile, los datos Tutor, Mascota, Especie, Raza, Extraccion y Envio ahora se renderizan en una estructura plana, opaca y sin superficies visuales pesadas. Desktop conserva el resumen previo desde `sm+`.

## Causa probable

La corrupcion persistente en Android real es compatible con artefactos de composicion CSS/GPU en un bloque con capas anidadas, sombras, fondos con opacidad y primitivas visuales promovidas a GPU. El problema no parece ser duplicacion de datos de negocio, sino repaint/composicion inestable del resumen activo.

## Que fallo de #809

#809 reforzo CSS sobre el panel y las superficies existentes, pero el resumen seguia usando la misma estructura visual base: `clinical-muted-band` y campos `surface-soft` dentro de un panel con composicion. Ese enfoque reduce riesgo, pero no elimina la condicion estructural que puede disparar ghosting en Android.

## Implementacion

- `ParticularesContent.tsx` agrega un resumen mobile-only con:
  - `data-particular-mobile-safe-summary="true"`.
  - seis `data-particular-mobile-safe-field="true"`.
  - clases planas con fondo `bg-card`, borde simple y sin `surface-soft`.
- El resumen desktop anterior queda como `hidden ... sm:block`, por lo que no coexiste visualmente en mobile.
- El bloque mobile-safe no usa `PremiumPanel`, `VisualIcon`, `render-gpu-soft`, `surface-soft`, `backdrop-blur`, `transform-gpu` ni `bg-card/`.
- `globals.css` agrega reglas mobile-only para los nuevos data attributes con fondos opacos, neutralizacion de filtros/transform/will-change, `contain: layout paint style`, `isolation: isolate`, borde estable y overflow controlado.
- Se conserva la campana de notificaciones, seguimiento del estudio, informe vinculado, Ver informe, Descargar, WhatsApp/email de tincion especial y logout particular.

## Archivos tocados

- `frontend/src/components/public/ParticularesContent.tsx`
- `frontend/src/app/globals.css`
- `test/frontend-particulares-mobile-session-card-render.test.ts`
- `docs/pr-history/PR-fix-particulares-mobile-safe-session-summary.md`

No se tocaron backend, API, auth, cookies, CSRF, CORS, CSP, storagePath, signed URLs, DB schema, indices, WebAuthn, Navbar, Footer ni dashboards admin/clinica.

## Tests y comandos

- `pnpm exec node --experimental-strip-types --experimental-specifier-resolution=node --test test/frontend-particulares-mobile-session-card-render.test.ts`: PASS, 8/8.
- `pnpm --dir frontend lint`: PASS.
- `pnpm --dir frontend typecheck`: PASS.
- `pnpm typecheck`: PASS.
- `pnpm typecheck:test`: PASS.
- `pnpm test`: PASS, 2149 pass, 1 skipped, 0 fail.
- `pnpm build`: PASS, backend root build con `esbuild`.
- `pnpm security:public-surface`: PASS, sin public devtools exposure findings. Reporta dos findings `server-only` en `frontend/src/middleware.ts` para nombres de cookies, sin exposicion publica.

No se ejecuto `pnpm --dir frontend build`.

## Resultados

Los contratos verifican:

- existe `data-particular-mobile-safe-summary`.
- existen seis `data-particular-mobile-safe-field`.
- el bloque mobile-safe contiene Tutor, Mascota, Especie, Raza, Extraccion y Envio.
- el bloque mobile-safe no contiene primitivas o clases prohibidas para este fix.
- el resumen desktop queda oculto en mobile con `hidden`/`sm:block`, no con opacity.
- el CSS mobile contiene reglas para los nuevos data attributes.
- el CSS neutraliza `filter`, `backdrop-filter`, `-webkit-backdrop-filter`, `transform`, `will-change`, `mix-blend-mode` y `text-shadow`.
- los fondos del resumen mobile-safe son opacos.
- los marcadores mobile-safe no aparecen en Navbar, Footer, server, drizzle ni shared.

## Validacion browser

No se uso navegador local ni token real en esta iteracion. Si se valida en browser, el token debe pegarlo manualmente el usuario en `/particulares`; no debe imprimirse, capturarse ni persistirse.

## Riesgos

- La confirmacion definitiva del bug requiere Android real con sesion particular activa.
- En mobile, el resumen queda deliberadamente mas plano que desktop para reducir capas y artefactos.
- El panel contenedor general sigue existiendo, pero las cards del resumen mobile-safe ya no dependen de las superficies visuales previas.

## Rollback

Revertir los cambios en:

- `frontend/src/components/public/ParticularesContent.tsx`
- `frontend/src/app/globals.css`
- `test/frontend-particulares-mobile-session-card-render.test.ts`
- `docs/pr-history/PR-fix-particulares-mobile-safe-session-summary.md`

No hay migraciones, backend, datos ni configuracion de auth para revertir.

## Estado final

Implementado y validado localmente. Mobile usa un layout plano unico para el resumen de sesion particular bajo `640px`. Desktop no cambia intencionalmente y conserva el resumen anterior desde `sm+`.

No se ejecuto `git add`, commit, push, PR, merge ni ninguna accion de publicacion.
