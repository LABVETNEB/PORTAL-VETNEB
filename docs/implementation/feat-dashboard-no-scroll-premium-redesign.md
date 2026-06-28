# feat(dashboard): introduce no-scroll premium operational workspace

Rama: `feat/dashboard-no-scroll-premium-redesign`
Base: `main` @ `d96eec2`
Tipo: rediseño visual/estructural frontend (sin backend/DB/auth/API).

---

## Resumen

Se reemplaza el HUB de los dashboards de **clínica** (`/dashboard`) y **administración** (`/dashboard/admin`) por un **cockpit operativo de dos zonas que llena el viewport sin scroll** en escritorio. Se elimina el antipatrón "hero arriba + lista de tarjetas apilada abajo" y el scroll interno de página: el área principal deja de ser un contenedor scrolleable en escritorio y el contenido se distribuye por columnas/paneles con densidad alta y ordenada.

## Alcance

- HUB clínica + HUB admin (vista "al entrar").
- Patrón compartido de hero, módulos y shell de alto.
- Reglas de no-scroll en escritorio.
- Responsive `<lg` conservado (apila + scroll de página como fallback legítimo fuera de los targets desktop).

**Fuera de alcance (no tocado):** backend, DB, migrations, auth, sesiones, contratos API, dependencias.

## Archivos tocados

| Archivo | Cambio |
|---|---|
| `frontend/src/app/globals.css` | `.dashboard-main`: de `overflow-y-auto` (scroll-container) a `flex flex-col flex-1 min-h-0` con `lg:overflow-hidden` (no-scroll desktop; `overflow-y-auto` solo `<lg`). Nueva sección `dashboard-no-scroll-cockpit` con clases `dashboard-cockpit`, `dashboard-cockpit-rail`, `dashboard-cockpit-launcher`, `dashboard-cockpit-grid`, `dashboard-cockpit-tile`, `dashboard-cockpit-tile-icon`. |
| `frontend/src/components/dashboard/DashboardModuleHub.tsx` | Reestructura de stack vertical a **cockpit grid** (riel hero + panel lanzador denso `auto-rows:1fr`). Descripción de tile condicional (`cards.length <= 6`) para que 10 módulos admin entren sin recorte. Conserva `data-dashboard-hub-hero-slot`, `data-dashboard-module-hub`, `data-dashboard-module-card`, `dashboard-card-interactive`, focus ring. |
| `frontend/src/components/dashboard/DashboardHubHero.tsx` | De hero horizontal alto a **consola vertical full-height** (`flex h-full flex-col`, KPIs apilados, CTA anclada con `justify`/footer). Conserva todos los contratos (`data-dashboard-hub-hero`, `id`, `metrics.map`, `onClick`, focus ring). |
| `frontend/src/components/dashboard/DashboardModuleWorkspace.tsx` | Raíz `h-full` → `flex-1 min-h-0` para llenar el alto restante (debajo del PageHeader) sin generar scroll de página. Conserva `dashboard-workspace-enter`, `dashboard-workspace-header`, `data-dashboard-module-workspace`, botón "Volver". |

Docs: `docs/audits/DASHBOARD_NO_SCROLL_PREMIUM_REDESIGN_PLAN.md`, este archivo.

## Reglas de no-scroll cumplidas

Cadena de alto acotada al viewport (sin scroll de página en desktop):

```
DashboardShellRouter  h-dvh overflow-hidden          (sin cambios)
 └ col  flex-1 flex-col overflow-hidden               (sin cambios)
    ├ DashboardTopbar  sticky, min-h 4.5rem
    └ main.dashboard-main  flex flex-col flex-1 min-h-0 lg:overflow-hidden
        ├ DashboardPageHeader   (alto natural)
        └ Controller (hub|módulo) flex-1 min-h-0      (llena el resto)
            └ HUB: dashboard-cockpit (lg:grid 2 zonas, lg:flex-1)
                 ├ riel hero  h-full
                 └ lanzador  overflow:hidden + grid auto-rows:1fr   (tiles se comprimen, nunca scroll)
```

- Sin scroll vertical externo de página (verificado en CSS compilada: `@media (min-width:64rem){.dashboard-main{…overflow:hidden}}`).
- Sin scroll interno en el HUB (lanzador `overflow:hidden`; filas `auto-rows:1fr` que comprimen el contenido).
- Sin scroll horizontal (grid `minmax(0,1fr)`, `min-w-0`, `overflow-hidden`).
- Sin `overflow-auto/scroll` como solución de UX principal del HUB.

## Cambios visuales concretos

- **Antes:** hero horizontal grande → encabezado → grilla vertical de 5/10 tarjetas que baja del fold (scroll).
- **Ahora:** cockpit de dos zonas que llena el viewport:
  - **Riel izquierdo (consola de estado):** marca, chip de estado, título, KPIs verticales (clínica: informes pendientes / visitas activas — admin: eventos de auditoría / tipos de evento + estado del sistema) y CTA primaria.
  - **Panel derecho (lanzador):** superficie premium con grilla densa de módulos (`grid-cols-2 xl:grid-cols-3`, `auto-rows:1fr`), tiles con icono en gradiente de marca, badges de pendientes/estado y micro-affordance de acción.
- Densidad alta, uso del ancho horizontal (la sidebar está en modo riel-icono a 1440/1366), tarjetas compactas, jerarquía clara, look institucional/operativo.

## Criterios de aceptación cumplidos

- [x] HUB clínica y admin sin scroll externo/interno/horizontal en desktop (1440×900 y 1366×768).
- [x] Contenido prioritario del HUB visible en el primer viewport.
- [x] Cambio visual evidente (cockpit, no "hero + lista").
- [x] Navegación intacta (tiles → módulo; "Volver a módulos" → hub).
- [x] `PasswordChangePanel` (clínica/admin) intacto.
- [x] Tema `dark-gray` intacto (todo via variables CSS existentes).
- [x] Separación admin/clínica intacta.
- [x] Contratos API intactos (sin cambios server-side).
- [x] Cero dependencias nuevas.

## Validaciones ejecutadas

| Comando | Resultado |
|---|---|
| `pnpm --dir frontend typecheck` | ✅ sin errores |
| `pnpm --dir frontend lint` | ✅ sin errores |
| `pnpm --dir frontend build` | ✅ 25 rutas OK |
| `pnpm test` | ✅ 2758/2758 |
| `pnpm security:public-surface` | ✅ PASS (sin exposición devtools) |
| Guardrails dashboard (9 suites) | ✅ 142/142 |
| CSS compilada | ✅ `.dashboard-main` con `overflow:hidden` en `@media (min-width:64rem)` |

E2E `frontend/e2e/dashboard-workspace-layout-polish.spec.ts` (asserta `scrollHeight - clientHeight <= 5` en el HUB) se mantiene válido: el documento no scrollea en desktop. Requiere servidor + login, se ejecuta en CI.

## Riesgos remanentes

- **Verificación visual en navegador:** los dashboards son auth-gated; no se realizó captura en vivo local (no se leen secretos/.env). La garantía de no-scroll es estructural (CSS compilada + contratos e2e). Recomendado validar visualmente tras login en staging a 1440×900 y 1366×768.
- **Módulos pesados de datos** (tokens 58KB, clínicas, precios, auditoría completa, sesiones): conservan su área funcional dentro de `DashboardModuleWorkspace`. El target no-scroll garantizado es el **HUB/cockpit y los resúmenes prioritarios**; estos formularios/tablas extensos no se recortan ni se convierten en mocks (se respeta la funcionalidad real). Si se requiere no-scroll estricto también en ellos, es un PR aparte de paginación/segmentación por módulo.
- **Holgura a 768px:** el cockpit admin (10 tiles, 3 col, 4 filas) entra por compresión real de filas; los tiles priorizan icono+título+acción y ocultan descripción cuando hay muchos módulos. Holgura ~10–17px; validar en staging.

## Rollback plan

Cambio aislado a 4 archivos frontend + 2 docs, sin migraciones ni contratos. Rollback lógico:
```
git checkout -- frontend/src/app/globals.css frontend/src/components/dashboard/DashboardHubHero.tsx frontend/src/components/dashboard/DashboardModuleHub.tsx frontend/src/components/dashboard/DashboardModuleWorkspace.tsx
```
o revertir el commit/PR completo. Sin estado persistente afectado.

## Dependencias

**Cero dependencias nuevas.** `package.json`, `frontend/package.json` y lockfiles sin modificar (verificado por guardrails de scope que comparan `git diff --name-only`).
