# Dashboard No-Scroll Premium Operational Workspace — Plan de rediseño

Rama: `feat/dashboard-no-scroll-premium-redesign`
Base: `main` @ `d96eec2`
Scope: `/dashboard` (clínica) y `/dashboard/admin` (administración) — solo frontend.
Skills aplicadas: `vetneb-briefing-planificacion-diseno-desarrollo-pruebas`, `vetneb-production-web-optimization-engineer`.

---

## 1. Diagnóstico honesto

### Por qué el dashboard "sigue viéndose igual" y sigue transmitiendo lógica de scroll

El shell ya está acotado al viewport (`DashboardShellRouter` usa `h-dvh overflow-hidden`), pero **el scroll real se delega a dos contenedores internos**, que es exactamente lo que el brief prohíbe:

1. **`.dashboard-main` es un contenedor con scroll interno.**
   En `frontend/src/app/globals.css:217-219`:
   ```css
   .dashboard-main { @apply flex-1 overflow-y-auto space-y-6 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7; }
   ```
   `overflow-y-auto` convierte el área principal en una columna scrolleable. En escritorio (1440×900 / 1366×768) el contenido del hub supera el alto disponible y aparece scroll interno.

2. **`DashboardModuleWorkspace` añade un segundo scroll interno.**
   En `frontend/src/components/dashboard/DashboardModuleWorkspace.tsx:46`:
   ```tsx
   <div className="min-h-0 flex-1 overflow-y-auto pt-4">{children}</div>
   ```

3. **El HUB es el antipatrón "hero arriba y lo demás apilado abajo".**
   - `DashboardHubHero.tsx` es un hero **horizontal y alto** (`px-5 py-5 sm:py-6`, título `text-2xl`, dos blobs decorativos `h-52/h-56 blur-3xl`).
   - `DashboardModuleHub.tsx` lo apila sobre un encabezado + una grilla vertical de tarjetas (`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`). Con 5 tarjetas (clínica) y **10 tarjetas (admin)** la pila crece muy por debajo del fold → necesita scroll.
   - Resultado: la primera lectura "al entrar" es un hero grande + lista de accesos que baja. No es un control center; es una página apilada con scroll.

4. **El alto del viewport se desperdicia en vez de distribuirse por columnas.**
   No se usa el espacio horizontal disponible (en 1440/1366 la sidebar está en modo riel-icono `w-[4.5rem]`, dejando ~1300px de ancho útil). Todo se resuelve en una sola columna vertical.

### Qué impide hoy un dashboard operativo real

- Layout **vertical de flujo** (stacks `space-y-*`) en lugar de un **grid de alto fijo** que reparte paneles.
- Hero de altura libre que empuja el contenido fuera del fold.
- Densidad baja (tarjetas grandes con mucho padding) → poca información útil por viewport.
- El scroll está "resuelto" con `overflow-y-auto`, justamente la solución prohibida.

### Qué debe cambiar para garantizar cero scroll

- `.dashboard-main` deja de ser scroll-container en escritorio: pasa a **flex column acotada al alto** con `lg:overflow-hidden` (scroll solo como fallback en móvil/tablet `< lg`).
- El HUB deja de ser "hero + lista" y pasa a **cockpit de dos zonas que llena el viewport**: consola de estado/KPIs (riel vertical) + panel lanzador de módulos en grilla densa con filas que se estiran (`auto-rows-fr`) para encajar sin scroll.
- El hero se reconvierte en **consola vertical full-height** (no hero horizontal alto).
- Densidad alta y ordenada: tiles compactos, jerarquía clara, uso del ancho.

---

## 2. Mapa real de superficies

### Archivos a modificar (frontend, dentro de scope)

| Archivo | Cambio |
|---|---|
| `frontend/src/app/globals.css` | `.dashboard-main` no-scroll en desktop + nueva sección `dashboard-no-scroll-cockpit` (clases de layout cockpit, tiles, rail, density). |
| `frontend/src/components/dashboard/DashboardModuleHub.tsx` | Reestructura a cockpit grid (rail hero + panel lanzador denso). Conserva `data-*` y hooks de tests. |
| `frontend/src/components/dashboard/DashboardHubHero.tsx` | Reconvierte a consola vertical full-height. Conserva contratos (`data-dashboard-hub-hero`, id, `metrics.map`, CTA, focus ring). |
| `frontend/src/components/dashboard/DashboardModuleWorkspace.tsx` | Acota la sección al alto (`flex-1 min-h-0`); el área de contenido nunca produce scroll de página (la cápsula interna solo aplica a módulos pesados de datos). |

### Archivos inspeccionados que NO se tocan (y por qué)

- `frontend/src/components/dashboard/DashboardShellRouter.tsx` — ya correcto (`h-dvh overflow-hidden`); test lo exige literal.
- `frontend/src/components/dashboard/DashboardSidebarFrame.tsx` / `DashboardTopbar.tsx` — className exactos verificados por `frontend-visual-consistency.test.ts` (riel-icono en targets, ya compacto).
- `frontend/src/app/dashboard/page.tsx`, `frontend/src/app/dashboard/admin/page.tsx` — estructura/orden verificados por tests; el cambio es en componentes y CSS, no en el cableado.
- `ClinicCommandCenter.tsx`, `AdminCommandCenter.tsx`, controllers — strings y orden verificados por tests; se benefician del CSS de densidad sin tocar JSX.

### Tests/guardrails relevantes (deben seguir verdes)

- `test/unit/ui/frontend/frontend-visual-consistency.test.ts` — exige `.dashboard-main { @apply … space-y-6 … sm:px-6 … lg:px-8 … }`, className exacto de sidebar/topbar, presencia de `<main className="dashboard-main">`.
- `test/frontend-dashboard-hub-hero.test.ts` — contratos de hero/hub (`data-dashboard-hub-hero`, `data-dashboard-hub-hero-slot`, `data-dashboard-module-hub`, `data-dashboard-module-card`, hero antes de la sección de tarjetas).
- `test/frontend-dashboard-interaction-foundation.test.ts` — `dashboard-card-interactive`, `data-*`, focus ring en hub.
- `test/frontend-dashboard-workspace-layout-polish.test.ts` — `dashboard-workspace-enter`, `dashboard-workspace-header`, `data-dashboard-module-workspace`, CSS markers; `h-dvh overflow-hidden` en shell.
- `test/frontend-dashboard-home.test.ts`, `…admin.test.ts`, `…admin-command-center.test.ts`, `…clinic-command-center.test.ts` — orden y strings de páginas/command centers.
- Scope guards (`git diff --name-only`) en varios tests: prohíben tocar `server/`, `shared/`, `frontend/src/app/api/`, `frontend/src/middleware*`, `package.json`, lockfiles, `next-env.d.ts`, `tsconfig.json`, `layout.tsx`, `lib/auth.ts`, `lib/seo.ts`. **Cero dependencias nuevas.**
- E2E `frontend/e2e/dashboard-workspace-layout-polish.spec.ts` — verifica `documentElement.scrollHeight - clientHeight <= 5` (sin scroll global) y los selectores `data-dashboard-module-hub/-card/-workspace`.

### Contratos NO afectados

Backend, DB, migrations, auth, sesiones, contratos API: sin cambios. Cookies/headers de `page.tsx` server-side intactos. Separación admin/clínica intacta. `PasswordChangePanel` intacto. Tema `dark-gray` intacto (todo el cockpit usa variables CSS existentes).

---

## 3. Propuesta estructural sin scroll

### Modelo de alto (cadena de flex, sin scroll en desktop)

```
DashboardShellRouter  → flex h-dvh overflow-hidden
  └ contenido          → flex flex-1 flex-col min-w-0 overflow-hidden
      ├ DashboardTopbar (min-h 4.5rem, sticky)        [altura fija]
      └ <main.dashboard-main> flex flex-col min-h-0 flex-1 lg:overflow-hidden
          ├ DashboardPageHeader                        [altura natural, compacta]
          └ Controller (hub | module)  flex-1 min-h-0  [LLENA el alto restante]
```

### HUB clínica — cockpit operativo

Grid de dos zonas que llena el alto (`lg:grid lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] lg:h-full lg:min-h-0`):

- **Zona A — Consola de estado (riel hero, full-height):** eyebrow + chip de estado, título, descripción, **KPIs verticales** (informes pendientes, visitas activas) y **CTA primaria** anclada abajo (`mt-auto`). Es el "resumen ejecutivo operativo".
- **Zona B — Lanzador de módulos (panel denso):** encabezado + grilla `grid-cols-2 xl:grid-cols-3 auto-rows-fr` de tiles compactos (operaciones, informes, logística, perfil, tokens) con badges de pendientes/activas. Las filas se estiran para encajar sin scroll.

### HUB admin — cockpit de control

Misma estructura. Zona A = consola de control (estado del sistema, eventos de auditoría, tipos de evento, CTA "Abrir administración"). Zona B = lanzador de **10 módulos** en `xl:grid-cols-3` (4 filas) con `auto-rows-fr`, badges de estado del sistema. Es el "centro de control ejecutivo".

### Reglas que garantizan cero scroll

- `.dashboard-main`: `lg:overflow-hidden` (desktop). Móvil/tablet `<lg`: `overflow-y-auto` (fallback responsive legítimo, fuera de los targets desktop).
- Cockpit: `lg:h-full lg:min-h-0`; panel lanzador `min-h-0 overflow-hidden`; grilla `auto-rows-fr` → los tiles se comprimen para encajar; nunca scroll interno en desktop.
- Riel hero: `h-full`, contenido compacto, CTA `mt-auto`.
- Listas/tablas dentro de módulos: se mantienen las reglas existentes (recientes limitados a `slice(0,3)`; "ver módulo completo" navega a otra ruta).

### Distribución por viewport

| Viewport | Sidebar | Cockpit |
|---|---|---|
| 1440×900 | riel-icono (`w-[4.5rem]`) | grid 2 zonas, lanzador `xl:grid-cols-3` |
| 1366×768 | riel-icono | igual, tiles más compactos (`auto-rows-fr`) |
| `<lg` (tablet/móvil) | riel-icono / drawer | apilado vertical, scroll de página permitido como fallback |

---

## 4. Criterios de aceptación (verificables)

- [ ] 1440×900: HUB clínica y admin **sin scroll** externo ni interno.
- [ ] 1366×768: HUB clínica y admin **sin scroll** externo ni interno.
- [ ] Sin scroll horizontal en desktop.
- [ ] Todo el contenido prioritario del HUB visible en el primer viewport.
- [ ] Cambio visual **evidente** al entrar (cockpit de dos zonas, no "hero + lista").
- [ ] E2E `documentElement.scrollHeight - clientHeight <= 5` sigue verde.
- [ ] No se rompe navegación (cards → módulo; volver → hub).
- [ ] No se rompe `PasswordChangePanel` (clínica/admin).
- [ ] No se rompe tema `dark-gray` (todo via variables CSS).
- [ ] No se rompe separación admin/clínica.
- [ ] No se rompen contratos API (sin cambios server-side).
- [ ] `pnpm test`, `pnpm --dir frontend typecheck`, `pnpm --dir frontend lint`, `pnpm --dir frontend build` verdes.
- [ ] Cero dependencias nuevas.

---

## 5. Plan de implementación

Título de PR sugerido: **`feat(dashboard): introduce no-scroll premium operational workspace`**

1. `globals.css`: ajustar `.dashboard-main` (no-scroll desktop) + sección `dashboard-no-scroll-cockpit` (clases `dashboard-cockpit`, `dashboard-cockpit-rail`, `dashboard-cockpit-launcher`, `dashboard-cockpit-grid`, `dashboard-cockpit-tile`, density).
2. `DashboardHubHero.tsx`: consola vertical full-height (conservar contratos).
3. `DashboardModuleHub.tsx`: cockpit grid (rail + lanzador denso), tiles compactos (conservar `data-*`/focus/`dashboard-card-interactive`).
4. `DashboardModuleWorkspace.tsx`: acotar al alto, sin scroll de página.
5. Validación: typecheck + lint + test + build (+ e2e si entorno disponible).

---

## 6. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| **Sobrecompactación** (tiles ilegibles a 768px). | `auto-rows-fr` con mínimos de tipografía; `line-clamp-2` en descripción; probar 10 tiles admin a 1366. |
| **Pérdida de legibilidad** en el riel hero. | Jerarquía explícita (eyebrow/título/desc/KPIs/CTA), contraste de marca, paddings controlados. |
| **Ruptura responsive** (romper desktop al arreglar móvil). | Desktop-first: cockpit solo `lg:`; `<lg` apila y permite scroll de página (fallback legítimo). |
| **Ocultamiento de acciones** (CTA fuera de vista). | CTA anclada con `mt-auto` dentro del riel; tiles siempre visibles por `auto-rows-fr`. |
| **Falso no-scroll** (contenedores escondidos / contenido recortado). | El lanzador encaja por compresión real de filas, no por `overflow:hidden` que recorte; el HUB no usa scroll interno. Módulos pesados de datos (tokens/clínicas/pricing/auditoría completa) conservan su área funcional: el HUB y los resúmenes prioritarios son el target no-scroll; se documenta explícitamente para no fingir. |
| **Romper guardrails de strings/orden.** | Se conservan todos los `data-*`, className exactos y orden de fuente verificados por los tests citados en §2. |
| **Tocar archivos fuera de scope.** | Solo 4 archivos frontend + globals.css; sin deps, sin server/DB/auth. |
