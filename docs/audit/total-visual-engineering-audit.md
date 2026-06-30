# Total Visual Engineering Audit

> Auditoría visual total de nivel ingeniería senior/extremo sobre Portal VETNEB.
> Documento **diagnóstico + rector operacional** (no implementa cambios): no toca
> código productivo, backend, dependencias, lockfiles, CI ni tests. No genera commit/push/PR.
>
> - **Fecha (diagnóstico)**: 2026-06-30
> - **Rama base**: `main` · **HEAD del diagnóstico**: `f235b61 feat(clinic): add informes and tokens advanced filters (#1191)`.
> - **Publicado como**: PR #1192 (`8f6b1a2 docs(audit): add total visual engineering audit`).
> - **Upgrade operativo (este cambio)**: rama `docs/upgrade-total-visual-engineering-audit` sobre `main` `8e9fe3e (#1193)`.
>   Eleva el documento a estándar **rector / operacional** (tablero, modelo de evidencia, plan de PRs ejecutable, matrices de
>   autorización/trazabilidad/riesgo, gates, contrato de agentes, prompts y política de mantenimiento) **sin re-derivar ni
>   cambiar hallazgos**. Conteo estable: **2 P0 · 8 P1 · 10 P2 · 6 P3 = 26**.
> - **Working tree**: limpio salvo **este propio documento** (modificado para el upgrade operativo) · **PRs abiertos**: 0.
> - **Skills aplicadas**: 8/9 disponibles con nombre exacto (`vetneb-*`; detalle y aporte en §3). `frontend-design` (plugin
>   Anthropic) **no está instalada en esta sesión** → se aplica su rúbrica de calidad visual ya **codificada en el diagnóstico
>   original** (que sí leyó su `SKILL.md`), complementada con WCAG 2.2, Core Web Vitals y matriz responsive. Sustitución documentada en §3.
> - **Documentos hermanos vigentes**: `total-software-engineering-audit.md` (#1193, ingeniería de software dura) —
>   **complementario; no se contradice ni se re-deriva** (lo visual/CSS es soberanía de este documento). Este documento tampoco
>   reemplaza las 4 auditorías Wave 0 del `docs/audit/README.md`; aporta la **capa estrictamente visual/frontend**.

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

| | |
| --- | --- |
| **Hallazgos** | **2 P0 · 8 P1 · 10 P2 · 6 P3 = 26 total** |
| **Baseline** | Verde (las 7 validaciones obligatorias pasan; ver salida final) |
| **Veredicto** | Premium *profesional* hoy; "excelencia visual extrema" requiere blindaje de pipeline (regresión + cross-browser + a11y) |

### 1.1 Executive Value Add — Qué significa esto para VETNEB

**Lectura ejecutiva en una frase:** el producto **se ve bien y es coherente hoy**; el trabajo pendiente es **tokenizar,
unificar y blindar**, **no rediseñar**. Ningún hallazgo rompe la apariencia en runtime (no verificable estáticamente); los dos
P0 son **de proceso/infraestructura**.

- **Riesgo de marca / producto.** Divergencia visual (badge off-token, dual-theme muerto, filtros bespoke, gradiente
  hardcodeado) **consolida drift de marca**; público tutor/staff usan **iPhone** y nada corre en WebKit/iOS (VIS-P0-001) → brecha de confianza.
- **Riesgo técnico.** `globals.css` 3.262 líneas + cards 1.9k LOC elevan el costo de cambio; **sin regresión visual (VIS-P0-002) no se sabe qué se rompe**.
- **Riesgo de accesibilidad.** Contraste tinte/tinte sin medir (axe ausente), `user-select:none` global y touch 32px: invariantes productivos sin red automatizada.
- **Qué se puede resolver sin autorización (frontend/docs en scope):** lote 0 — PR-VIS-0/1/2/3/4/5 (§16.2).
- **Qué requiere autorización explícita (⚠) / qué NO hacer todavía:** ver Authorization Matrix (§29) y Do Not Do (§38) —
  en síntesis: deps/CI/catálogo y no rediseñar ni activar regresión+cross-browser+Storybook en un solo PR.

**Conclusión ejecutiva (4 certezas):** (1) base visual **sólida y por encima del promedio**; (2) **sin P0 de apariencia rota**
detectable estáticamente; (3) el mayor riesgo es la **falta de garantías de ingeniería visual** (regresión + cross-browser +
a11y), no la estética; (4) ruta correcta: **incremental, por PRs chicos, reversibles y trazables**.

### 1.2 Executive Control Panel

Decisión en 60 segundos: estado por dimensión, riesgo vivo, siguiente acción concreta y si hace falta autorización.
Estado: ✅ ok · ⚠️ gap accionable · ⛔ gap con autorización fuerte. (Detalle: §6–§9, §24, §29.)

| Dimensión | Estado | Riesgo actual | Siguiente acción (PR) | Autorización |
| --- | --- | --- | --- | --- |
| Design system governance | ⚠️ | DS implícito; badge off-token, dark dual, sin token de elevación | PR-VIS-1 → PR-VIS-2 → PR-VIS-3 | frontend (no) |
| Visual regression | ⛔ | 0 baselines → drift silencioso en `globals.css` 3.262 LOC | PR-VIS-9 | ⚠ CI (baselines) |
| Cross-browser rendering | ⛔ | Chromium-only; WebKit/iOS/Firefox sin verificar | PR-VIS-10 | ⚠ CI (proyectos) |
| Responsive / no-scroll | ✅/⚠️ | Contrato fuerte y testeado; extremos 320/1536/1920 sin cubrir | PR-VIS-9 (viewports) | frontend/⚠ CI |
| Accessibility / WCAG visual | ⚠️ | Contraste sin axe; `user-select` global; touch 32px | PR-VIS-4 → PR-VIS-8 | frontend → ⚠ dep |
| Frontend styling architecture | ⚠️ | `globals.css` monolítico; cards 1.9k LOC; duplicación admin/clínica | PR-VIS-0 (freeze) → PR-VIS-7 | docs → frontend |
| Dashboard / data visualization | ⚠️ | Filtros y badges no unificados; `chart-*` sin viz real | PR-VIS-6 | frontend |
| Typography / readability | ✅/⚠️ | Inter genérica; escala tipográfica ad-hoc | PR futuro (escala/marca) | frontend/marca |
| Color / contrast | ⚠️ | Off-token `violet/slate`; contraste no medido | PR-VIS-2 → PR-VIS-8 | frontend → ⚠ dep |
| Motion / microinteractions | ✅/⚠️ | reduced-motion cubierto; perspective imperceptible | PR-VIS-11 | frontend |
| Core Web Vitals / visual perf | ⚠️ | Sin medición CWV; cards client pesados | PR-VIS-11 | ⚠ tooling/CI |
| Production visual QA | ⚠️ | Sin QA visual autenticado ni matriz de estados extremos | Fase 5 / PR-VIS-9 | frontend/⚠ |

**Acción inmediata sin autorización:** **PR-VIS-0** (este documento). **Mayor valor/menor riesgo después:**
PR-VIS-1 → PR-VIS-2 → PR-VIS-4 → PR-VIS-3 → PR-VIS-5 (lote 0, §16.2).

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

### 3.0 Skills leídas y aplicadas (upgrade operativo 2026-06-30)

El upgrade se realizó leyendo y aplicando las skills VETNEB solicitadas. **8/9 existen con el nombre exacto** (`anthropic-skills:vetneb-*`); `frontend-design` **no está instalada en esta sesión** → ver sustitución abajo.

| Skill | Aporte a este upgrade | Estado |
| --- | --- | --- |
| `frontend-design` | Rúbrica de excelencia visual (jerarquía, color, tipografía, motion, anti-AI-slop) | **No instalada** → sustituida (ver nota) |
| `vetneb-staff-senior-full-stack-engineer` | Criterio Staff, PRs chicos, separación admin/clínica/particular/público, "no simular éxito" | Aplicada |
| `vetneb-production-web-optimization-engineer` | CWV, perf visual, layout shift, bundle, anti-patrones de producción, P0–P3 | Aplicada |
| `vetneb-web-end-to-end-global` | E2E, regresión visual, matriz responsive, no-scroll, definición de "operativo" | Aplicada |
| `vetneb-lanzamiento-mantenimiento` | Readiness, release gates, rollback, mantenimiento, post-merge | Aplicada |
| `vetneb-pwa-end-to-end` | Mobile/PWA, viewport/safe-area iOS, política de cache (no privados) | Aplicada |
| `vetneb-briefing-planificacion-diseno-desarrollo-pruebas` | Estructura de briefs/PR plan, acceptance criteria, anti-deriva, trazabilidad | Aplicada |
| `vetneb-protocolos-comunicacion` | Formato rector, gobernanza documental, comunicación técnica | Aplicada |
| `vetneb-security-production-invariants` | Accesibilidad como invariante productivo; CSP/headers cuando impactan rendering | Aplicada |

**Sustitución documentada (`frontend-design`):** la skill de creación de UI premium **no figura en la lista de skills de esta
sesión**. Su rúbrica de calidad visual (tipografía distintiva, color cohesivo, motion, composición, anti-"AI slop") **ya está
codificada en el diagnóstico original** (§1–§18), que sí leyó su `SKILL.md`. Como este upgrade es **operativo/docs-only** (no
re-juzga la estética ni cambia hallazgos), la sustitución no degrada el resultado: el criterio visual se conserva del
diagnóstico y se complementa con WCAG 2.2 (a11y), Core Web Vitals (LCP/CLS/INP) y matriz responsive/heurísticas de Nielsen. No
existe en el entorno una skill de review/auditoría visual con metodología propia; los criterios Staff/perf/E2E de las `vetneb-*`
cubren la dimensión de ingeniería visual.

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

> Orden por dependencia/riesgo; ninguno es mega-PR; cada uno mergeable y reversible. Scope/tests/acceptance/rollback por PR en **§16.1** (este listado = índice de títulos).

1. **PR-VIS-0 · docs(audit): cerrar esta auditoría rectora** — *este documento* (+ índice en `docs/audit/README.md` si se decide).
2. **PR-VIS-1 · chore(theme): remove dead `.dark`/`darkMode:class`** (VIS-P1-003 f1).
3. **PR-VIS-2 · fix(admin): tokenize report status badge** (VIS-P1-004).
4. **PR-VIS-3 · feat(ds): elevation + gradient + focus-ring tokens** (VIS-P2-001/002, VIS-P3-001/002).
5. **PR-VIS-4 · a11y(global): scope `user-select` to app chrome** (VIS-P1-008).
6. **PR-VIS-5 · feat(ui): `select`/`textarea`/`label` primitives** (VIS-P1-006 f1).
7. **PR-VIS-6 · refactor(dashboard): unify FilterBar/FilterField** (VIS-P1-005, VIS-P2-003).
8. **PR-VIS-7 · refactor(dashboard): extract shared token-card primitives** (VIS-P1-002).
9. **PR-VIS-8 · test(e2e): axe-core a11y on key routes** (VIS-P1-007) — ⚠ dep.
10. **PR-VIS-9 · test(e2e): visual regression baselines** (VIS-P0-002, §14) — ⚠ CI.
11. **PR-VIS-10 · test(e2e): webkit + firefox projects** (VIS-P0-001) — ⚠ CI.
12. **PR-VIS-11 · perf: Lighthouse/CWV baseline + perspective decision** (VIS-P2-009/007) — ⚠ tooling.

> Nota: PR-VIS-8/9/10/11 introducen deps dev / cambios de CI → requieren autorización explícita (no tocar deps/lockfile/workflows sin acuerdo); pueden quedar como propuesta.

### 16.1 PR Execution Matrix (scope · autorización · tests · acceptance · rollback)

| PR | Hallazgos | Scope | Autorización | Tests obligatorios | Acceptance Criteria | Rollback |
| --- | --- | --- | --- | --- | --- | --- |
| PR-VIS-0 | (este doc) | docs-only | No | `git diff --check`; diff solo `docs/**` | Doc rector mergeado; **0 cambios de código**; conteo 26 estable | Revertir el doc |
| PR-VIS-1 | P1-003 (f1) | frontend (theme) | frontend | `theme-mode.spec` + typecheck/lint/build | `0` usos `dark:`; tema único intacto; **sin cambio visual percibido** | Revert `tailwind.config.ts` + bloque `.dark` |
| PR-VIS-2 | P1-004 | frontend (admin) | frontend | E2E admin-reports + visual del módulo | Badge sobre tokens marca/`StatusBadge`; **0 colores crudos** en el componente | Revert del componente |
| PR-VIS-3 | P2-001/002, P3-001/002 | frontend (defs `globals`) | frontend | typecheck/build + `theme-mode.spec` | Tokens elevación/gradiente/focus definidos; hover no-op corregido; `badge` `focus-visible` | Revert de las defs |
| PR-VIS-4 | P1-008 | frontend (`globals` base) | frontend | E2E no-scroll + check de regla; manual de selección | `user-select` permitido en contenido/informe; restringido al chrome | Revert de la regla |
| PR-VIS-5 | P1-006 (f1) | frontend (`ui/*`) | frontend | typecheck/build (sin migrar call-sites) | `ui/select|textarea|label` creados y accesibles; **sin cambio en pantallas** | Borrar las primitivas |
| PR-VIS-6 | P1-005, P2-003 | frontend (dashboard) | frontend | E2E no-scroll + filtros por módulo | `FilterBar/FilterField` único + `<Button>` + focus `ring-ring/85`; touch ≥40px mobile | Revert por módulo |
| PR-VIS-7 | P1-002 | frontend (refactor) | frontend | E2E tokens admin+clínica | Primitivas compartidas extraídas; **sin cambio visual**; cards reducen LOC | Revert del split (mecánico) |
| PR-VIS-8 | P1-007 | test+deps | ⚠ dep (axe) | `@axe-core/playwright` en rutas clave | axe verde; contraste <4.5:1 corregido o registrado | Quitar dep + spec |
| PR-VIS-9 | P0-002, P2-005/010 | test+CI | ⚠ CI (baselines) | `toHaveScreenshot` + job separado | Baselines estables (públicas primero); diff>threshold bloquea P0/P1 | Borrar baselines + job |
| PR-VIS-10 | P0-001 | test+CI | ⚠ CI (proyectos) | E2E `webkit`+`firefox` subset crítico | Smoke crítico verde en WebKit + Firefox | Revert projects Playwright + CI |
| PR-VIS-11 | P2-009/007 | perf+CI | ⚠ tooling CWV | Lighthouse/unlighthouse baseline | Baseline LCP/CLS/INP; decisión de perspective registrada | Quitar tooling/medición |

### 16.2 Dependencias y secuenciación entre PRs

- **Lote 0 (frontend/docs, sin deps/CI — primero; alto retorno, reversible):** PR-VIS-0 → PR-VIS-1 → PR-VIS-2 → PR-VIS-4 → PR-VIS-3 → PR-VIS-5.
- **Lote 1 (componentes/refactor frontend; depende de tokens/primitivas):** PR-VIS-6 → PR-VIS-7.
- **Lote 2 (blindaje del pipeline; ⚠ deps/CI; *una herramienta por PR*):** PR-VIS-8 → PR-VIS-9 → PR-VIS-10 → PR-VIS-11.
- **Precedencias duras:** PR-VIS-0 antes de todo; tokens (PR-VIS-3)+primitivas (PR-VIS-5) antes de unificar (PR-VIS-6/7);
  regresión visual estable (PR-VIS-9) antes de cambios globales amplios de CSS; axe/contrast (PR-VIS-8) antes de color global;
  cross-browser (PR-VIS-10) antes de "production visual ready"; catálogo/Storybook (P3-003) después de las primitivas mínimas.

### 16.3 First 5 PR — Implementation Briefs

Briefs ejecutables estilo ticket senior, en el orden recomendado (lote 0 primero). **Listos para copiar como prompt futuro.**
Todos respetan el protocolo VETNEB (cambio mínimo; sin tocar fuera de scope; Git manual lo hace Nico; sin commit/push/PR).

#### Brief 1 — PR-VIS-0 · docs(audit): cerrar esta auditoría rectora *(docs-only)*
- **Contexto.** Esta auditoría visual debe quedar como documento rector operacional (tablero, matrices, gates, contrato de agentes).
- **Problema.** Sin la capa operativa, los PRs visuales se eligen y ejecutan con ambigüedad.
- **Objetivo.** Mergear este documento elevado; opcional: 1 línea de índice en `docs/audit/README.md` si se decide indexar.
- **Archivos probables.** `docs/audit/total-visual-engineering-audit.md` (+ opcional `docs/audit/README.md`).
- **Cambios permitidos.** Sólo documentación.
- **Cambios prohibidos.** Tocar frontend, backend, tests, deps, CI, DB. **0 cambios de código.**
- **Tests esperados.** Ninguno nuevo; validar que el árbol sólo cambió `docs/**`.
- **Riesgos.** Nulo.
- **Criterio de Done.** Doc mergeado; `git diff --name-only` = sólo `docs/**`; conteo 26 estable.
- **Comandos de validación.** `git diff --check` · `git diff --name-only`.
- **Nota para Codex/Claude.** No "arreglar de paso" ningún CSS. Sólo documentación.

#### Brief 2 — PR-VIS-1 · chore(theme): eliminar dark-mode muerto o documentar theme único *(frontend)*
- **Contexto.** Conviven `.dark` + `darkMode:"class"` (código muerto, `0` usos de `dark:`) y el dark real `:root[data-theme="dark-gray"]` con overrides substring.
- **Problema.** VIS-P1-003: dos mecanismos de tema; riesgo de aplicar fixes en el path equivocado.
- **Objetivo.** Eliminar `.dark` + `darkMode:"class"` muertos **o**, si se prefiere theme único, documentar la decisión y dejar un solo mecanismo (`[data-theme]`).
- **Archivos probables.** `frontend/tailwind.config.ts`, `frontend/src/app/globals.css` (bloque `.dark`).
- **Cambios permitidos.** Quitar el wiring muerto; no tocar el dark real `[data-theme]`.
- **Cambios prohibidos.** Cambiar la apariencia clara; introducir `dark:`; tocar otros bloques de `globals.css`.
- **Tests esperados.** `theme-mode.spec` verde; verificar por grep que `0` `dark:` quedan.
- **Riesgos.** Bajo (confirmar que `.dark` es realmente muerto en runtime antes de borrar).
- **Criterio de Done.** Un único mecanismo de tema; `theme-mode.spec` + typecheck/lint/build verdes; sin cambio visual percibido.
- **Comandos de validación.** `pnpm --dir frontend typecheck` · `lint` · `build` · `pnpm --dir frontend e2e` (theme).
- **Nota para Codex/Claude.** Si hay duda de que `.dark` sea muerto, **detenerse y documentar**, no borrar a ciegas.

#### Brief 3 — PR-VIS-2 · fix(admin): tokenizar el status badge off-token *(frontend)*
- **Contexto.** `AdminReportStatusBadge` usa `slate/sky/violet/emerald/amber` crudos (`violet` no existe en el sistema).
- **Problema.** VIS-P1-004: la pantalla admin-reports se ve off-brand; dos lenguajes de color de estado.
- **Objetivo.** Reescribir el badge sobre tokens de marca (`vetneb-*`) o reusar `StatusBadge`, conservando estados y semántica.
- **Archivos probables.** `frontend/src/app/dashboard/admin/AdminReportStatusBadge.tsx` (o ruta equivalente).
- **Cambios permitidos.** Mapear colores a tokens; opcional añadir icono/forma (no sólo color, WCAG 1.4.1).
- **Cambios prohibidos.** Cambiar la taxonomía de estados; tocar otros componentes.
- **Tests esperados.** E2E del módulo admin-reports; snapshot/visual del badge.
- **Riesgos.** Bajo.
- **Criterio de Done.** `0` colores crudos Tailwind en el componente; estados con tono de marca; E2E verde.
- **Comandos de validación.** `pnpm --dir frontend typecheck` · `lint` · `build` · E2E admin.
- **Nota para Codex/Claude.** Una sola fuente de verdad de estado: preferir reuso de `StatusBadge` antes de reimplementar.

#### Brief 4 — PR-VIS-3 · feat(ds): tokens de elevación + gradiente + focus-ring *(frontend)*
- **Contexto.** `rgba(15,45,62,α)` hardcodeado ×65; gradiente hex repetido ×4; focus mixto (`ring/85` vs `ring-vetneb-teal/15`); `badge` usa `focus:` y un hover no-op.
- **Problema.** VIS-P2-001/002 + VIS-P3-001/002: sin escala de elevación, gradiente sin token, foco inconsistente.
- **Objetivo.** Definir `--shadow-1..4`/`--gradient-clinical-primary`/token de focus **en su definición** (reemplazo gradual luego); corregir hover no-op y `badge` a `focus-visible`.
- **Archivos probables.** `frontend/src/app/globals.css` (definición de tokens + corrección hover), `frontend/src/components/ui/badge.tsx`.
- **Cambios permitidos.** Añadir tokens; corregir hover y focus de `badge`.
- **Cambios prohibidos.** Migrar masivamente los 65 call-sites en este PR; tocar la apariencia más allá del hover no-op.
- **Tests esperados.** typecheck/build + `theme-mode.spec`.
- **Riesgos.** Bajo-medio (orden de cascada/layers).
- **Criterio de Done.** Tokens definidos y usados en su origen; hover real o removido; `badge` con `focus-visible`.
- **Comandos de validación.** `pnpm --dir frontend typecheck` · `lint` · `build`.
- **Nota para Codex/Claude.** No reemplazar todos los `rgba(...)` aún; sólo definir tokens y corregir lo no-op.

#### Brief 5 — PR-VIS-4 · a11y(global): acotar `user-select:none` al chrome del App Shell *(frontend)*
- **Contexto.** `* { user-select:none }` global con re-enable sólo en inputs/contenteditable.
- **Problema.** VIS-P1-008: tutor/clínica no puede seleccionar/copiar texto de informe, IDs ni nombres.
- **Objetivo.** Limitar `user-select:none` al chrome (nav/botones/topbar) y **permitir selección** en contenido público e informes.
- **Archivos probables.** `frontend/src/app/globals.css` (regla base) — recordar mantener el orden ante los bloques de dashboard (memoria de scope tests).
- **Cambios permitidos.** Reacotar el selector; permitir selección en contenido.
- **Cambios prohibidos.** Romper contratos no-scroll; reordenar bloques que rompan los tests de scope legacy.
- **Tests esperados.** E2E no-scroll vigente; verificación manual de copia en informe/IDs.
- **Riesgos.** Bajo (cuidar orden de reglas vs bloques dashboard; ver memoria de scope tests).
- **Criterio de Done.** Selección habilitada en contenido/informe; chrome sin selección; no-scroll intacto.
- **Comandos de validación.** `pnpm --dir frontend typecheck` · `lint` · `build` · E2E no-scroll.
- **Nota para Codex/Claude.** Confirmar que la nueva regla queda **antes** de los bloques de dashboard en `globals.css`.

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

**Qué NO hacer:** no rediseñar dashboard/públicas "de una" (el no-scroll y la semántica son activos); no mover masivamente
`globals.css` antes de Fase 0/1; no introducir dependencias visuales (Percy/Chromatic/Storybook/axe) sin autorización; no seguir
agregando bloques `feature:start/end` ni cards > 1k LOC. Lista completa en §38.

**Riesgo de no hacerlo.** Cada cambio visual seguirá siendo una apuesta sin red (Chromium-only, sin
baselines), la deuda del CSS monolítico y los cards de 1.9k LOC crecerá, y la divergencia de marca
(off-token, dual-theme, filtros bespoke) se consolidará — alejando al producto del estándar premium en
vez de acercarlo, justo cuando la base actual ya está cerca.

**Ruta recomendada.** Fase 0 (este doc) → Fase 1 (tokens) → Fase 4 (blindaje CI) → Fase 2/3
(componentes) → Fase 5 (QA productivo). Iterativo, por PRs chicos, sin congelar el desarrollo.

### 18.1 Veredicto ejecutable directo

- **Primer PR (hoy, docs-only, sin autorización extra):** **PR-VIS-0** — cerrar esta auditoría rectora.
- **Segundo PR (frontend, sin deps/CI):** **PR-VIS-1** — eliminar dark-mode muerto o documentar theme único.
- **Tercero/cuarto/quinto (frontend, lote 0):** **PR-VIS-2** (badge token) → **PR-VIS-4** (`user-select`) → **PR-VIS-3** (tokens elevación/gradiente/focus).
- **Antes de declarar "excelencia visual extrema" deben cerrarse:** Gate 1 (baseline verde, ✔), Gate 6 (regresión visual, PR-VIS-9),
  Gate 4 (cross-browser WebKit/Firefox, PR-VIS-10) y Gate 5 (a11y/WCAG con axe, PR-VIS-8). Sin esto, "se ve bien" depende de un solo navegador y de inspección manual.
- **Requiere autorización explícita (no avanzar sin ella):** deps (`@axe-core/playwright`, Lighthouse/unlighthouse), CI (baselines de
  regresión visual, proyectos cross-browser), catálogo (Storybook/Percy/Chromatic/Loki), cambios de tokens globales con impacto amplio.
- **Mayor valor con menor riesgo (orden de retorno):** PR-VIS-0 → PR-VIS-1 → PR-VIS-2 → PR-VIS-4 → PR-VIS-3 → PR-VIS-5, antes de invertir en el blindaje con autorización (lote 2).

---

## 19. Evidence Confidence Model

Grado de evidencia: **Alta** = código/config/grep en el repo · **Media** = patrón o ausencia de artefacto (matizable con runtime) ·
**Baja** = requiere render real (WebKit/iOS), device, lector de pantalla o métricas productivas (aquí sólo se infiere).

| Categoría | Método de evidencia | Confianza | Brecha pendiente |
| --- | --- | --- | --- |
| CSS global monolítico (P1-001) | `wc -l globals.css`=3.262; ≈25 fences `feature:start/end` | **Alta** (repo) | Mapa exacto de utilities por dominio |
| Sin regresión visual (P0-002) | `0` PNG baseline; `0` `toHaveScreenshot` (grep) | **Alta** | — |
| Cross-browser real (P0-001) | `playwright.config.ts` único `project: chromium` | Alta (config) / **Baja** (render WebKit/iOS) | Ejecutar WebKit/Firefox/iOS |
| Contraste renderizado (P1-007, color) | Cálculo estático tinte/tinte; sin axe/Lighthouse | **Media/Baja** | axe + Lighthouse + render real |
| Core Web Vitals reales (P2-009) | Patrones de código (`priority`/preload/`fill`) | **Baja** | Lighthouse/CWV productivo |
| Dark-mode dual muerto (P1-003) | `0` usos `dark:` (grep); `.dark` + `[data-theme]` coexisten | Alta (repo) / **Media** (runtime) | Confirmar `.dark` muerto en runtime |
| Badge off-token (P1-004) | `AdminReportStatusBadge.tsx:7-27` slate/sky/violet | **Alta** | — |
| Sombras hardcodeadas (P2-001) | `rgba(15,45,62,α)`×65 en 21 archivos | **Alta** | — |
| `user-select` global (P1-008) | `globals.css:98-105` `*{user-select:none}` | Alta (regla) / **Media** (UX real) | Verificar copia real en informe/IDs |
| Filtros no unificados (P1-005) | 3 patrones en archivos citados (§Aud.3/5) | **Alta** | — |
| Componentes gigantes (P1-002) | `wc -l` 1.894 / 1.604 | Alta (LOC) / **Media** (complejidad) | Complejidad ciclomática no medida |
| Faltan primitivas (P1-006) | inventario `ui/*` + 43 raw `select/textarea/role=dialog` | **Alta** | — |
| Touch targets (P2-003) | `h-8`=32px ×84 | Alta (clase) / **Media** (device) | Medición en device real |
| Perspective imperceptible (P2-007) | memoria `project_pr24_perspective_audit` | **Media** | Percepción real / e2e umbral `rotateX` |

---

## 20. Finding Evidence Ledger

Resumen para validar rápido cada P0/P1/P2. *Tipo:* `código` (lógica/regla), `config`, `ausencia` (grep/falta de artefacto), `LOC` (tamaño).

| ID | Evidencia principal | Tipo | Confianza | Validación adicional recomendada |
| --- | --- | --- | --- | --- |
| VIS-P0-001 | `playwright.config.ts` 1 project `chromium`; 37 `backdrop-filter`/7 `dvh`/14 `safe-area` | config+código | Alta (repo) | Render real WebKit/Firefox/iOS |
| VIS-P0-002 | `0` baselines PNG; `0` `toHaveScreenshot` | ausencia | Alta | Generar baseline y medir flake |
| VIS-P1-001 | `globals.css` 3.262 LOC; fences feature | LOC+código | Alta | Mapear utilities por dominio |
| VIS-P1-002 | `AdminParticularTokensCard`(1.894)+`ClinicParticularTokensCard`(1.604) | LOC | Alta/Media | Diff de lógica compartida |
| VIS-P1-003 | `globals.css:66-94` `.dark` + `darkMode:class`; `0` `dark:` | código+ausencia | Alta/Media | Confirmar muerto en runtime |
| VIS-P1-004 | `AdminReportStatusBadge.tsx:7-27` | código | Alta | — |
| VIS-P1-005 | `AdminAuditFilterBar`/`StickyFilterBar`/selects inline | código | Alta | — |
| VIS-P1-006 | `ui/*` sin select/textarea/label/dialog; 43 raw en 21 archivos | ausencia | Alta | — |
| VIS-P1-007 | Sin axe/jest-axe; badge tinte/tinte | ausencia | Alta (ausencia) / Media (contraste) | axe + cálculo de contraste por estado |
| VIS-P1-008 | `globals.css:98-105` | código | Alta | Verificación manual de copia |
| VIS-P2-001 | `rgba(15,45,62,α)`×65 | código | Alta | — |
| VIS-P2-002 | `globals.css:170-175,190,271` hex ×4; hover==base | código | Alta | — |
| VIS-P2-003 | `h-8`×84; filtros mobile | código | Alta/Media | Medición en device |
| VIS-P2-004 | `Navbar.tsx` `xl:hidden`/`xl:flex` | código | Alta | — |
| VIS-P2-005 | `e2e/*` viewports sin 320/1536/1920 | ausencia | Alta | — |
| VIS-P2-006 | `globals.css` `--font-*`=Inter | config | Alta | Decisión de marca |
| VIS-P2-007 | memoria PR-24 | código | Media | e2e con umbral `rotateX` |
| VIS-P2-008 | `utils.ts` vs `AdminReportStatusBadge.tsx` | código | Alta | Documentar mapping canónico |
| VIS-P2-009 | Sin Lighthouse/CWV en CI/scripts | ausencia | Alta (repo) / Baja (real) | Medir Lighthouse/CWV |
| VIS-P2-010 | Dashboards sin matriz de estados extremos | ausencia | Alta | Fixtures de estrés |

---

## 21. Risk × Effort × Reversibility Matrix

Impacto (Alto/Medio/Bajo) · Esfuerzo (S/M/L/XL) · Reversibilidad (Alta/Media/Baja) · Riesgo impl. (Bajo/Medio/Alto) · "Orden" = secuencia ejecutiva (alineada con §16.2).

| ID | Sev | Impacto | Esfuerzo | Reversibilidad | Riesgo impl. | Orden |
| --- | --- | --- | --- | --- | --- | --- |
| VIS-P1-003 | P1 | Medio | M | Alta | Bajo-Medio | 1 |
| VIS-P1-004 | P1 | Medio | S | Alta | Bajo | 2 |
| VIS-P1-008 | P1 | Medio | S | Alta | Bajo | 3 |
| VIS-P2-001 | P2 | Medio | M | Alta | Bajo | 4 |
| VIS-P2-002 | P2 | Bajo | S | Alta | Bajo | 4 |
| VIS-P3-001 | P3 | Bajo | XS | Alta | Nulo | 4 |
| VIS-P3-002 | P3 | Bajo | XS | Alta | Bajo | 4 |
| VIS-P1-006 | P1 | Medio | M-L | Alta | Medio | 5 |
| VIS-P1-005 | P1 | Medio | M | Alta | Medio | 6 |
| VIS-P1-002 | P1 | Medio | L | Alta (split puro) | Medio | 7 |
| VIS-P1-007 | P1 | Alto | M | Alta | Bajo | 8 |
| VIS-P0-002 | P0 | Alto | M-L | Alta | Medio (flake) | 9 |
| VIS-P0-001 | P0 | Alto | M | Alta | Bajo-Medio | 10 |
| VIS-P2-009 | P2 | Medio | M | Alta | Bajo | 11 |
| VIS-P2-007 | P2 | Bajo | S-M | Alta | Bajo | 11 |
| VIS-P1-001 | P1 | Medio | XL (fases) | Media | Medio | f0 (freeze) / diferido |
| VIS-P2-003 | P2 | Medio | S-M | Alta | Bajo | con PR-VIS-6 |
| VIS-P2-005 | P2 | Bajo | S | Alta | Bajo | con PR-VIS-9 |
| VIS-P2-010 | P2 | Medio | M | Alta | Bajo | con PR-VIS-9 |
| VIS-P2-004 | P2 | Bajo | S | Alta | Bajo | PR futuro |
| VIS-P2-006 | P2 | Bajo | S-M | Alta | Bajo (marca) | PR futuro |
| VIS-P2-008 | P2 | Bajo | S | Alta | Bajo | PR futuro (docs) |
| VIS-P3-003/004/005/006 | P3 | Bajo | S | Alta | Bajo | cleanup PRs |

**Justificación del orden:** primero alta reversibilidad/bajo riesgo que reduce drift de marca (1–4); luego primitivas y
unificación (5–7); después **blindaje del pipeline** (8–10) que destraba iterar sin miedo; por último medición/perf (11) y el
refactor estructural del CSS monolítico (f0 + diferido), que es XL y de reversibilidad media.

---

## 22. Traceability Matrix

Trazabilidad hallazgo → riesgo → PR → validación → estado (todos **Abierto** en este baseline). Cubre P0, P1 y P2.

| Hallazgo | Riesgo | PR recomendado | Test / validación | Estado |
| --- | --- | --- | --- | --- |
| VIS-P0-001 | Sin verificación WebKit/iOS/Firefox | PR-VIS-10 | E2E webkit+firefox subset | Abierto |
| VIS-P0-002 | Drift visual silencioso en `globals.css` | PR-VIS-9 | `toHaveScreenshot` + job CI | Abierto |
| VIS-P1-001 | CSS monolítico, alta superficie de regresión | PR-VIS-0 (freeze/contrato) → extracción diferida | `git diff --check`; revisión de layers | Abierto |
| VIS-P1-002 | Drift admin/clínica por duplicación | PR-VIS-7 | E2E tokens admin+clínica | Abierto |
| VIS-P1-003 | Tema dual, fixes en path equivocado | PR-VIS-1 | `theme-mode.spec` | Abierto |
| VIS-P1-004 | Pantalla off-brand; dos lenguajes de estado | PR-VIS-2 | E2E/visual admin-reports | Abierto |
| VIS-P1-005 | Inconsistencia visual/foco de filtros | PR-VIS-6 | E2E no-scroll + filtros | Abierto |
| VIS-P1-006 | Selects nativos divergen cross-browser | PR-VIS-5 | typecheck/build primitivas | Abierto |
| VIS-P1-007 | Riesgo WCAG 1.4.3 oculto | PR-VIS-8 | `@axe-core/playwright` | Abierto |
| VIS-P1-008 | No se puede copiar contenido/informe | PR-VIS-4 | E2E no-scroll + manual | Abierto |
| VIS-P2-001 | Sin escala de elevación; drift | PR-VIS-3 | typecheck/build | Abierto |
| VIS-P2-002 | Drift de marca; hover no-op | PR-VIS-3 | typecheck/build | Abierto |
| VIS-P2-003 | Ergonomía táctil mobile | PR-VIS-6 (variante mobile) | medición geométrica E2E | Abierto |
| VIS-P2-004 | Nav colapsada en tablet | PR futuro (nav `lg`) | smoke 768/1024 | Abierto |
| VIS-P2-005 | Extremos responsive no cubiertos | PR-VIS-9 (viewports) | smoke 320/768/1024/1536/1920 | Abierto |
| VIS-P2-006 | Diferenciación de marca limitada | PR futuro (marca) | revisión de marca | Abierto |
| VIS-P2-007 | Costo de motion sin payoff | PR-VIS-11 | e2e umbral `rotateX` | Abierto |
| VIS-P2-008 | Modelo mental de estado dividido | PR futuro (docs mapping) | revisión de mapping | Abierto |
| VIS-P2-009 | Sin baseline de performance visual | PR-VIS-11 | Lighthouse/CWV | Abierto |
| VIS-P2-010 | Regresiones en bordes no detectadas | PR-VIS-9 (fixtures estrés) | capturas en regresión | Abierto |

---

## 23. Security / Accessibility Visual Control Matrix

Accesibilidad tratada como **invariante productivo** (skill `vetneb-security-production-invariants`). Estado: ✅ ok · ◐ parcial · ✘ gap.

| Control | Estado actual | Evidencia | Gap | Severidad | PR recomendado |
| --- | --- | --- | --- | --- | --- |
| Focus visible | ◐ | `:focus-visible` global; `badge` usa `focus:` | Ring inconsistente | P3 | PR-VIS-3 |
| Keyboard navigation | ✅ | `ModuleTabs`/`ModuleDialog` roles+flechas+trap | — | — | (mantener) |
| Labels / nombres | ◐ | aria en públicas; filtros abreviados | Sin ayuda contextual | P3 | PR-VIS-6 |
| Icon-only buttons | ◐ | varios botones de acción | Sin label garantizado | P2 | PR-VIS-6 |
| Dialogs / drawers | ◐ | `ModuleDialog` (Radix) + hand-rolled | `UploadReportModal` manual | P1 | PR-VIS-5/6 |
| Contrast (1.4.3) | ✘ | badges tinte/tinte; `text-amber-700/800` | Sin axe; <4.5:1 sin verificar | P1 | PR-VIS-8 |
| Reduced motion | ✅ | `@media prefers-reduced-motion` ×4 | — | — | (mantener) |
| Readable text size | ◐ | `text-[11px]` labels filtro | Al límite de legibilidad | P3 | PR futuro (escala) |
| Touch targets (2.5.5/2.5.8) | ✘ | `h-8`=32px mobile | <44px | P2 | PR-VIS-6 |
| Safe-area iOS | ◐ | 14× `safe-area-inset` | Sin verificación en iOS real | P1 (cross-browser) | PR-VIS-10 |
| Scroll locking / no-scroll | ✅ | App Shell `overflow-hidden` + specs | Verificado por geometría, no apariencia | P0 (regresión) | PR-VIS-9 |
| Error/empty/loading states | ✅ | primitivas `EmptyState/ErrorState/LoadingState` | Feedback copy/upload ad-hoc | P2 | PR-VIS-7 |
| Semantic headings | ✅ | headings ordenados + `aria-labelledby` | — | — | (mantener) |
| Text selection (1.4.x) | ✘ | `user-select:none` global | No se copia contenido | P1 | PR-VIS-4 |

---

## 24. Production Visual Readiness Gates

Gates para declarar "excelencia visual extrema" certificable. Estado: ✔ pasado · ◐ parcial · ✘ no.

| Gate | Estado | Evidencia | Bloqueantes | PRs necesarios |
| --- | --- | --- | --- | --- |
| **Gate 1 — Repo green baseline** | ✔ | 7 validaciones verdes; `git diff --check` limpio | — | — (mantener) |
| **Gate 2 — Visual governance** | ✘ | DS implícito; badge off-token; dark dual; sin tokens elevación | P1-003/004, P2-001/002 | PR-VIS-1/2/3 (+ freeze P1-001) |
| **Gate 3 — Responsive / no-scroll verified** | ◐ | Contrato fuerte; extremos 320/1536/1920 sin cubrir | P2-005 | PR-VIS-9 (viewports) |
| **Gate 4 — Cross-browser verified** | ✘ | Chromium-only; WebKit/Firefox/iOS sin correr | P0-001 | PR-VIS-10 |
| **Gate 5 — Accessibility / WCAG verified** | ✘ | Sin axe; contraste/touch/`user-select` | P1-007/008, P2-003 | PR-VIS-4 → PR-VIS-8 |
| **Gate 6 — Visual regression baseline** | ✘ | `0` baselines; `0` `toHaveScreenshot` | P0-002 | PR-VIS-9 |
| **Gate 7 — Performance / CWV measured** | ✘ | Sin Lighthouse/CWV | P2-009 | PR-VIS-11 |
| **Gate 8 — Production visual QA completed** | ✘ | Sin QA autenticado ni estados extremos | P2-010 + cross-browser | Fase 5 + PR-VIS-9/10 |

**Camino crítico a "extremo":** Gate 1 (✔) → Gate 2 (PR-VIS-1/2/3) → Gate 6 (PR-VIS-9) → Gate 4 (PR-VIS-10) → Gate 5 (PR-VIS-8) → Gate 7/8 (CWV + QA productivo).

---

## 25. Decision Framework — cómo elegir el próximo PR visual

Reglas en orden de prioridad. Si dos PRs compiten, gana el de **mayor confianza × menor riesgo × mayor reversibilidad**.

1. Primero P0/P1 de **alta confianza y bajo riesgo** (lote 0, §16.2).
2. No cambiar diseño masivamente **sin regresión visual mínima** (PR-VIS-9 antes de cambios globales amplios).
3. No introducir Storybook/Percy/Chromatic/Loki sin **autorización explícita**.
4. No mezclar **refactor visual** con **rediseño**.
5. No tocar dashboard **no-scroll** sin E2E específico.
6. No activar reglas CI visuales sin **baseline estable**.
7. No tocar **colores globales** sin contrast audit (PR-VIS-8 antes).
8. No cambiar **CSS global amplio** sin screenshots/control de regresión.
9. No cambiar filtros/cards/tablas sin tests de **responsive/no-scroll**.

| Situación | Decisión recomendada | Motivo |
| --- | --- | --- |
| Hay tiempo para 1 PR de bajo riesgo | PR-VIS-0 (docs) → PR-VIS-1 | Máx. valor, 0 riesgo, reversible |
| "Mejorar la marca ya" | PR-VIS-2 (badge token) antes que rediseño | Drift se cierra barato y reversible |
| "Blindar lo visual" | PR-VIS-9 (regresión) antes de tocar `globals.css` | Sin baseline no hay red |
| "Excelencia extrema" | No declararla sin Gate 4 (WebKit/iOS) | "Se ve bien" en Chromium ≠ en Safari |
| Van a refactorizar un card gigante | Split puro, sin cambio visual | Aísla riesgo, rollback mecánico |
| Aparece dep/CI nuevo en un PR | Separar y pedir autorización | Protocolo VETNEB / scope |
| PR toca color global | Exigir contrast audit (axe) antes | Sin medición no hay Done |
| PR toca dashboard | Exigir E2E no-scroll | Contrato no-scroll es activo |

---

## 26. Risk Acceptance Register

Estado recomendado mientras no se cierra: Mitigado · Aceptado temporal · Pendiente evidencia · Bloqueado por acceso externo.

| Riesgo | Sev | Estado recomendado | Revisión | Condición para cerrar |
| --- | --- | --- | --- | --- |
| Playwright solo Chromium (P0-001) | P0 | Aceptado temporal | Antes de "cross-browser ready" | PR-VIS-10 (WebKit+Firefox) + pase iOS real |
| Sin regresión visual (P0-002) | P0 | Aceptado temporal | Antes de cambios globales de CSS | PR-VIS-9 con baseline estable + threshold |
| CSS global monolítico (P1-001) | P1 | Aceptado temporal (freeze append-only) | Por cada PR de estilos | Contrato DS + extracción gradual por fases |
| Componentes visuales gigantes (P1-002) | P1 | Aceptado temporal | Por card tocado | Extracción de primitivas sin cambio visual |
| Filtros no unificados (P1-005) | P1 | Aceptado temporal | Próximo PR dashboard | `FilterBar`/`FilterField` único |
| Dark-mode muerto (P1-003) | P1 | Mitigable ya | Inmediato | PR-VIS-1 (eliminar o documentar theme único) |
| Badges off-token (P1-004) | P1 | Mitigable ya | Inmediato | PR-VIS-2 (tokens marca) |
| Primitivas UI faltantes (P1-006) | P1 | Aceptado temporal | Próximo PR DS | `ui/select|textarea|label` + estandarizar diálogos |
| `user-select` global (P1-008) | P1 | Mitigable ya | Inmediato | PR-VIS-4 (scoping al chrome) |
| Contraste no automatizado (P1-007) | P1 | Pendiente evidencia | Antes de cambios de color | PR-VIS-8 (axe) + corrección <4.5:1 |
| Sombras hardcodeadas (P2-001) | P2 | Aceptado temporal | Con PR-VIS-3 | Escala `--shadow-*` tokenizada |
| Sin Storybook/catálogo visual (P3-003) | P3 | Aceptado temporal | Tras primitivas mínimas | Doc DS o Storybook (⚠ autorización) |

---

## 27. PR Dependency Graph

Dependencias **duras** (bloqueantes) y **blandas** (recomendadas); secuencia en §16.2.

| PR | Depende de | Bloquea | Tipo | Motivo |
| --- | --- | --- | --- | --- |
| PR-VIS-0 | — | toda ejecución | Dura | El doc rector define scope/orden |
| PR-VIS-1 | — | — | — | Independiente, alto valor temprano |
| PR-VIS-2 | — | — | — | Independiente, alto valor temprano |
| PR-VIS-3 | — | PR-VIS-6 (focus), PR-VIS-7 | Blanda | Tokens antes de unificar componentes |
| PR-VIS-4 | — | — | — | Independiente (a11y global) |
| PR-VIS-5 | — | PR-VIS-6 | Blanda | Primitivas antes de migrar filtros/forms |
| PR-VIS-6 | PR-VIS-3, PR-VIS-5 | — | Blanda | FilterBar usa tokens/primitivas |
| PR-VIS-7 | PR-VIS-5 (blanda) | — | Blanda | Extracción sobre base de primitivas |
| PR-VIS-8 | — | cambios de color globales | Dura | Contrast audit antes de tocar color |
| PR-VIS-9 | — | cambios globales de CSS; Gate 6 | Dura | Baseline antes de cambios amplios |
| PR-VIS-10 | — | "production visual ready"; Gate 4 | Dura | Sin esto no se declara cross-browser |
| PR-VIS-11 | — | Gate 7 | Blanda | Medición CWV + decisión perspective |

---

## 28. Validation Command Matrix

Comandos por tipo de PR visual (Terminal 1, PowerShell). **Si Next modifica `frontend/next-env.d.ts`:** `git restore --staged
frontend/next-env.d.ts 2>$null; git restore frontend/next-env.d.ts` y repetir `pnpm test` (memoria `feedback_next_env_regeneration`).

| Tipo de PR | Comandos mínimos | Adicionales | Cuándo aplica |
| --- | --- | --- | --- |
| Docs-only | `git diff --check` · `git diff --name-only` (solo `docs/**`) | — | Sólo `docs/**` |
| CSS / global style | `pnpm --dir frontend typecheck` · `lint` · `build` | borrar `frontend/.next` antes de re-E2E (memoria cache stale) | `globals.css` |
| Component primitive | `pnpm --dir frontend typecheck` · `lint` · `build` | E2E afectado | `components/ui/*` |
| Dashboard module | typecheck · lint · build · **E2E no-scroll** del módulo | parity mobile | `app/dashboard/**` |
| Public page | typecheck · lint · build · `pnpm security:public-surface` | smoke público | `app/(public)/**` |
| Responsive / no-scroll | E2E no-scroll + geometría por viewport | 320/768/1024/1536/1920 | layout/filtros/cards |
| Accessibility / WCAG | E2E a11y + `@axe-core/playwright` (⚠ dep) | keyboard spec | foco/contraste/labels |
| Visual regression | `toHaveScreenshot` (⚠ CI) + job separado | subir diffs como artefacto | baselines |
| Cross-browser | E2E projects `webkit`/`firefox` (⚠ CI) | iOS real (externo) | render divergente |
| Performance / CWV | Lighthouse/unlighthouse (⚠ tooling) | EXPLAIN bundle | perf visual |
| Design system / token | typecheck · build + grep de hardcodes residuales | regresión visual | tokens/`globals` defs |
| CI / dependency | `pnpm install --frozen-lockfile` · suite afectada (⚠ autorización) | `pnpm audit` | workflows / `package.json` |

**Gate global previo a cualquier merge:** `git diff --check` · `pnpm test` · `pnpm --dir frontend typecheck` ·
`pnpm --dir frontend lint` · `pnpm --dir frontend build` · `pnpm build` · `pnpm security:public-surface`.

---

## 29. Authorization Matrix

| Cambio | Autorización | Motivo | Ejemplo |
| --- | --- | --- | --- |
| docs-only | No | Sin impacto runtime | Esta auditoría |
| tests-only (E2E geometría) | No | No toca producción | Sumar viewports a smoke |
| CSS global (en scope) | No (frontend) | Sin contrato/seguridad | Scoping `user-select` |
| design tokens | No (frontend) | Definición local | `--shadow-*`/gradiente |
| component primitives | No (frontend) | UI base | `ui/select|textarea|label` |
| dashboard modules | No (frontend) + E2E no-scroll | Contrato no-scroll | Unificar FilterBar |
| public pages | No (frontend) + `security:public-surface` | Superficie pública | Ajuste de hero/nav |
| a11y tooling | Sí (⚠ dep) | Dependencia dev | `@axe-core/playwright` |
| visual regression baselines | Sí (⚠ CI) | Política de baseline + job | `toHaveScreenshot` |
| cross-browser CI | Sí (⚠ CI) | Tiempo CI + matriz | projects `webkit`/`firefox` |
| new dev dependencies | Sí (⚠ deps) | Supply-chain / lockfile | axe, Lighthouse |
| Storybook/Percy/Chromatic/Loki | Sí (⚠⚠) | Servicio/herramienta nueva | Catálogo visual |
| production visual QA | Sí (⚠) | Acceso autenticado real | Capturas prod dashboard |
| Core Web Vitals tooling | Sí (⚠) | Tooling/CI | Lighthouse CI |

---

## 30. Owner / Reviewer Matrix

Roles técnicos (no personas). En proyecto solo-owner, "reviewer" = checklist + self-review disciplinado, o segundo par cuando exista.

| Área | Owner | Reviewer | Motivo |
| --- | --- | --- | --- |
| Design tokens / DS | Design system reviewer | Staff frontend | Coherencia de marca |
| Theming / dark-mode | Staff frontend | Design system reviewer | Un solo mecanismo |
| Filtros / dashboard | Staff frontend | QA/E2E reviewer | Contrato no-scroll |
| Componentes compartidos | Staff frontend | Staff full-stack | Impacto admin+clínica+public |
| Accesibilidad / WCAG | Accessibility reviewer | Staff frontend | Invariante productivo |
| Regresión visual / E2E | QA/E2E reviewer | Staff frontend | Baseline y flake |
| Cross-browser | QA/E2E reviewer | Performance reviewer | Render divergente |
| Performance / CWV | Performance reviewer | Staff frontend | Layout shift / bundle |
| Públicas / SEO visual | Staff frontend | Product owner | Marca + LCP |
| Release / readiness | Operations reviewer | Product owner | Go/no-go visual |

---

## 31. Done Evidence Requirements

| Tipo de cambio | Evidencia mínima en PR | Opcional | No aceptable |
| --- | --- | --- | --- |
| Dashboard visual | Antes/después + **E2E no-scroll** + checks mobile | trace/video | "Se ve lindo" sin E2E |
| Token / design-system | Mapa de tokens + sin hardcodes nuevos (grep) + typecheck/build | regresión visual | Nuevos `rgba(...)`/hex crudos |
| Accessibility | Foco + labels + teclado + axe (si aplica) | lector de pantalla | Solo color para estado |
| Visual regression | Baseline + threshold + matriz + sin flakiness | diffs como artefacto | Screenshot manual como sustituto |
| Cross-browser | Report Chromium/WebKit/Firefox | iOS real | "Cross-browser" solo en Chromium |
| Public page | typecheck/lint/build + `security:public-surface` | smoke público | `next-env.d.ts` modificado sin restaurar |
| Docs-only | `git diff --name-only` = solo `docs/**` | — | Tocó código "de paso" |
| Refactor (card gigante) | Diff del split + E2E sin cambio de comportamiento | — | Mezcla refactor + cambio visual |

---

## 32. Failure Mode Analysis

| Hallazgo | Cómo falla en producción | Señal temprana | Prevención | Detección | Recuperación |
| --- | --- | --- | --- | --- | --- |
| Sin regresión visual (P0-002) | Edición de `globals.css` regresa una pantalla | Reportes de "se ve raro" | Baselines + threshold | `toHaveScreenshot` | Revertir el PR; regenerar baseline |
| Chromium-only (P0-001) | `backdrop-filter`/`dvh`/select rompen en Safari/iOS | Quejas desde iPhone | E2E WebKit + pase iOS | E2E cross-browser | Fix WebKit-aware; fallback |
| CSS global monolítico (P1-001) | Cambio en un fence rompe cascada de otro | Estilos cruzados tras merge | Freeze + `@layer` + contrato | Regresión visual | Revertir; aislar por layer |
| Tokens sin baseline (P2-001/002) | Cambio de elevación/gradiente drift global | Sombras/bordes inconsistentes | Tokens + regresión visual | Diff visual | Revertir defs |
| Filtros/dashboard sin no-scroll (P1-005) | Filtro rompe el single-viewport | Scroll inesperado en cockpit | E2E no-scroll por módulo | Specs geometría | Revertir; re-anclar `min-h-0` |
| Contraste no automatizado (P1-007) | Texto ilegible en estado tinte/tinte | Reportes de legibilidad | axe + contrast audit | axe en CI | Ajustar tokens a ≥4.5:1 |
| Motion sin reduced-motion | Animación molesta/insegura | Mareo/CLS | `prefers-reduced-motion` | Spec reduced-motion | Desactivar animación |
| Componentes gigantes (P1-002) | Regresión por cambio en card 1.9k LOC | PRs lentos, miedo a tocar | Split + primitivas | E2E tokens | Revert del PR |
| `user-select` global (P1-008) | Tutor no copia ID/informe → fricción | Soporte: "no puedo copiar" | Scoping al chrome | Manual + regla | Revertir regla |

---

## 33. Engineering Visual Scorecard

Escala 0–5 cualitativa basada en hallazgos (sin precisión falsa): 0=ausente, 3=funcional, 5=extremo.

| Dimensión | Actual | Objetivo | Brecha | PRs que suben score |
| --- | --- | --- | --- | --- |
| Visual quality | 4 | 5 | Filtros/badges/afordancia | PR-VIS-2/6 |
| Design system governance | 3 | 5 | Tokens, badge, theme dual | PR-VIS-1/2/3 |
| Component consistency | 3 | 5 | 3 patrones filtro/badge; duplicación | PR-VIS-5/6/7 |
| Responsive / no-scroll | 4 | 5 | Extremos sin cubrir | PR-VIS-9 |
| Cross-browser | 1.5 | 5 | Chromium-only | PR-VIS-10 |
| Accessibility / WCAG | 3 | 5 | Contraste/touch/`user-select` | PR-VIS-4/8 |
| Visual regression | 1 | 5 | 0 baselines | PR-VIS-9 |
| Typography | 3.5 | 5 | Inter genérica; escala ad-hoc | PR futuro (escala/marca) |
| Color / contrast | 3 | 5 | Off-token; sin medición | PR-VIS-2/8 |
| Motion | 3.5 | 5 | Perspective imperceptible | PR-VIS-11 |
| Frontend styling architecture | 2.5 | 5 | `globals.css` 3.262 LOC; cards 1.9k | PR-VIS-0/3/7 |
| Dashboard / data visualization | 3.5 | 5 | Filtros/badges; sin viz real | PR-VIS-6 |
| Visual performance | 2.5 | 5 | Sin CWV; cards client pesados | PR-VIS-11 |
| Production visual QA | 2 | 5 | Sin QA autenticado/estados extremos | Fase 5 + PR-VIS-9/10 |
| Documentation (DS) | 2 | 5 | Sin catálogo/contrato DS | PR-VIS-0 + Storybook (⚠) |

**Promedio actual ≈ 2.9/5 (Profesional alto / borde Senior).** Salto a ≈3.8 con lote 0 + PR-VIS-6/7; "extremo" exige PR-VIS-8/9/10 (a11y + regresión + cross-browser).

---

## 34. Measurable Improvement Targets

Metas medibles; los baselines no medidos se declaran como tales (no se inventan).

| Área | Métrica objetivo | Baseline conocido | Cómo medir | PR habilitador |
| --- | --- | --- | --- | --- |
| Regresión visual | Baseline mínimo en rutas críticas | **0 baselines** | `toHaveScreenshot` | PR-VIS-9 |
| Cross-browser | Chromium + WebKit + Firefox | **Chromium-only** | projects Playwright | PR-VIS-10 |
| Accessibility | axe sin violaciones críticas en rutas clave | **sin axe** | `@axe-core/playwright` | PR-VIS-8 |
| Contraste | ≥4.5:1 por estado | **sin medición** | contrast checks/axe | PR-VIS-8 |
| CSS global | Reducir/encapsular por fases o congelar append-only | **3.262 líneas** | `wc -l` + mapa de layers | PR-VIS-0 (freeze) → diferido |
| Component duplication | Cards de token con primitivas compartidas | **1.894 + 1.604 LOC** | `wc -l` post-split | PR-VIS-7 |
| Hardcodes de elevación | 0 `rgba(...)` literales nuevos | **65 ocurrencias** | grep en CI/local | PR-VIS-3 |
| Off-token palette | 0 colores crudos en dashboard | **slate/sky/violet en 1 pantalla** | grep + review | PR-VIS-2 |
| Touch targets | ≥44px en controles mobile densos | **32px (`h-8`)** | medición geométrica E2E | PR-VIS-6 |
| Core Web Vitals | Baseline LCP/CLS/INP público + dashboard demo | **sin datos** | Lighthouse/CWV | PR-VIS-11 |
| Cobertura responsive | 320/768/1024/1536/1920 en smoke | **sin estos viewports** | E2E smoke | PR-VIS-9 |

---

## 35. No-Go Criteria (bloquean merge)

| No-Go | Aplica a | Motivo | Cómo detectarlo |
| --- | --- | --- | --- |
| PR visual toca CSS global sin E2E/responsive | CSS/global | Regresión silenciosa | ¿Hay E2E no-scroll/responsive en el PR? |
| PR dashboard rompe no-scroll | dashboard | Contrato roto | E2E no-scroll falla |
| PR cambia tokens globales sin contrast audit | tokens/color | Riesgo WCAG | ¿Hay axe/contrast check? |
| PR agrega dev dependency sin autorización | deps | Supply-chain / lockfile | Diff de `package.json`/lock |
| PR agrega visual baselines sin política de actualización | regresión visual | Baselines obsoletos | ¿Hay regla de regenerar baseline? |
| PR activa CI visual sin baseline estable | CI visual | Flake/falsos positivos | ¿Baseline estable previo? |
| PR cambia componentes compartidos sin revisar admin+clínica+public | componentes | Drift cruzado | ¿Se revisaron las 3 superficies? |
| PR deja `next-env.d.ts` modificado | frontend build | Ruido/regresión | `git status -- frontend/next-env.d.ts` |
| PR mezcla refactor visual con funcionalidad | refactor | Rollback difícil | Revisar diff por scope |
| PR introduce regresión visual + cross-browser + Storybook juntos | tooling | Riesgo acumulado | ¿Más de una herramienta nueva? |

---

## 36. Acceptance Criteria por Severidad

**P0 / P1 — cada hallazgo debe:**
- tener un **PR específico** (no agruparse con otro P1);
- incluir **evidencia visual o técnica** + **test/validación** que demuestre el cierre;
- definir **rollback** explícito;
- tener **owner/reviewer** asignado (§30);
- ser **trazable** (aparecer en §22).

**P2 — cada hallazgo:**
- **puede agruparse** por área (p.ej. a11y/responsive) si reduce ruido;
- requiere **validación** (E2E, axe, build o verificación manual documentada);
- **no debe crear deuda nueva** ni romper contratos no-scroll.

**P3 — cada hallazgo:**
- se cierra en **cleanup/polish PRs** agrupados;
- **no debe bloquear** entregas críticas ni gates de producción.

---

## 37. Open Questions / Requires External Visual Access

Preguntas que **no** pueden cerrarse desde el repo: requieren render real, device, lector de pantalla o métricas productivas.

| Pregunta | Por qué importa | Cómo verificar | Riesgo si no se verifica |
| --- | --- | --- | --- |
| **iOS Safari real** | `backdrop-filter`/`dvh`/select divergen; público iPhone | Device iOS o BrowserStack | Roturas no vistas en el principal navegador del público |
| **Android Chrome real** | Touch/teclado/safe-area | Device Android | Ergonomía mobile no verificada |
| **Firefox** | `-webkit-` no aplica; render de forms | E2E `firefox` | Divergencia de formularios |
| **Edge** | Chromium-based pero perfiles distintos | E2E/manual | Bajo, pero no verificado |
| **Dashboards autenticados en prod** | Datos reales, latencia, sesión | Acceso autenticado real | QA visual productivo ausente |
| **Datos largos reales** | Nombres largos, N filas | Fixtures de estrés + prod | Overflow/no-scroll roto en bordes |
| **Red lenta** | Skeleton/LCP/CLS percibidos | Throttling/Lighthouse | Percepción de performance no validada |
| **Lighthouse / CWV** | LCP/CLS/INP reales | Lighthouse CI/unlighthouse | Optimizar a ciegas |
| **Screenshots de producción** | Verdad visual vs local | Captura autenticada | Drift prod vs local no detectado |
| **Lector de pantalla** | VoiceOver/NVDA/TalkBack | Pase manual con AT | A11y robusta no garantizada |
| **Dispositivos reales** | Notch/safe-area/densidad | Matriz de devices | Bordes mobile no cubiertos |

---

## 38. Do Not Do — Anti-patrones visuales a evitar

- **No** rediseñar todo (dashboard/públicas) "de una".
- **No** mover masivamente `globals.css` antes de Fase 0/1 (riesgo de cascada).
- **No** cambiar tokens globales sin baseline de regresión + contrast audit.
- **No** introducir regresión visual + cross-browser + Storybook en un solo PR.
- **No** resolver el design system con una mega-abstracción.
- **No** romper contratos no-scroll por mejora estética.
- **No** mezclar cambios visuales y funcionales en el mismo PR.
- **No** usar screenshots manuales como sustituto de regression testing.
- **No** declarar excelencia visual sin WebKit/iOS.
- **No** usar "se ve lindo" como criterio de aceptación.
- **No** introducir `next/link`/`<a>` (navegación vía `PublicRouteControl`, memoria de hardening).
- **No** seguir agregando bloques `feature:start/end` al CSS global ni cards > 1k LOC: congelar ese patrón.

---

## 39. Codex/Claude Execution Contract

Para que un agente ejecute PRs visuales futuros con bajo riesgo, leyendo **este** documento como fuente.
**Cómo operar.** (1) Leer §1.2 (Control Panel) y §16 (PR plan). (2) Elegir **un** PR (el primero no cerrado del lote vigente;
ante duda, **PR-VIS-0**, luego lote 0). (3) Limitar el scope a los archivos del PR (§16.1); nada "de paso". (4) Aplicar §28
(validaciones del tipo) y §31 (evidencia). (5) Respetar §29 (autorización): si el PR la requiere y no está dada en el mismo
mensaje → **detenerse y pedirla** (listar archivos + riesgo). (6) Respetar §35 (No-Go) y §38 (Do Not Do). (7) Si Next modifica
`next-env.d.ts`, restaurarlo y repetir `pnpm test`. (8) **No** `git add/commit/push` ni `gh pr` (lo hace Nico).

**Salida obligatoria del agente:**
1. Hallazgo/PR elegido (ID). 2. Scope (incluido/excluido). 3. Archivos esperados. 4. Riesgos. 5. Tests. 6. Validaciones
ejecutadas + resultado real (ejecutado/pasó · ejecutado/falló · no ejecutado · script no disponible). 7. Confirmación de
restricciones respetadas. 8. Comandos manuales pendientes para Nico, **sin** ejecutarlos.

**Desviaciones:** si hay que salir de scope, detenerse, documentar motivo + archivos + riesgo y esperar autorización. No simular éxito ni ocultar fallos.

---

## 40. PR Prompt Templates (copiar / pegar)

**A — Docs/test-only visual (sin autorización):**
```
Repo: C:\PORTAL-VETNEB | Rama base: main (crear rama docs/* o test/*)
PR: <ID, p.ej. PR-VIS-0> | Objetivo: <1 línea>
Scope: SOLO docs/** y/o frontend/e2e/** (geometría). Excluido: frontend/src, backend, deps, CI.
Restricciones: protocolo VETNEB; no commit/push/PR; no tocar producción.
Validación: git diff --check ; git diff --name-only ; (si E2E) pnpm --dir frontend e2e:<capa>.
Si Next cambia next-env.d.ts: restaurarlo y repetir pnpm test.
Salida: resumen + archivos + validaciones reales + restricciones respetadas.
```

**B — Frontend visual implementation (cambio mínimo):**
```
Repo: C:\PORTAL-VETNEB | Rama base: main (crear rama feat/*|fix/*|refactor/*)
PR: <ID, p.ej. PR-VIS-2> | Objetivo: <causa raíz visual, 1 línea>
Scope exacto: <archivos>. Fuera de scope: <lista>. Sin rediseño; sin romper no-scroll.
Restricciones: sin deps/CI nuevos; protocolo VETNEB; no commit/push.
Tests: <E2E no-scroll/visual/a11y según tipo>.
Validación: pnpm --dir frontend typecheck ; lint ; build ; (público) pnpm security:public-surface.
Si Next cambia next-env.d.ts: restaurarlo y repetir pnpm test.
Salida: diff lógico + riesgos + validaciones reales + pendientes manuales.
```

**C — Tooling/CI/dependency visual con autorización (⚠):**
```
Repo: C:\PORTAL-VETNEB | Rama base: main
PR: <ID, p.ej. PR-VIS-9/10> | Objetivo: <1 línea> | AUTORIZACIÓN: <explícita aquí>
Scope: <playwright.config / workflow / package.json>. Una sola herramienta por PR.
Obligatorio: política de baseline/threshold (regresión) o matriz (cross-browser) + plan de rollback.
Restricciones: no exponer secretos; no commit/push/PR; baseline estable antes de activar gate.
Validación: §28 según tipo + gate global.
Salida: cambios + rollback + validaciones reales + riesgo residual.
```

---

## 41. Audit Maintenance Policy

- **Cuándo actualizar:** ante un evento invalidante (abajo) o al cerrar un PR del plan (marcar §22 "Cerrado", re-score §33, ajustar §34).
- **Eventos que la invalidan (revisar el área afectada):** cambios en CSS globales; nuevos dashboards; cambios de design tokens;
  cambios E2E/Playwright; nuevas dependencias visuales; cambios CI visuales; incidentes visuales en producción; cambios de marca;
  cambios mobile/PWA; cambios de performance visual.
- **Cómo cerrar un hallazgo:** PR mergeado con evidencia (§31) → estado "Cerrado" en §22 → nota en gap analysis (§10) → re-score (§33).
- **Cómo agregar un hallazgo:** ID estable siguiente (`VIS-Px-NNN`) + fila en §7/§8/§9 + §20 + §22; no romper la numeración existente.
- **Evitar drift:** este documento es la fuente del plan visual; los hallazgos cerrados se **marcan, no se borran** (trazabilidad).
  Conciliar con `docs/SOURCES_OF_TRUTH.md` y no contradecir `total-software-engineering-audit.md`.
- **Qué evidencia queda en el PR:** antes/después, E2E/axe/regresión según tipo (§31).
- **Quién la revisa:** Staff frontend + reviewer del área (§30); auditable por un tercero vía §19/§20/§37.

---

## 42. Internal Consistency Check

Verificación interna al cerrar este upgrade (auditable por un tercero):
- **Cada P1 tiene PR:** ✔ (001→PR-VIS-0 freeze+diferido · 002→PR-VIS-7 · 003→PR-VIS-1 · 004→PR-VIS-2 · 005→PR-VIS-6 · 006→PR-VIS-5 · 007→PR-VIS-8 · 008→PR-VIS-4). Ver §22.
- **Cada P2 tiene PR o justificación:** ✔ (001→PR-VIS-3 · 002→PR-VIS-3 · 003→PR-VIS-6 · 004→PR futuro nav `lg` · 005→PR-VIS-9 · 006→PR futuro marca · 007→PR-VIS-11 · 008→PR futuro docs mapping · 009→PR-VIS-11 · 010→PR-VIS-9).
- **Cada P0 tiene PR:** ✔ (001→PR-VIS-10 · 002→PR-VIS-9).
- **Autorizaciones marcadas:** ✔ coherentes entre §1.2, §16.1, §28 y §29 (⚠ deps/CI/tooling).
- **Primer PR inequívoco:** ✔ **PR-VIS-0** (§1.2, §16.3, §18.1) — único docs-only de máximo valor, sin autorización.
- **Conteo estable:** ✔ 2 P0 · 8 P1 · 10 P2 · 6 P3 = 26 (sin cambios respecto del diagnóstico original).
- **Estado del árbol expresado con precisión:** ✔ el front-matter aclara "limpio salvo este propio documento (modificado para el upgrade)".
- **Documento ya existente:** ✔ no se afirma "sin archivos nuevos"; PR-VIS-0 es edición del archivo existente (no creación).
- **Sin contradicciones** con `total-software-engineering-audit.md`: ✔ lo visual/CSS queda como soberanía de este documento; el software audit lo cita como complementario (#1192).

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
