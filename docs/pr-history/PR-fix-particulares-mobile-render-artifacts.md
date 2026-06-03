# PR fix particulares mobile render artifacts

## Resumen

Se reforzo el render mobile del dashboard de particulares en `/particulares` cuando existe una sesion particular activa. El cambio apunta a eliminar ghosting, duplicacion visual y artefactos de composicion en Android sin ocultar campos ni modificar contratos de datos.

El fix queda aislado al panel particular autenticado mediante los selectores existentes:

- `data-particular-session-panel="true"`
- `data-particular-session-summary="true"`
- `data-particular-session-field="true"`

## Causa probable

La corrupcion observada parece consistente con composicion CSS/GPU en mobile, no con datos duplicados. El panel activo combinaba superficies anidadas con opacidades, sombras, gradientes suaves y clases como `render-gpu-soft`, `surface-soft` y `clinical-muted-band`. En ciertos Android/WebView, esa mezcla puede promover capas y dejar restos visuales al repintar cards dentro del panel.

## Archivos tocados

- `frontend/src/components/public/ParticularesContent.tsx`
- `frontend/src/app/globals.css`
- `test/frontend-particulares-mobile-session-card-render.test.ts`
- `docs/pr-history/PR-fix-particulares-mobile-render-artifacts.md`

No se tocaron backend, auth, cookies, CSRF, CORS, CSP, storagePath, signed URLs, DB schema, indices, WebAuthn, Navbar ni Footer.

## Implementacion

- Se mantuvo el import dinamico de `DashboardNotificationsBell`.
- Se aislo la campana particular en `particular-notifications-bell-layer`.
- El placeholder de la campana paso de `bg-card/95` a `bg-card` y quedo targeteable por CSS.
- En `@media (max-width: 639px)`, el panel particular activo ahora fuerza:
  - backgrounds opacos con `hsl(var(--card))` y `hsl(var(--vetneb-surface-raised))`.
  - `background-image: none !important`.
  - `backdrop-filter` y `-webkit-backdrop-filter` en `none`.
  - `filter`, `transform` y `will-change` neutralizados.
  - `backface-visibility`, `perspective`, `mix-blend-mode` y `text-shadow` estables.
  - `contain: layout` en panel y `contain: layout paint` en resumen/fields.
  - sombras simples dentro del panel particular mobile.
- No se redefinio `.surface-soft` globalmente.
- Se conservaron Tutor, Mascota, Especie, Raza, Extraccion, Envio, Seguimiento del estudio, Informe vinculado, Ver informe, Descargar, links de WhatsApp/email y campana particular.

## Tests y comandos

Comando enfocado:

- `pnpm exec node --experimental-strip-types --experimental-specifier-resolution=node --test test/frontend-particulares-mobile-session-card-render.test.ts`: PASS, 5/5.

Validacion solicitada:

- `pnpm --dir frontend lint`: PASS.
- `pnpm --dir frontend typecheck`: PASS.
- `pnpm typecheck`: PASS.
- `pnpm typecheck:test`: PASS.
- `pnpm test`: PASS, 2146 pass, 1 skipped, 0 fail.
- `pnpm build`: PASS. Build root backend con `esbuild`; genero `dist/index.js`.
- `pnpm security:public-surface`: PASS, sin public devtools exposure findings. Conserva dos findings informativos `server-only` preexistentes en `frontend/src/middleware.ts`.

No se ejecuto `pnpm --dir frontend build`.

## Verificacion browser

Se levanto temporalmente `pnpm --dir frontend dev -- -p 3000 -H 127.0.0.1` y se abrio `http://127.0.0.1:3000/particulares` en el navegador integrado.

Resultado:

- `/particulares` respondio 200.
- Viewport mobile `390x844` activo; `window.matchMedia("(max-width: 639px)").matches === true`.
- Sin sesion real disponible, se verifico el estado sin sesion: formulario de token visible y sin errores de consola del navegador.
- El servidor frontend reporto `ECONNREFUSED` al proxy de `/api/particular/auth/me` porque el backend local no estaba corriendo en la URL configurada. Esto no bloqueo el render del formulario.

La sesion particular activa queda cubierta por contratos fuente porque este entorno no tenia token real para autenticar un caso.

## Resultados

El fix queda aplicado y cubierto por contratos que verifican:

- Los tres `data-*` de sesion particular siguen presentes.
- Existen exactamente seis fields visibles.
- Siguen los anchors `particular-study-tracking` y `particular-report`.
- El bloque CSS esta dentro de `@media (max-width: 639px)`.
- El bloque mobile neutraliza `backdrop-filter`, `-webkit-backdrop-filter`, `filter`, `transform` y `will-change`.
- Resumen y fields usan fondos opacos.
- `.surface-soft` no fue redefinida globalmente.
- La campana particular sigue presente y aislada con wrapper estable.

## Riesgos

- La validacion definitiva del bug visual requiere repetir en un Android real con sesion particular activa y datos reales del caso.
- En mobile, las superficies del panel activo quedan deliberadamente mas planas para reducir capas GPU. Desktop no cambia.

## Rollback

Revertir los cambios de:

- `frontend/src/components/public/ParticularesContent.tsx`
- `frontend/src/app/globals.css`
- `test/frontend-particulares-mobile-session-card-render.test.ts`
- `docs/pr-history/PR-fix-particulares-mobile-render-artifacts.md`

## Estado final

Implementado y validado localmente. No se ejecuto `git add`, commit, push, PR ni merge.

Confirmacion: el fix CSS es mobile-only y esta aislado al panel de particulares autenticado.
