# Global WOFF2 Font Implementation

## Scope
Aplicación de fuente global local variable WOFF2 en el frontend, reemplazando la carga vía `next/font/google` (Inter + Source Sans 3) por un único asset local sin dependencias externas en build ni runtime.

## Files changed
- `frontend/public/fonts/InterVariable.woff2` — nuevo asset local (344 KB, variable, pesos 100–900).
- `frontend/src/app/globals.css` — `@font-face` variable, tokens `--font-heading/--font-body/--font-ui` apuntando a `"Inter"`, regla `html` con el stack global.
- `frontend/src/app/layout.tsx` — eliminado `next/font/google`, agregado `<link rel="preload">` del único archivo de fuente.
- `test/frontend-public-typography-contract.test.ts` — contrato tipográfico actualizado a la implementación nueva (asset local existente, sin imports remotos, `@font-face` variable, tokens, preload).

## Font source
- Archivo usado: `InterVariable.woff2` del release oficial Inter v4.1 (github.com/rsms/inter), SHA256 `693B77D4F32EE9B8BFC995589B5FAD5E99ADF2832738661F5402F9978429A8E3`.
- Formato: variable WOFF2 (`format("woff2")`).
- Peso: rango variable `100 900`, `font-style: normal` (no se incorpora itálica: el sitio no la usa).
- Estrategia de carga: asset servido desde `frontend/public/fonts/`, preload de un solo archivo en `<head>`, `@font-face` en `globals.css`.

Por qué Inter: ya era la fuente de headings/UI del proyecto y `body` ya declaraba `font-feature-settings` específicos de Inter (`cv02/cv03/cv04/cv11`). Consolidar a Inter variable elimina la segunda familia (Source Sans 3), reduce de 8 archivos de fuente a 1 y mantiene la identidad visual existente.

## Performance notes
- font-display: `swap`.
- preload: un único `<link rel="preload" as="font" type="font/woff2" crossOrigin="anonymous">` para la fuente crítica global.
- fallback: `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` (stack previo intacto).
- El service worker existente ya cachea requests con `destination === "font"` (`frontend/public/sw.js`), sin cambios.
- Sin Google Fonts en build: el build ya no descarga fuentes de red.

## Validation
- `pnpm --dir frontend lint` — PASS.
- `pnpm --dir frontend typecheck` — PASS.
- `pnpm --dir frontend build` — PASS (26/26 páginas, sin cambios de tamaño de bundles JS).
- `pnpm typecheck` y `pnpm typecheck:test` — PASS.
- `pnpm test` — 2657 tests, 2651 PASS; los 6 fallos son guard tests históricos (PR-1/2/4/6/8/9) que ejecutan `git diff --name-only` sobre el working tree sin commitear y bloquean `layout.tsx` para *sus* scopes pasados. Pasan con el tree limpio (post-commit y en CI).
- `pnpm build` (root/backend) — PASS.
- `pnpm security:public-surface` — PASS.
- `test/frontend-public-typography-contract.test.ts` — 3/3 PASS con el contrato actualizado.

## Out of scope
- No rediseño visual.
- No cambios de layout.
- No cambios de contenido.
- No dependencias externas runtime.
- No se modificaron los guard tests históricos de scope de otros PRs.
