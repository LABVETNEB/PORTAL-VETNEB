# Total Visual Engineering Audit

> Auditoría visual total de nivel ingeniería senior/extremo sobre Portal VETNEB.
> Documento **exclusivamente diagnóstico**: no implementa cambios visuales, no toca
> código productivo, backend, dependencias, lockfiles, CI ni tests. No genera commit/push/PR.
>
> - **Fecha**: 2026-06-30
> - **Rama base**: `main`
> - **HEAD**: `f235b61 feat(clinic): add informes and tokens advanced filters (#1191)`
> - **Working tree**: limpio · **PRs abiertos**: 0
> - **Skill aplicada**: `frontend-design` (plugin oficial Anthropic) como rúbrica de calidad visual,
>   complementada con metodología de auditoría de ingeniería (WCAG 2.2, Core Web Vitals, matriz responsive).
> - **Estándar relacionado vigente**: este documento NO reemplaza las 4 auditorías Wave 0 del
>   `docs/audit/README.md`; las **complementa** con una capa estrictamente visual/frontend.

---

## 1. Executive Summary

**Estado visual general.** VETNEB es un producto frontend **maduro y por encima del promedio**.
Existe un sistema de tokens HSL coherente (semánticos + marca `vetneb-*` + sidebar + chart + motion),
primitivas shadcn/Radix sólidas (`button`, `card`, `input`, `badge`, `table`, `ModuleDialog`,
`ModuleTabs`, `EmptyState`), un contrato no-scroll de "single-viewport App Shell" bien testeado,
páginas públicas con jerarquía semántica correcta (`aria-labelledby`, headings ordenados, `alt`,
`priority` en LCP, decorativos `aria-hidden`) y disciplina de accesibilidad de teclado en dashboard.

**Riesgo principal.** El riesgo dominante NO es estético puntual, es **sistémico y de proceso**:

1. **Cero verificación cross-browser en runtime.** Playwright corre **solo Chromium**. El código
   apunta deliberadamente a iOS Safari (37 usos de `backdrop-filter`, 7 `dvh`, 14 `safe-area-inset`,
   29 prefijos `-webkit-`, `<input type="date">`/`<select>` nativos), pero **nunca se ejecuta en
   WebKit ni Firefox**. Para un producto cuyo público particular/tutor y staff clínico usa mayormente
   iPhone, esto es una brecha de confianza de producción.
2. **Cero red de seguridad de regresión visual.** No hay baselines (`0` PNG commiteados, `0`
   `toHaveScreenshot`); los "screenshots" existentes son evidencia/validación de bytes. Cualquier
   edición sobre un `globals.css` de **3.262 líneas** puede regresar visualmente producción en silencio.
3. **Deuda de arquitectura de estilos.** El sistema de diseño vive implícito en un CSS global
   monolítico append-only (bloques `start/end` por feature) + componentes gigantes (hasta **1.894
   LOC** en un solo card) con duplicación admin/clínica.

**Nivel de madurez actual.** En una escala `básico → profesional → senior → ingeniería extrema`:

| Capa | Madurez |
| --- | --- |
| Tokens / theming | **Senior** (con deuda: sombras hardcodeadas, dark-mode dual) |
| Primitivas UI base | **Senior** |
| Composición de módulos dashboard (no-scroll) | **Senior** |
| Páginas públicas (semántica + LCP) | **Senior** |
| Consistencia de componentes (filtros, badges, forms) | **Profesional** (fragmentado) |
| Arquitectura de estilos (CSS global, componentes) | **Profesional con deuda alta** |
| Verificación visual (cross-browser, regresión, a11y automatizado) | **Básico** |
| Documentación de design system | **Básico/ausente** |

**Dictamen.** El producto está **listo para estándar premium *profesional*, pero NO todavía para
"excelencia visual extrema" certificable**, por una razón de ingeniería, no de gusto: **no existe la
infraestructura que garantice que lo visual no se rompe ni se degrada**. Hoy el "se ve bien" depende
de inspección manual en un solo navegador. Para alcanzar el estándar extremo hay que (a) tokenizar y
documentar el sistema, (b) unificar componentes fragmentados, y (c) blindar el pipeline con regresión
visual + cross-browser + a11y automatizado. Ninguno requiere rediseñar; todos son PRs chicos y seguros.

---

## 2. Audit Scope

### 2.1 URLs/pantallas consideradas
- **Públicas**: `/`, `/servicios`, `/precios`, `/clinicas`, `/contacto`, `/profesionales`,
  `/profesionales/[clinicId]`, `/particulares`, `/citologia-veterinaria`, `/histopatologia-veterinaria`,
  `/informes-veterinarios`, `/laboratorio-patologico-veterinario`, `/login`, `/not-found`, `/offline`.
- **Dashboard Clínica**: `/dashboard` y módulos `?module=informes|tokens|logistica|perfil`
  (+ rutas `/dashboard/informes`, `/dashboard/logistica/*`).
- **Dashboard Admin**: `/dashboard/admin` y módulos `?module=admin-clinics|admin-reports|
  admin-report-upload|admin-particular-tokens|admin-audit|admin-alerts|admin-sessions`.

### 2.2 Archivos/componentes inspeccionados (muestra representativa)
- Tokens / estilos: `frontend/tailwind.config.ts`, `frontend/src/app/globals.css` (3.262 líneas),
  `frontend/src/lib/theme.ts`, `frontend/src/lib/utils.ts`, `frontend/postcss.config.mjs`.
- Primitivas UI: `components/ui/{button,card,input,badge,table,skeleton,separator}.tsx`.
- Primitivas dashboard: `ModuleSurface`, `ModuleTabs`, `ModuleDialog`, `EmptyState`, `ErrorState`,
  `LoadingState`, `StatusBadge`, `StatsCards`, `StickyFilterBar`, `FilterDrawer`, `usePagedRows`.
- Controladores/shells: `ClinicDashboardWorkspaceController`, `AdminDashboardWorkspaceController`,
  `PrivateDashboardShell`, `DashboardTopbar`, `Navbar`, `Footer`, `PublicLayout`.
- Cards/feature pesados: `AdminParticularTokensCard` (1.894 LOC), `ClinicParticularTokensCard`
  (1.604 LOC), `AdminReportsCard`, `AdminReportStatusBadge`, `AdminAuditFilterBar`, `UploadReportModal`.
- Páginas: `app/page.tsx` (home), `LoginContent`, secciones públicas (`PublicHero`,
  `SpecimenJourneySection`, `PerspectiveScrollSection`).

### 2.3 Tests revisados
- `frontend/playwright.config.ts` + 49 specs E2E (`frontend/e2e/*.spec.ts`), con foco en contratos
  no-scroll, parity mobile y geometría. `visual-smoke.spec.ts`, `theme-mode.spec.ts`,
  `dashboard-accessibility-keyboard.spec.ts`.

### 2.4 Documentación revisada
- `docs/audit/README.md`, `docs/SOURCES_OF_TRUTH.md`, índice `docs/audit/*` (≈70 documentos),
  `docs/audit/dashboard-horizontal-navigation-information-architecture.md`,
  `docs/audit/product-ux-dashboard-audit.md`, `docs/audit/dashboard-mobile-whitebox-visual-audit.md`,
  `docs/audit/DASHBOARD_PREMIUM_VISUAL_REDESIGN_PLAN.md`, `docs/implementation/*` (filtros recientes).

### 2.5 Qué NO pudo verificarse (límites)
- **Runtime productivo autenticado**: dashboards clínica/admin requieren sesión y datos reales; no se
  ejecutó inspección visual en `https://www.vetneb.com.ar/dashboard*`. Auditado por **código + fixtures
  E2E + contratos**.
- **Render real en WebKit/Firefox/Edge/iOS Safari/Android Chrome**: no hay proyecto Playwright ni acceso
  de dispositivo. Documentado como brecha (VIS-P0-001).
- **Métricas Lighthouse/Core Web Vitals reales** (LCP/CLS/INP/FCP): no se midieron; no se inventan
  números. Se evalúa por patrones de código (ver §5, Auditoría 14).
- **Diferencias prod vs local** (latencia, datos largos, errores API en vivo): auditadas por contratos
  de estado (empty/error/loading) y fixtures, no por observación productiva.

---

## 3. Methodology

- **Skill usada**: `frontend-design` (Anthropic plugin oficial; `SKILL.md` leído completo).
  Es una skill de **creación** de interfaces premium (tipografía distintiva, color cohesivo con CSS
  vars, motion de alto impacto, composición espacial, anti-"AI slop"). Se aplica como **rúbrica de
  calidad** ("¿a qué se parece la excelencia visual?") para juzgar lo existente. No existe en el entorno
  una skill `frontend-design-review` ni una skill de review/auditoría visual con metodología propia, por
  lo que la skill de creación se complementa con:
  - **WCAG 2.2** (Perceivable/Operable/Understandable/Robust) para accesibilidad.
  - **Core Web Vitals** (LCP/CLS/INP) para performance visual.
  - **Matriz responsive** por breakpoints y heurísticas de Nielsen para UX/IA.
- **Herramientas**: lectura de código (Read/Grep/Glob), análisis estático de patrones (conteo de
  hardcodes, divergencias de clase, LOC por archivo), revisión de specs Playwright y documentación.
- **Criterios de severidad**: P0 (bloqueante de uso/acceso/navegación/confianza/CI) · P1 (alto impacto
  sistémico) · P2 (mejora importante de pulido/consistencia/mantenibilidad) · P3 (refinamiento menor).
- **Viewports objetivo de evaluación**: 320, 360, 375, 390, 414, 430, 768, 1024, 1280, 1366×768,
  1440×900, 1536×864, 1920×1080.
- **Límites de la auditoría**: estática + documental; sin runtime cross-browser ni medición de CWV;
  sin acceso productivo autenticado. Hallazgos de runtime se marcan explícitamente como "verificación
  visual/manual pendiente".

### 3.1 Qué se auditó automáticamente vs verificación manual pendiente

| Verificable por código (HECHO) | Verificación visual/manual PENDIENTE |
| --- | --- |
| Tokens, escala de color/radius/motion, dark-mode wiring | Contraste real renderizado por estado (tinte-sobre-tinte) |
| Hardcodes (sombras, hex, off-token palette), LOC, duplicación | Render en WebKit/Firefox/Edge, iOS/Android reales |
| Estructura semántica/ARIA, focus rings, roles, keyboard nav | Lectores de pantalla (VoiceOver/NVTA/TalkBack) reales |
| Cobertura/viewports/tipo de assert de los specs E2E | Métricas Lighthouse LCP/CLS/INP productivas |
| Patrones de filtros, badges, formularios, estados | Datos extremos reales (nombres largos, muchas filas, errores API en vivo) |
| Motion (duración/easing/reduced-motion) declarado | Percepción real de microinteracciones y perspective scroll |

---

## 4. Current Visual Architecture Map

### 4.1 Public pages
- `PublicLayout` = `Navbar` (sticky, `<details>` mobile + nav horizontal en `xl`) + contenido + `Footer`.
- Navegación **sin `next/link` ni `<a>`** por contrato: `PublicRouteControl` (button + `router.push`)
  — endurecimiento conocido (memoria `project_frontend_navigation_hardening`).
- Home (`app/page.tsx`, 614 LOC): hero evidence-first con imagen LCP `priority`, tipografía display
  `clamp(4rem,10vw,8rem)`, secciones con `PerspectiveScrollSection` + `PublicScrollReveal` (motion),
  cards bento, `SpecimenJourneySection` (timeline). Jerarquía semántica correcta.
- Sistema visual público vía clases bespoke en globals: `public-hero-action-tile`, `public-cta-*`,
  `public-evidence-band-*`, `premium-card`, `diagnostic-field`, `public-soft-canvas`.

### 4.2 Dashboard Clínica
- `ClinicDashboardWorkspaceController` (509 LOC) orquesta módulos vía `?module=` (informes, tokens,
  logística, perfil) dentro del App Shell. Variantes mobile dedicadas (`ClinicMobile*`,
  `ClinicMobileBottomNav`). Cards pesados: `ClinicParticularTokensCard` (1.604 LOC),
  `ClinicPublicProfileCard` (911), `ClinicInformesWorkspaceSummary` (605).

### 4.3 Dashboard Admin
- `AdminDashboardWorkspaceController` (425 LOC) + `AdminCommandCenter`; módulos admin-* con variantes
  mobile no-scroll (`AdminMobile*Module`, `AdminMobileBottomNav`, `AdminMobileHubLauncher`).
  Cards: `AdminParticularTokensCard` (1.894 LOC, el más grande del repo), `AdminReportsCard` (912),
  `AdminClinicsManagementCard` (723), `AdminPricingEditorCard` (677), `admin/page.tsx` (857).

### 4.4 Design system actual
- **Tokens** (`globals.css :root`): color HSL semántico + `vetneb-{ink,navy,teal,cyan,amber,surface,
  surface-raised,surface-muted,line}`, `sidebar-*`, `chart-1..5`, `--radius:0.5rem`, motion
  (`--motion-fast/base/slow`, `--ease-out-soft`, `--ease-in-out-soft`), fuentes
  (`--font-heading/body/ui` = todas "Inter").
- **Tailwind** (`tailwind.config.ts`): mapea tokens a `colors.*`, `borderRadius` (lg/md/sm), plugin
  `tailwindcss-animate`, `darkMode:"class"`.
- **Primitivas UI** (`components/ui`): solo `badge, button, card, input, separator, skeleton, table`.
  **No** hay `select`, `textarea`, `label`, `dialog`, `tabs`, `tooltip`, `switch`, `checkbox`,
  `dropdown`, `toast` como primitivas (se resuelven ad-hoc por feature o vía Radix Dialog envuelto).

### 4.5 CSS / Tailwind / tokens
- `globals.css` = **3.262 líneas**, organizado como changelog de features con fences
  `/* feature:start */ … /* feature:end */` (≈25 bloques), múltiples `@layer base|components`,
  `@keyframes`, `@media (prefers-reduced-motion)` (×4) y un bloque "Unlayered on purpose"
  (`theme-mode-dark-gray`) que usa selectores de especificidad/substring para ganarle a los layers.

### 4.6 Tests visuales existentes
- 49 specs Playwright (solo Chromium). Patrón dominante: **assert de geometría** (boundingBox,
  overflow, no-scroll) y **parity** mobile/desktop, **no** comparación de apariencia.
- `visual-smoke.spec.ts`: navega 5 rutas × 2 viewports (1440, 390) y valida que el screenshot es PNG
  no vacío (header de bytes), **no** un diff visual.

### 4.7 Contratos no-scroll existentes
- "Single-viewport App Shell": `.dashboard-main` (`overflow-hidden`), `ModuleSurface` →
  `dashboard-module-surface/toolbar/body` (`min-h-0` chain), `ModuleTabs`, `usePagedRows`,
  `MasterDetailWorkspace`. Contratos fijados por specs (`dashboard-*-no-scroll-contract`,
  `dashboard-single-viewport-app-shell`, etc.) y por memorias de proyecto.

---

## 5. Findings by Audit Area

### Auditoría 1 — UI Visual Quality
**Observaciones.** Jerarquía y limpieza altas en público (hero audaz, bandas alternadas, bento de
servicios con `featured`/`wide`). Dashboard premium con cards `clinical-card` (sombra multicapa + inset
+ ring blanco), KPIs `dashboard-kpi-pill` con tonos `data-tone`. **Hallazgos**: (a) headers de filtro
inconsistentes entre módulos (3 patrones, ver Aud. 3/5); (b) el botón "Aplicar" de
`AdminAuditFilterBar` no usa `<Button>` → afordancia de acción primaria distinta (plano `bg-vetneb-navy`
vs gradiente del sistema); (c) densidad muy alta (controles `h-8`) correcta para el cockpit pero al
límite de touch en mobile. **Severidad**: P1 (filtros), P2 (densidad). **Evidencia**:
`AdminAuditFilterBar.tsx:118-124`, `globals.css` `.dashboard-kpi-pill`.

### Auditoría 2 — Design System Governance
**Observaciones.** Existe sistema real (tokens + cva + utilities), pero con gobierno parcial.
**Hallazgos**: (1) **Dark-mode dual**: bloque `.dark` + `darkMode:"class"` es **código muerto** (0
usos de `dark:`); el dark real es `:root[data-theme="dark-gray"]` con overrides frágiles
`[class*="text-amber-7"]`. (2) **Sombras sin token**: `rgba(15,45,62,α)` hardcodeado **65×** en 21
archivos (incl. `button/card/input/table`). (3) **Gradiente primario hardcodeado** hex
(`#0E3556/#2B5B88/#3F7EA2`) repetido 4× en globals, no tokenizado. (4) **Off-token palette**:
`AdminReportStatusBadge` usa `slate/sky/violet/emerald/amber` crudos (violet ni existe en el sistema).
(5) **Faltan primitivas** (select/textarea/label/dialog/tabs como `ui/*`). **Severidad**: P1/P2.

### Auditoría 3 — Component Consistency
**Observaciones.** Primitivas base coherentes (cva: `button` 6 variantes × 4 tamaños, `badge` 4
variantes). **Hallazgos**: (a) **3 capas de badge** (`ui/badge`, `StatusBadge` que lo envuelve bien,
`AdminReportStatusBadge` reimplementado como `<span>` off-token); (b) **3 patrones de filtro**
(`controlClassName` bespoke; `StickyFilterBar`+`FilterDrawer`; `<select>` inline en
`informes/page.tsx` y `ClinicParticularTokensCard`); (c) **modales mixtos**: `ModuleDialog` (Radix,
accesible) coexiste con `UploadReportModal` (865 LOC, hand-rolled) y `role="dialog"` manual; (d)
**duplicación admin/clínica**: `AdminParticularTokensCard` (1.894) ≈ `ClinicParticularTokensCard`
(1.604) comparten lógica de tabla/paginación/copy/filtros. **Severidad**: P1.

### Auditoría 4 — Responsive Layout
**Observaciones.** Contrato no-scroll fuertemente testeado en mobile (360/390/412/430 + landscape) y
parcialmente en desktop (1280/1366/1440). Safe-area-inset usado (14×). **Hallazgos**: (a) **nav full
solo en `xl`** (≥1280): 768–1279px (tablet/laptop chico) recibe el menú colapsado `<details>`; (b)
sin cobertura E2E en **320px**, **1536×864**, **1920×1080**, y tablet **768/1024** apenas tocada; (c)
verificación de scroll horizontal accidental es por geometría, no visual. **Severidad**: P2.

### Auditoría 5 — Cross-Browser Rendering
**Observaciones.** Código WebKit-aware (37 `backdrop-filter`, 7 `dvh`, 14 `safe-area-inset`, 29
`-webkit-`), `<select>`/`<input type=date>` nativos (render divergente Safari/Firefox). **Hallazgo
crítico**: Playwright **solo Chromium** → **cero** verificación WebKit/Firefox/Edge. `backdrop-filter`
+ `dvh` + selects nativos son exactamente lo que más diverge en Safari. **Severidad**: **P0**
(VIS-P0-001).

### Auditoría 6 — Accessibility & WCAG
**Observaciones (positivo).** `:focus-visible` global (outline 2px + offset), focus-visible rings en
botones/inputs/nav, `ModuleTabs` con `role=tablist/tab/tabpanel` + flechas/Home/End, `ModuleDialog`
con focus trap + `aria-labelledby/describedby` + bloqueo en `busy`, headings semánticos, `aria-hidden`
en decorativos, `aria-live` en filtros activos, spec keyboard dedicado. **Hallazgos**: (1) **sin
scanning automatizado** (no axe-core/jest-axe) → contraste de badges tinte-sobre-tinte (p.ej.
`text-vetneb-teal` sobre `bg-vetneb-teal/12`) **sin verificar** contra 4.5:1 (1.4.3); (2)
`user-select:none` global afecta contenido público/informe → fricción para copiar texto (3.x/operabilidad);
(3) touch targets `h-8`=32px < 44px en filtros mobile (2.5.5 AAA / borde de 2.5.8 AA); (4) sin
verificación con lector de pantalla real. **Severidad**: P1.

### Auditoría 7 — Visual Regression Testing
**Observaciones.** **0** baselines PNG, **0** `toHaveScreenshot`; los `page.screenshot()` son evidencia
(escriben a `docs/audit/evidence/*` / `test-results`) o validación de bytes. Playwright limpia
`test-results/` al inicio (memoria `reference_playwright_clears_test_results`). **Hallazgo**: no existe
red de seguridad de apariencia para un `globals.css` de 3.262 líneas bajo mandato premium. **Severidad**:
**P0** (VIS-P0-002). Sin Percy/Chromatic/Loki/Storybook.

### Auditoría 8 — Typography & Readability
**Observaciones.** Única familia **Inter** variable (precargada woff2, `font-feature-settings`
cv02/03/04/11, antialias). Escala display audaz en hero. **Hallazgos**: (a) por rúbrica
`frontend-design`, Inter es "fuente genérica" → oportunidad de display face para diferenciación de marca
(defendible en clínico); (b) escala tipográfica **no tokenizada** (tamaños ad-hoc:
`clamp(4rem,10vw,8rem)`, `text-3xl/4xl/xl/lg`, `text-[0.68rem]`, `text-[0.6875rem]`) sin set documentado;
(c) micro-textos `text-[11px]` en labels de filtro al límite de legibilidad. **Severidad**: P2/P3.

### Auditoría 9 — Color System & Contrast
**Observaciones.** Paleta marca cohesiva (navy/teal/cyan/amber sobre superficies frías). Estados
semánticos (`destructive`, alerts success/warning/info via `clinical-alert-*`). **Hallazgos**: (a)
**dos lenguajes de color de estado** (tokens `vetneb-*` en `StatusBadge` vs Tailwind crudo en
`AdminReportStatusBadge`); (b) `text-amber-800`/`text-amber-700` crudos en warnings (parcheados sólo en
dark-gray con selectores substring); (c) contraste de tinte-sobre-tinte sin verificación automatizada
(ver Aud. 6). **Severidad**: P1 (consistencia), P1 (contraste sin verificar).

### Auditoría 10 — Spacing, Grid & Layout
**Observaciones.** Escala de spacing = Tailwind default (consistente). Cards `p-6`, headers densos,
`dashboard-list-row`, grids responsive bien armados (bento `lg:col-span-2`, divididores `divide-*`).
**Hallazgos**: (a) sin token de **elevación/sombra** (ver Aud. 2); (b) `min-h-[8rem]/[11rem]` en empty
states y otras alturas mágicas dispersas; (c) densidad del cockpit (`h-8`, `h-11` header de tabla)
coherente internamente. **Severidad**: P2/P3.

### Auditoría 11 — Interaction States
**Observaciones.** Botones con hover/active (`active:scale-[0.98]`), focus-visible ring/85, disabled
`opacity-55`, `data-[state=selected]` en filas, skeleton/loading/empty/error como componentes.
**Hallazgos**: (1) **focus mixto**: `badge` usa `focus:` (no `focus-visible:`); filtros usan
`focus:ring-vetneb-teal/15` (color/anillo distinto al `ring/85` del sistema); (2)
`clinical-primary-gradient-hover:hover` define el **mismo** gradiente que el base → hover no-op; (3)
botón "Aplicar" hand-rolled sin sombra del sistema → afordancia inconsistente; (4) estados copied/
uploaded/downloaded existen en cards de token/informe pero con implementación ad-hoc por card.
**Severidad**: P2/P3.

### Auditoría 12 — Motion & Microinteraction
**Observaciones.** Tokens de motion declarados (`--motion-*`, easings), `tailwindcss-animate`, entradas
de workspace (`@keyframes dashboard-workspace-enter`), skeleton pulse, reveals escalonados.
`prefers-reduced-motion` cubierto ×4. **Hallazgos**: (a) **perspective scroll activo pero
imperceptible** (auditoría previa PR-24, memoria `project_pr24_perspective_audit`): costo de cómputo sin
payoff perceptual → amplificar o remover; (b) muchos `PublicScrollReveal` por página → riesgo de "ruido"
de animación; (c) verificación de *layout shift* por animación es indirecta. **Severidad**: P2.

### Auditoría 13 — Frontend Styling Architecture
**Observaciones.** `cn()` (clsx+tailwind-merge) bien usado, inline styles casi nulos (3 archivos),
`!important` ausente en globals. **Hallazgos críticos**: (1) **CSS global monolítico** 3.262 líneas,
append-only por feature; (2) **componentes gigantes** (1.894 / 1.604 / 1.224 / 912 LOC) que mezclan
fetch + estado + filtros + tabla + paginación + diálogos + copy; (3) **duplicación admin/clínica**; (4)
DS no centralizado (utilities one-off en globals en vez de variantes/tokens); (5) sin Storybook/catálogo.
**Severidad**: P1. Ver Mapa de deuda §10/§15.

### Auditoría 14 — Core Web Vitals & Visual Performance
**Observaciones (sin medición; sólo patrones).** LCP: hero usa `next/image` `priority` + `sizes=100vw`;
fuente **preload** woff2 + `font-display:swap` → bueno. CLS: imágenes con `fill`/dimensiones, App Shell
con altura fija → bajo riesgo estructural; reveals con opacidad/transform (no reflow). Bundles: muchos
`"use client"` y componentes de 1.5k–1.9k LOC en dashboard → riesgo de JS de cliente pesado.
**Hallazgo**: **no se mide** Lighthouse/CWV en CI ni local. **Severidad**: P2 (brecha de medición).
**Recomendación de medición** en §5/§14 abajo.

### Auditoría 15 — UX Heuristic Evaluation
**Observaciones.** Flujos claros (login → dashboard por rol; hero con 2 CTAs: portal vs particulares;
journey de muestra explícito). Estados de error/empty/loading presentes. Prevención de errores en login
(`getSafeNextPath` valida redirect). **Hallazgos**: (a) afordancia de acción primaria inconsistente en
filtros; (b) feedback de copy/upload ad-hoc por card; (c) la nav colapsada en tablet puede aumentar
carga cognitiva en 768–1279px. **Severidad**: P2.

### Auditoría 16 — Information Architecture
**Observaciones.** Menú público claro (6 ítems), dashboard por `?module=` con bottom-nav mobile y
sidebar/topbar desktop, hub-reset sincrónico para evitar desync (memorias admin/clinic hub-reset).
**Hallazgos**: (a) **dos taxonomías de estado de informe** (`uploaded/processing/ready/delivered` en
`utils.ts` vs `sample_received/processing/evaluation/report_development/delivered` en admin workflow) →
modelo mental dividido entre clínica y admin; (b) nav full solo en `xl`. **Severidad**: P2.

### Auditoría 17 — Microcopy & Content Clarity
**Observaciones.** Tono profesional y consistente en público (es-AR, registro clínico). Labels claros.
**Hallazgos**: (a) terminología de estado divergente (Aud. 16); (b) labels de filtro abreviados
("Clínica ID", "Informe ID") OK pero sin ayuda contextual; (c) sin guía de microcopy documentada.
**Severidad**: P2/P3.

### Auditoría 18 — Brand Consistency
**Observaciones.** Identidad sobria clínica-premium coherente público↔software (navy/teal, microscopio,
firma "Dr. Nicolás E. Barbé"). **Hallazgos**: (a) Inter genérica vs rúbrica de diferenciación; (b)
off-token violet/slate en admin rompe la paleta de marca en una pantalla; (c) gradiente clínico fuerte
de marca pero hardcodeado (no token) → riesgo de drift. **Severidad**: P2/P3.

### Auditoría 19 — Dashboard / Data Visualization
**Observaciones.** Cockpit denso, tablas con header uppercase tracking, paginación unificada
(`dashboard-pagination-*`), KPIs con tono, no-scroll por paginación/tabs, variantes mobile dedicadas,
empty/error/loading consistentes vía primitivas. **Hallazgos**: (a) filtros no unificados; (b) badges de
estado no unificados; (c) `chart-1..5` tokens definidos pero sin visualizaciones de datos reales
detectadas (métricas son KPIs textuales) → si se agregan charts, falta sistema de viz; (d) densidad vs
touch en mobile. **Severidad**: P1 (filtros/badges), P2 (resto).

### Auditoría 20 — Production Visual QA
**Observaciones.** Smoke público productivo existe (`smoke:prod:public`), version gate y cache contracts
robustos. **Hallazgos**: (a) sin QA visual productivo autenticado documentado para dashboards; (b) sin
matriz de estados extremos (nombres largos, N filas, errores API en vivo, sesión expirada) verificada
visualmente; (c) brecha cross-browser (Aud. 5). **Severidad**: P1 (cross-browser), P2 (estados extremos).

---

## 6. P0 Findings

| ID | Severidad | Área | Ubicación | Evidencia | Impacto | Recomendación | Esfuerzo | Riesgo | Fase |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| VIS-P0-001 | P0 | Cross-browser (Aud. 5,20) | `frontend/playwright.config.ts` (projects) | Único `project: chromium`; 37 `backdrop-filter`, 7 `dvh`, 14 `safe-area-inset`, `<select>`/`<input type=date>` nativos en `src` | iOS Safari/WebKit + Firefox **sin verificar**; público tutor/clínica usa iPhone; backdrop-filter/dvh/selects divergen en WebKit | Agregar proyectos Playwright `webkit` y `firefox` para `visual-smoke` + un set crítico (login, home, dashboard frames); priorizar WebKit | M | Bajo (config + tiempo CI) | Fase 4 |
| VIS-P0-002 | P0 | Regresión visual (Aud. 7) | `frontend/e2e/*`, ausencia de baselines | `0` PNG commiteados, `0` `toHaveScreenshot`; `visual-smoke` valida bytes, no apariencia | Cualquier edición de `globals.css` (3.262 LOC) regresa producción en silencio; mandato premium sin red de seguridad | Introducir `toHaveScreenshot` con baselines estables (animaciones desactivadas, datos fixture) para rutas/módulos clave; gate de merge | M-L | Medio (flakiness si fixtures inestables) | Fase 4 |

> Nota de honestidad: ambos P0 son **de proceso/infraestructura**, no roturas activas de runtime. Se
> clasifican P0 porque el mandato explícito es "excelencia visual extrema" y la rúbrica P0 incluye
> "rompe confianza o CI": hoy no hay garantía de que lo visual no se degrade ni de que funcione fuera de
> Chromium. No se detectó un P0 de apariencia rota por análisis estático (requiere runtime).

---

## 7. P1 Findings

| ID | Severidad | Área | Ubicación | Evidencia | Impacto | Recomendación | Esfuerzo | Riesgo |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| VIS-P1-001 | P1 | Arquitectura estilos (Aud. 13) | `frontend/src/app/globals.css` | 3.262 líneas; ≈25 bloques `feature:start/end`; bloque "Unlayered on purpose" con selectores substring | Mantenibilidad baja, alta superficie de regresión, DS implícito | Plan de extracción gradual a `@layer` por dominio + tokens; documentar contrato (Fase 0) antes de mover nada | L | Medio (orden de cascada/layers) |
| VIS-P1-002 | P1 | Componentes gigantes / duplicación (Aud. 3,13) | `AdminParticularTokensCard.tsx` (1894), `ClinicParticularTokensCard.tsx` (1604), `ParticularesContent.tsx` (1224), `AdminReportsCard.tsx` (912) | LOC medidos; admin/clinic token cards casi-duplican tabla/paginación/copy/filtros | Cambios visuales hay que hacerlos 2× (admin+clínica) → drift | Extraer hooks/subcomponentes compartidos (TokenTable, CopyTokenButton, PagedTableShell) sin cambiar diseño | L | Medio (refactor amplio; cubrir con tests) |
| VIS-P1-003 | P1 | Theming dual (Aud. 2,9) | `globals.css:66-94` (`.dark`), `tailwind.config.ts` (`darkMode:"class"`), `globals.css:1612+` (`data-theme="dark-gray"`) | `0` usos de `dark:`; overrides `[class*="text-amber-7"]` | DS confuso; dos mecanismos; riesgo de fixes en el path equivocado | Eliminar `.dark`/`darkMode:class` muertos **o** consolidar el dark real en tokens `[data-theme]` sin substring selectors | M | Medio (verificar que `.dark` es realmente muerto en runtime) |
| VIS-P1-004 | P1 | Off-token status colors (Aud. 2,3,9,19) | `AdminReportStatusBadge.tsx:7-27` | `slate/sky/violet/emerald/amber` crudos; `violet` inexistente en sistema | Pantalla admin-reports se ve "off-brand"; dos lenguajes de estado | Reescribir `AdminReportStatusBadge` sobre tokens marca (reusar `StatusBadge` o mapear a `vetneb-*`) | S | Bajo |
| VIS-P1-005 | P1 | Filtros no unificados (Aud. 1,3,11) | `AdminAuditFilterBar.tsx`, `StickyFilterBar.tsx`, `FilterDrawer.tsx`, `informes/page.tsx:359`, `ClinicParticularTokensCard.tsx:1212` | 3 patrones; `controlClassName` con `focus:ring-vetneb-teal/15`; submit hand-rolled `bg-vetneb-navy` | Inconsistencia visual y de foco entre módulos | Definir `FilterBar`/`FilterField` shared + usar `<Button>`; alinear focus a `ring-ring/85` | M | Medio (varios módulos) |
| VIS-P1-006 | P1 | Faltan primitivas form/dialog (Aud. 2,3,5) | `components/ui/*` (sin select/textarea/label/dialog), 43 usos raw `<select>/<textarea>/role="dialog"` en 21 archivos | Inventario de `ui/`; conteo grep | Native selects divergen cross-browser; estados/focus inconsistentes | Crear `ui/select`, `ui/textarea`, `ui/label`; estandarizar diálogos sobre `ModuleDialog`/Radix | M-L | Medio |
| VIS-P1-007 | P1 | A11y sin scanning + contraste (Aud. 6,9) | suite E2E; badges tinte/tinte | No axe-core/jest-axe; `text-vetneb-teal` sobre `bg-vetneb-teal/12` sin verificar 4.5:1 | Riesgo WCAG 1.4.3 oculto | Añadir `@axe-core/playwright` en rutas clave; auditar contraste por estado y corregir tokens si <4.5:1 | M | Bajo |
| VIS-P1-008 | P1 | `user-select:none` global (Aud. 6,15) | `globals.css:98-105` | `* { user-select:none }` con re-enable sólo en inputs/contenteditable | Tutor/clínica no puede seleccionar/copiar texto de informe/IDs/nombres por highlight (sólo botones copy de token) | Limitar `user-select:none` al chrome del App Shell (botones/nav), permitir selección en contenido público e informes | S | Bajo |

---

## 8. P2 Findings

| ID | Severidad | Área | Ubicación | Evidencia | Impacto | Recomendación | Esfuerzo | Riesgo |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| VIS-P2-001 | P2 | Token de elevación (Aud. 2,10) | 21 archivos incl. `ui/{button,card,input,table}.tsx` | `rgba(15,45,62,α)` × 65 | Sin escala de sombra; drift de elevación | Definir `--shadow-1..4` (o `--elevation-*`) tokenizando el ink-rgba; reemplazar gradualmente | M | Bajo |
| VIS-P2-002 | P2 | Gradiente hardcodeado (Aud. 2,11) | `globals.css:170-175,190,271` | hex `#0E3556/#2B5B88/#3F7EA2` ×4; hover == base | Drift de marca; hover no-op | `--gradient-clinical-primary` token; corregir hover (o quitarlo) | S | Bajo |
| VIS-P2-003 | P2 | Touch targets (Aud. 4,6,11) | dashboard `h-8` ×84; `AdminAuditFilterBar` mobile | 32px < 44px | Ergonomía táctil en mobile (filtros/acciones densas) | Subir a ≥40–44px en variante mobile de controles de filtro/acción | S-M | Bajo |
| VIS-P2-004 | P2 | Nav tablet (Aud. 4,16) | `Navbar.tsx` (`xl:hidden`/`xl:flex`) | Nav full solo ≥1280 | 768–1279px usa menú colapsado | Evaluar nav horizontal desde `lg` (1024) o tabbar tablet | S | Bajo |
| VIS-P2-005 | P2 | Cobertura responsive E2E (Aud. 4,7) | `e2e/*` viewports | Sin 320/1536/1920; tablet 768/1024 mínima | Riesgo en extremos no cubiertos | Sumar 320, 768, 1024, 1536, 1920 al smoke visual | S | Bajo |
| VIS-P2-006 | P2 | Tipografía marca (Aud. 8,18) | `globals.css` `--font-*` = Inter | Única familia genérica | Diferenciación de marca limitada | Evaluar display face distintivo para títulos públicos (mantener Inter UI) | S-M | Bajo (gusto/marca) |
| VIS-P2-007 | P2 | Perspective scroll (Aud. 12) | `PerspectiveScrollSection`, `globals.css` `public-perspective-scroll` | Memoria PR-24: activo pero imperceptible | Costo sin payoff | Amplificar (umbral perceptible) o remover; decidir con evidencia | S-M | Bajo |
| VIS-P2-008 | P2 | Taxonomía de estado (Aud. 16,17) | `utils.ts` vs `AdminReportStatusBadge.tsx` | 4 estados vs 5 stages distintos | Modelo mental dividido clínica/admin | Documentar mapping canónico estado↔stage; alinear labels | S | Bajo |
| VIS-P2-009 | P2 | Medición CWV (Aud. 14) | CI / scripts | Sin Lighthouse/CWV | No hay baseline de performance visual | Añadir Lighthouse CI (o `unlighthouse`) en público + dashboard demo | M | Bajo |
| VIS-P2-010 | P2 | Estados extremos QA (Aud. 20) | dashboards | Sin matriz visual de datos largos/N filas/error API | Regresiones en bordes no detectadas | Fixtures de estrés + capturas en regresión visual | M | Bajo |

---

## 9. P3 Findings

| ID | Severidad | Área | Ubicación | Evidencia | Impacto | Recomendación | Esfuerzo | Riesgo |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| VIS-P3-001 | P3 | Regla muerta (Aud. 13) | `globals.css:173-175` | `clinical-primary-gradient-hover:hover` = base | Ruido/confusión | Quitar o dar delta real de hover | XS | Nulo |
| VIS-P3-002 | P3 | Focus mixto (Aud. 11) | `ui/badge.tsx:6` (`focus:`) vs resto (`focus-visible:`) | Inconsistencia de patrón | Foco visible en click en badge | Unificar a `focus-visible:` | XS | Bajo |
| VIS-P3-003 | P3 | Sin catálogo DS (Aud. 2,7) | repo | Sin Storybook/doc DS | Onboarding y consistencia | Doc DS mínimo (tokens+componentes) o Storybook ligero | M | Bajo |
| VIS-P3-004 | P3 | Escala tipográfica (Aud. 8) | público/dashboard | Tamaños ad-hoc (`text-[0.68rem]`, clamp, etc.) | Jerarquía sin sistema | Definir escala tokenizada y mapear | S-M | Bajo |
| VIS-P3-005 | P3 | Tap highlight (Aud. 5,11) | `globals.css:101` | `-webkit-tap-highlight-color:transparent` global | Sin feedback táctil por defecto | Verificar `active:` explícito en todo tappable | S | Bajo |
| VIS-P3-006 | P3 | Inline styles (Aud. 13) | `logistica/metricas`, `logistica/rutas`, `AdminMobileHealthModule` | `style={{…}}` ×3 | Menor; estilo fuera de sistema | Mover a clases/vars si aplica | XS | Nulo |

**Resumen de conteo:** P0 = 2 · P1 = 8 · P2 = 10 · P3 = 6 · **Total = 26**.

---

## 10. Design System Gap Analysis

**Tokens faltantes**
- Escala de **sombra/elevación** (`--shadow-1..4`) — hoy `rgba(15,45,62,α)` hardcodeado ×65.
- **Gradiente primario** como token (`--gradient-clinical-primary`) — hoy hex repetido.
- **Escala tipográfica** semántica (display/h1..h6/body/caption) — hoy tamaños ad-hoc.
- **Token de focus ring** unificado (color + offset) — hoy conviven `ring/85` y `ring-vetneb-teal/15`.
- **Touch target** mínimo como variable de densidad (`--control-h-mobile`).

**Componentes faltantes (como `ui/*`)**
- `select`, `textarea`, `label`, `dialog` (base), `tabs` (público), `tooltip`, `dropdown-menu`,
  `toast/feedback`, `pagination` (hoy clases `dashboard-pagination-*`), `FilterBar/FilterField`.

**Variantes faltantes**
- `Button`: variante "filtro/aplicar" densa (hoy hand-rolled).
- `Badge`/`StatusBadge`: una sola fuente de verdad para estados (eliminar `AdminReportStatusBadge` off-token).
- `Input`: tamaño `sm` (h-8) canónico para cockpit.

**Estados faltantes/no unificados**
- copied/uploaded/downloaded/refreshed implementados ad-hoc por card → primitiva de feedback.

**Duplicaciones**
- `AdminParticularTokensCard` ↔ `ClinicParticularTokensCard` (tabla/paginación/copy/filtros).
- 3 patrones de filtro; 3 capas de badge; modales Radix vs hand-rolled.
- Dark-mode dual (`.dark` muerto vs `data-theme`).

**Reglas recomendadas**
1. Ningún color crudo de Tailwind (`slate/sky/violet/...`) en dashboard: sólo tokens `vetneb-*`/semánticos.
2. Ninguna sombra `rgba(...)` literal: sólo tokens de elevación.
3. Toda acción primaria usa `<Button>`; todo input/select/textarea usa primitiva `ui/*`.
4. Un único mecanismo de tema; sin selectores `[class*=...]`.
5. Focus único (`focus-visible` + `ring-ring/85` + offset).

---

## 11. Dashboard Excellence Gap Analysis

| Eje | Estado | Gap | Acción |
| --- | --- | --- | --- |
| **Admin** | Denso, modular, mobile dedicado | Badge off-token, filtros bespoke, card 1.894 LOC | Tokenizar badge, unificar filtros, decomponer card |
| **Clínica** | Parity con admin, mobile dedicado | Card 1.604 LOC duplica admin; selects inline | Extraer shared primitives admin/clínica |
| **No-scroll** | Contrato fuerte y testeado | Verificación por geometría, no apariencia | Sumar regresión visual sobre los frames vacíos/llenos |
| **Tablas** | `ui/table` consistente, paginación unificada | Densidad vs touch; sin viz de datos | Estado mobile táctil; sistema de charts si se agregan |
| **Filtros** | Funcionales (form GET progresivo) | 3 patrones, focus divergente, submit hand-rolled | `FilterBar` shared + `<Button>` + focus único |
| **Métricas** | KPIs `dashboard-kpi-pill` con tono | `chart-1..5` sin uso real | Definir sistema de data-viz al introducir charts |
| **Mobile** | Variantes dedicadas, bottom-nav, hub | Touch 32px, nav tablet colapsada | Subir targets; revisar breakpoint nav |
| **Estados** | empty/error/loading como primitivas | Feedback copy/upload ad-hoc; sin estados extremos en QA visual | Primitiva feedback + fixtures de estrés |
| **Acciones** | Claras por módulo | Afordancia primaria inconsistente (filtros) | Unificar jerarquía de botón |

---

## 12. Responsive Risk Matrix

| Viewport | Riesgo | Módulo/Página afectada | Evidencia | Severidad | Recomendación |
| --- | --- | --- | --- | --- | --- |
| 320 | Medio | Cockpit denso, filtros `h-8`, tablas | Sin cobertura E2E a 320; controles muy densos | P2 | Smoke a 320 + verificar overflow/touch |
| 360 | Bajo | Admin/clínica mobile | Cubierto (`360x640/740`) | — | Mantener |
| 375 | Bajo | iPhone SE/mini | Interpolable de 360/390 | P3 | Confirmar en smoke |
| 390 | Bajo | iPhone estándar | Cubierto (parity specs) | — | Mantener |
| 414 | Bajo | iPhone Plus | Cercano a 412/430 cubiertos | P3 | Confirmar |
| 430 | Bajo | iPhone Pro Max | Cubierto | — | Mantener |
| 768 | **Medio-Alto** | Tablet portrait; **nav colapsada** | Nav full sólo `xl`; E2E tablet mínima | P2 | Nav desde `lg`; smoke 768 |
| 1024 | Medio | Tablet landscape/laptop chico | Nav aún colapsada (<1280); poca cobertura | P2 | Smoke 1024 + revisar nav |
| 1280 | Bajo | Laptop | Cubierto (1280×800/900) | — | Mantener |
| 1366×768 | Bajo | Laptop común | Cubierto (`1366x768/650`) | — | Mantener (no-scroll OK) |
| 1440×900 | Bajo | Desktop | `visual-smoke` 1440 | P3 | Sumar a regresión visual |
| 1536×864 | Medio | Desktop HiDPI común | **Sin cobertura** | P2 | Sumar al smoke |
| 1920×1080 | Medio | Desktop grande | **Sin cobertura**; riesgo de aire muerto/anchos máximos | P2 | Sumar; verificar `max-w` y densidad |

---

## 13. Accessibility / WCAG Gap Matrix

| Criterio WCAG | Ubicación | Problema | Severidad | Recomendación | Test recomendado |
| --- | --- | --- | --- | --- | --- |
| 1.4.3 Contraste (mín) | Badges tinte/tinte (`StatusBadge`, alerts), `text-amber-700/800` | Sin verificación de 4.5:1 por estado | P1 | Auditar y ajustar tokens si <4.5:1 | `@axe-core/playwright` + cálculo de contraste |
| 1.4.1 Uso del color | `AdminReportStatusBadge` (sólo color, sin icono) | Estado sólo por color | P2 | Añadir icono/forma (como `StatusBadge`) | axe + revisión manual |
| 2.5.5 / 2.5.8 Target size | Filtros/acciones `h-8` (32px) mobile | < 44px (AAA) / borde AA | P2 | ≥40–44px en variante mobile | Medición geométrica en E2E mobile |
| 1.4.x Selección de texto | `user-select:none` global | No se puede seleccionar/copiar contenido/informe | P1 | Scoping del `user-select` al chrome | Test manual + regla CSS |
| 4.1.2 Nombre/rol/valor | Native `<select>` sin estilos focus del sistema | Foco divergente; render nativo | P2 | Primitiva `ui/select` accesible | axe + keyboard spec |
| 2.1.1 Teclado | `ModuleTabs`/`ModuleDialog`/nav | **Cubierto** (roles + flechas + focus trap) | — | Mantener | `dashboard-accessibility-keyboard.spec` |
| 2.4.7 Foco visible | global `:focus-visible` | **Cubierto** pero ring inconsistente (badge `focus:`) | P3 | Unificar token de ring | Visual + axe |
| 2.3.3 / 2.2.2 Motion | reveals + perspective | reduced-motion cubierto ×4 | — | Mantener; revisar payoff perspective | Spec reduced-motion |
| 4.1.x Robustez cross-AT | Lectores reales | Sin verificación SR/WebKit | P1 | Pase manual VoiceOver/NVDA + WebKit | Manual + Playwright webkit |

---

## 14. Visual Regression Strategy

**Objetivo**: red de seguridad de apariencia que bloquee merges con drift visual, estable (sin falsos
positivos), barata de mantener.

1. **Motor**: Playwright `toHaveScreenshot` (sin dependencia nueva; ya está el runner). Alternativa
   gestionada: Percy/Chromatic (requiere servicio externo — fuera de scope sin autorización).
2. **Matriz de rutas (baseline inicial, públicas + frames de dashboard con fixture)**:
   `/`, `/servicios`, `/precios`, `/clinicas`, `/contacto`, `/particulares`, `/login`,
   `/dashboard` (frame vacío + con datos fixture), `?module=informes|tokens|logistica|perfil`,
   `/dashboard/admin` + módulos admin-* (vía `admin-populated-api-server.mjs`).
3. **Matriz de viewports**: 360, 390, 768, 1024, 1366×768, 1440×900, 1920×1080 (subset por ruta para
   contener costo; mobile+desktop mínimo por ruta).
4. **Estados**: default, empty, error, loading, "datos largos"/N filas (fixtures de estrés), dialog
   abierto, filtros activos.
5. **Fixtures/datos**: reusar `e2e/fixtures/admin-populated-api-server.mjs`; congelar fecha/seed;
   datos deterministas.
6. **Thresholds**: `maxDiffPixelRatio` ≈ 0.01–0.02; `animations:"disabled"`; `caret:"hide"`;
   `fonts` precargadas y `await fonts.ready`.
7. **CI**: job separado `visual-regression` (no en el path crítico de unit); subir diffs como artefacto;
   actualización de baseline sólo vía flag explícito en PR dedicado.
8. **Baseline**: generar en un solo runner/OS (evitar diffs por subpíxel cross-OS); documentar cómo
   regenerar.
9. **Naming**: `vr-<area>-<ruta>-<viewport>-<estado>.png` (p.ej. `vr-admin-reports-1366x768-loaded.png`).
10. **Cuándo bloquear merge**: cualquier diff > threshold en rutas P0/P1 bloquea; rutas P2 informan.

**Anti-flake**: desactivar animaciones/transiciones (ya hay helper `disableAnimations` en
`visual-smoke`), esperar `networkidle`/`fonts.ready`, fijar `prefers-reduced-motion`, datos fixture
estables, un solo entorno de baseline.

---

## 15. Frontend Styling Architecture Refactor Plan

> Todas las fases son **PRs chicos, docs-only o de bajo riesgo**, sin rediseño y sin tocar backend/auth/
> deps/lockfile/CI más allá de lo estrictamente necesario por fase.

- **Fase 0 — Documentación/contratos (docs-only).** Este documento + un `docs/implementation/
  design-system-contract.md` que congele: inventario de tokens, mapa de utilities de `globals.css`,
  reglas DS (§10). Sin tocar código.
- **Fase 1 — Tokens mínimos.** Añadir tokens de **elevación** y **gradiente** y **focus ring**;
  reemplazar *en su definición* (no en todos los call-sites aún). Eliminar dark-mode muerto (`.dark` +
  `darkMode:class`) o consolidar. Riesgo bajo, alto retorno.
- **Fase 2 — Componentes base.** Crear `ui/select`, `ui/textarea`, `ui/label`; unificar `Badge`/
  `StatusBadge` y **retirar** `AdminReportStatusBadge` off-token; variante `Input` `sm`.
- **Fase 3 — Dashboard shared primitives.** `FilterBar/FilterField` único; extraer
  `TokenTable`/`PagedTableShell`/`CopyTokenButton` compartidos admin↔clínica; estandarizar diálogos
  sobre `ModuleDialog`.
- **Fase 4 — Regresión visual + cross-browser CI.** `toHaveScreenshot` (§14) + proyectos Playwright
  `webkit`/`firefox` + `@axe-core/playwright`.
- **Fase 5 — Production visual QA.** Runbook de QA visual autenticado (dashboards), matriz de estados
  extremos, Lighthouse/CWV baseline.

---

## 16. Recommended PR Plan

> Orden por dependencia y riesgo. Ninguno es un mega-PR. Cada uno mergeable y reversible.

1. **PR-VIS-0 · docs(audit): total visual engineering audit** — *este documento*.
   - Scope: sólo `docs/audit/total-visual-engineering-audit.md` (+ línea en `docs/audit/README.md` si se
     decide indexar). Tests: ninguno nuevo. Riesgo: nulo. Validación: `git diff --check`.
2. **PR-VIS-1 · chore(theme): remove dead `.dark`/`darkMode:class`** (VIS-P1-003 parte 1).
   - Archivos: `tailwind.config.ts`, `globals.css` (bloque `.dark`). Tests: `theme-mode.spec`. Riesgo:
     bajo (verificar 0 `dark:`). Validación: typecheck+lint+build+e2e theme.
3. **PR-VIS-2 · fix(admin): tokenize report status badge** (VIS-P1-004).
   - Archivos: `AdminReportStatusBadge.tsx` (→ tokens marca o reuso de `StatusBadge`). Tests: snapshot/
     visual del módulo admin-reports. Riesgo: bajo.
4. **PR-VIS-3 · feat(ds): elevation + gradient + focus-ring tokens** (VIS-P2-001/002, VIS-P3-001/002).
   - Archivos: `globals.css` (definición de tokens), corrección hover no-op, focus de `badge`. Reemplazo
     gradual luego. Riesgo: bajo-medio.
5. **PR-VIS-4 · a11y(global): scope `user-select` to app chrome** (VIS-P1-008).
   - Archivos: `globals.css` base. Tests: manual + regla. Riesgo: bajo.
6. **PR-VIS-5 · feat(ui): `select`/`textarea`/`label` primitives** (VIS-P1-006 parte 1).
   - Archivos: `components/ui/*` nuevos. Sin migrar call-sites aún. Riesgo: bajo.
7. **PR-VIS-6 · refactor(dashboard): unify FilterBar/FilterField** (VIS-P1-005).
   - Migrar `AdminAuditFilterBar` + selects inline al patrón único + `<Button>`. Riesgo: medio (por módulo,
     uno por PR si hace falta).
8. **PR-VIS-7 · refactor(dashboard): extract shared token-card primitives** (VIS-P1-002).
   - Extraer lógica común admin/clínica. Dividir en sub-PRs por primitiva. Riesgo: medio (cubrir con tests).
9. **PR-VIS-8 · test(e2e): axe-core a11y on key routes** (VIS-P1-007).
   - Añadir `@axe-core/playwright` (dependencia dev — requiere autorización explícita). Riesgo: bajo.
10. **PR-VIS-9 · test(e2e): visual regression baselines** (VIS-P0-002, §14).
    - `toHaveScreenshot` + job CI. Riesgo: medio (flake) → empezar por públicas.
11. **PR-VIS-10 · test(e2e): webkit + firefox projects** (VIS-P0-001).
    - Proyectos Playwright + subset crítico. Riesgo: bajo-medio.
12. **PR-VIS-11 · perf: Lighthouse/CWV baseline + perspective decision** (VIS-P2-009/007).
    - Medición + decisión sobre perspective scroll. Riesgo: bajo.

> Nota: PRs 8, 9, 10 introducen dependencias dev / cambios de CI → requieren autorización explícita por
> el contrato de scope (no tocar deps/lockfile/workflows sin acuerdo). Pueden quedar como propuesta.

---

## 17. Definition of Done for Visual Excellence

- [ ] Cero colores crudos Tailwind (`slate/sky/violet/...`) en dashboard; sólo tokens.
- [ ] Cero sombras `rgba(...)` literales; escala de elevación tokenizada.
- [ ] Gradiente de marca y focus ring como tokens únicos.
- [ ] Un único mecanismo de tema (sin `.dark` muerto, sin selectores substring).
- [ ] Una sola fuente de verdad por componente (badge, filtro, dialog, select, textarea).
- [ ] Sin componentes > ~400 LOC mezclando fetch+UI; lógica compartida admin/clínica extraída.
- [ ] Contraste ≥ 4.5:1 verificado por estado (axe-core en CI).
- [ ] Touch targets ≥ 44px en variantes mobile de controles densos.
- [ ] `user-select` permitido en contenido/informe; restringido al chrome.
- [ ] Regresión visual (`toHaveScreenshot`) cubriendo rutas P0/P1 × viewports clave × estados.
- [ ] Verificación cross-browser WebKit + Firefox en CI.
- [ ] Baseline Lighthouse/CWV (LCP/CLS/INP) público + dashboard demo.
- [ ] Contrato de design system documentado (tokens + componentes + reglas).
- [ ] Decisión registrada sobre perspective scroll (amplificar o remover).

---

## 18. Final Recommendation

**Dictamen directo.** VETNEB es visualmente **bueno y coherente**, pero su techo hoy está limitado por
**falta de garantías de ingeniería**, no por decisiones estéticas. El camino a "excelencia visual total"
**no es rediseñar**: es **tokenizar, unificar y blindar**.

**Qué hacer primero (en orden):**
1. **Fundaciones baratas y seguras**: eliminar dark-mode muerto, tokenizar badge admin off-token,
   tokens de elevación/gradiente/focus, y scoping de `user-select` (PR-VIS-1..5). Alto retorno, riesgo bajo.
2. **Blindaje del pipeline**: regresión visual + cross-browser WebKit/Firefox + axe-core
   (PR-VIS-8..10). Esto es lo que **destraba** poder iterar visualmente sin miedo y es la base del
   estándar extremo.
3. **Unificación de componentes**: filtros y primitivas de form/dialog; extracción de la duplicación
   admin/clínica (PR-VIS-6/7), en sub-PRs.

**Qué NO hacer:**
- **No** rediseñar el dashboard ni las públicas "de una": el contrato no-scroll y la semántica actual son
  activos; romperlos cuesta más de lo que rinde.
- **No** mover masivamente el `globals.css` antes de Fase 0/1 (riesgo de cascada).
- **No** introducir dependencias visuales (Percy/Chromatic/Storybook/axe) sin autorización de scope.
- **No** seguir agregando bloques `feature:start/end` al CSS global ni cards > 1k LOC: congelar ese patrón.

**Riesgo de no hacerlo.** Cada cambio visual seguirá siendo una apuesta sin red (Chromium-only, sin
baselines), la deuda del CSS monolítico y los cards de 1.9k LOC crecerá, y la divergencia de marca
(off-token, dual-theme, filtros bespoke) se consolidará — alejando al producto del estándar premium en
vez de acercarlo, justo cuando la base actual ya está cerca.

**Ruta recomendada.** Fase 0 (este doc) → Fase 1 (tokens) → Fase 4 (blindaje CI) → Fase 2/3
(componentes) → Fase 5 (QA productivo). Iterativo, por PRs chicos, sin congelar el desarrollo.

---

### Anexo A — Trazabilidad con auditorías previas (no duplicar)
- IA/navegación dashboard: `docs/audit/dashboard-horizontal-navigation-information-architecture.md`.
- UX dashboard / operating system: `docs/audit/product-ux-dashboard-audit.md`,
  `docs/audit/dashboard-mobile-whitebox-visual-audit.md`.
- Plan visual premium dashboard: `docs/audit/DASHBOARD_PREMIUM_VISUAL_REDESIGN_PLAN.md`,
  `docs/audit/DASHBOARD_NO_SCROLL_PREMIUM_REDESIGN_PLAN.md`.
- No-scroll App Shell: `docs/audit/DASHBOARD_SINGLE_VIEWPORT_APP_SHELL_PLAN.md`.
- Perspective scroll (PR-24): memoria de proyecto `project_pr24_perspective_audit`.
- Este documento **complementa** (capa visual/frontend) y **no reemplaza** las 4 auditorías Wave 0
  vigentes del `docs/audit/README.md`.
