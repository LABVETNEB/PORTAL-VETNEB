# Fix: paginador Tokens mobile anclado al margen inferior interno del módulo

- Rama: `fix/admin-mobile-tokens-pagination-bottom`
- HEAD base: `5b82400 fix(admin): compact mobile tokens dashboard (#1077)`

## Problema real observado

Posterior a #1077, en Dashboard Administrador mobile, módulo **Tokens**, el
paginador (`1–6` / `1–10` · Anterior · Pág. N · Siguiente) quedaba ubicado
justo debajo de la lista de tokens, sin anclarse al borde inferior interno del
módulo. Cuando la lista no llenaba el alto disponible (dataset corto, p. ej.
6 tokens), el espacio vacío quedaba **debajo del paginador** en lugar de ser
absorbido por la zona de lista, dejando el paginador "flotando" arriba de un
bloque inferior vacío.

Causa raíz: el contenedor mobile (`data-admin-mobile-core-module="tokens"`)
era un `flex flex-col` con `gap-1.5`, pero ni la lista
(`data-admin-particulars-mobile-list="true"`) ni el paginador
(`data-admin-mobile-core-pager="true"`) tenían `flex-1`/`mt-auto`. Sin un
elemento que absorbiera el espacio restante, el paginador quedaba inmediatamente
después de la lista (su altura natural), y el sobrante de altura del flex
padre quedaba como hueco debajo de todo, después del paginador.

## Scope

- Layout del módulo Tokens mobile en
  [AdminParticularTokensCard.tsx](../../frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx).
- Tests e2e existentes del módulo Tokens mobile.

## No alcance

- Backend / API / DB / auth.
- Clínicas, Sesiones, Intentos fallidos, Auditoría, System health, Mantenimiento, desktop.
- Lógica de paginación (page size, offsets, fetch).
- Dependencias / lockfiles / CI.
- #1074 (anti-ghosting) y #1076 (tokens fluidos): preservados sin tocar sus clases.

## Archivos modificados

- [frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx](../../frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx)
- [frontend/e2e/admin-tokens-mobile-toolbar-layout.spec.ts](../../frontend/e2e/admin-tokens-mobile-toolbar-layout.spec.ts)

## Implementación aplicada

En el contenedor mobile del módulo Tokens:

```diff
- <div className="flex min-h-0 flex-1 flex-col gap-1.5 md:hidden" data-admin-mobile-core-module="tokens">
+ <div className="flex h-full min-h-0 flex-1 flex-col gap-1.5 md:hidden" data-admin-mobile-core-module="tokens">
    <div
      data-admin-particulars-mobile-list="true"
-     className="divide-y divide-vetneb-line/60 overflow-hidden rounded-lg border border-vetneb-line/75"
+     className="min-h-0 flex-1 divide-y divide-vetneb-line/60 overflow-hidden rounded-lg border border-vetneb-line/75"
    >
```

- `h-full` en el stage del módulo asegura que el contenedor ocupe todo el alto
  disponible cedido por el `CardContent`/`section` padres (ya `flex-1 min-h-0`).
- `flex-1 min-h-0` en la caja de la lista hace que esa caja (con
  `overflow-hidden`, sin scroll) absorba todo el espacio vertical sobrante
  cuando el dataset es corto. El hueco vacío queda *dentro* del borde de la
  lista, no debajo del paginador.
- El paginador (`shrink-0`, sin cambios) queda empujado naturalmente al final
  de la columna flex, pegado al borde inferior interno del módulo.
- No se tocó el `mt-auto`/posición del paginador; el fix resuelve el problema
  haciendo que el espacio sobrante se reparta en la lista, no después del pager.
- Cuando no hay tokens (dataset vacío + mobile viewport) el estado vacío
  (`surface-empty`) sigue siendo `flex-1`; en ese caso no hay paginador
  renderizado (no aplica el contrato de anclaje).

## Tests agregados/reforzados

En `frontend/e2e/admin-tokens-mobile-toolbar-layout.spec.ts`:

- `mockAdminParticularTokens` ahora acepta un dataset de origen configurable.
- Nuevo helper `assertPagerAnchoredToModuleBottom`: compara el borde inferior
  del módulo (`data-admin-mobile-core-module="tokens"`) contra el borde
  inferior del paginador (`data-admin-mobile-core-pager="true"`), con
  tolerancia de 28px (padding/border del `CardContent`).
- `admin tokens mobile pager stays bottom-anchored with a full page` (10
  tokens, 3 viewports): paginador anclado abajo con dataset completo.
- `admin tokens mobile pager stays bottom-anchored with a short dataset` (6
  tokens, 3 viewports): paginador anclado abajo con dataset corto (`1–6`),
  además de verificar ausencia de `overflow: auto|scroll`.

Estos tests fallaban contra el estado previo (gaps medidos de 150–316px) y
pasan tras el fix (TDD confirmado).

## Validaciones ejecutadas

Todas en PowerShell, desde `C:\PORTAL-VETNEB`:

```powershell
pnpm --dir frontend exec playwright test frontend/e2e/admin-tokens-mobile-toolbar-layout.spec.ts
# 9 passed

pnpm --dir frontend exec playwright test frontend/e2e/admin-mobile-core-modules-no-scroll.spec.ts
# 13 passed

pnpm test
# 2815 passed (nota: `next dev` reescribe frontend/next-env.d.ts como efecto
# colateral de levantar el server de Playwright; se revirtió con
# `git checkout -- frontend/next-env.d.ts` antes de correr pnpm test, según
# el guardrail PR-N conocido del repo)

pnpm --dir frontend lint
pnpm --dir frontend typecheck
pnpm --dir frontend build
# Compiled successfully, 0 errores

pnpm build
# esbuild backend bundle, Done
```

## Evidencia de paginador anclado abajo

Test `assertPagerAnchoredToModuleBottom` mide en runtime:
`moduleBottom - pagerBottom <= 28px` en los 3 viewports mobile
(360x740, 390x844, 430x932), tanto con 10 tokens (`1–10`) como con 6 tokens
(`1–6`). Antes del fix, el mismo assert fallaba con gaps de 150px a 316px.

## Evidencia de no-scroll

- `admin-tokens-mobile-toolbar-layout.spec.ts`: assert de
  `overflowX`/`overflowY` distinto de `auto`/`scroll` en todo el subárbol del
  módulo, para el dataset corto (6 tokens) y ya existente para el dataset
  estándar.
- `admin-mobile-core-modules-no-scroll.spec.ts`: contrato completo de
  `html`/`body` sin overflow vertical/horizontal, módulo Tokens incluido,
  sigue pasando en página 1 y página 2.

## Confirmación de no tocar backend/API/DB/auth/Clínica/dependencias/lockfiles/CI/otros módulos

- `git diff --stat` solo afecta `AdminParticularTokensCard.tsx` (2 líneas de
  clases) y el spec de tests del propio módulo Tokens.
- No se modificó ningún archivo de backend, rutas API, esquema DB, middleware
  de auth, `package.json`, lockfiles, ni workflows de CI.
- Módulos Clínicas, Sesiones, Intentos fallidos, Auditoría, System health,
  Mantenimiento y desktop no fueron tocados; sus tests (`admin-mobile-core-modules-no-scroll.spec.ts`
  para clinics/reports) siguen en verde sin cambios.

## Riesgo residual

- La tolerancia de 28px asumida para el gap inferior del paginador depende
  del padding actual de `CardContent` (`px-4 py-2`); si un PR futuro cambia
  ese padding de forma significativa, el test de anclaje debería revisarse.
- El estado vacío (sin tokens) no tiene paginador y no quedó cubierto por el
  contrato de anclaje porque no aplica (sin dataset no hay `1–N` que anclar).
