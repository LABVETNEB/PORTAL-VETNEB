# Dark Gray Mode

## Scope
Implementacion de opcion global Normal / Dark Gray Mode en frontend, con persistencia y sin flash visual.

## Problem
El proyecto no tenia una opcion persistente para usar modo oscuro. Existia un bloque `.dark` legacy en `globals.css` (azul marino, estilo scaffold) que ningun codigo aplicaba; se dejo intacto y fuera de este modelo.

## Files changed
- `frontend/src/app/globals.css` — bloque `theme-mode-dark-gray` al final del archivo (tokens + overrides puntuales).
- `frontend/src/app/layout.tsx` — `data-theme="normal"` + `suppressHydrationWarning` en `<html>`, `<script src="/theme-init.js">` sincronico en `<head>`.
- `frontend/src/lib/theme.ts` — nuevo: constantes `THEME_STORAGE_KEY`, modos y tipo `ThemeMode`.
- `frontend/src/components/theme/ThemeModeToggle.tsx` — nuevo: control cliente accesible (button + `aria-pressed`).
- `frontend/src/components/layout/Navbar.tsx` — toggle en el grupo de acciones derecho del header publico.
- `frontend/src/components/dashboard/DashboardTopbar.tsx` — mismo toggle reutilizado en el topbar del dashboard.
- `frontend/public/theme-init.js` — nuevo: init estatico pre-paint (lee localStorage y setea `dataset.theme`).
- `frontend/e2e/theme-mode.spec.ts` — nuevo: contrato e2e del tema.
- `test/auth-cookie-persistence-contract.test.ts` — allowlist quirurgica (ver Validation).
- `test/frontend-csp-inline-blockers-contract.test.ts` — allowlist quirurgica (ver Validation).

## Implementation
- Modelo por atributo estable en `<html>`: `data-theme="normal"` (default SSR) / `data-theme="dark-gray"`.
- Todos los tokens HSL existentes (`--background`, `--card`, `--vetneb-*`, `--sidebar-*`, etc.) se sobreescriben bajo `:root[data-theme="dark-gray"]`; `:root` no se toca, por lo que Normal queda bit a bit igual.
- El bloque nuevo va sin `@layer` a proposito: gana de forma determinista sobre `components`/`utilities` de Tailwind v4.
- Overrides puntuales solo donde habia colores literales claros: `public-cta-secondary`/`public-cta-outline` (superficie elevada gris oscura), `public-cta-on-hero` (mantiene texto navy sobre su fondo claro fijo, ya que el hero conserva su gradiente navy de marca en ambos modos), textos ambar (`text-amber-6/7/8xx`, `clinical-alert-warning`, `dashboard-kpi-pill[data-tone="critical"]`) a ambar claro legible.
- Gradientes de marca hardcodeados (heroes, CTA primario, headers clinicos, sidebar) se conservan: ya son superficies oscuras compatibles. Sin filtros globales, sin invertir imagenes/logos.
- El dashboard hereda el tema via tokens del layout raiz; el toggle se reutiliza en su topbar (un control por shell, sin duplicar logica).

## Theme model
- Normal: tokens actuales de `:root` sin cambios; `color-scheme: light`.
- Dark Gray: grises oscuros premium con tinte frio sutil (hue 210, saturacion 8-16%) — fondo `hsl(210 8% 12%)` (#1c2024, no negro), cards `hsl(210 9% 16%)`, bordes `hsl(210 8% 28-30%)`, texto principal `hsl(210 16% 90%)`, secundario `hsl(210 10% 68%)`, links/acentos en azul acero y teal aclarados (`--vetneb-navy: 205 58% 68%`, `--vetneb-teal: 177 50% 48%`); `color-scheme: dark` (controles nativos y scrollbars correctos). Contrastes verificados ≥ 4.5:1 en texto normal.
- Persistence: `localStorage["vetneb-theme-mode"] = "normal" | "dark-gray"`; default `normal`; escritura en `try/catch` (si falla, el tema aplica igual en la vista).
- Hydration strategy: el HTML SSR sale con `data-theme="normal"`; `/theme-init.js` (externo, sincronico, primero en `<head>`) aplica el valor persistido antes del primer paint — el parser no pinta `<body>` antes de ejecutarlo, asi que no hay flash. `suppressHydrationWarning` en `<html>` cubre la diferencia de atributo; el toggle monta en estado `normal` y se sincroniza con `dataset.theme` en `useEffect` (sin mismatch). Se eligio script externo y no inline para no introducir un bloqueador del enforcement CSP futuro (cubierto por `script-src 'self'`).

## Accessibility
- `button` nativo con `aria-pressed`, `aria-label` ("Cambiar a modo oscuro/normal") y `title`; operable por teclado con foco visible (`focus-visible:ring`).
- `color-scheme` correcto por modo; contraste AA en texto/control; sin animaciones nuevas.

## Validation
- `pnpm --dir frontend lint` — PASS.
- `pnpm --dir frontend typecheck` — PASS.
- `pnpm --dir frontend build` — PASS (25/25 paginas, mismas rutas estaticas/dinamicas).
- `pnpm --dir frontend e2e theme-mode.spec.ts` — PASS (2/2): existe el selector, alterna Normal/Dark Gray, persiste en `localStorage`, aplica `data-theme="dark-gray"` al `documentElement`, vuelve a normal, aplica pre-hidratacion sin errores de hydration.
- `pnpm test` — 2651/2657 PASS. Los 6 fallos locales son exclusivamente guardrails historicos por diff (`PR-1/2/4/6/8/9 ... stays within allowed file scope`): ejecutan `git diff --name-only` sobre el working tree y disparan ante cualquier cambio sin commitear en archivos como `layout.tsx`/`globals.css`. Verificado empiricamente: con `git stash -u` (arbol limpio) los 6 pasan; en CI post-commit el diff esta vacio y quedan verdes. No se modificaron.
- `pnpm build` — PASS.
- `pnpm security:public-surface` — PASS (los 2 hallazgos `[server-only]` de `proxy.ts` son informativos y preexistentes en `main`).
- Verificacion visual con screenshots (home, precios, login): Normal identico al actual; Dark Gray gris oscuro premium con jerarquia intacta.
- Tests de contrato actualizados (dentro del scope del PR, que exige persistencia via `localStorage` y testing actualizado):
  - `auth-cookie-persistence-contract`: el ban global del literal `localStorage` en `frontend/src` ahora exceptua solo los 2 archivos de tema; para ellos exige que usen unicamente la key `vetneb-theme-mode` y prohibe referencias a `session`/`auth`/`cookie`/`token`. El invariante de auth queda igual de fuerte.
  - `frontend-csp-inline-blockers-contract`: el scan de `<script>` JSX exceptua unicamente el src exacto `/theme-init.js` (script externo same-origin: no requiere `unsafe-inline` ni nonce, no es bloqueador de enforcement segun el criterio documentado del propio contrato). Los scripts inline siguen prohibidos.

## Out of scope
- Sin rediseño de secciones.
- Sin cambios de copy institucional (solo labels del control de tema).
- Sin cambios backend.
- Sin cambios de negocio.
- Sin dependencias nuevas (icons via `lucide-react` ya existente).
- Bloque `.dark` legacy de `globals.css` intacto (no usado por nadie).
- `theme-color` PWA/manifest sin cambios.
