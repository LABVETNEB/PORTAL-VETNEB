# VETNEB — Fix: densidad mobile del módulo Tokens (Admin) — 10 visibles sin scroll

Corrección quirúrgica del layout mobile del módulo **Tokens** del Dashboard
Administrador: elimina el bloque introductorio interno redundante, sube el
panel operativo y eleva la densidad de 3 a 10 tokens visibles por página sin
scroll global ni interno.

---

## 1. Resumen ejecutivo

En mobile, `AdminParticularTokensCard` renderizaba siempre un `CardHeader`
interno (“Tokens particulares” + descripción + métricas “En página / Activos /
Con informe / Página”) por encima del panel operativo (“Tokens administrados”,
“Generar token”, filtro “ID clínica”, lista, paginador). Ese bloque es
redundante en mobile: el app-bar ya muestra el título del módulo activo vía
`AdminMobileContextTitle`. Además, `MOBILE_PAGE_SIZE = 3` dejaba mucho espacio
vacío bajo el paginador.

**Corrección:** se oculta el `CardHeader` interno sólo en mobile
(`hidden md:flex`, desktop intacto), se sube `MOBILE_PAGE_SIZE` a `10` y se
compacta la densidad vertical del toolbar/lista/paginador mobile (gaps,
paddings, ancho del input de filtro) para que las 10 filas + toolbar entren en
el viewport sin `overflow:auto/scroll`.

TDD real: se reforzó primero el spec e2e (10 ítems exactos + header oculto +
sin overflow) contra el código viejo (**RED** — 1 ítem visible por el filtro
de clínica corriendo antes de la aserción, luego **RED** por overflow del
`<Table>` desktop oculto) → implementación → **GREEN** 3/3 viewports.

---

## 2. Rama y base

- Rama: `fix/admin-mobile-tokens-density-10-visible` (creada desde `main` limpio).
- HEAD base: `7b47e04 feat(admin): add fluid mobile dashboard tokens (#1076)`.

---

## 3. Problema visual (scope del PR)

1. Bloque superior interno (“Tokens particulares” + descripción + métricas)
   sobraba en mobile.
2. El panel operativo (“Tokens administrados”, “Generar token”, filtro “ID
   clínica”, “Filtrar”/“Actualizar”, lista, paginador) debía subir a ocupar ese
   espacio.
3. Espacio vacío excesivo debajo del paginador.
4. Debían entrar 10 tokens visibles por página en mobile (antes: 3).

## 4. No alcance (no tocado)

Backend, API, DB, auth, Clínica, dependencias, lockfiles, CI, Hub, Auditoría,
Clínicas, Sesiones, Mantenimiento, PWA/service worker, rutas públicas,
producción, otros módulos admin, textos nuevos, lógica de seguridad,
contratos de sesión, cookies, tokens reales.

---

## 5. Archivos inspeccionados (diagnóstico previo)

- `frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx`
- `frontend/src/app/dashboard/admin/AdminMobileCommandModule.tsx` (descartado:
  Tokens no usa este wrapper; tiene su propia rama `md:hidden` interna)
- `frontend/src/app/dashboard/admin/AdminDashboardWorkspaceController.tsx`
  (stage anti-ghosting #1074, fuera de este archivo, no tocada)
- `frontend/src/app/dashboard/admin/page.tsx` (slot `admin-particular-tokens`,
  no tocado)
- `frontend/src/components/dashboard/DashboardTopbar.tsx` (confirma que el
  app-bar mobile ya muestra el título del módulo activo)
- `frontend/src/app/globals.css` (bloque `--admin-mobile-*` de #1076: sólo
  app-bar/bottom-nav/hub-launcher/status-config modules; Tokens no lo usa, por
  lo tanto no requería ni admitía edición aquí)
- `frontend/src/components/ui/card.tsx`, `button.tsx` (bases `cva` para
  confirmar el patrón `hidden md:flex` y alturas reales de los botones)
- e2e: `admin-tokens-mobile-toolbar-layout.spec.ts`,
  `admin-mobile-core-modules-no-scroll.spec.ts`,
  `admin-mobile-final-polish-no-scroll.spec.ts`,
  `admin-mobile-module-layer-isolation.spec.ts`,
  `dashboard-real-app-shell-no-scroll-contract.spec.ts`,
  `dashboard-card-navigation-shell.spec.ts`,
  `dashboard-accessibility-keyboard.spec.ts`
- Test de contrato backend: `test/admin-tokens-enterprise-density.test.ts`

---

## 6. Archivos modificados

| Archivo | Cambio |
|---|---|
| `frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx` | `MOBILE_PAGE_SIZE` 3→10. `CardHeader` (título+descripción+métricas) oculto sólo en mobile (`hidden md:flex`, desktop sin cambios). Compactación de densidad mobile: `CardContent`, toolbar, fila de lista y paginador (gaps/paddings reducidos, `min-h-10→min-h-9`); ancho del input “ID clínica” de `w-full` a `w-28` en mobile para evitar el salto de línea forzado en el toolbar. Ningún `md:*` (desktop) fue modificado. |
| `frontend/e2e/admin-tokens-mobile-toolbar-layout.spec.ts` | Reforzado (test contractual mobile más cercano): dataset mock 9→11 tokens; nuevas aserciones — header interno oculto, métricas ocultas, exactamente 10 ítems visibles, sin overflow vertical en `html`/`body`, sin `overflow:auto/scroll` en el subárbol mobile (`data-admin-mobile-core-module="tokens"`). |
| `frontend/e2e/admin-mobile-core-modules-no-scroll.spec.ts` | Contrato legacy compartido (clinics/reports/tokens). Se agregó `maxItemsPerPage` por módulo (clinics:5, reports:5, **tokens:10**) en vez del `5` fijo; dataset mock de tokens 9→13 para que la aserción “la página cambia tras paginar” siga siendo significativa con `MOBILE_PAGE_SIZE=10`. **clinics y reports quedan exactamente igual que antes (cap 5, dataset 9).** |
| `test/admin-tokens-enterprise-density.test.ts` | Alineación in-PR de un único string pineado del Input (`className="h-8 w-full text-xs md:w-36"` → `...w-28...`), causado directamente por el cambio de ancho del filtro. Las otras 5 pruebas del archivo (incl. `PAGE_SIZE=9` desktop, clases prohibidas, no-scroll) se verificaron intactas y siguen en verde. |

No se crearon archivos nuevos de test/infraestructura: se reforzaron los
existentes más cercanos, por instrucción explícita del protocolo.

---

## 7. Qué legacy se preservó y por qué

- **Desktop intacto:** todas las clases `md:*` del componente quedaron sin
  tocar (`md:flex`, `md:py-2`, `md:min-h-8`, `md:flex-row`, `md:w-36`, etc.).
  `PAGE_SIZE=9` (desktop) y su test de contrato no se modificaron.
- **#1074 (stage anti-ghosting):** vive en
  `AdminDashboardWorkspaceController.tsx` / `globals.css`
  (`data-dashboard-module-stage`), fuera de este archivo. No se tocó ninguna
  línea de ese mecanismo; queda preservado por aislamiento de scope, no por
  omisión.
- **#1076 (tokens fluidos mobile):** sólo controla
  app-bar/bottom-nav/hub-launcher y los módulos `status`/`config`
  (Resumen, Estado del sistema, Precios, Mantenimiento). Tokens nunca consumió
  esas variables CSS (usa Tailwind directo); no había nada de #1076 que tocar
  ni romper.
- **Cap de página `clinics`/`reports`:** se mantuvo en `5` sin cambios; sólo
  `tokens` subió a `10`, con justificación explícita en el propio test
  (`maxItemsPerPage`).

---

## 8. Decisiones técnicas

1. **Ocultar el `CardHeader` con `hidden md:flex`** en vez de eliminarlo: es el
   mismo patrón ya usado en este archivo para la tabla desktop
   (`hidden ... md:block`), preserva el código y el contenido para desktop sin
   ramificar el componente.
2. **No tocar paginación backend:** el contrato `limit/offset` ya soporta
   cualquier valor (confirmado en `lib/api.ts`); sólo se ajustó la constante
   frontend `MOBILE_PAGE_SIZE`.
3. **Ancho fijo (`w-28`) en el input de filtro mobile** en vez de `w-full`:
   evita que el formulario fuerce un salto de línea completo, liberando ~32px
   verticales sin perder la función del filtro (accesible vía
   `aria-label="ID de clínica"` independientemente del ancho visual).
4. **Sin alturas hardcodeadas frágiles:** la compactación se hizo con la misma
   escala de utilidades Tailwind ya usada en el archivo (`gap-*`, `py-*`,
   `min-h-*`), no con `style` inline ni píxeles mágicos.
5. **No se tocó `globals.css`:** todo el ajuste fue posible con clases
   Tailwind locales al componente, evitando el riesgo de cache de Turbopack en
   e2e y cualquier efecto sobre otros módulos que sí comparten ese archivo.

---

## 9. Validaciones ejecutadas

| Comando | Resultado |
|---|---|
| `pnpm --dir frontend e2e -- admin-tokens-mobile-toolbar-layout.spec.ts` | **RED** inicial (orden de aserciones + falso positivo de overflow en `<Table>` desktop oculto) → corregido → **GREEN 3/3** |
| `pnpm --dir frontend e2e -- admin-mobile-core-modules-no-scroll.spec.ts` | **GREEN 13/13** (clinics, reports, tokens; mobile + desktop) |
| `pnpm --dir frontend e2e -- admin-mobile-final-polish-no-scroll.spec.ts admin-mobile-module-layer-isolation.spec.ts dashboard-real-app-shell-no-scroll-contract.spec.ts dashboard-card-navigation-shell.spec.ts dashboard-accessibility-keyboard.spec.ts` | **GREEN 129/129** |
| `pnpm test` (root) | **2815 pass / 0 fail** |
| `pnpm --dir frontend lint` | OK (sin salida) |
| `pnpm --dir frontend typecheck` | OK |
| `pnpm --dir frontend build` | OK (`next build` exitoso, 25 rutas) |
| `pnpm build` (root) | OK (`esbuild` backend, 877.3kb) |
| `git diff --check` | limpio |

> Nota operativa: tras cada corrida de `pnpm --dir frontend e2e`, el dev server
> regenera `frontend/next-env.d.ts` apuntando a `./.next/dev/types/routes.d.ts`;
> se revirtió a `./.next/types/routes.d.ts` antes de correr typecheck/build,
> conforme al patrón ya conocido en este repo.

Total de specs e2e relacionados a Tokens admin mobile identificados por
referencia directa a `admin-particular-tokens` / `core-module="tokens"`: **7
archivos, 145 casos, 145 pasan.**

---

## 10. Resultado de tests (TDD)

- **RED #1:** `toHaveCount(10)` recibía `1` — causa: la aserción se ejecutaba
  después de aplicar el filtro por clínica (`clinicId=12`) ya presente en el
  test, que reduce el dataset a 1 token. Fix: reordenar las nuevas aserciones
  antes de la interacción de filtro.
- **RED #2:** `forbidden overflow auto/scroll` detectaba
  `DIV.dashboard-table-responsive` y el wrapper de `<Table>` (`overflow-auto`
  propio de `components/ui/table.tsx`). Causa: ambos son descendientes del
  workspace pero pertenecen a la rama **desktop**, oculta (`display:none`) en
  mobile; `getComputedStyle` igual reporta su `overflow` declarado aunque no
  se renderice. Fix: escanear sólo `[data-admin-mobile-core-module="tokens"]`
  (mismo patrón ya usado por el contrato legacy compartido), no el workspace
  completo.
- **GREEN:** 3/3 viewports (360×740, 390×844, 430×932) — header oculto,
  métricas ocultas, 10 ítems exactos, sin overflow vertical/horizontal, sin
  `overflow:auto/scroll` en el subárbol mobile, toolbar operable
  (filtro+Filtrar+Limpiar+Actualizar), touch target de “Actualizar” ≥34px.

---

## 11. `git status --short --untracked-files=all`

```
 M frontend/e2e/admin-mobile-core-modules-no-scroll.spec.ts
 M frontend/e2e/admin-tokens-mobile-toolbar-layout.spec.ts
 M frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx
 M test/admin-tokens-enterprise-density.test.ts
```

## 12. `git diff --stat`

```
 .../admin-mobile-core-modules-no-scroll.spec.ts    | 14 +++---
 .../e2e/admin-tokens-mobile-toolbar-layout.spec.ts | 51 +++++++++++++++++++++-
 .../dashboard/admin/AdminParticularTokensCard.tsx  | 16 +++----
 test/admin-tokens-enterprise-density.test.ts       |  2 +-
 4 files changed, 66 insertions(+), 17 deletions(-)
```

## 13. `git diff --check`

Sin hallazgos (salida vacía).

---

## 14. Evidencia de no-scroll / densidad 10

- `admin-tokens-mobile-toolbar-layout.spec.ts` (reforzado): por viewport
  (360×740, 390×844, 430×932) — `[data-admin-mobile-core-item="true"]` cuenta
  exactamente **10**; `document.documentElement`/`body` sin `scrollHeight >
  clientHeight`; cero elementos con `overflow-x`/`overflow-y` en
  `auto`/`scroll` dentro de `[data-admin-mobile-core-module="tokens"]`.
- `admin-mobile-core-modules-no-scroll.spec.ts` (legacy, ajustado): cada ítem
  individual de `tokens` queda dentro del viewport (no clip), el paginador
  queda dentro del viewport y por encima del bottom nav, “Siguiente” habilitado
  y la página efectivamente cambia de contenido tras paginar.
- `admin-mobile-final-polish-no-scroll.spec.ts` (sin cambios, verificado
  igualmente verde): cada ítem dentro de la “banda de contenido mobile” y sin
  clipping por ancestros, con el dataset real del fixture server (9 tokens).

---

## 15. Confirmación explícita de scope

- Bloque superior mobile de Tokens (“Tokens particulares” + descripción +
  métricas): **eliminado del render mobile** (`hidden`), intacto en desktop.
- Panel operativo (“Tokens administrados”, “Generar token”, filtro, lista,
  paginador): **subido**, ocupa el espacio liberado.
- **10 tokens visibles por página en mobile:** confirmado (test exacto
  `toHaveCount(10)`).
- **Sin scroll global:** confirmado (`html`/`body` `scrollHeight <=
  clientHeight` en los 3 viewports).
- **Sin scroll interno:** confirmado (sin contenedores con scroll real dentro
  del módulo mobile).
- **Sin `overflow:auto`/`overflow:scroll` agregado:** confirmado por
  `git diff` y por el escaneo de computed style en e2e.
- **Bottom nav / app-bar preservados:** confirmado (specs de chrome mobile
  compartidos siguen verdes; no se tocó ningún archivo de chrome).
- **Touch targets ≥36px en controles operativos principales:** “Actualizar”,
  “Filtrar”, paginador `Anterior`/`Siguiente` (mobile) siguen en `h-9`/`size=sm`
  por defecto (36px) o superior; no se redujo ningún control operativo
  principal por debajo de su tamaño previo.
- **#1074 (anti-ghosting) preservado:** archivo/selector no tocados.
- **#1076 (tokens fluidos mobile) preservado:** archivo/selectores no tocados.
- **Backend/API/DB/auth/Clínica/dependencias/lockfiles/CI/otros módulos admin:
  no tocados** (confirmado por `git diff --stat`: sólo 1 componente Tokens + 2
  specs e2e + 1 test de contrato backend de alineación de string).

---

## 16. Riesgos residuales

1. La densidad de 10 filas se verificó empíricamente con Playwright/Chromium
   headless en los 3 viewports estándar del repo (360×740 hasta 430×932). No
   se verificó en hardware real; dado que el ajuste es puramente de
   espaciado/Tailwind (sin `transform`/composición GPU de por medio, a
   diferencia de #1074), el riesgo de divergencia headless↔dispositivo real es
   bajo.
2. El ancho del input “ID clínica” bajó de `w-full` a `w-28` en mobile; el
   placeholder visual puede truncarse en viewports muy angostos, pero la
   etiqueta accesible (`aria-label`) no se ve afectada y el test de toolbar
   reforzado sigue validando que el filtro funciona end-to-end.

---

### Cierre / Git manual (protocolo VETNEB)

Implementación, tests y validaciones completas. Según el protocolo, **Git lo
ejecuta Nico**:

```powershell
git add frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx `
        frontend/e2e/admin-tokens-mobile-toolbar-layout.spec.ts `
        frontend/e2e/admin-mobile-core-modules-no-scroll.spec.ts `
        test/admin-tokens-enterprise-density.test.ts `
        docs/audit/admin-mobile-tokens-density-10-visible.md
git status --short --untracked-files=all
git commit -m "fix(admin): compact mobile tokens dashboard"
git push -u origin fix/admin-mobile-tokens-density-10-visible
gh pr create --title "fix(admin): compact mobile tokens dashboard" --body "## Summary
- Remove the redundant mobile-only Admin Tokens intro/metrics block
- Move the operational Tokens panel up and reduce unused space below pagination
- Keep 10 tokens visible per page on mobile without global or internal scroll
- Preserve bottom nav, appbar, stage anti-ghosting (#1074) and fluid mobile dashboard tokens (#1076)

## Scope
- Admin Dashboard mobile Tokens module only
- Tests (e2e + backend contract alignment) and required implementation Markdown only

## Not touched
- Backend, API, DB, Auth, Clínica, dependencies, lockfiles, CI, Hub, Auditoría, Clínicas, Sesiones, Mantenimiento, PWA/service worker, other admin modules

## Validation
- pnpm test (2815/2815)
- pnpm --dir frontend lint
- pnpm --dir frontend typecheck
- pnpm --dir frontend build
- pnpm build
- pnpm --dir frontend e2e (7 archivos relacionados a Tokens admin mobile, 145/145)"
gh pr checks --watch
```
