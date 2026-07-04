# Global Dashboard Redesign — Engineering Audit

Audit-only artifact. No production code, CSS, tests, backend, API, auth, DB, dependencies, lockfiles or CI were modified for this document.

| Field | Value |
| --- | --- |
| Date | 2026-07-04 |
| Branch | main |
| HEAD | 2c0063e docs(audit): add dashboard technical data audits (#1284) |
| Working tree | Clean before this file |
| Mandatory sources | `docs/audit/datos tecnicos dashboard/dashboard-visual-component-taxonomy.md` (780 lines), `docs/audit/datos tecnicos dashboard/dashboard-visual-component-quantum-measurements.md` (13,746 lines, 220/220 route×viewport measurements) |
| Scope | Calculation of every dashboard render surface + one global visual system + fixed-viewport architecture + PR decomposition |
| Out of scope | Any implementation; backend/API/auth/DB/Supabase/deps/lockfiles/CI; `.claude/worktrees`; `origin/test/particular-authenticated-session-fixture` |

---

## 1. Executive Decision

**A global redesign is technically viable now, and it must be executed as a codification-and-remediation program, not a rebuild.**

The measured baseline is strong: 0 external-scroll failures across 220 route×viewport runs (quantum audit §7, §14), a working density-token layer (`--dash-*`, `globals.css:2112–2262`), a working deterministic pagination substrate (`usePagedRows`, `useAdaptiveItemsPerPage`), and 130 stable `data-*` contracts (102 with direct E2E/unit consumers). What is missing is not a shell — it is **one written, enforced global grammar** plus remediation of the measured offenders:

1. `.dashboard-inline-detail` at `/dashboard/informes`: 129.07% of viewport at 430×932, visible 0%–36.06% depending on viewport, internal scroll delta up to +1981px (quantum §8, §13).
2. `.dashboard-surface` at `/dashboard/logistica/metricas`: 759px tall inside a 740px viewport (visible 33.35% at 360×740; 109.43% viewport share at 375×667).
3. The full-route family (`/dashboard/informes`, `/dashboard/logistica/*`) diverges from the in-shell workspace grammar (96 of the 224 total clipped components live there).
4. The Particular authenticated surface (`/particulares`) is visually and structurally outside the dashboard grammar; its vertical viewport-fit is explicitly deferred (R-18 per `frontend/e2e/helpers/particular-session-contracts.ts:196–200`).

The architecture specification in the mission (§6) maps almost one-to-one onto primitives that already exist. The redesign is therefore: **extract the grammar into named tokens, enforce it on every surface, fix the four measured offenders, and extend it to Particular — in eight small PRs.**

---

## 2. Source Files Inspected

| Path | Reason inspected | Findings | Risk level |
| --- | --- | --- | --- |
| `docs/audit/datos tecnicos dashboard/dashboard-visual-component-taxonomy.md` | Mandatory source of truth (components, contracts) | 249 components, 130 `data-*` attrs, full layer taxonomy, risk map (§12) | N/A (docs) |
| `docs/audit/datos tecnicos dashboard/dashboard-visual-component-quantum-measurements.md` | Mandatory source of truth (runtime geometry) | 6,157 visible component measurements, 0 external scroll, 224 clipped, 157 internal scrolls; offender queue in §13 | N/A (docs) |
| `frontend/src/components/dashboard/DashboardShellRouter.tsx` | Shell root | `h-dvh overflow-hidden` shell + `min-h-0` frame + role bottom nav; surface via `useSelectedLayoutSegment` | Critical — E2E shell contracts |
| `frontend/src/components/dashboard/DashboardModuleWorkspace.tsx` | Workspace frame grammar | `min-h-0 flex-1` section, back button, `data-dashboard-module-viewport` | Critical — workspace contracts |
| `frontend/src/hooks/useAdaptiveItemsPerPage.ts` | Density/pagination engine | ResizeObserver + rAF-throttled remeasure + synchronous first measure; clamps min/max; already implements spec §2.2 lifecycle pattern (minus `devicePixelContentBoxSize`, not needed without canvas) | Medium |
| `frontend/src/components/dashboard/usePagedRows.ts` | Client pagination primitive | Deterministic in-memory pager, page clamped on dataset shrink; spec §C2 compliant | Medium |
| `frontend/src/app/globals.css` (targeted: 243–247, 714–999, 1120–1140, 2100–2340, 2407–2437, 3318+) | Visual system source | `--dash-*` fluid density tokens + 3 compact tiers (`max-height: 860/760/680`); `--admin-mobile-*` shell vars; `.dashboard-main` overflow-hidden contract; `contain: layout paint style` already used in `particular-*` blocks; `.dashboard-inline-scroll/detail` bounded-scroll contract; `--dash-accent-*` per-module accents | Critical — shared visual path |
| `frontend/src/app/dashboard/admin/AdminSessionsReadOnlyCard.tsx` (targeted) | Server-paginated card data flow | Client `offset/limit` state, refetch on every page change, no page cache; offset recomputed when effective limit changes | Medium |
| `frontend/src/lib/api.ts` (targeted) | Data-fetch layer for cache plan | Centralized `apiFetch`; no client caching keywords (`cache`/`no-store`/`revalidate`) — plain credentialed fetch | Medium |
| `frontend/src/components/public/ParticularesContent.tsx` (targeted) | Particular surface confirmation | Authenticated state gated on `getParticularSession()` → `GET /api/particular/auth/me` + `getParticularStudyTrackingCase()`; hooks `data-particulares-hero`, `data-particular-session-panel`, `data-particular-mobile-flat-card="tracking"/"report"` | High — public+auth mixed surface |
| `frontend/e2e/helpers/particular-session-contracts.ts` | Particular E2E contract | Cookie `particular_session_id`; horizontal no-scroll + forbidden-overflow invariants asserted today; **vertical 100dvh fit explicitly deferred to R-18** | Medium |
| `frontend/e2e/*` (56 dashboard-related specs, via scan) | Protected contract inventory | No-scroll, parity, stage isolation, mobile family, tokens/reports/clinics specs consume the 102 `data-*` hooks | Critical — regression net |

Additional verification: `grep` for `<canvas|getContext|devicePixelContentBoxSize` across `frontend/src` → **zero matches**. There are no canvas/SVG analytical rendering contexts in the dashboard today; SVG usage is icon-level only.

---

## 3. Render Surface Calculation

Composition legend: Shell = `DashboardShellRouter` (`data-vetneb-app-shell`, `h-dvh overflow-hidden`) → frame (`min-h-0 overflow-hidden`) → `DashboardTopbar` → `main.dashboard-main` (overflow-hidden) → `data-dashboard-module-stage` → hub or `DashboardModuleWorkspace` → module viewport. All 22 surfaces share this chain; full routes share shell+topbar+main but not the stage/workspace pair.

Measured chrome baseline (quantum §6, clinic hub, 360×740): topbar 65.78px; `dashboard-main` 623.83px; module stage 609.45px; bottom nav reservation ≈ 50.39px (740 − 689.61). Desktop chrome tokens: `--dash-header-h: 4.5rem` (72px), compact tiers 4rem / 3.6rem at `max-height: 760px / 680px`.

### 3.A Surface composition

| # | Route | Role | Module state | Entry | Hub/Workspace controller | Primary content blocks | Classification |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `/dashboard` | clinic | hub | `app/dashboard/page.tsx` | `ClinicDashboardWorkspaceController` → `ClinicDashboardCockpit` | Status band, 4 KPI chips, 5 module tiles, primary actions strip (desktop), signal rail | Role-specific hub on global shared shell |
| 2 | `/dashboard?module=operaciones` | clinic | workspace | same | Controller → `DashboardModuleWorkspace` → `ClinicCommandCenter` | KPI pills, attention/activity/continuity panels | Role-specific workspace |
| 3 | `/dashboard?module=informes` | clinic | workspace | same | → `ClinicInformesWorkspaceSummary` | FilterBar, table/mobile rows, pager, detail dialog | Role-specific workspace |
| 4 | `/dashboard?module=logistica` | clinic | workspace | same | → `ClinicLogisticaWorkspaceSummary` | List panel, rows, detail dialog | Role-specific workspace |
| 5 | `/dashboard?module=perfil` | clinic | workspace | same | → `ClinicPublicProfileCard` (+`PasswordChangePanel`) | Profile tabs, fields, toolbar/footer | Role-specific workspace |
| 6 | `/dashboard?module=tokens` | clinic | workspace | same | → `ClinicParticularTokensCard` | Toolbar, table/mobile list, future slots, pager, detail dialog | Role-specific workspace |
| 7 | `/dashboard/informes` | clinic | full route | `informes/page.tsx` | `InformesReportsList` (no stage/workspace) | FilterBar, inline master-detail list (`dashboard-inline-scroll` + `dashboard-inline-detail`), pager, timeline, file actions | Legacy/full-route extension |
| 8 | `/dashboard/logistica` | clinic | full route | `logistica/page.tsx` | `LogisticsCommandCenter` | KPI pills, recent rows, route links | Legacy/full-route extension |
| 9 | `/dashboard/logistica/visitas` | clinic | full route | `visitas/page.tsx` | table page | Metric cards, table, URL `offset/limit` pager | Legacy/full-route extension |
| 10 | `/dashboard/logistica/rutas` | clinic | full route | `rutas/page.tsx` | table page | Metric cards, table, URL pager | Legacy/full-route extension |
| 11 | `/dashboard/logistica/metricas` | clinic | full route | `metricas/page.tsx` | metrics page | Metric cards, SLA/route-plan table, URL pager | Legacy/full-route extension |
| 12 | `/dashboard/admin` | admin | hub | `admin/page.tsx` | `AdminDashboardWorkspaceController` → `DashboardModuleHub` + `DashboardHubHero`; mobile: `AdminMobileHubLauncher` (6 tiles/page) + `AdminMobileHubPager` | Hero (status/metrics/CTA), 10 dense module cards | Role-specific hub; mobile-only launcher adaptation |
| 13 | `?module=admin` | admin | workspace | same | → `AdminCommandCenter` / `AdminMobileCommandModule` + `ModuleTabs` | Summary metrics, alerts, quick links | Role-specific workspace |
| 14 | `?module=admin-clinics` | admin | workspace | same | → `AdminClinicsManagementCard` + `ClinicEditDrawer` | Filters, table / mobile cards (`data-admin-clinic-mobile-card`), pager, drawer | Role-specific workspace; mobile core family |
| 15 | `?module=admin-report-upload` | admin | workspace | same | → `AdminReportsCard` + `UploadReportModal` | Filters, workflow table / mobile list, pager, file actions | Role-specific workspace; mobile core family |
| 16 | `?module=admin-particular-tokens` | admin | workspace | same | → `AdminParticularTokensCard` | Filters, create flow, table / mobile list, pager, detail dialog | Role-specific workspace; mobile core family |
| 17 | `?module=admin-pricing` | admin | workspace | same | → `AdminPricingEditorCard` / `AdminMobilePricingModule` + `ModuleTabs` + `CompactPager` | Category tabs, item forms, save-all | Role-specific workspace; mobile config family |
| 18 | `?module=admin-sessions` | admin | workspace | same | → `AdminSessionsReadOnlyCard` | Stats grid, sessions table / mobile ops list, pager, revoke, password dialog | Role-specific workspace; mobile ops family |
| 19 | `?module=admin-users-roles` | admin | workspace | same | → `AdminUsersRolesReadOnlyCard` | Filters, fitted table / mobile ops list, role update, pager | Role-specific workspace; mobile ops family |
| 20 | `?module=audit-log` | admin | workspace | same | → `AdminAuditCard` (`AdminAuditDenseTable`, `AdminAuditFilterBar`, `AdminAuditDetailDialog`) / `AdminMobileAuditModule` | Filters, dense table, detail dialog, pager | Role-specific workspace; mobile ops family |
| 21 | `?module=admin-health` | admin | workspace | same | → `AdminSchemaHealthStatusCard` / `AdminMobileHealthModule` + `AdminMobileStatusModule` | Status panels, schema metrics, tabs | Role-specific workspace; mobile status family |
| 22 | `?module=admin-maintenance` | admin | workspace | same | → `AdminMaintenanceDryRunCard` / `AdminMobileMaintenanceModule` + `AdminMobileConfigModule` | Dry-run candidates list, schema section, compact pager | Role-specific workspace; mobile config family |

### 3.B Contracts, footprint and risk per surface

Footprint source column cites the quantum audit (Q§6 per-surface tables; Q§5 summary; Q§8 consumers; Q§13 queue).

| # | Route | CSS class contract (load-bearing) | `data-*` contract (load-bearing) | Viewport responsibility | Measured footprint source | No-scroll risk | Clipping risk | Density risk | Components likely causing clipping / surface consumption |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `/dashboard` | `dashboard-app-shell`, `dashboard-main`, `clinic-hub-*`, `dashboard-kpi-chip`, `dashboard-hub-band` | `data-vetneb-app-shell*`, `data-clinic-cockpit*`, `data-clinic-dashboard-stage`, `data-dashboard-module-hub` | Shell owns 100vh; cockpit content-hugging | Q§6 lines 89–763; stage 609px @360×740; hub 564px | Low (PASS ×10) | Low (3 clipped) | Medium — KPI chips 3/4 hidden on small mobile | Status band (134px) if KPI count grows |
| 2 | `?module=operaciones` | `dashboard-surface`, `dashboard-kpi-pill`, `dashboard-list-row` | `data-clinic-command-*`, `data-dashboard-module-workspace` | Workspace viewport bounded | Q§6 764–1218 | Low | Medium (6 clipped) | Medium | Attention/activity panels at 375×667 |
| 3 | `?module=informes` | `surface-muted`, filter classes | `data-clinic-reports-*`, `data-clinic-report-filter-bar` | Bounded list + pager | Q§6 1219–1663 | Low | Low | Medium — filter row height | Filter bar + table header stack |
| 4 | `?module=logistica` | `clinical-alert-warning` | `data-clinic-logistics-*` | Bounded list panel | Q§6 1664–2018 | Low | Low | Low | — |
| 5 | `?module=perfil` | `field-*`, `clinical-muted-band` | `data-clinic-profile-*`, `data-module-tabs` | Tabs bound form height | Q§6 2019–2463 | Low | Low | Medium — long forms rely on tabs | Fields group if tabs removed |
| 6 | `?module=tokens` | `surface-muted`, `clinical-pill` | `data-clinic-access-*` | Table/mobile list + pager | Q§6 2464–2798 | Low | Low | Medium | Future-slots block competes with rows |
| 7 | `/dashboard/informes` | `dashboard-master-panel`, `dashboard-inline-list/scroll/detail`, `dashboard-pagination-*` | `data-detail-state` | Inline detail expands inside bounded scroll | Q§6 2799–3093; **inline-detail h=1424 @430×932, 129.07% viewport, visible 0–36.06%; inline-scroll +1981 internal** | Low external / **High internal** | **High (21 clipped)** | High | `.dashboard-inline-detail` (dominant), `.dashboard-inline-scroll` |
| 8 | `/dashboard/logistica` | `dashboard-surface`, `dashboard-kpi-pill` | `data-tone` | Cards + rows in main | Q§6 3094–3448 | Low | **High (39 clipped)** | Medium | Stacked KPI cards + recent list on ≤375px |
| 9 | `/visitas` | `dashboard-metric-card`, `clinical-table-state` | — (URL pager) | Table page bounded by pager math | Q§6 3449–3723 | Low | High (20 clipped) | High | Metric card grid above table |
| 10 | `/rutas` | same | — | same | Q§6 3724–3998 | Low | Medium (8) | Medium | Metric cards |
| 11 | `/metricas` | `dashboard-surface`, `dashboard-metric-card` | — | same | Q§6 3999–4273; **surface h=759 @360×740, visible 33.35%; 109.43% @375×667** | Low external / High internal | **High (28 clipped)** | **High** | `.dashboard-surface` metrics stack (dominant) |
| 12 | `/dashboard/admin` | `dashboard-cockpit*`, `admin-mobile-hub-*`, `dashboard-card-interactive` | `data-dashboard-hub-*`, `data-dashboard-module-card`, `data-admin-mobile-hub-*` | Dense 10-card grid desktop; 6-tile paged launcher mobile | Q§6 4274–5108 | Low | Medium (8) | Medium — hero + 10 cards at 1024×768 | Hero panel + dense grid at short heights |
| 13–22 | `?module=admin*` | `dashboard-surface`, `dashboard-fitted-table`, `dashboard-table-*`, `admin-mobile-{core,ops,status,config}-*`, `field-*` | `data-dashboard-module-workspace`, `data-admin-mobile-{core,ops,status,config}-*`, module-specific attrs (taxonomy §9) | Workspace viewport + card-owned pagination | Q§6 5109–9907; ~5 internal / 8–10 clipped each | Low (PASS ×10 each) | Medium | Medium — filters+stats+table+pager stack | Filter bars + stats grids above tables at ≤768px |

### 3.C Particular user surface

**Particular dashboard route under `/dashboard/**`: NOT CONFIRMED IN REPO.** No route, controller, or shell surface exists for a particular role inside the private dashboard shell (`DashboardShellRouter` resolves only `admin` | `clinic`).

**Particular authenticated session surface: CONFIRMED**, but as a token-gated state of the public route `/particulares`:

| Property | Value |
| --- | --- |
| Route | `/particulares` (`frontend/src/app/particulares/page.tsx` → `ParticularesContent.tsx`) |
| Auth | Cookie `particular_session_id` (backend default `PARTICULAR_COOKIE_NAME`); client mount reads `GET /api/particular/auth/me` then `GET /api/particular/study-tracking/me` |
| Shell | `PublicLayout` (Navbar/Footer) — **not** the dashboard app shell |
| Content blocks | Hero (`data-particulares-hero`), session panel (`data-particular-session-panel`), summary/fields (`data-particular-session-summary/field`), tracking card (`data-particular-mobile-flat-card="tracking"`), report card (`…="report"`), actions (`data-particular-mobile-flat-actions`), notifications bell layer |
| CSS contract | `globals.css` blocks `particular-session-mobile-render-fix` (714–890) and `particular-mobile-flat-stack` (892–999), including `contain: layout paint style` isolation |
| E2E contract | `particular-authenticated-session-fixture.spec.ts` + `helpers/particular-session-contracts.ts`; asserts horizontal no-scroll + zero forbidden `overflow:auto/scroll` containers today; **vertical `100dvh` fit is the explicit target of a future R-18** |
| Measured footprint | Not covered by the quantum audit (out of its 22-route matrix) — must be measured in PR-GD-7 evidence |

---

## 4. Global Design System Proposal — "VETNEB Cockpit Grammar v2"

One grammar for Admin, Clinic and Particular. Role identity is expressed **only** through semantic accent tokens (`--dash-accent-*`) and content — never through divergent layout, radius, shadow or typography systems. Every rule below anchors to an existing class/token so enforcement is a codification pass, not a rewrite.

| Grammar | Rule (single global system) | Existing anchor |
| --- | --- | --- |
| Shell | One root: `h-dvh overflow-hidden` flex column → topbar → frame (`min-h-0`) → main (`overflow-hidden`) → bottom nav (mobile). No surface may opt out. | `DashboardShellRouter.tsx`, `.dashboard-main` (`globals.css:245`) |
| Background | Layered gradient + 88px grid texture on `main`; children above via `z-index:1`. Full routes and Particular adopt the same background stack (Particular via a scoped equivalent, not by joining the private shell). | `globals.css:1120–1135` |
| Topbar | Sticky-bounded app bar, `min-height: var(--dash-header-h)`; title/subtitle left, actions right; mobile admin app bar variant with kebab. Height participates in the viewport equation, never grows content-driven. | `DashboardTopbar.tsx`, `data-dashboard-topbar-polish` |
| Nav | Desktop: horizontal `?module=` nav with `aria-current`, hidden on mobile. Mobile: role bottom nav, fixed height token, safe-area padded. One nav model, two role instances. | `DashboardHorizontalNav.tsx`, `AdminMobileBottomNav.tsx`, `ClinicMobileBottomNav.tsx` |
| Hero/Cockpit | Hub = status band (dot + heading + KPI chips) + module grid + signal rail/hero. Admin hero and clinic status band are the same band grammar with different slots. | `DashboardHubHero.tsx`, `.dashboard-hub-band`, `.dashboard-kpi-chip` |
| Module grid | Dense auto-fit grid; tile count fixed per role (clinic 5, admin 10 desktop / 6-per-page mobile); tiles never wrap chrome out of viewport — grid height derives from `--dash-content-h` share. | `.dashboard-cockpit-grid`, `.clinic-hub-tile-grid`, `AdminMobileHubLauncher` |
| Module card | Icon slot (accented) + title + optional description + chevron; min tap target 44px; `truncate`/`line-clamp` mandatory. | `data-dashboard-module-card`, `.clinic-hub-tile-icon`, `.dashboard-card-interactive` |
| Workspace | `min-h-0 flex-1` section: header (back + title, single line, truncated) + `data-dashboard-module-viewport` child that owns 100% of the remainder. Full routes must adopt this same frame (PR-GD-4). | `DashboardModuleWorkspace.tsx` |
| Table/list | Desktop table + mobile row-variant pair, always inside a card that owns its pagination footer; row height = `--dash-row-h`; page size from `useAdaptiveItemsPerPage` or `usePagedRows`. No unbounded lists. | `.dashboard-fitted-table`, `.dashboard-table-responsive`, `data-*-mobile-list` |
| Form/action | `field-*` inputs, `--dash-control-h` control height; primary CTA right-aligned in toolbar or sticky action bar inside the module (never below the fold). | `.field-select`, `StickyActionBar`, `.dashboard-btn-interactive` |
| Modal/drawer | `ModuleDialog`/drawer with overlay, focus trap, bounded `max-height: calc(100dvh - 2*var(--dash-pad-y))`, internal scroll allowed only inside the dialog body. | `ModuleDialog.tsx`, `.clinical-modal`, `.dashboard-focus-trap-container` |
| Mobile bottom nav | Fixed items + "Más" overflow (admin) / 6 destinations (clinic); height token + `env(safe-area-inset-bottom)`; active state `aria-current`. | `--admin-mobile-bottom-nav-h` (`globals.css:2411`) |
| Status chip/badge | Tone-driven: `data-tone` / `data-status` maps to ok/warn/critical/neutral hues; chips = icon+label+value; badges = text only. No ad-hoc colored spans. | `.dashboard-status-dot[data-tone]`, `StatusBadge`, `.clinical-pill` |
| Density scale | The `--dash-*` fluid clamp tokens + compact tiers at `max-height: 860/760/680` are the **only** density mechanism. Components consume tokens; they never hardcode paddings that fight the tiers. | `globals.css:2112–2262` |
| Spacing scale | `--dash-pad-x/y`, `--dash-rhythm`, `--dash-gap`, `--dash-card-pad`, `--dash-list-pad-y` — nothing else for macro spacing. | same block |
| Typography | `dashboard-section-heading` / `dashboard-section-description` / `--dash-secondary-font`; scale steps only via compact tiers; no global font shrink. | `globals.css:2258–2260` |
| Icon treatment | lucide icons in accented icon slots (`27×27px measured`); icon-only buttons require `aria-label`. | `.dashboard-kpi-chip-icon`, `.clinic-hub-tile-icon` |
| Border/radius/shadow | One surface system: `dashboard-surface` (raised), `surface-soft`, `surface-muted`, `surface-empty` (dashed); shadows from the existing `clinical-shadow`/topbar values; radius stays at the current `rounded-lg` family. | taxonomy §8 primitives |
| Responsive | Width breakpoints for composition (mobile nav vs horizontal nav), height tiers for density. Mobile is a distinct composition (bottom nav + paged launchers + row-variants), never a scaled desktop. | `admin-mobile-*` blocks, `sm:`/`md:` usage |
| No-scroll | External scroll = failure everywhere. Internal scroll allowed only in: dialog bodies, `.dashboard-table-scroll` (horizontal, opt-in), and explicitly bounded list bodies that pass the "mathematically justified" test in §8. Everything else paginates. | `.dashboard-main` comment (`globals.css:243–247`) |
| Clipping prevention | Every flex/grid descendant chain must carry `min-w-0`/`min-h-0`; media/tables capped at `max-width:100%`; long values `overflow-wrap:break-word`. | `globals.css:2308–2325` |
| Content prioritization | Order inside any surface: status → primary metric/action → data → secondary signals. When height shrinks: drop descriptions first (`--dash-secondary-font` tier), then secondary chips (`display:none` tier), then reduce rows via adaptive page size. Never hide primary actions or module tiles. | KPI chip hide behavior measured at 360×740 (chips 3–4 `DISPLAY_NONE`) |

---

## 5. Fixed-Viewport Architecture (repo-adapted)

### 5.1 Canonical CSS variables (extends the existing `--dash-*` layer; no renames of existing tokens)

```css
.dashboard-app-shell {
  /* Existing (kept): --dash-header-h, --dash-pad-*, --dash-rhythm, --dash-gap,
     --dash-card-pad, --dash-panel-min, --dash-control-h, --dash-tab-h,
     --dash-cockpit-gap, --dash-list-pad-y, --dash-row-h, --dash-secondary-font */

  /* New canonical boundary tokens */
  --dash-viewport-h: 100dvh;
  --dash-bottom-nav-h: 0px;                          /* desktop default */
  --dash-page-header-h: clamp(1.5rem, 3.5vh, 2.5rem); /* hub-only page header */
  --dash-pagination-h: clamp(2rem, 4vh, 2.75rem);
  --dash-safe-bottom: env(safe-area-inset-bottom, 0px);

  /* Mathematical boundary allocation */
  --dash-content-h: calc(
    var(--dash-viewport-h)
    - var(--dash-header-h)
    - var(--dash-bottom-nav-h)
    - var(--dash-safe-bottom)
    - (2 * var(--dash-pad-y))
  );
  --dash-canvas-h: calc(var(--dash-content-h) - var(--dash-pagination-h));
}

@media (max-width: 767px) {
  .dashboard-app-shell {
    --dash-bottom-nav-h: var(--admin-mobile-bottom-nav-h, 3.25rem); /* role nav token */
  }
}
```

Cross-check against measured reality (360×740 clinic hub): 740 − 65.78 (topbar) − 50.39 (bottom nav) = 623.83px = measured `.dashboard-main` height exactly. The formula codifies what the flex chain already produces, so it can be introduced as documentation-grade tokens without changing rendering, then consumed incrementally.

### 5.2 Grid rows / columns

Shell (already flex; codified as explicit rows): `rows: auto minmax(0, 1fr) auto` → topbar / frame / bottom-nav. Workspace: `rows: auto minmax(0, 1fr)` → workspace header / module viewport. Card with pagination: `rows: auto auto minmax(0, 1fr) var(--dash-pagination-h)` → card header / toolbar+filters / bounded body / pager. Hub (desktop admin): `rows: auto minmax(0, 1fr)` with hero+grid sharing via `--dash-cockpit-gap`; columns `repeat(auto-fit, minmax(clamp(9.5rem, 18vw, 13rem), 1fr))`.

### 5.3 Height ledger

| Zone | Token | Desktop | Compact (≤760px h) | Mobile |
| --- | --- | --- | --- | --- |
| Header | `--dash-header-h` | 4.5rem | 4rem / 3.6rem (≤680) | measured 65.78px |
| Horizontal nav | inside header block (desktop only) | ≤ 2.5rem | ≤ 2.25rem | `display:none` (measured ZERO_RECT) |
| Page header (hub) | `--dash-page-header-h` | ≤ 2.5rem | ≤ 2rem | 26.58px measured |
| Workspace height | `--dash-content-h` | derived | derived | derived |
| Pagination | `--dash-pagination-h` | 2.75rem max | 2.25rem | 2rem |
| Content canvas | `--dash-canvas-h` | derived | derived | derived |
| Bottom nav reservation | `--dash-bottom-nav-h` + `--dash-safe-bottom` | 0 | 0 | ≈50.39px measured + safe-area |

### 5.4 Overflow and containment policy

- Overflow: `hidden` on shell, frame, main, stage, workspace, module surface. `auto` only on: dialog bodies, `.dashboard-table-scroll` (x), and justified bounded list bodies (§8). `overscroll-behavior: contain` mandatory on every internal scroller (already on `.dashboard-inline-scroll`).
- Containment: `contain: layout paint style` on module-level wrappers (stage, module surface, card bodies, mobile module frames) — precedent already in production for the `particular-*` blocks (`globals.css:720/801/898`). `contain: size` only where height is token-derived (pager-bound table bodies), never on content-hugging cockpit sections.

---

## 6. Reflow Isolation Plan

| Wrapper | Needs `contain`? | Type | `content-visibility` safe? | `min-h-0`/`min-w-0` status | Thrash risk notes |
| --- | --- | --- | --- | --- | --- |
| `.dashboard-app-shell` | No | — | No | n/a (root) | Root must stay uncontained: dialogs/overlays escape subtrees |
| `[data-vetneb-app-shell-frame]` | No | — | No | Present (`min-w-0 flex-1 overflow-hidden`) | — |
| `main.dashboard-main` | Yes | `layout` | No | Present (`min-h-0`) | Background gradient repaint is main-wide; `paint` unsafe (sticky topbar shadow overlaps) |
| `[data-dashboard-module-stage]` | Yes | `layout style` | No | Present (`min-height:0; min-width:0` via `globals.css:2217–2225`) | `paint` requires verifying no dialog is portaled inside stage; verify before adding |
| `DashboardModuleWorkspace` section | Yes | `layout style` | No | Present (`min-h-0 flex-1`) | Header truncation already bounds width |
| `[data-dashboard-module-viewport]` | Yes | `layout paint style` | No | Present (`min-h-0 min-w-0 flex-1`) | Prime isolation point: module data rewrites must not reflow chrome |
| `ModuleSurface` / card bodies | Yes | `layout paint style` | Only for paged-away table bodies (they are unmounted today, so N/A) | Present per taxonomy | Adaptive page-size remeasure loops guarded by rAF in hook |
| Hub grids (`.dashboard-cockpit-grid`, `.clinic-hub-tile-grid`) | Yes | `layout` | No | Verify `min-w-0` on tile children in PR-GD-2/3 | Tile label wrap is the main historical thrash source; `truncate` mandatory |
| Mobile module frames (`admin-mobile-*`, `ClinicMobileModuleFrame`) | Yes | `layout paint style` | No | Present per admin-mobile CSS | Already isolation-tested by `admin-mobile-module-layer-isolation.spec.ts` |
| Dialogs/drawers | No | — | No | Present | Must escape containment: never place `contain: paint` on their ancestors' overlay path |
| `.dashboard-inline-scroll` list body | Yes | `layout` | No (rows carry selection state) | Present | Internal scroller; `contain: paint` would clip the inline detail's focus ring — verify |

Nested grid/flex chains at risk of cascade (verify during PR-GD-4/5): filter bar → stats grid → table → pager stacks in admin cards (four sibling autos above a `1fr` body), and metric-card grids above tables in the logistics full routes.

---

## 7. Responsive Density Matrix

Coefficients are relative to the desktop baseline (typography 1.0 = current desktop scale; card density 1.0 = `--dash-card-pad` max). Chrome height = topbar + nav/bottom-nav + safe-area. Pass criterion applies to **both** role homes and every module of that role at that viewport.

| Viewport | Role(s) | Max module tiles visible | Max table rows | Max visible filters | Max visible actions | Type coeff. | Card density coeff. | Allowed chrome height | No-scroll pass criterion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 360×740 | clinic / admin | 5 (clinic, 1-col×5 or 2-col) / 6 paged (admin launcher) | 5–6 mobile rows | 1 row + drawer | 2 + overflow menu | 0.85 | 0.75 | ≤ 118px (65.78 + 50.39 measured) + safe-area | `scrollHeight == clientHeight == 740`; 0 forbidden scrollers |
| 375×667 | clinic / admin | 5 / 6 paged | 4–5 mobile rows | 1 + drawer | 2 + overflow | 0.85 | 0.70 | ≤ 118px + safe-area | delta 0 @667; worst-case height tier (≤680) active |
| 390×844 | clinic / admin / particular (PR-GD-7 target viewport) | 5 / 6 paged | 6 mobile rows | 1 + drawer | 2 + overflow | 0.90 | 0.80 | ≤ 120px + safe-area | delta 0 @844; particular: R-18 vertical fit |
| 412×915 | clinic / admin | 5 / 6 paged | 6–7 mobile rows | 1 + drawer | 3 | 0.90 | 0.80 | ≤ 120px + safe-area | delta 0 @915 |
| 430×932 | clinic / admin | 5 / 6 paged | 7 mobile rows | 1 + drawer | 3 | 0.90 | 0.85 | ≤ 122px + safe-area | delta 0 @932; informes inline-detail must not exceed viewport (today 129.07%) |
| 768×1024 | all | 5 / 10 (2-col grid ok) | 8–10 | 2 rows inline | 3–4 | 0.95 | 0.90 | ≤ 130px | delta 0 @1024; ≤ 20 clipped components today → target 0 primary-content clips |
| 1024×768 | all | 5 / 10 | 6–8 (short height) | 1 row inline | 4 | 0.95 | 0.85 (compact tier ≤860 active) | ≤ 122px | delta 0 @768; inline-detail today 113.18% → must be bounded |
| 1366×768 | all | 5 / 10 | 6–8 | 1 row inline | 4 | 0.95 | 0.85 | ≤ 122px | delta 0 @768; metricas surface today 79.83% visible → 100% |
| 1440×900 | all | 5 / 10 | 8–10 | 2 rows inline | 4+ | 1.00 | 1.00 | ≤ 136px (72 topbar + nav + margins) | delta 0 @900; 1 clipped today → 0 |
| 1920×1080 | all | 5 / 10 | 10–12 | 2 rows inline | 4+ | 1.00 | 1.00 | ≤ 136px | delta 0 @1080; inline-detail today 36.06% visible → 100% or dialog |

Density downscaling is programmatic: `useAdaptiveItemsPerPage` recomputes items from the measured container (`floor((h − header − gap) / rowHeight)`, clamped) on every `ResizeObserver` tick, which already realizes the N-max → N-min rule from the spec (§2.4). The matrix above fixes the clamps (min/max) per viewport class; the runtime measurement picks the exact value.

---

## 8. Pagination Matrix

Global rules: no infinite scroll anywhere (none exists today — keep it that way); page size recalculation preserves the first visible record by recomputing `offset = floor(firstIndex / newLimit) * newLimit` (pattern already implemented in `AdminSessionsReadOnlyCard.tsx:308–311`); selection is keyed by row id, not row index, so it survives page-size changes; network duplication is avoided by the page-memoization layer (§9) for server-paginated cards and is structurally impossible for `usePagedRows` (in-memory) surfaces.

| Surface (table/list) | Engine today | Default desktop | Default tablet | Default mobile | Min | Max | Recalc on viewport change |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Clinic informes summary (#3) | bounded list + pager | 8 | 6 | 4 | 3 | 12 | adaptive (container-measured) |
| Clinic tokens (#6) | table/mobile + pager | 8 | 6 | 4 | 3 | 12 | adaptive |
| Informes full route (#7) | `useAdaptiveItemsPerPage` + inline detail | measured | measured | measured | 3 | `INFORMES_LIMIT_CAP` | already adaptive; detail must become bounded (dialog ≤ md, capped inline ≥ lg) |
| Logística visitas/rutas/metricas (#9–11) | URL `offset/limit` server pager | 10 | 8 | 5 | 4 | 20 | recompute limit from height tier; clamp offset to preserve first record |
| Admin clinics (#14) | server-adaptive + mobile pager | 8 | 6 | 4 | 3 | 12 | adaptive |
| Admin reports (#15) | server-adaptive + mobile pager | 8 | 6 | 4 | 3 | 12 | adaptive |
| Admin tokens (#16) | server-adaptive + mobile pager | 8 | 6 | 4 | 3 | 12 | adaptive |
| Admin pricing catalog (#17) | `usePagedRows` + `CompactPager` (`CATALOG_PAGE_SIZE` mobile) | 10 | 8 | 6 | 4 | 14 | client-side reslice, instant |
| Admin sessions (#18) | client offset/limit vs server, hybrid cap | measured | measured | measured | 4 | superset cap in card | offset-preserving recompute (already implemented) |
| Admin users/roles (#19) | dense fitted table + pager | 10 | 8 | 5 | 4 | 14 | adaptive |
| Admin audit (#20) | dense table page size | 10–12 | 8 | 5 | 4 | 16 | adaptive |
| Admin maintenance candidates (#22) | `usePagedRows` + `CompactPager` | 8 | 6 | 4 | 3 | 10 | client-side reslice |
| Admin mobile hub launcher (#12) | fixed 6/page + `AdminMobileHubPager` | n/a | n/a | 6 | 6 | 6 | fixed by contract (E2E) |
| Admin mobile module menu | fixed 5/page | n/a | n/a | 5 | 5 | 5 | fixed by contract (E2E) |

Justified internal scrollers (the only ones): dialog/drawer bodies; `.dashboard-table-scroll` horizontal opt-in; `.dashboard-inline-scroll` **only** while PR-GD-5 converts the informes inline detail to a bounded pattern — after that its scroll delta must be ≤ one expanded detail height, not +1981px.

---

## 9. Cache and Memory Hygiene Plan (based on the real data flow)

Real flow confirmed: server components render initial data into module slots (`page.tsx`/`admin/page.tsx`); mutations go through server actions or `apiFetch`; interactive admin cards refetch with client `offset/limit` state on every page change (evidence: `AdminSessionsReadOnlyCard`); `frontend/src/lib/api.ts` has no caching layer; the only existing cache utility is `public-pricing-cache.ts` (public data). Client-paged surfaces (`usePagedRows`) never touch the network on page change.

| Item | Decision |
| --- | --- |
| Is LRU needed? | **Yes, narrowly**: only for server-paginated, read-only card fetches (sessions, users/roles, audit, clinics, reports, tokens lists). **No** for `usePagedRows` surfaces (already in-memory), server components (Next handles them), or anything mutated by the current user mid-view. |
| Where it lives | New pure utility `frontend/src/lib/dashboard-page-cache.ts` + thin hook `frontend/src/hooks/useCachedModulePages.ts`. Introduced in **PR-GD-5 only**, adopted card-by-card. Framework-decoupled per spec §3.2. |
| Key shape | `${surface}:${moduleId}:${serializedFilters}:${offset}:${limit}` — filters serialized in stable key order. |
| Invalidation | (a) any mutation in the same module (revoke/update/upload/create) clears that module's entries; (b) explicit refresh button clears module entries; (c) filter change changes the key (natural miss); (d) TTL 60s as staleness backstop for a 1,000-concurrent-session environment. |
| Max entries | 24 per module map (≈ current page ± adjacent pages across filter sets); global cap 96 entries; LRU eviction on insert. |
| Teardown | Module unmount (workspace swap) clears that module's map; logout path already clears last-module storage — extend teardown call there. |
| Object URLs | Report view/download flows (`ReportDownloadButton`) — audit in PR-GD-5 whether any `URL.createObjectURL` exists; if so, `revokeObjectURL` on unmount. NOT CONFIRMED as present — verify before writing code. |
| Event listeners | Controllers (`popstate`, hub-reset subscriptions) and menus (Escape handlers) already unsubscribe in effect cleanups per taxonomy; PR-GD-8 adds a leak assertion to the evidence run. |
| Observers | `useAdaptiveItemsPerPage` already disconnects its `ResizeObserver` and cancels pending rAF on cleanup (`useAdaptiveItemsPerPage.ts:134–139`). New observers must copy this exact pattern. |
| Timers/RAF | Notifications bell polling interval must clear on unmount (verify in PR-GD-8); rAF handles cancelled as above. |
| Sensitive data | Cache holds only what the card already renders; never persists (memory-only), never enters service worker or storage — preserves the "no private caching" invariant. |

Canvas/SVG observer module (spec §2.2): there are **no** canvas/SVG analytical contexts in the dashboard (verified: zero `getContext`/`<canvas>` matches). Do not inject canvas infrastructure. The reusable design when a real chart lands (most plausible: `/dashboard/logistica/metricas`): extend the existing `useAdaptiveItemsPerPage` observer pattern into a `useCanvasViewportSync` module that (1) observes the canvas parent, (2) reads `devicePixelContentBoxSize` (fallback `contentRect × devicePixelRatio`), (3) syncs `canvas.width/height` to the hardware pixel size before draw, and (4) schedules redraw through the same single-rAF throttle. It ships only in the same PR that ships the first real chart.

---

## 10. Global PR Decomposition

Every PR: one branch from updated `main`, audit-first diff review, PNPM validation, visual evidence per §13, and Nico performs all git add/commit/push/PR/merge steps manually.

**PR-GD-1 — Shared fixed-viewport layout substrate (tokens + containment)**
- Scope: add `--dash-viewport-h`, `--dash-bottom-nav-h`, `--dash-page-header-h`, `--dash-pagination-h`, `--dash-safe-bottom`, `--dash-content-h`, `--dash-canvas-h` to the existing `.dashboard-app-shell` token block; add `contain: layout`/`layout style` to `dashboard-main`/stage per §6 (only the rows marked safe); document the ledger in `docs/implementation/`.
- Files: `frontend/src/app/globals.css` (append-only inside the `dashboard-viewport-zoom-adaptability` layer), one docs file.
- Non-scope: no component edits, no className changes, no `data-*` changes, no visual delta expected (tokens are definitional).
- Risk: Low — additive CSS custom properties; containment additions are the only behavior-capable change and are limited to §6 "safe" rows.
- Validation: `pnpm --dir frontend lint`, `typecheck`, `build`; full no-scroll E2E family; visual regression specs.
- Evidence: before/after DOMRect capture of shell chain at 360×740, 1366×768, 1440×900; scroll deltas all 0.

**PR-GD-2 — Admin dashboard hub redesign (grammar enforcement)**
- Scope: align `DashboardHubHero` + `DashboardModuleHub` dense grid to the band/grid grammar (§4); tile `min-w-0`+truncation audit; hero height participates in `--dash-content-h` share; 1024×768/short-height polish.
- Files: `DashboardHubHero.tsx`, `DashboardModuleHub.tsx`, scoped CSS additions.
- Non-scope: `AdminMobileHubLauncher`/pager (locked 6-per-page contract), bottom nav, workspaces.
- Risk: Medium — `data-dashboard-hub-*`/`data-dashboard-module-card` are wide E2E contracts; attributes and aria-labels must not change.
- Validation: hub hero unit test, card navigation, accessibility, admin hub no-scroll specs.

**PR-GD-3 — Clinic dashboard hub redesign (grammar parity)**
- Scope: cockpit status band/KPI chips/tile grid/signal rail brought to the identical band grammar; KPI chip visibility tiers made token-driven instead of hidden count.
- Files: `ClinicDashboardWorkspaceController.tsx` (cockpit render only, not controller state), scoped CSS.
- Non-scope: controller navigation/state machine (pending activation, hub reset, URL sync), `ClinicMobileBottomNav`.
- Risk: Medium-high — same file hosts the state machine; diff must be surgical to the cockpit JSX.
- Validation: clinic controller specs, card-navigation-shell, module state parity, hub hero.

**PR-GD-4 — Shared module workspace grammar (incl. full-route adoption)**
- Scope: full routes (`/dashboard/informes`, `/dashboard/logistica`, `/visitas`, `/rutas`, `/metricas`) adopt the workspace frame grammar (header + bounded viewport + card-owned pager); metric-card stacks become single compact metric strips at ≤768px (fixes the 759px `dashboard-surface` at 360×740).
- Files: the five full-route `page.tsx` files, `LogisticsCommandCenter.tsx`, scoped CSS.
- Non-scope: in-shell workspaces, controllers, `DashboardModuleWorkspace.tsx` API.
- Risk: Medium — full-route adaptive E2E specs pin selectors; keep `dashboard-main`, metric card classes, pager URLs.
- Validation: `dashboard-logistica-*-full-route-adaptive` specs, informes server-adaptive pagination spec.

**PR-GD-5 — Tables/lists/pagination density engine + page cache**
- Scope: apply the §8 matrix clamps to each card; convert informes inline detail to bounded pattern (dialog ≤ md — pattern already exists as masked master-detail; capped inline ≥ lg); introduce `dashboard-page-cache.ts` + hook, adopt in sessions/users/audit first.
- Files: `InformesReportsList.tsx`, `informes.constants.ts`, admin read-only cards, new lib/hook files, scoped CSS.
- Non-scope: server actions, API payloads, upload/mutation flows.
- Risk: Medium-high — largest behavioral PR; may be split per card family if diff exceeds review size.
- Validation: masked master-detail spec, fixture-pagination specs, workspace-1000/5000 stress specs, unit tests for cache (new).

**PR-GD-6 — Mobile dashboard system pass**
- Scope: unify the three admin mobile families (core/ops/status-config) and clinic mobile frames on the §7 mobile matrix; safe-area and chrome-height assertions tokenized.
- Files: `admin-mobile-*` CSS blocks (additive), mobile module components as needed.
- Non-scope: bottom navs' item sets, hub launcher page size (6), module menu page size (5) — all E2E-locked.
- Risk: Medium — nine admin-mobile no-scroll spec families guard this exactly.
- Validation: all `admin-mobile-*` specs + clinic mobile parity specs at 360×740/390×844/412×915.

**PR-GD-7 — Particular surface integration (confirmed as `/particulares` authenticated state)**
- Scope: bring the authenticated session panel (session summary, tracking card, report card, actions) to the global grammar via scoped tokens (surface/status/typography parity); deliver the R-18 vertical viewport-fit for the authenticated state at 390×844.
- Files: `ParticularesContent.tsx`, `particular-*` CSS blocks.
- Non-scope: public marketing sections of `/particulares`, auth flow, cookies, `/api/particular/*`, moving Particular into the private shell (it stays a public-route session surface).
- Risk: Medium — mobile render-fix CSS is defensive (GPU/compositing workarounds); regression on real devices must be visually verified.
- Validation: `particular-authenticated-session-fixture.spec.ts` extended with the vertical fit assertion; public-routes overflow specs.

**PR-GD-8 — Runtime measurement and regression evidence**
- Scope: re-run the quantum measurement protocol on the same 22 routes × 10 viewports (+ `/particulares` authenticated), produce the after-tables (no-scroll, clipping, internal scroll, largest consumers), diff against the baseline audit; add leak assertions (observer/timer counts) to the evidence run.
- Files: docs only (`docs/audit/datos tecnicos dashboard/`), optional measurement script under `frontend/e2e/fixtures` if the team approves persisting it.
- Non-scope: any production code.
- Risk: Low.
- Validation: measurement completeness 220+/220+; acceptance criteria §12 checked line by line.

Ordering: PR-GD-1 → (2,3 parallel) → 4 → 5 → 6 → 7 → 8. Each PR is independently shippable and revertible.

---

## 11. Implementation Guardrails (must-not-touch per PR)

All PRs: no backend (`server/`), no API routes/payloads, no auth/session/cookie names, no DB/Supabase, no dependencies, no `pnpm-lock.yaml`, no `.github/workflows`, no `.claude/worktrees`, no `origin/test/particular-authenticated-session-fixture`, no deletion/renaming of any of the 130 `data-*` attributes, no edits to pinned `@apply` className contracts flagged by taxonomy §12, no E2E selector weakening, no test deletion.

| PR | Additional frozen files/contracts |
| --- | --- |
| GD-1 | All `.tsx`; existing CSS rules (append-only); `dashboard-single-viewport-app-shell` / `dashboard-no-scroll-cockpit` locked strings |
| GD-2 | `AdminDashboardWorkspaceController.tsx`; `AdminMobileHubLauncher/Pager/Tile`; `AdminMobileBottomNav.tsx`; `DashboardTopbar.tsx` |
| GD-3 | Controller state machine sections of `ClinicDashboardWorkspaceController.tsx`; `ClinicMobileBottomNav.tsx`; `clinic-hub-reset` lib |
| GD-4 | `DashboardModuleWorkspace.tsx`; all in-shell workspace components; `informes.actions.ts` |
| GD-5 | Server actions; `UploadReportModal.tsx`; `ClinicEditDrawer.tsx` mutation logic; `api.ts` transport behavior |
| GD-6 | Bottom nav item sets; launcher/menu page sizes (6/5); kebab menu actions; safe-area attribute names |
| GD-7 | `/api/particular/*` client functions' contracts; public sections of `/particulares`; `PublicLayout` |
| GD-8 | Everything productive |

---

## 12. Acceptance Criteria (global)

1. External scroll delta = 0 at every dashboard home and module across the 10-viewport matrix (maintains today's 220/220 PASS).
2. Internal scroll only in dialog bodies, `.dashboard-table-scroll`, and §8-justified bounded lists; informes inline scroll delta bounded to ≤ one detail height.
3. Zero clipped primary-content components (baseline: 224 clipped incl. inline-detail at 0% visible and metricas surface at 33.35% visible — both must reach 100% visible or become explicitly bounded/paginated).
4. All primary actions visible without scroll at all matrix viewports.
5. One visual grammar across Admin, Clinic and Particular; role differences only via `--dash-accent-*` and content.
6. Mobile is composition-specific (bottom nav, paged launchers, row variants) — never compressed desktop.
7. Desktop keeps cockpit hierarchy: status → KPIs → modules → signals.
8. All 130 `data-*` attributes and the 102 direct E2E/unit consumers unchanged and green.
9. Route/module transitions remain deterministic (pending-activation buffer, navigation-intent guard, last-module persistence untouched).
10. Frame budget respected: transitions and page-size recalcs stay on the single-rAF throttle path; no synchronous layout loops introduced (spec §C3).
11. No new dependencies; no backend/API/auth/DB changes; no lockfile/CI churn.
12. Page-cache layer memory-bounded (≤96 entries), memory-only, cleared on module teardown and logout.

---

## 13. Required Evidence (per implementation PR)

- Before/after screenshots at minimum 360×740, 390×844, 768×1024, 1366×768, 1440×900 (viewport dimensions stated on each capture).
- DOMRect measurements of the touched surface chain (same method as quantum audit §3: `getBoundingClientRect`, visible-area intersection).
- Scroll deltas: `documentElement/body scrollHeight − clientHeight` = 0, plus internal deltas of every scroller in scope.
- Clipping report: visible% for every component the PR touches (target 100% or documented bounded contract).
- Affected route list and unchanged-contract statement (`data-*` inventory diff = empty).
- Tests run: `pnpm --dir frontend lint`, `pnpm --dir frontend typecheck`, `pnpm --dir frontend build`, plus the E2E families named in each PR's validation row (§10).

---

## 14. Final Recommendation

**Implement now, starting strictly with PR-GD-1 (substrate), then execute PR-GD-2 through PR-GD-8 in order.** Do not merge any hub/workspace redesign PR before the substrate tokens exist, and do not combine PRs. The two highest-value remediation targets after the substrate are the informes inline-detail bound (PR-GD-5) and the logistics-metricas surface compaction (PR-GD-4) — both are measured, bounded, and testable. The Particular surface is confirmed and integrable without touching auth or its public-route placement (PR-GD-7). No blocker exists; the risk is review-size discipline, which the PR decomposition controls.


---

# PART II — Pixel-Surface Utilization, Density, Pagination and Screenshot Evidence (Addendum)

Audit/advisory only. Screenshots in `global-dashboard-redesign-screenshot-evidence/` are **evidence of the current state (`before`)**; they do not imply any implementation occurred. No production code, CSS, tests, backend, API, auth, DB, dependencies, lockfiles or CI were modified.

## 15. Runtime Baseline (Part II)

| Field | Value |
| --- | --- |
| Date | 2026-07-04 |
| Branch / HEAD | main / 2c0063e (clean before this addendum) |
| Frontend runtime | `pnpm --dir frontend dev --hostname 127.0.0.1` → http://127.0.0.1:3000 (`NEXT_PUBLIC_API_URL=http://127.0.0.1:3107`) |
| API fixture | `node e2e/fixtures/admin-populated-api-server.mjs` → http://127.0.0.1:3107 (same protocol as the quantum audit) |
| Sessions | `app_session_id=e2e_populated_clinic_session`; `admin_session_id=e2e_populated_admin_session`; `particular_session_id=e2e_test_particular_session` + route-level mocks of `GET /api/particular/auth/me` and `GET /api/particular/study-tracking/me` (mirrors `frontend/e2e/helpers/particular-session-contracts.ts`) |
| Browser | Chromium via `@playwright/test`, `deviceScaleFactor=1` |
| Surfaces × viewports | 23 surfaces (22 dashboard routes + `/particulares` authenticated) × 10 viewports = 230/230 measured |
| Screenshots | 78 PNG captured (every surface at 390×844, 1366×768, 1440×900 + offender extras) |
| Tooling | Temporary Node/Playwright script run from outside the repo (scratchpad); deleted after completion; nothing added to the repo except this document and the evidence folder |

## 16. Measurement Method and Accuracy

Each route loaded with its role session cookie, waited for its ready selector, network idle (best effort) and a 1250 ms settle (same discipline as the quantum audit §3). Then:

1. **100% pixel accounting by point sampling.** The viewport is sampled on an 8 px grid (one sample = 64 px²). Every sample point is assigned to exactly **one** region by priority: pagination → filters → toolbars/actions → list/table → module cards/tiles → hero/cockpit (incl. KPI chips, signals, status band) → panels/surfaces → page/workspace headers → main free space → topbar → horizontal nav → bottom nav → shell structural gap → outside shell. Because every point is classified exactly once, the accounted percentage is 100.0% by construction (sampling accuracy ±~1.5% per region; totals exact).
2. **Scroll deltas** from `documentElement`/`body` scroll vs client sizes (vertical and horizontal).
3. **Overflow px²** = Σ (scrollHeight − clientHeight) × clientWidth over every element with computed `overflow: auto|scroll` and a real delta (internal scroll debt).
4. **Clipped px²** = Σ (full DOMRect area − viewport-visible area) over the leaf/offender component set.
5. **Pagination compliance** probed per candidate control: prev/next button detection (Anterior/Siguiente/aria), page-status text (`X / Y`, `Pág.`), full visibility inside the viewport, and horizontal center offset of the control container vs `main`.
6. **Row census**: unique visible row elements (mobile rows, table rows, list rows) and median row height.
7. **Font probes** (390×844 and 1440×900) and **column geometry** (1440×900) per §22/§25.

Known limits: sampling grid cannot attribute sub-8px slivers; the center-offset probe measures the pagination **container** (full-width footers report offset 0 even when the control cluster is right-aligned inside — screenshot evidence is authoritative for cluster alignment, see §24); closed drawers/menus/dialogs are unmounted and not measured.

## 17. Device Matrix — Exact Surface, Chrome and Safe Density

Measured averages across the 23 surfaces per viewport (chrome = topbar + horizontal nav + bottom nav + shell structural gap; canvas = main area). Safe density derived from measured component metrics: dense desktop row 36 px (12–13 px font / 16–19.5 px line), mobile touch row 44 px, card header ≈ 64 px, filter row ≈ 48 px, pagination reserve ≈ 44 px, module tile min 86 px (icon 44 + label 24 + padding), minimum readable font 12 px (11 px found once — see §22).

| Viewport | Total px² | Avg chrome px² | Avg usable canvas px² | Topbar h (median) | Bottom nav h | Max safe table rows (dense/touch) | Max safe module tiles | Max safe visible actions | Min readable font | Min card h | Max card h before waste |
| --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 360×740 | 266,400 | 30,575 | 234,385 | 65.0 | 50.4 | 10 / 8 | 6 | 2 + overflow | 12 px | 40 px | 96 px |
| 375×667 | 250,125 | 32,031 | 217,633 | 65.0 | 50.4 | 9 / 7 | 6 | 2 + overflow | 12 px | 40 px | 96 px |
| 390×844 | 329,160 | 33,909 | 295,371 | 53.0 | 50.4 | 13 / 10 | 6 | 3 | 12 px | 40 px | 96 px |
| 412×915 | 376,980 | 36,085 | 336,011 | 53.0 | 50.4 | 14 / 11 | 6–8 | 3 | 12 px | 40 px | 96 px |
| 430×932 | 400,760 | 38,244 | 362,652 | 53.0 | 50.4 | 15 / 12 | 6–8 | 3 | 12 px | 40 px | 104 px |
| 768×1024 | 786,432 | 72,659 | 713,773 | 92.3 | 0 | 20 / 16 | 10 | 4 | 12 px | 40 px | 112 px |
| 1024×768 | 786,432 | 96,879 | 689,553 | 92.3 | 0 | 13 / 10 | 10 | 4 | 12 px | 36 px | 112 px |
| 1366×768 | 1,049,088 | 129,425 | 921,199 | 92.3 | 0 | 13 / 10 | 10 | 5 | 12 px | 36 px | 120 px |
| 1440×900 | 1,296,000 | 136,237 | 1,154,003 | 92.3 | 0 | 17 / 13 | 10 | 5 | 12 px | 36 px | 131 px |
| 1920×1080 | 2,073,600 | 181,649 | 1,891,951 | 92.3 | 0 | 21 / 17 | 10–12 | 6 | 12 px | 36 px | 131 px |

Max safe rows formula: `floor((canvas_h − card_header 64 − filters 48 − pagination 44) / row_h)` with `canvas_h = viewport_h − topbar − bottom_nav − 2·pad_y`. Measured reality vs capability: the best surface today shows 14 rows (audit-log mobile @390) and 9 rows desktop — desktop capability is 17–21 rows. That gap is quantified per surface in §23.

## 18. Fixture Data Coverage Caveats (honest scope of Part II numbers)

| Surface | Caveat | Evidence |
| --- | --- | --- |
| `?module=admin-sessions` | Fixture answers "E2E fixture route not found" for the sessions read — the card renders its error/empty state. Rows=0 is a **fixture gap**, not a UI defect. Density verdicts for sessions are deferred. | `admin__dashboard-admin-module-admin-sessions__1440x900__before.png` |
| `?module=tokens` (clinic) | Card renders "E2E populated session required" + empty state; pager not rendered (pagers mount only with data). This also caused the two initial measurement retries at 360×740/375×667. | `clinic__dashboard-module-tokens__1440x900__before.png` |
| `?module=admin-clinics` | Table renders 1 tall row with populated fixture; pager not detected by probe. Pagination verdict deferred to implementation-PR verification. | `admin__dashboard-admin-module-admin-clinics__1440x900__before.png` |
| Logistics full routes | Fixture cardinality is small (2 visitas / 2 rutas per hub KPIs), so rows=3 partially reflects data, not page-size caps. Waste percentages remain valid (empty area is empty regardless of cause); row-capacity targets in §23 assume production-scale data. |
| All | Same limitation class as quantum audit §12: closed overlays unmounted; dynamic data changes density. |

## 19. Density and Proportionality Method

For each component probe (§22): `minimum_content_height = title_line_height + subtitle/metadata_line_heights_if_present + action_height_if_present + vertical_padding + separator_allowance`. `density_surplus_px = actual_height − minimum_content_height`. Classification: COMPACT_VALID (surplus ≤ 8 px), DENSITY_BALANCED (≤ 24 px), OVEREXPANDED (> 24 px), UNDERREADABLE (any font < 12 px or tap target < 44 px on touch), CLIPPED (visible area < full area).

## 20. Region Taxonomy Used by the Ledger

`Shell` = everything inside `.dashboard-app-shell` (for `/particulares`: the document). `Main` = `main.dashboard-main` area = hero/cockpit + module/card + list/table + toolbars/filters/headers + pagination + **unused (main free)**. `Unused` column = main free space + shell structural gap + any area outside the shell. `Module/card` = module tiles + bounded panels/surfaces. `Clipped`/`Overflow` per §16.3–4. Every px² in the table is measured, none is estimated.

## 21. Pixel Surface Ledger — 100% Accounting, 230/230 Route×Viewport Cells

Accounted % is 100.0 by construction of the point classifier (§16.1); each row's regions sum exactly to the viewport total. Intentional empty area that is justified: the `--dash-pad-*`/`--dash-rhythm` frame insets and inter-panel gaps (≈6–9% on module workspaces — the healthy baseline). Everything above that baseline is classified as visual/operational debt in §23.

Headline totals: external scroll failures 10/230 (all on `/particulares` authenticated — §27); horizontal scroll failures 0/230 at document level (but internal horizontal table scroll exists on logistics tables — §25/§27); worst unused: `admin-health` 74.7% @1920×1080; worst clipped: informes inline detail 945,404 px² @1366×768; worst internal overflow: informes inline scroll 1,452,000 px² @1920×1080.

| Route | Viewport | Total px² | Shell px² | Topbar px² | Nav px² | Bottom nav px² | Main px² | Hero/cockpit px² | Module/card px² | List/table px² | Toolbars/filters/headers px² | Pagination px² | Unused px² | Clipped px² | Overflow px² | Accounted % |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| /dashboard | 360x740 | 266400 | 264960 | 23040 | 0 | 17280 | 224640 | 112832 | 40960 | 0 | 8256 | 0 | 62592 | 0 | 0 | 99.5 |
| /dashboard | 375x667 | 250125 | 249664 | 24064 | 0 | 18048 | 207552 | 106368 | 37632 | 0 | 8640 | 0 | 54912 | 0 | 0 | 99.8 |
| /dashboard | 390x844 | 329160 | 329280 | 21952 | 0 | 18816 | 288512 | 126336 | 43648 | 0 | 9024 | 0 | 109504 | 0 | 0 | 100.0 |
| /dashboard | 412x915 | 376980 | 372096 | 22848 | 0 | 19584 | 329664 | 131200 | 47104 | 0 | 9600 | 0 | 141760 | 0 | 0 | 98.7 |
| /dashboard | 430x932 | 400760 | 400896 | 24192 | 0 | 20736 | 355968 | 136448 | 49984 | 0 | 9984 | 0 | 159552 | 0 | 0 | 100.0 |
| /dashboard | 768x1024 | 786432 | 786432 | 73728 | 0 | 0 | 712704 | 170752 | 93760 | 0 | 81792 | 0 | 366400 | 0 | 0 | 100.0 |
| /dashboard | 1024x768 | 786432 | 786432 | 98304 | 0 | 0 | 688128 | 225664 | 79296 | 0 | 117504 | 0 | 265664 | 0 | 0 | 100.0 |
| /dashboard | 1366x768 | 1049088 | 1050624 | 131328 | 0 | 0 | 919296 | 281472 | 107520 | 0 | 126080 | 0 | 404224 | 0 | 0 | 100.1 |
| /dashboard | 1440x900 | 1296000 | 1290240 | 138240 | 0 | 0 | 1152000 | 257664 | 74816 | 0 | 132864 | 0 | 686656 | 0 | 0 | 99.6 |
| /dashboard | 1920x1080 | 2073600 | 2073600 | 184320 | 0 | 0 | 1889280 | 309248 | 86464 | 0 | 160512 | 0 | 1333056 | 0 | 0 | 100.0 |
| /dashboard?module=operaciones | 360x740 | 266400 | 264960 | 23040 | 0 | 768 | 241152 | 0 | 151360 | 0 | 71552 | 0 | 18240 | 45061 | 0 | 99.5 |
| /dashboard?module=operaciones | 375x667 | 250125 | 249664 | 24064 | 0 | 3648 | 221952 | 0 | 132480 | 0 | 69120 | 0 | 20352 | 60224 | 0 | 99.8 |
| /dashboard?module=operaciones | 390x844 | 329160 | 329280 | 21952 | 0 | 768 | 306560 | 0 | 213568 | 0 | 72192 | 0 | 20800 | 0 | 0 | 100.0 |
| /dashboard?module=operaciones | 412x915 | 376980 | 372096 | 22848 | 0 | 19584 | 329664 | 0 | 233600 | 0 | 76800 | 0 | 19264 | 0 | 0 | 98.7 |
| /dashboard?module=operaciones | 430x932 | 400760 | 400896 | 24192 | 0 | 20736 | 355968 | 0 | 249600 | 0 | 79872 | 0 | 26496 | 0 | 0 | 100.0 |
| /dashboard?module=operaciones | 768x1024 | 786432 | 786432 | 73728 | 0 | 0 | 712704 | 0 | 524032 | 0 | 129536 | 0 | 59136 | 0 | 0 | 100.0 |
| /dashboard?module=operaciones | 1024x768 | 786432 | 786432 | 98304 | 0 | 0 | 688128 | 0 | 507904 | 0 | 119040 | 0 | 61184 | 0 | 0 | 100.0 |
| /dashboard?module=operaciones | 1366x768 | 1049088 | 1050624 | 131328 | 0 | 0 | 919296 | 0 | 665280 | 0 | 158400 | 0 | 95616 | 0 | 0 | 100.1 |
| /dashboard?module=operaciones | 1440x900 | 1296000 | 1290240 | 138240 | 0 | 0 | 1152000 | 0 | 879744 | 0 | 178176 | 0 | 94080 | 0 | 0 | 99.6 |
| /dashboard?module=operaciones | 1920x1080 | 2073600 | 2073600 | 184320 | 0 | 0 | 1889280 | 0 | 1512576 | 0 | 239616 | 0 | 137088 | 0 | 0 | 100.0 |
| /dashboard?module=informes | 360x740 | 266400 | 264960 | 23040 | 0 | 17280 | 224640 | 0 | 2752 | 134848 | 49536 | 16512 | 20992 | 0 | 0 | 99.5 |
| /dashboard?module=informes | 375x667 | 250125 | 249664 | 24064 | 0 | 18048 | 207552 | 0 | 2880 | 118080 | 48960 | 17280 | 20352 | 0 | 0 | 99.8 |
| /dashboard?module=informes | 390x844 | 329160 | 329280 | 21952 | 0 | 18816 | 288512 | 0 | 3008 | 192512 | 51136 | 18048 | 23808 | 0 | 0 | 100.0 |
| /dashboard?module=informes | 412x915 | 376980 | 372096 | 22848 | 0 | 19584 | 329664 | 0 | 3200 | 233984 | 54400 | 18816 | 19264 | 0 | 0 | 98.7 |
| /dashboard?module=informes | 430x932 | 400760 | 400896 | 24192 | 0 | 20736 | 355968 | 0 | 3328 | 249600 | 56576 | 19968 | 26496 | 0 | 0 | 100.0 |
| /dashboard?module=informes | 768x1024 | 786432 | 786432 | 73728 | 0 | 0 | 712704 | 0 | 11776 | 435712 | 170752 | 35328 | 59136 | 0 | 0 | 100.0 |
| /dashboard?module=informes | 1024x768 | 786432 | 786432 | 98304 | 0 | 0 | 688128 | 0 | 7936 | 436480 | 134912 | 47616 | 61184 | 0 | 0 | 100.0 |
| /dashboard?module=informes | 1366x768 | 1049088 | 1050624 | 131328 | 0 | 0 | 919296 | 0 | 10560 | 570240 | 179520 | 63360 | 95616 | 0 | 0 | 100.1 |
| /dashboard?module=informes | 1440x900 | 1296000 | 1290240 | 138240 | 0 | 0 | 1152000 | 0 | 11136 | 779520 | 200448 | 66816 | 94080 | 0 | 0 | 99.6 |
| /dashboard?module=informes | 1920x1080 | 2073600 | 2073600 | 184320 | 0 | 0 | 1889280 | 0 | 29952 | 1362816 | 254592 | 104832 | 137088 | 0 | 0 | 100.0 |
| /dashboard?module=logistica | 360x740 | 266400 | 264960 | 23040 | 0 | 17280 | 224640 | 0 | 2752 | 151360 | 49536 | 0 | 20992 | 0 | 0 | 99.5 |
| /dashboard?module=logistica | 375x667 | 250125 | 249664 | 24064 | 0 | 18048 | 207552 | 0 | 2880 | 135360 | 48960 | 0 | 20352 | 0 | 0 | 99.8 |
| /dashboard?module=logistica | 390x844 | 329160 | 329280 | 21952 | 0 | 18816 | 288512 | 0 | 3008 | 210560 | 51136 | 0 | 23808 | 0 | 0 | 100.0 |
| /dashboard?module=logistica | 412x915 | 376980 | 372096 | 22848 | 0 | 19584 | 329664 | 0 | 3200 | 252800 | 54400 | 0 | 19264 | 0 | 0 | 98.7 |
| /dashboard?module=logistica | 430x932 | 400760 | 400896 | 24192 | 0 | 20736 | 355968 | 0 | 3328 | 269568 | 56576 | 0 | 26496 | 0 | 0 | 100.0 |
| /dashboard?module=logistica | 768x1024 | 786432 | 786432 | 73728 | 0 | 0 | 712704 | 0 | 11776 | 582912 | 58880 | 0 | 59136 | 0 | 0 | 100.0 |
| /dashboard?module=logistica | 1024x768 | 786432 | 786432 | 98304 | 0 | 0 | 688128 | 0 | 7936 | 539648 | 79360 | 0 | 61184 | 0 | 0 | 100.0 |
| /dashboard?module=logistica | 1366x768 | 1049088 | 1050624 | 131328 | 0 | 0 | 919296 | 0 | 10560 | 707520 | 105600 | 0 | 95616 | 0 | 0 | 100.1 |
| /dashboard?module=logistica | 1440x900 | 1296000 | 1290240 | 138240 | 0 | 0 | 1152000 | 0 | 11136 | 935424 | 111360 | 0 | 94080 | 0 | 0 | 99.6 |
| /dashboard?module=logistica | 1920x1080 | 2073600 | 2073600 | 184320 | 0 | 0 | 1889280 | 0 | 29952 | 1572480 | 149760 | 0 | 137088 | 0 | 0 | 100.0 |
| /dashboard?module=perfil | 360x740 | 266400 | 264960 | 23040 | 0 | 3520 | 238400 | 0 | 176128 | 0 | 44032 | 0 | 18240 | 0 | 0 | 99.5 |
| /dashboard?module=perfil | 375x667 | 250125 | 249664 | 24064 | 0 | 768 | 224832 | 0 | 164160 | 0 | 43200 | 0 | 17472 | 0 | 0 | 99.8 |
| /dashboard?module=perfil | 390x844 | 329160 | 329280 | 21952 | 0 | 18816 | 288512 | 0 | 219584 | 0 | 45120 | 0 | 23808 | 0 | 0 | 100.0 |
| /dashboard?module=perfil | 412x915 | 376980 | 372096 | 22848 | 0 | 19584 | 329664 | 0 | 262400 | 0 | 48000 | 0 | 19264 | 0 | 0 | 98.7 |
| /dashboard?module=perfil | 430x932 | 400760 | 400896 | 24192 | 0 | 20736 | 355968 | 0 | 279552 | 0 | 49920 | 0 | 26496 | 0 | 0 | 100.0 |
| /dashboard?module=perfil | 768x1024 | 786432 | 786432 | 73728 | 0 | 0 | 712704 | 0 | 588800 | 0 | 64768 | 0 | 59136 | 0 | 0 | 100.0 |
| /dashboard?module=perfil | 1024x768 | 786432 | 786432 | 98304 | 0 | 0 | 688128 | 0 | 539648 | 0 | 87296 | 0 | 61184 | 0 | 0 | 100.0 |
| /dashboard?module=perfil | 1366x768 | 1049088 | 1050624 | 131328 | 0 | 0 | 919296 | 0 | 707520 | 0 | 116160 | 0 | 95616 | 0 | 0 | 100.1 |
| /dashboard?module=perfil | 1440x900 | 1296000 | 1290240 | 138240 | 0 | 0 | 1152000 | 0 | 935424 | 0 | 122496 | 0 | 94080 | 0 | 0 | 99.6 |
| /dashboard?module=perfil | 1920x1080 | 2073600 | 2073600 | 184320 | 0 | 0 | 1889280 | 0 | 1587456 | 0 | 164736 | 0 | 137088 | 0 | 0 | 100.0 |
| /dashboard?module=tokens | 360x740 | 266400 | 264960 | 23040 | 0 | 17280 | 224640 | 0 | 143104 | 0 | 60544 | 0 | 20992 | 0 | 0 | 99.5 |
| /dashboard?module=tokens | 375x667 | 250125 | 249664 | 24064 | 0 | 18048 | 207552 | 0 | 123840 | 0 | 63360 | 0 | 20352 | 0 | 0 | 99.8 |
| /dashboard?module=tokens | 390x844 | 329160 | 329280 | 21952 | 0 | 18816 | 288512 | 0 | 198528 | 0 | 66176 | 0 | 23808 | 0 | 0 | 100.0 |
| /dashboard?module=tokens | 412x915 | 376980 | 372096 | 22848 | 0 | 19584 | 329664 | 0 | 240000 | 0 | 70400 | 0 | 19264 | 0 | 0 | 98.7 |
| /dashboard?module=tokens | 430x932 | 400760 | 400896 | 24192 | 0 | 20736 | 355968 | 0 | 256256 | 0 | 73216 | 0 | 26496 | 0 | 0 | 100.0 |
| /dashboard?module=tokens | 768x1024 | 786432 | 786432 | 73728 | 0 | 0 | 712704 | 0 | 547584 | 0 | 105984 | 0 | 59136 | 0 | 0 | 100.0 |
| /dashboard?module=tokens | 1024x768 | 786432 | 786432 | 98304 | 0 | 0 | 688128 | 0 | 492032 | 0 | 134912 | 0 | 61184 | 0 | 0 | 100.0 |
| /dashboard?module=tokens | 1366x768 | 1049088 | 1050624 | 131328 | 0 | 0 | 919296 | 0 | 707520 | 0 | 116160 | 0 | 95616 | 0 | 0 | 100.1 |
| /dashboard?module=tokens | 1440x900 | 1296000 | 1290240 | 138240 | 0 | 0 | 1152000 | 0 | 935424 | 0 | 122496 | 0 | 94080 | 0 | 0 | 99.6 |
| /dashboard?module=tokens | 1920x1080 | 2073600 | 2073600 | 184320 | 0 | 0 | 1889280 | 0 | 1572480 | 0 | 179712 | 0 | 137088 | 0 | 0 | 100.0 |
| /dashboard/informes | 360x740 | 266400 | 264960 | 23040 | 0 | 3072 | 238848 | 0 | 68800 | 23680 | 85248 | 9472 | 51648 | 435740 | 590646 | 99.5 |
| /dashboard/informes | 375x667 | 250125 | 249664 | 24064 | 0 | 5568 | 220032 | 0 | 62784 | 12480 | 89856 | 0 | 54912 | 451827 | 628815 | 99.8 |
| /dashboard/informes | 390x844 | 329160 | 329280 | 21952 | 0 | 18816 | 288512 | 0 | 86912 | 28864 | 94464 | 18368 | 59904 | 452332 | 498312 | 100.0 |
| /dashboard/informes | 412x915 | 376980 | 372096 | 22848 | 0 | 19584 | 329664 | 0 | 98624 | 55040 | 99072 | 19264 | 57664 | 452723 | 500595 | 98.7 |
| /dashboard/informes | 430x932 | 400760 | 400896 | 24192 | 0 | 20736 | 355968 | 0 | 98176 | 64768 | 105984 | 20608 | 66432 | 462707 | 513645 | 100.0 |
| /dashboard/informes | 768x1024 | 786432 | 786432 | 73728 | 0 | 0 | 712704 | 0 | 190976 | 137600 | 198144 | 38528 | 147456 | 592792 | 658523 | 100.0 |
| /dashboard/informes | 1024x768 | 786432 | 786432 | 98304 | 0 | 0 | 688128 | 0 | 237568 | 166144 | 83072 | 52864 | 148480 | 777920 | 870389 | 100.0 |
| /dashboard/informes | 1366x768 | 1049088 | 1050624 | 131328 | 0 | 0 | 919296 | 0 | 310656 | 213696 | 111936 | 71232 | 211776 | 945404 | 1077384 | 100.1 |
| /dashboard/informes | 1440x900 | 1296000 | 1290240 | 138240 | 0 | 0 | 1152000 | 0 | 343296 | 387072 | 118272 | 86016 | 217344 | 832712 | 1085415 | 99.6 |
| /dashboard/informes | 1920x1080 | 2073600 | 2073600 | 184320 | 0 | 0 | 1889280 | 0 | 448896 | 861824 | 160512 | 101248 | 316800 | 801845 | 1452000 | 100.0 |
| /dashboard/logistica | 360x740 | 266400 | 264960 | 23040 | 0 | 256 | 241664 | 21312 | 55040 | 0 | 66240 | 0 | 99072 | 120774 | 0 | 99.5 |
| /dashboard/logistica | 375x667 | 250125 | 249664 | 24064 | 0 | 256 | 225344 | 22464 | 34560 | 0 | 69184 | 0 | 99136 | 139928 | 0 | 99.8 |
| /dashboard/logistica | 390x844 | 329160 | 329280 | 21952 | 0 | 256 | 307072 | 23616 | 105280 | 0 | 72128 | 0 | 106048 | 84768 | 0 | 100.0 |
| /dashboard/logistica | 412x915 | 376980 | 372096 | 22848 | 0 | 128 | 349120 | 24768 | 137600 | 0 | 75072 | 0 | 111680 | 51114 | 0 | 98.7 |
| /dashboard/logistica | 430x932 | 400760 | 400896 | 24192 | 0 | 256 | 376448 | 26496 | 159744 | 0 | 58752 | 0 | 131456 | 46670 | 0 | 100.0 |
| /dashboard/logistica | 768x1024 | 786432 | 786432 | 73728 | 0 | 0 | 712704 | 38528 | 335616 | 0 | 47104 | 0 | 291456 | 75327 | 0 | 100.0 |
| /dashboard/logistica | 1024x768 | 786432 | 786432 | 98304 | 0 | 0 | 688128 | 21056 | 286528 | 0 | 63488 | 0 | 317056 | 34025 | 0 | 100.0 |
| /dashboard/logistica | 1366x768 | 1049088 | 1050624 | 131328 | 0 | 0 | 919296 | 21056 | 383616 | 0 | 84480 | 0 | 430144 | 3962 | 0 | 100.1 |
| /dashboard/logistica | 1440x900 | 1296000 | 1290240 | 138240 | 0 | 0 | 1152000 | 20608 | 393984 | 0 | 89088 | 0 | 648320 | 0 | 0 | 99.6 |
| /dashboard/logistica | 1920x1080 | 2073600 | 2073600 | 184320 | 0 | 0 | 1889280 | 21056 | 532224 | 0 | 119808 | 0 | 1216192 | 0 | 0 | 100.0 |
| /dashboard/logistica/visitas | 360x740 | 266400 | 264960 | 23040 | 0 | 384 | 241536 | 0 | 100288 | 98560 | 0 | 0 | 42688 | 347628 | 231878 | 99.5 |
| /dashboard/logistica/visitas | 375x667 | 250125 | 249664 | 24064 | 0 | 384 | 225216 | 0 | 102144 | 79488 | 0 | 0 | 43584 | 397399 | 225413 | 99.8 |
| /dashboard/logistica/visitas | 390x844 | 329160 | 329280 | 21952 | 0 | 384 | 306944 | 0 | 103808 | 153600 | 0 | 0 | 49536 | 258638 | 218948 | 100.0 |
| /dashboard/logistica/visitas | 412x915 | 376980 | 372096 | 22848 | 0 | 384 | 348864 | 0 | 110784 | 172800 | 0 | 12544 | 52736 | 215009 | 209897 | 98.7 |
| /dashboard/logistica/visitas | 430x932 | 400760 | 400896 | 24192 | 0 | 768 | 375936 | 0 | 113536 | 183168 | 0 | 19968 | 59264 | 200818 | 202139 | 100.0 |
| /dashboard/logistica/visitas | 768x1024 | 786432 | 786432 | 73728 | 0 | 0 | 712704 | 0 | 144128 | 324864 | 0 | 41216 | 202496 | 54324 | 60771 | 100.0 |
| /dashboard/logistica/visitas | 1024x768 | 786432 | 786432 | 98304 | 0 | 0 | 688128 | 0 | 179712 | 285696 | 0 | 63488 | 159232 | 0 | 0 | 100.0 |
| /dashboard/logistica/visitas | 1366x768 | 1049088 | 1050624 | 131328 | 0 | 0 | 919296 | 0 | 240064 | 327360 | 0 | 84480 | 267392 | 0 | 0 | 100.1 |
| /dashboard/logistica/visitas | 1440x900 | 1296000 | 1290240 | 138240 | 0 | 0 | 1152000 | 0 | 273792 | 345216 | 0 | 77952 | 455040 | 0 | 0 | 99.6 |
| /dashboard/logistica/visitas | 1920x1080 | 2073600 | 2073600 | 184320 | 0 | 0 | 1889280 | 0 | 359552 | 371200 | 0 | 104832 | 1053696 | 0 | 0 | 100.0 |
| /dashboard/logistica/rutas | 360x740 | 266400 | 264960 | 23040 | 0 | 384 | 241536 | 0 | 100288 | 98560 | 0 | 0 | 42688 | 94059 | 74205 | 99.5 |
| /dashboard/logistica/rutas | 375x667 | 250125 | 249664 | 24064 | 0 | 384 | 225216 | 0 | 102144 | 79488 | 0 | 0 | 43584 | 141730 | 69840 | 99.8 |
| /dashboard/logistica/rutas | 390x844 | 329160 | 329280 | 21952 | 0 | 18816 | 288512 | 0 | 103808 | 113664 | 0 | 21056 | 49984 | 62884 | 65475 | 100.0 |
| /dashboard/logistica/rutas | 412x915 | 376980 | 372096 | 22848 | 0 | 19584 | 329664 | 0 | 110976 | 118400 | 0 | 21952 | 78336 | 56520 | 59364 | 98.7 |
| /dashboard/logistica/rutas | 430x932 | 400760 | 400896 | 24192 | 0 | 20736 | 355968 | 0 | 113536 | 125504 | 0 | 23296 | 93632 | 51319 | 54126 | 100.0 |
| /dashboard/logistica/rutas | 768x1024 | 786432 | 786432 | 73728 | 0 | 0 | 712704 | 0 | 150016 | 141312 | 0 | 41216 | 380160 | 0 | 0 | 100.0 |
| /dashboard/logistica/rutas | 1024x768 | 786432 | 786432 | 98304 | 0 | 0 | 688128 | 0 | 179712 | 198400 | 0 | 55552 | 254464 | 0 | 0 | 100.0 |
| /dashboard/logistica/rutas | 1366x768 | 1049088 | 1050624 | 131328 | 0 | 0 | 919296 | 0 | 240064 | 264000 | 0 | 73920 | 341312 | 0 | 0 | 100.1 |
| /dashboard/logistica/rutas | 1440x900 | 1296000 | 1290240 | 138240 | 0 | 0 | 1152000 | 0 | 273792 | 267264 | 0 | 77952 | 532992 | 0 | 0 | 99.6 |
| /dashboard/logistica/rutas | 1920x1080 | 2073600 | 2073600 | 184320 | 0 | 0 | 1889280 | 0 | 359552 | 371200 | 0 | 104832 | 1053696 | 0 | 0 | 100.0 |
| /dashboard/logistica/metricas | 360x740 | 266400 | 264960 | 23040 | 0 | 768 | 241152 | 0 | 191040 | 0 | 0 | 0 | 50112 | 157421 | 0 | 99.5 |
| /dashboard/logistica/metricas | 375x667 | 250125 | 249664 | 24064 | 0 | 768 | 224832 | 0 | 177088 | 0 | 0 | 0 | 47744 | 189599 | 0 | 99.8 |
| /dashboard/logistica/metricas | 390x844 | 329160 | 329280 | 21952 | 0 | 768 | 306560 | 0 | 251712 | 0 | 0 | 0 | 54848 | 120658 | 0 | 100.0 |
| /dashboard/logistica/metricas | 412x915 | 376980 | 372096 | 22848 | 0 | 384 | 348864 | 0 | 293632 | 0 | 0 | 0 | 55232 | 92951 | 0 | 98.7 |
| /dashboard/logistica/metricas | 430x932 | 400760 | 400896 | 24192 | 0 | 768 | 375936 | 0 | 312192 | 0 | 0 | 0 | 63744 | 90200 | 0 | 100.0 |
| /dashboard/logistica/metricas | 768x1024 | 786432 | 786432 | 73728 | 0 | 0 | 712704 | 0 | 488064 | 0 | 0 | 41216 | 183424 | 0 | 0 | 100.0 |
| /dashboard/logistica/metricas | 1024x768 | 786432 | 786432 | 98304 | 0 | 0 | 688128 | 0 | 573952 | 0 | 0 | 0 | 114176 | 118588 | 0 | 100.0 |
| /dashboard/logistica/metricas | 1366x768 | 1049088 | 1050624 | 131328 | 0 | 0 | 919296 | 0 | 765504 | 0 | 0 | 0 | 153792 | 157858 | 0 | 100.1 |
| /dashboard/logistica/metricas | 1440x900 | 1296000 | 1290240 | 138240 | 0 | 0 | 1152000 | 0 | 885504 | 0 | 0 | 77952 | 188544 | 0 | 0 | 99.6 |
| /dashboard/logistica/metricas | 1920x1080 | 2073600 | 2073600 | 184320 | 0 | 0 | 1889280 | 0 | 1222272 | 0 | 0 | 104832 | 562176 | 0 | 0 | 100.0 |
| /dashboard/admin | 360x740 | 266400 | 264960 | 14400 | 0 | 17280 | 233280 | 0 | 180096 | 0 | 0 | 11008 | 42176 | 0 | 0 | 99.5 |
| /dashboard/admin | 375x667 | 250125 | 249664 | 15040 | 0 | 18048 | 216576 | 0 | 160512 | 0 | 0 | 11520 | 44544 | 0 | 0 | 99.8 |
| /dashboard/admin | 390x844 | 329160 | 329280 | 15680 | 0 | 18816 | 294784 | 0 | 229632 | 0 | 0 | 12032 | 53120 | 0 | 0 | 100.0 |
| /dashboard/admin | 412x915 | 376980 | 372096 | 16320 | 0 | 19584 | 336192 | 0 | 272832 | 0 | 0 | 12800 | 50560 | 0 | 0 | 98.7 |
| /dashboard/admin | 430x932 | 400760 | 400896 | 17280 | 0 | 20736 | 362880 | 0 | 293760 | 0 | 0 | 13312 | 55808 | 0 | 0 | 100.0 |
| /dashboard/admin | 768x1024 | 786432 | 786432 | 73728 | 0 | 0 | 712704 | 259072 | 206272 | 0 | 0 | 0 | 247360 | 0 | 0 | 100.0 |
| /dashboard/admin | 1024x768 | 786432 | 786432 | 98304 | 0 | 0 | 688128 | 190848 | 187840 | 0 | 0 | 0 | 309440 | 0 | 0 | 100.0 |
| /dashboard/admin | 1366x768 | 1049088 | 1050624 | 131328 | 0 | 0 | 919296 | 188160 | 286720 | 0 | 0 | 0 | 444416 | 0 | 0 | 100.1 |
| /dashboard/admin | 1440x900 | 1296000 | 1290240 | 138240 | 0 | 0 | 1152000 | 231168 | 400512 | 0 | 0 | 0 | 520320 | 0 | 0 | 99.6 |
| /dashboard/admin | 1920x1080 | 2073600 | 2073600 | 184320 | 0 | 0 | 1889280 | 290304 | 555520 | 0 | 0 | 0 | 1043456 | 0 | 0 | 100.0 |
| /dashboard/admin?module=admin | 360x740 | 266400 | 264960 | 14400 | 0 | 17280 | 233280 | 0 | 0 | 217408 | 0 | 0 | 15872 | 0 | 0 | 99.5 |
| /dashboard/admin?module=admin | 375x667 | 250125 | 249664 | 15040 | 0 | 18048 | 216576 | 0 | 0 | 201600 | 0 | 0 | 14976 | 0 | 0 | 99.8 |
| /dashboard/admin?module=admin | 390x844 | 329160 | 329280 | 15680 | 0 | 18816 | 294784 | 0 | 0 | 276736 | 0 | 0 | 18048 | 0 | 0 | 100.0 |
| /dashboard/admin?module=admin | 412x915 | 376980 | 372096 | 16320 | 0 | 19584 | 336192 | 0 | 0 | 323200 | 0 | 0 | 12992 | 0 | 0 | 98.7 |
| /dashboard/admin?module=admin | 430x932 | 400760 | 400896 | 17280 | 0 | 20736 | 362880 | 0 | 0 | 342784 | 0 | 0 | 20096 | 0 | 0 | 100.0 |
| /dashboard/admin?module=admin | 768x1024 | 786432 | 786432 | 73728 | 0 | 0 | 712704 | 0 | 547584 | 0 | 64768 | 0 | 100352 | 0 | 0 | 100.0 |
| /dashboard/admin?module=admin | 1024x768 | 786432 | 786432 | 98304 | 0 | 0 | 688128 | 0 | 492032 | 0 | 87296 | 0 | 108800 | 0 | 0 | 100.0 |
| /dashboard/admin?module=admin | 1366x768 | 1049088 | 1050624 | 131328 | 0 | 0 | 919296 | 0 | 644160 | 0 | 116160 | 0 | 158976 | 0 | 0 | 100.1 |
| /dashboard/admin?module=admin | 1440x900 | 1296000 | 1290240 | 138240 | 0 | 0 | 1152000 | 0 | 857472 | 0 | 133632 | 0 | 160896 | 0 | 0 | 99.6 |
| /dashboard/admin?module=admin | 1920x1080 | 2073600 | 2073600 | 184320 | 0 | 0 | 1889280 | 0 | 1482624 | 0 | 164736 | 0 | 241920 | 0 | 0 | 100.0 |
| /dashboard/admin?module=admin-clinics | 360x740 | 266400 | 264960 | 14400 | 0 | 17280 | 233280 | 0 | 77632 | 139776 | 0 | 0 | 15872 | 0 | 0 | 99.5 |
| /dashboard/admin?module=admin-clinics | 375x667 | 250125 | 249664 | 15040 | 0 | 18048 | 216576 | 0 | 78272 | 123328 | 0 | 0 | 14976 | 0 | 0 | 99.8 |
| /dashboard/admin?module=admin-clinics | 390x844 | 329160 | 329280 | 15680 | 0 | 18816 | 294784 | 0 | 86848 | 189888 | 0 | 0 | 18048 | 0 | 0 | 100.0 |
| /dashboard/admin?module=admin-clinics | 412x915 | 376980 | 372096 | 16320 | 0 | 19584 | 336192 | 0 | 98560 | 224640 | 0 | 0 | 12992 | 0 | 0 | 98.7 |
| /dashboard/admin?module=admin-clinics | 430x932 | 400760 | 400896 | 17280 | 0 | 20736 | 362880 | 0 | 97024 | 245760 | 0 | 0 | 20096 | 0 | 0 | 100.0 |
| /dashboard/admin?module=admin-clinics | 768x1024 | 786432 | 786432 | 73728 | 0 | 0 | 712704 | 0 | 483072 | 135168 | 35328 | 0 | 59136 | 0 | 0 | 100.0 |
| /dashboard/admin?module=admin-clinics | 1024x768 | 786432 | 786432 | 98304 | 0 | 0 | 688128 | 0 | 402944 | 184320 | 39680 | 0 | 61184 | 0 | 0 | 100.0 |
| /dashboard/admin?module=admin-clinics | 1366x768 | 1049088 | 1050624 | 131328 | 0 | 0 | 919296 | 0 | 523584 | 247296 | 52800 | 0 | 95616 | 0 | 0 | 100.1 |
| /dashboard/admin?module=admin-clinics | 1440x900 | 1296000 | 1290240 | 138240 | 0 | 0 | 1152000 | 0 | 719104 | 272000 | 66816 | 0 | 94080 | 0 | 0 | 99.6 |
| /dashboard/admin?module=admin-clinics | 1920x1080 | 2073600 | 2073600 | 184320 | 0 | 0 | 1889280 | 0 | 1309056 | 353280 | 89856 | 0 | 137088 | 0 | 0 | 100.0 |
| /dashboard/admin?module=admin-report-upload | 360x740 | 266400 | 264960 | 14400 | 0 | 17280 | 233280 | 0 | 65152 | 127296 | 9984 | 14976 | 15872 | 0 | 0 | 99.5 |
| /dashboard/admin?module=admin-report-upload | 375x667 | 250125 | 249664 | 15040 | 0 | 18048 | 216576 | 0 | 65152 | 110208 | 10496 | 15744 | 14976 | 0 | 0 | 99.8 |
| /dashboard/admin?module=admin-report-upload | 390x844 | 329160 | 329280 | 15680 | 0 | 18816 | 294784 | 0 | 67584 | 181632 | 11008 | 16512 | 18048 | 0 | 0 | 100.0 |
| /dashboard/admin?module=admin-report-upload | 412x915 | 376980 | 372096 | 16320 | 0 | 19584 | 336192 | 0 | 81280 | 216000 | 11520 | 14400 | 12992 | 0 | 0 | 98.7 |
| /dashboard/admin?module=admin-report-upload | 430x932 | 400760 | 400896 | 17280 | 0 | 20736 | 362880 | 0 | 69376 | 242688 | 12288 | 18432 | 20096 | 0 | 0 | 100.0 |
| /dashboard/admin?module=admin-report-upload | 768x1024 | 786432 | 786432 | 73728 | 0 | 0 | 712704 | 0 | 66304 | 428032 | 136704 | 22528 | 59136 | 0 | 0 | 100.0 |
| /dashboard/admin?module=admin-report-upload | 1024x768 | 786432 | 786432 | 98304 | 0 | 0 | 688128 | 0 | 80384 | 368640 | 147200 | 30720 | 61184 | 0 | 0 | 100.0 |
| /dashboard/admin?module=admin-report-upload | 1366x768 | 1049088 | 1050624 | 131328 | 0 | 0 | 919296 | 0 | 80512 | 546112 | 155840 | 41216 | 95616 | 0 | 0 | 100.1 |
| /dashboard/admin?module=admin-report-upload | 1440x900 | 1296000 | 1290240 | 138240 | 0 | 0 | 1152000 | 0 | 120704 | 739840 | 153856 | 43520 | 94080 | 0 | 0 | 99.6 |
| /dashboard/admin?module=admin-report-upload | 1920x1080 | 2073600 | 2073600 | 184320 | 0 | 0 | 1889280 | 0 | 146176 | 1324800 | 222336 | 58880 | 137088 | 0 | 0 | 100.0 |
| /dashboard/admin?module=admin-particular-tokens | 360x740 | 266400 | 264960 | 14400 | 0 | 17280 | 233280 | 0 | 27712 | 149760 | 27456 | 12480 | 15872 | 0 | 0 | 99.5 |
| /dashboard/admin?module=admin-particular-tokens | 375x667 | 250125 | 249664 | 15040 | 0 | 18048 | 216576 | 0 | 25792 | 133824 | 28864 | 13120 | 14976 | 0 | 0 | 99.8 |
| /dashboard/admin?module=admin-particular-tokens | 390x844 | 329160 | 329280 | 15680 | 0 | 18816 | 294784 | 0 | 31808 | 200896 | 30272 | 13760 | 18048 | 0 | 0 | 100.0 |
| /dashboard/admin?module=admin-particular-tokens | 412x915 | 376980 | 372096 | 16320 | 0 | 19584 | 336192 | 0 | 40960 | 236160 | 31680 | 14400 | 12992 | 0 | 0 | 98.7 |
| /dashboard/admin?module=admin-particular-tokens | 430x932 | 400760 | 400896 | 17280 | 0 | 20736 | 362880 | 0 | 35584 | 258048 | 33792 | 15360 | 20096 | 0 | 0 | 100.0 |
| /dashboard/admin?module=admin-particular-tokens | 768x1024 | 786432 | 786432 | 73728 | 0 | 0 | 712704 | 0 | 150784 | 337920 | 164864 | 0 | 59136 | 0 | 0 | 100.0 |
| /dashboard/admin?module=admin-particular-tokens | 1024x768 | 786432 | 786432 | 98304 | 0 | 0 | 688128 | 0 | 141824 | 353280 | 131840 | 0 | 61184 | 0 | 0 | 100.0 |
| /dashboard/admin?module=admin-particular-tokens | 1366x768 | 1049088 | 1050624 | 131328 | 0 | 0 | 919296 | 0 | 183552 | 463680 | 176448 | 0 | 95616 | 0 | 0 | 100.1 |
| /dashboard/admin?module=admin-particular-tokens | 1440x900 | 1296000 | 1290240 | 138240 | 0 | 0 | 1152000 | 0 | 196864 | 663680 | 197376 | 0 | 94080 | 0 | 0 | 99.6 |
| /dashboard/admin?module=admin-particular-tokens | 1920x1080 | 2073600 | 2073600 | 184320 | 0 | 0 | 1889280 | 0 | 278656 | 1207040 | 266496 | 0 | 137088 | 0 | 0 | 100.0 |
| /dashboard/admin?module=admin-pricing | 360x740 | 266400 | 264960 | 14400 | 0 | 17280 | 233280 | 0 | 0 | 204288 | 0 | 13120 | 15872 | 0 | 0 | 99.5 |
| /dashboard/admin?module=admin-pricing | 375x667 | 250125 | 249664 | 15040 | 0 | 18048 | 216576 | 0 | 0 | 184704 | 0 | 16896 | 14976 | 0 | 0 | 99.8 |
| /dashboard/admin?module=admin-pricing | 390x844 | 329160 | 329280 | 15680 | 0 | 18816 | 294784 | 0 | 0 | 262336 | 0 | 14400 | 18048 | 0 | 0 | 100.0 |
| /dashboard/admin?module=admin-pricing | 412x915 | 376980 | 372096 | 16320 | 0 | 19584 | 336192 | 0 | 0 | 307840 | 0 | 15360 | 12992 | 0 | 0 | 98.7 |
| /dashboard/admin?module=admin-pricing | 430x932 | 400760 | 400896 | 17280 | 0 | 20736 | 362880 | 0 | 0 | 326784 | 0 | 16000 | 20096 | 0 | 0 | 100.0 |
| /dashboard/admin?module=admin-pricing | 768x1024 | 786432 | 786432 | 73728 | 0 | 0 | 712704 | 0 | 618240 | 0 | 35328 | 0 | 59136 | 0 | 0 | 100.0 |
| /dashboard/admin?module=admin-pricing | 1024x768 | 786432 | 786432 | 98304 | 0 | 0 | 688128 | 0 | 587264 | 0 | 39680 | 0 | 61184 | 0 | 0 | 100.0 |
| /dashboard/admin?module=admin-pricing | 1366x768 | 1049088 | 1050624 | 131328 | 0 | 0 | 919296 | 0 | 770880 | 0 | 52800 | 0 | 95616 | 0 | 0 | 100.1 |
| /dashboard/admin?module=admin-pricing | 1440x900 | 1296000 | 1290240 | 138240 | 0 | 0 | 1152000 | 0 | 991104 | 0 | 66816 | 0 | 94080 | 0 | 0 | 99.6 |
| /dashboard/admin?module=admin-pricing | 1920x1080 | 2073600 | 2073600 | 184320 | 0 | 0 | 1889280 | 0 | 1662336 | 0 | 89856 | 0 | 137088 | 0 | 0 | 100.0 |
| /dashboard/admin?module=admin-sessions | 360x740 | 266400 | 264960 | 14400 | 0 | 17280 | 233280 | 0 | 0 | 203648 | 0 | 13760 | 15872 | 0 | 0 | 99.5 |
| /dashboard/admin?module=admin-sessions | 375x667 | 250125 | 249664 | 15040 | 0 | 18048 | 216576 | 0 | 0 | 187200 | 0 | 14400 | 14976 | 0 | 0 | 99.8 |
| /dashboard/admin?module=admin-sessions | 390x844 | 329160 | 329280 | 15680 | 0 | 18816 | 294784 | 0 | 0 | 261696 | 0 | 15040 | 18048 | 0 | 0 | 100.0 |
| /dashboard/admin?module=admin-sessions | 412x915 | 376980 | 372096 | 16320 | 0 | 19584 | 336192 | 0 | 0 | 307520 | 0 | 15680 | 12992 | 0 | 0 | 98.7 |
| /dashboard/admin?module=admin-sessions | 430x932 | 400760 | 400896 | 17280 | 0 | 20736 | 362880 | 0 | 0 | 326144 | 0 | 16640 | 20096 | 0 | 0 | 100.0 |
| /dashboard/admin?module=admin-sessions | 768x1024 | 786432 | 786432 | 73728 | 0 | 0 | 712704 | 0 | 111872 | 453376 | 35328 | 23552 | 88576 | 0 | 0 | 100.0 |
| /dashboard/admin?module=admin-sessions | 1024x768 | 786432 | 786432 | 98304 | 0 | 0 | 688128 | 0 | 150784 | 349184 | 39680 | 39680 | 108800 | 0 | 0 | 100.0 |
| /dashboard/admin?module=admin-sessions | 1366x768 | 1049088 | 1050624 | 131328 | 0 | 0 | 919296 | 0 | 200640 | 464640 | 52800 | 42240 | 158976 | 0 | 0 | 100.1 |
| /dashboard/admin?module=admin-sessions | 1440x900 | 1296000 | 1290240 | 138240 | 0 | 0 | 1152000 | 0 | 211584 | 668160 | 66816 | 55680 | 149760 | 0 | 0 | 99.6 |
| /dashboard/admin?module=admin-sessions | 1920x1080 | 2073600 | 2073600 | 184320 | 0 | 0 | 1889280 | 0 | 284544 | 1228032 | 89856 | 74880 | 211968 | 0 | 0 | 100.0 |
| /dashboard/admin?module=admin-users-roles | 360x740 | 266400 | 264960 | 14400 | 0 | 17280 | 233280 | 0 | 0 | 203648 | 0 | 13760 | 15872 | 0 | 0 | 99.5 |
| /dashboard/admin?module=admin-users-roles | 375x667 | 250125 | 249664 | 15040 | 0 | 18048 | 216576 | 0 | 0 | 187200 | 0 | 14400 | 14976 | 0 | 0 | 99.8 |
| /dashboard/admin?module=admin-users-roles | 390x844 | 329160 | 329280 | 15680 | 0 | 18816 | 294784 | 0 | 0 | 261696 | 0 | 15040 | 18048 | 0 | 0 | 100.0 |
| /dashboard/admin?module=admin-users-roles | 412x915 | 376980 | 372096 | 16320 | 0 | 19584 | 336192 | 0 | 0 | 307520 | 0 | 15680 | 12992 | 0 | 0 | 98.7 |
| /dashboard/admin?module=admin-users-roles | 430x932 | 400760 | 400896 | 17280 | 0 | 20736 | 362880 | 0 | 0 | 326144 | 0 | 16640 | 20096 | 0 | 0 | 100.0 |
| /dashboard/admin?module=admin-users-roles | 768x1024 | 786432 | 786432 | 73728 | 0 | 0 | 712704 | 0 | 294400 | 300288 | 35328 | 23552 | 59136 | 0 | 0 | 100.0 |
| /dashboard/admin?module=admin-users-roles | 1024x768 | 786432 | 786432 | 98304 | 0 | 0 | 688128 | 0 | 150784 | 396800 | 39680 | 39680 | 61184 | 0 | 0 | 100.0 |
| /dashboard/admin?module=admin-users-roles | 1366x768 | 1049088 | 1050624 | 131328 | 0 | 0 | 919296 | 0 | 200640 | 528000 | 52800 | 42240 | 95616 | 0 | 0 | 100.1 |
| /dashboard/admin?module=admin-users-roles | 1440x900 | 1296000 | 1290240 | 138240 | 0 | 0 | 1152000 | 0 | 367488 | 567936 | 66816 | 55680 | 94080 | 0 | 0 | 99.6 |
| /dashboard/admin?module=admin-users-roles | 1920x1080 | 2073600 | 2073600 | 184320 | 0 | 0 | 1889280 | 0 | 823680 | 763776 | 89856 | 74880 | 137088 | 0 | 0 | 100.0 |
| /dashboard/admin?module=audit-log | 360x740 | 266400 | 264960 | 14400 | 0 | 17280 | 233280 | 0 | 0 | 203648 | 0 | 13760 | 15872 | 0 | 0 | 99.5 |
| /dashboard/admin?module=audit-log | 375x667 | 250125 | 249664 | 15040 | 0 | 18048 | 216576 | 0 | 0 | 187200 | 0 | 14400 | 14976 | 0 | 0 | 99.8 |
| /dashboard/admin?module=audit-log | 390x844 | 329160 | 329280 | 15680 | 0 | 18816 | 294784 | 0 | 0 | 261696 | 0 | 15040 | 18048 | 0 | 0 | 100.0 |
| /dashboard/admin?module=audit-log | 412x915 | 376980 | 372096 | 16320 | 0 | 19584 | 336192 | 0 | 0 | 307520 | 0 | 15680 | 12992 | 0 | 0 | 98.7 |
| /dashboard/admin?module=audit-log | 430x932 | 400760 | 400896 | 17280 | 0 | 20736 | 362880 | 0 | 0 | 326144 | 0 | 16640 | 20096 | 0 | 0 | 100.0 |
| /dashboard/admin?module=audit-log | 768x1024 | 786432 | 786432 | 73728 | 0 | 0 | 712704 | 0 | 268544 | 270848 | 114176 | 0 | 59136 | 0 | 0 | 100.0 |
| /dashboard/admin?module=audit-log | 1024x768 | 786432 | 786432 | 98304 | 0 | 0 | 688128 | 0 | 168704 | 357120 | 101120 | 0 | 61184 | 0 | 0 | 100.0 |
| /dashboard/admin?module=audit-log | 1366x768 | 1049088 | 1050624 | 131328 | 0 | 0 | 919296 | 0 | 213248 | 475200 | 135232 | 0 | 95616 | 0 | 0 | 100.1 |
| /dashboard/admin?module=audit-log | 1440x900 | 1296000 | 1290240 | 138240 | 0 | 0 | 1152000 | 0 | 402688 | 512256 | 142976 | 0 | 94080 | 0 | 0 | 99.6 |
| /dashboard/admin?module=audit-log | 1920x1080 | 2073600 | 2073600 | 184320 | 0 | 0 | 1889280 | 0 | 870400 | 688896 | 192896 | 0 | 137088 | 0 | 0 | 100.0 |
| /dashboard/admin?module=admin-health | 360x740 | 266400 | 264960 | 14400 | 0 | 17280 | 233280 | 0 | 0 | 217408 | 0 | 0 | 15872 | 0 | 0 | 99.5 |
| /dashboard/admin?module=admin-health | 375x667 | 250125 | 249664 | 15040 | 0 | 18048 | 216576 | 0 | 0 | 201600 | 0 | 0 | 14976 | 0 | 0 | 99.8 |
| /dashboard/admin?module=admin-health | 390x844 | 329160 | 329280 | 15680 | 0 | 18816 | 294784 | 0 | 0 | 276736 | 0 | 0 | 18048 | 0 | 0 | 100.0 |
| /dashboard/admin?module=admin-health | 412x915 | 376980 | 372096 | 16320 | 0 | 19584 | 336192 | 0 | 0 | 323200 | 0 | 0 | 12992 | 0 | 0 | 98.7 |
| /dashboard/admin?module=admin-health | 430x932 | 400760 | 400896 | 17280 | 0 | 20736 | 362880 | 0 | 0 | 342784 | 0 | 0 | 20096 | 0 | 0 | 100.0 |
| /dashboard/admin?module=admin-health | 768x1024 | 786432 | 786432 | 73728 | 0 | 0 | 712704 | 0 | 129536 | 0 | 35328 | 0 | 547840 | 0 | 0 | 100.0 |
| /dashboard/admin?module=admin-health | 1024x768 | 786432 | 786432 | 98304 | 0 | 0 | 688128 | 0 | 151040 | 0 | 39680 | 0 | 497408 | 0 | 0 | 100.0 |
| /dashboard/admin?module=admin-health | 1366x768 | 1049088 | 1050624 | 131328 | 0 | 0 | 919296 | 0 | 184320 | 0 | 52800 | 0 | 682176 | 0 | 0 | 100.1 |
| /dashboard/admin?module=admin-health | 1440x900 | 1296000 | 1290240 | 138240 | 0 | 0 | 1152000 | 0 | 193536 | 0 | 66816 | 0 | 891648 | 0 | 0 | 99.6 |
| /dashboard/admin?module=admin-health | 1920x1080 | 2073600 | 2073600 | 184320 | 0 | 0 | 1889280 | 0 | 250240 | 0 | 89856 | 0 | 1549184 | 0 | 0 | 100.0 |
| /dashboard/admin?module=admin-maintenance | 360x740 | 266400 | 264960 | 14400 | 0 | 17280 | 233280 | 0 | 0 | 217408 | 0 | 0 | 15872 | 0 | 0 | 99.5 |
| /dashboard/admin?module=admin-maintenance | 375x667 | 250125 | 249664 | 15040 | 0 | 18048 | 216576 | 0 | 0 | 201600 | 0 | 0 | 14976 | 0 | 0 | 99.8 |
| /dashboard/admin?module=admin-maintenance | 390x844 | 329160 | 329280 | 15680 | 0 | 18816 | 294784 | 0 | 0 | 276736 | 0 | 0 | 18048 | 0 | 0 | 100.0 |
| /dashboard/admin?module=admin-maintenance | 412x915 | 376980 | 372096 | 16320 | 0 | 19584 | 336192 | 0 | 0 | 323200 | 0 | 0 | 12992 | 0 | 0 | 98.7 |
| /dashboard/admin?module=admin-maintenance | 430x932 | 400760 | 400896 | 17280 | 0 | 20736 | 362880 | 0 | 0 | 342784 | 0 | 0 | 20096 | 0 | 0 | 100.0 |
| /dashboard/admin?module=admin-maintenance | 768x1024 | 786432 | 786432 | 73728 | 0 | 0 | 712704 | 0 | 141312 | 0 | 35328 | 0 | 536064 | 0 | 0 | 100.0 |
| /dashboard/admin?module=admin-maintenance | 1024x768 | 786432 | 786432 | 98304 | 0 | 0 | 688128 | 0 | 198400 | 0 | 39680 | 0 | 450048 | 0 | 0 | 100.0 |
| /dashboard/admin?module=admin-maintenance | 1366x768 | 1049088 | 1050624 | 131328 | 0 | 0 | 919296 | 0 | 264000 | 0 | 52800 | 0 | 602496 | 0 | 0 | 100.1 |
| /dashboard/admin?module=admin-maintenance | 1440x900 | 1296000 | 1290240 | 138240 | 0 | 0 | 1152000 | 0 | 278400 | 0 | 66816 | 0 | 806784 | 0 | 0 | 99.6 |
| /dashboard/admin?module=admin-maintenance | 1920x1080 | 2073600 | 2073600 | 184320 | 0 | 0 | 1889280 | 0 | 374400 | 0 | 89856 | 0 | 1425024 | 0 | 0 | 100.0 |
| /particulares | 360x740 | 266400 | 264960 | 23040 | 0 | 0 | 241920 | 0 | 218880 | 0 | 0 | 0 | 23040 | 116204 | 0 | 99.5 |
| /particulares | 375x667 | 250125 | 249664 | 24064 | 0 | 0 | 225600 | 0 | 201536 | 0 | 0 | 0 | 24064 | 113684 | 0 | 99.8 |
| /particulares | 390x844 | 329160 | 329280 | 25088 | 0 | 0 | 304192 | 0 | 279104 | 0 | 0 | 0 | 25088 | 110341 | 0 | 100.0 |
| /particulares | 412x915 | 376980 | 372096 | 26112 | 0 | 0 | 345984 | 0 | 319872 | 0 | 0 | 0 | 26112 | 78953 | 0 | 98.7 |
| /particulares | 430x932 | 400760 | 400896 | 27648 | 0 | 0 | 373248 | 0 | 345600 | 0 | 0 | 0 | 27648 | 77343 | 0 | 100.0 |
| /particulares | 768x1024 | 786432 | 786432 | 49152 | 0 | 0 | 737280 | 0 | 675840 | 0 | 0 | 0 | 61440 | 0 | 0 | 100.0 |
| /particulares | 1024x768 | 786432 | 786432 | 65536 | 0 | 0 | 720896 | 0 | 638976 | 0 | 0 | 0 | 81920 | 0 | 0 | 100.0 |
| /particulares | 1366x768 | 1049088 | 1050624 | 87552 | 0 | 0 | 963072 | 0 | 798720 | 0 | 0 | 0 | 164352 | 0 | 0 | 100.1 |
| /particulares | 1440x900 | 1296000 | 1290240 | 92160 | 0 | 0 | 1198080 | 0 | 962560 | 0 | 0 | 0 | 235520 | 0 | 0 | 99.6 |
| /particulares | 1920x1080 | 2073600 | 2073600 | 122880 | 0 | 0 | 1950720 | 0 | 1437696 | 0 | 0 | 0 | 513024 | 0 | 0 | 100.0 |

## 22. Font-to-Component Proportionality Audit

Measured with computed styles at 390×844 (mobile) and 1440×900 (desktop). Min height per §19 formula; separator allowance 8 px where a divider/gap exists.

| Component (surface) | VP | Font / line-height | Content lines | Pad-Y | Action h | Min content h | Actual h | Surplus | Classification | Recommendation |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| Admin mobile hub launcher tile | 390×844 | 16 / 24 | 1 label + icon 44 | 10.2 | — | ≈86 | 210.6 | **+124.6** | **OVEREXPANDED** | Tile stretched to fill the stage. Recovered space must carry per-module operational status (e.g., "12 pendientes", "3 alertas") or the launcher moves to 8 tiles/page. |
| Admin hub hero rail | 1440×900 | 16 / 24 (head 20/25) | head + status + 3 metrics + CTA | 40 | 42 | ≈257 | 687.7 | **+430.7** | **OVEREXPANDED** | 336×688 px rail (17.8% of viewport) carries 5 data points + 1 CTA. Compact to ≤300 px; reclaimed column becomes a live audit/activity feed (§23). |
| Admin desktop module card | 1440×900 | 16 / 24 | title + desc + icon | 16 | — | ≈103–116 | 131 | +15–28 | DENSITY_BALANCED | Keep. |
| Clinic cockpit tile | 1440×900 | 16 / 24 | 1–2 lines + icon inline | 19.2 | — | ≈48 | 57.2 | +9 | COMPACT_VALID | Keep as the reference tile grammar. |
| Clinic cockpit tile | 390×844 | 16 / 24 | 1–2 lines + icon | 13.4 | — | ≈44 | 51.4 | +7 | COMPACT_VALID | Keep. |
| KPI chip | 1440×900 | 16 / 24 (label 11–12) | label + value + icon | 14.4 | — | ≈43 | 46.0 | +3 | COMPACT_VALID | Keep; fix any label below 12 px. |
| Clinic status band | 1440×900 | 16 / 24 (head 20/25) | head + description | 24 | — | ≈73 | 92.8 | +20 | DENSITY_BALANCED | Keep. |
| Clinic status band | 390×844 | 16 / 24 (head 18/22.5) | head + desc + chips wrap | 17.6 | — | ≈110 | 134.4 | +24 | DENSITY_BALANCED | Keep. |
| Operaciones metric card | 390×844 | 16 / 24 (head 14/20) | label + value | 0 (inner) | — | ≈68 | 106 | **+38** | **OVEREXPANDED** | Absorb surplus into a trend/secondary metric line, or compact to ≤80 px. |
| Metricas metric card | 390×844 | 16 / 24 (head 14/20) | 2-line label + value | 0 | — | ≈88 | 134 | **+46** | **OVEREXPANDED** | Same as above; four of these stack 536 px on a 740 px viewport and push the table out (§27). |
| Visitas/rutas metric card | 390×844 | 16 / 24 | label + value | 0 | — | ≈68 | 94 | +26 | OVEREXPANDED (borderline) | Compact to metric strip on mobile (PR-GD-4). |
| Clinic reports table row | 1440×900 | 13 / 19.5 | 1 line + inline action 28 | ≈16 | 28 | ≈36 | 49 | +13 | DENSITY_BALANCED | Keep. |
| Admin reports/tokens dense row | 1440×900 | 12 / 16 | 1 line + action 28 | ≈16 | 28 | ≈32 | 35.7 | +3.7 | COMPACT_VALID | The density reference for all desktop tables. |
| Admin users/roles row | 1440×900 | 13 / 19.5 | 1 line | ≈16 | — | ≈35.5 | 41 | +5.5 | COMPACT_VALID | Keep. |
| Admin audit row | 1440×900 | 13 / 19.5 | 1 line + action | ≈16 | 28 | ≈35.5 | 37 | +1.5 | COMPACT_VALID | Keep. |
| Admin clinics table row | 1440×900 | 13 / 19.5 | multi-line stacked cells | ≈16 | — | ≈75 (3 lines) | 156.5 | **+81.5** | **OVEREXPANDED** | Cells stack too many sublines; collapse secondary contact/user data into metadata line or detail drawer (§25). |
| Visitas table row | 1440×900 | 14 / 20 | 1–2 lines | ≈16 | — | ≈36–56 | 69 | +13–33 | OVEREXPANDED (borderline) | Wrapped NOTAS/DIRECCIÓN cells inflate rows; truncate + detail on demand. |
| Visitas table row | 390×844 | 14 / 20 | wrapped cells, table w=879 px in a 390 px viewport | — | — | — | 109 | — | **CLIPPED** | Table escapes horizontally (internal x-scroll 508 px). Requires mobile row variant, not a scrolling table (§25, §27). |
| Clinic informes mobile row | 390×844 | 16 / 24 | 2 lines + action 28 | 12 | 28 | ≈60 | 62 | +2 | COMPACT_VALID | Keep as the mobile row reference. |
| Admin core mobile rows (reports/tokens/audit) | 390×844 | 16 / 24 | 1 line + action 28 | 4–8 | 28 | ≈32–36 | 37.5–41.5 | +3–7 | COMPACT_VALID | Keep. |
| Admin audit mobile chip label | 390×844 | head 11 / 16.5 | — | — | — | — | — | — | **UNDERREADABLE** | 11 px measured heading/chip inside the audit mobile card — below the 12 px floor. Raise in PR-GD-6. |
| Informes inline detail | all | 16 / 24 | full case detail | — | 40 | bounded target ≤ canvas | 862–1484 | — | **CLIPPED** | 0–48.8% visible; convert to bounded pattern (PR-GD-5). |
| Particular tracking card | 390×844 | 16 / 24 | 1 heading + timeline | 32 | — | ≈96 (+timeline) | 178 | **+82 (pre-timeline)** | OVEREXPANDED | Marketing-grade padding on an operational card; compact padding to operational scale in PR-GD-7. |

## 23. Operational Density Reallocation Plan

Rule applied: reclaimed area becomes operational data (rows, chips, status, actions) — never decorative whitespace. All px² measured; expected extra rows computed with the §17 row heights.

| Surface | VP | Wasted px² (measured) | Source of waste | Proposed operational data | Expected gain | Risk | PR |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| `?module=admin-health` | 1440×900 | 891,648 (68.8%) | Five ~135 px status cards atop an empty workspace (screenshot-proven) | Schema table (per-table status rows), runtime metrics history, failed-login alerts inline | +12–16 status/data rows | Low — read-only data already fetched by sibling cards | PR-GD-5 |
| `?module=admin-health` | 1920×1080 | 1,549,184 (74.7%) | Same | Same + two-column composition | +20 rows | Low | PR-GD-5 |
| `?module=admin-maintenance` | 1440×900 | 806,784 (62.3%) | 199 px dry-run card in an empty workspace | Candidates table with central pagination, last-run summary, schema section inline | +10–14 candidate rows | Low | PR-GD-5 |
| `/dashboard` (clinic hub) | 1440×900 | 686,656 (53.0%) | Cockpit is content-hugging; ~340 px full-width empty band below (screenshot-proven) | Two operational rails: recent reports (8×51 px rows) + upcoming visits/expiring tokens (5 rows), reusing `dashboard-list-row` | +13 operational rows on the home | Medium — cockpit E2E hooks must stay intact | PR-GD-3 |
| `/dashboard` (clinic hub) | 1920×1080 | 1,333,056 (64.3%) | Same | Same, three rails | +20 rows | Medium | PR-GD-3 |
| `/dashboard/admin` (admin hub) | 1440×900 | ~518,400 (40%) + hero surplus 144,715 (430.7×336) | Hero rail overexpansion + free band | Compact hero ≤300 px; reclaimed column = last audit events feed (10×37 px) + system status chips | +10 event rows on the admin home | Medium — hub hero unit test contracts | PR-GD-2 |
| `/dashboard/logistica` | 1440×900 | 648,320 (50.0%) | 286 px summary card + 3 list rows in a full-height main | Raise recent list to adaptive fill (14×51 px), add second KPI row (SLA/turnaround) | +8–11 rows | Low | PR-GD-4 |
| `/dashboard/logistica/visitas`, `/rutas` | 1920×1080 | 1,053,696 (50.8%) | Fixed table region + fixture-scale data; page cap not viewport-derived | Adaptive `limit` from canvas height (21 dense rows at 1080p vs 3 today) | +18 row capacity | Low — URL pager already exists | PR-GD-4/5 |
| Admin mobile hub launcher | 390×844 | 138,000 inside tiles (6 × 124.6 × 184.7) | Tiles stretched to fill stage | Per-module status line inside each tile (pending counts, alerts) | 6 operational status lines | Low | PR-GD-2/6 |
| Clinic informes summary | 1440×900 | list shows 3×49 px rows in a 664 px surface (≈450 px list capacity idle) | Fixed 3-row summary at every viewport (measured 3 rows at 360→1920) | Adaptive page size: 8–10 rows desktop, 5–6 mobile, keep pager | +5–7 rows | Low — pager and dialog contracts already exist | PR-GD-5 |
| Clinic logistica summary | 1440×900 | Same pattern (3 rows always) | Same | Adaptive rows + add pager (today NONE — §24) | +5 rows + deterministic pager | Low | PR-GD-5 |
| `/dashboard/informes` | all | Not "unused" (15–20%) but 435,740–945,404 px² clipped + up to 1,452,000 px² internal overflow | Unbounded inline detail inside inner scroller | Bounded detail (dialog ≤ md, capped inline ≥ lg) + rows freed by removing detail expansion from list flow | Detail 100% visible + 2–4 more rows | Medium — master-detail E2E specs | PR-GD-5 |
| `/particulares` authenticated | all | External scroll 1,037–2,515 px (see §27) + card padding surplus | Public-layout stacking + marketing paddings on operational cards | Single-viewport session layout at mobile per R-18: summary, tracking, report, actions in one bounded composition | External delta → 0 | Medium — public route shares marketing sections | PR-GD-7 |

Example (addendum format): Reclaimed 686,656 px² on 1440×900 clinic hub. Recommended use: two operational rails reusing `dashboard-list-row` (51.1 px) — 8 recent reports + 5 upcoming visits — preserving cockpit hierarchy and 44 px tap targets. Risk: cockpit `data-clinic-cockpit-*` E2E contracts; mitigated by adding rails as new siblings, not restructuring existing nodes.

## 24. Central Pagination Compliance Matrix

Probe basis §16.5; container center offset was 0 for every detected pager (containers are full-width), but screenshots show the **control cluster right-aligned** inside the footer (e.g., sessions, informes full route) — the required `Anterior | Página X de Y | Siguiente` centered cluster is therefore NOT met even where controls exist. "Reserved h" = §17 pagination reserve.

| Table/list/workspace | Pagination exists | Prev | Page X/Y | Next | Cluster centered | Fully visible in surface | Measured h | Reserved h | Pass/Fail | Required fix |
| --- | --- | --- | --- | --- | --- | --- | ---: | ---: | --- | --- |
| Clinic informes summary | Yes | Yes | Yes | Yes | No (right-aligned cluster) | Yes | 49 | 44 | PARTIAL | Center cluster (PR-GD-5) |
| Clinic logistica summary | **No** | — | — | — | — | — | 0 | 44 | **FAIL** | Add deterministic pager (PR-GD-5) |
| Clinic tokens | Not rendered (empty fixture state) | — | — | — | — | — | — | 44 | DEFERRED (fixture gap §18) | Verify with populated data in PR-GD-5 |
| Informes full route | Yes | Yes | Yes | Yes | No (right-aligned) | Yes | 57 | 44 | PARTIAL | Center cluster; detail bounding (PR-GD-5) |
| Logística visitas | Yes | Yes | Yes | Yes | No | **No @390×844 (below fold/clipped)** | 57 | 44 | **FAIL (P1 @mobile)** | Pager inside bounded surface + mobile rows (PR-GD-4) |
| Logística rutas | Yes | Yes | Yes | Yes | No | Yes | 57 | 44 | PARTIAL | Center cluster (PR-GD-4) |
| Logística métricas | Yes | Yes | Yes | Yes | No | **No @390×844** | 57 | 44 | **FAIL (P1 @mobile)** | Same as visitas (PR-GD-4) |
| Admin hub mobile launcher | Yes (hub pager, dots+status) | Yes | Yes | Yes | Yes | Yes | 34 | 34 | PASS | Keep (E2E-locked 6/page) |
| Admin clinics | Not detected by probe (fixture: 1 row) | — | — | — | — | — | — | 44 | VERIFY | Confirm pager markup + centering with populated data (PR-GD-5) |
| Admin reports (workflow) | Yes | Yes | Yes | Yes | No | Yes | 31–43 | 44 | PARTIAL | Center cluster (PR-GD-5) |
| Admin particular tokens | Yes @390 (h=43); not detected @1440 | Yes | Yes | Yes | No | Yes | 43 | 44 | PARTIAL + VERIFY desktop | Unify markup on shared pager (PR-GD-5) |
| Admin pricing (CompactPager ×2) | Yes | Yes | Yes | Yes | No | Yes | 41 | 44 | PARTIAL | Center cluster (PR-GD-5) |
| Admin sessions | Yes (footer present in error state) | Yes | Yes | Yes | No (right-aligned — screenshot) | Yes | 37–41 | 44 | PARTIAL (data deferred §18) | Center cluster (PR-GD-5) |
| Admin users/roles | Yes | Yes | Yes | Yes | No | Yes | 37–41 | 44 | PARTIAL | Center cluster (PR-GD-5) |
| Admin audit log | Yes @390 (×2, h=41); not detected @1440 | Yes | Yes | Yes | No | Yes | 41 | 44 | PARTIAL + VERIFY desktop | Unify markup (PR-GD-5) |
| Admin maintenance | Pager mounts with data (CompactPager); not rendered in measured state | — | — | — | — | — | — | 44 | DEFERRED | Verify with dry-run data (PR-GD-5) |
| Particular session cards | N/A (single case view) | — | — | — | — | — | — | — | N/A | No-scroll fit instead (PR-GD-7) |

Global verdict: **no infinite scroll or append-on-scroll exists anywhere (0/230)** — the deterministic model is intact. The compliance gap is (a) two missing pagers (clinic logistica summary; anything hidden by fixture gaps to verify), (b) two P1 out-of-surface pagers on logistics mobile, and (c) systematic right-aligned clusters instead of the required centered `Anterior | Página X de Y | Siguiente`. One shared, centered, height-reserved pager component (extending `CompactPager`) resolves (c) everywhere.

## 25. Column Geometry Matrix

Measured `thead th` widths at 1440×900. Priority per the mandated order (identifier → status → date → metric → owner → action → metadata). Mobile transformation states whether a structured mobile row variant exists today.

**Clinic informes summary (table w=1395):** CASO/PACIENTE 363 (26.0%) · ESTUDIO 237 (17.0%) · ESTADO 209 (15.0%) · FECHA 195 (14.0%) · ARCHIVO/INFORME 251 (18.0%) · ACCIÓN 140 (10.0%). Verdict: balanced; ESTADO could yield ~60 px to CASO on narrow desktops (badge needs ≤ 150). Mobile: structured rows exist (`data-clinic-reports-mobile-row`: primary=paciente, secondary=estudio·fecha, status chip right, action inline; max h 62, min 44; rows/page adaptive 5–6). No action required beyond min/max locks.

**Logística visitas (w=1393):** ID 61 (4.4%) · CLÍNICA 510 (36.6%) · DIRECCIÓN 180 (12.9%) · PROGRAMADA 187 (13.4%) · COMPLETADA 181 (13.0%) · ESTADO 123 (8.8%) · NOTAS 150 (10.8%). Verdict: **imbalanced** — CLÍNICA absorbs free width (min 220 / max 320 suffices; truncate + title attr); NOTAS should collapse into metadata/detail. Mobile: **NO row variant — table x-scrolls 508 px @390 (P1)**. Required mobile row: primary=clínica, secondary=programada→completada, status chip, notas→detail; max h 72, min 44; 8–10 rows/page.

**Logística rutas (w=1393):** ID 122 (8.8%) · NOMBRE 280 (20.1%) · FECHA PLANIFICADA 345 (24.8%) · PARADAS 191 (13.7%) · PROGRESO 211 (15.1%) · ESTADO 244 (17.5%). Verdict: **imbalanced** — a date column at 24.8% and a badge column at 17.5% (dates need ≤ 180, badges ≤ 150); reclaim ~260 px for NOMBRE/PROGRESO. Mobile: no row variant — same P1 family as visitas.

**Admin clinics (w=1361):** CLÍNICA 247 (18.1%) · CONTACTO 310 (22.8%) · USUARIO 265 (19.5%) · FECHAS 244 (17.9%) · ACCIONES 294 (21.6%). Verdict: **imbalanced + over-tall rows (156.5 px)** — cells stack sublines; ACCIONES at 21.6% is double the action norm (≤ 140 px). Collapse CONTACTO/USUARIO sublines into one metadata line + drawer. Mobile: structured cards exist (`data-admin-clinic-mobile-card`) — keep.

**Admin reports workflow (w=1361):** CASO/PACIENTE 272 (20.0%) · CLÍNICA 245 (18.0%) · ESTUDIO 191 (14.0%) · ESTADO 204 (15.0%) · FECHA 163 (12.0%) · ARCHIVO 177 (13.0%) · ACCIÓN 109 (8.0%). Verdict: balanced; the desktop density reference (35.7 px rows). Mobile rows exist.

**Admin particular tokens (w=1361):** TOKEN/PACIENTE 272 (20.0%) · CLÍNICA 245 (18.0%) · ESTADO 150 (11.0%) · INFORME 163 (12.0%) · ÚLTIMO ACCESO 204 (15.0%) · CREADO 191 (14.0%) · ACCIÓN 136 (10.0%). Verdict: balanced; two date columns could merge under a narrow-desktop rule (< 1280: keep ÚLTIMO ACCESO, move CREADO to detail). Mobile rows exist.

**Admin users/roles (w=1361):** USUARIO 245 (18.0%) · TIPO 136 (10.0%) · ROL 191 (14.0%) · CLÍNICA 317 (23.3%) · CREADO 168 (12.3%) · ACTUALIZADO 168 (12.3%) · ACCIÓN 136 (10.0%). Verdict: near-balanced; CLÍNICA is the flexible column (min 200/max 280); one of CREADO/ACTUALIZADO collapses first at < 1280. Mobile rows exist.

**Admin audit (w=1361):** FECHA 152 (11.2%) · ACTOR 160 (11.8%) · ACCIÓN(evento) 192 (14.1%) · ENTIDAD 160 (11.8%) · DETALLE 625 (45.9%) · ACCIÓN 72 (5.3%). Verdict: DETALLE at 45.9% is the metadata column by design, but must be `line-clamp:1` with dialog for full detail (min 300/max 640); action at 72 px is below the 96 px comfortable min. Mobile rows exist (14 rows @390 — the best mobile density in the product).

Global truncation/alignment rules to codify (PR-GD-5): identifiers left + `truncate`; dates left, fixed 150–180 px, `tabular-nums`; badges center, 110–150 px; metrics right; actions right, 96–140 px; every flexible column `min-w-0` + `truncate`; no cell may wrap beyond 2 lines (clinics table currently violates).

## 26. Screenshot Evidence Index

78 screenshots captured in `global-dashboard-redesign-screenshot-evidence/` (naming: `<role>__<route-slug>__<WxH>__before.png`). Each proves current-state bounds, density, pagination placement and any surface escape. Index below; findings reference §27 classifications.

| Screenshot | Route | Viewport | What it proves | Finding |
| --- | --- | ---: | --- | --- |
| clinic__dashboard-logistica__360x740__before.png | dashboard-logistica | 360x740 | Low-density hub card, ~50% unused desktop | P2_DENSITY_WASTE / P2_UNDERUTILIZED_LIST_CAPACITY |
| clinic__dashboard-logistica-metricas__360x740__before.png | dashboard-logistica-metricas | 360x740 | Metric stack + table exceeding small-mobile viewport | P1_CARD_CLIPPING + P1_PAGINATION_OUT_OF_SURFACE (mobile) |
| particular__particulares-authenticated__360x740__before.png | particulares-authenticated | 360x740 | Authenticated session panel inside public layout; page scrolls externally | P1_ZERO_OVERFLOW_FAILURE (all viewports) |
| clinic__dashboard-logistica-metricas__375x667__before.png | dashboard-logistica-metricas | 375x667 | Metric stack + table exceeding small-mobile viewport | P1_CARD_CLIPPING + P1_PAGINATION_OUT_OF_SURFACE (mobile) |
| clinic__dashboard__390x844__before.png | dashboard | 390x844 | Clinic hub cockpit bounds, tile/KPI density, empty band below cockpit on desktop | P2_DENSITY_WASTE (desktop), COMPACT_VALID tiles |
| clinic__dashboard-module-operaciones__390x844__before.png | dashboard-module-operaciones | 390x844 | Workspace bounds, KPI pills, panel composition | DENSITY_BALANCED; metric cards OVEREXPANDED mobile |
| clinic__dashboard-module-informes__390x844__before.png | dashboard-module-informes | 390x844 | Summary list density (3 rows at every viewport), pager placement | P2_UNDERUTILIZED_LIST_CAPACITY; pager cluster right-aligned |
| clinic__dashboard-module-logistica__390x844__before.png | dashboard-module-logistica | 390x844 | Summary list without pagination control | P1-adjacent: missing pager (see 24) |
| clinic__dashboard-module-perfil__390x844__before.png | dashboard-module-perfil | 390x844 | Profile tabs bounded in workspace | Supports PASS (no escape) |
| clinic__dashboard-module-tokens__390x844__before.png | dashboard-module-tokens | 390x844 | Empty state under fixture; toolbar/CTA bounds | DEFERRED: fixture gap (18) |
| clinic__dashboard-informes__390x844__before.png | dashboard-informes | 390x844 | Inline master-detail: internal scroller and buried/clipped detail | P1_CARD_CLIPPING + internal overflow |
| clinic__dashboard-logistica__390x844__before.png | dashboard-logistica | 390x844 | Low-density hub card, ~50% unused desktop | P2_DENSITY_WASTE / P2_UNDERUTILIZED_LIST_CAPACITY |
| clinic__dashboard-logistica-visitas__390x844__before.png | dashboard-logistica-visitas | 390x844 | Table column overflow on mobile, pager below fold; column imbalance desktop | P1_TABLE_COLUMN_COLLAPSE_FAILURE + P1_PAGINATION_OUT_OF_SURFACE (mobile); P2_COLUMN_SPACING_IMBALANCE |
| clinic__dashboard-logistica-rutas__390x844__before.png | dashboard-logistica-rutas | 390x844 | Same table family; date/badge columns oversized | P2_COLUMN_SPACING_IMBALANCE |
| clinic__dashboard-logistica-metricas__390x844__before.png | dashboard-logistica-metricas | 390x844 | Metric stack + table exceeding small-mobile viewport | P1_CARD_CLIPPING + P1_PAGINATION_OUT_OF_SURFACE (mobile) |
| admin__dashboard-admin__390x844__before.png | dashboard-admin | 390x844 | Hub hero rail size vs content; launcher tile overexpansion mobile | P2_OVEREXPANDED_CARD (hero, mobile tiles) |
| admin__dashboard-admin-module-admin__390x844__before.png | dashboard-admin-module-admin | 390x844 | Command center composition and status items | DENSITY_BALANCED |
| admin__dashboard-admin-module-admin-clinics__390x844__before.png | dashboard-admin-module-admin-clinics | 390x844 | Over-tall table rows (156.5px), action column width | P2_OVEREXPANDED_CARD rows + P2_COLUMN_SPACING_IMBALANCE |
| admin__dashboard-admin-module-admin-report-upload__390x844__before.png | dashboard-admin-module-admin-report-upload | 390x844 | Dense reference table (35.7px rows), pager placement | COMPACT_VALID; pager cluster right-aligned |
| admin__dashboard-admin-module-admin-particular-tokens__390x844__before.png | dashboard-admin-module-admin-particular-tokens | 390x844 | Dense table + mobile list parity | COMPACT_VALID |
| admin__dashboard-admin-module-admin-pricing__390x844__before.png | dashboard-admin-module-admin-pricing | 390x844 | Tabs + CompactPager placement | PARTIAL pagination centering |
| admin__dashboard-admin-module-admin-sessions__390x844__before.png | dashboard-admin-module-admin-sessions | 390x844 | Fixture gap error state; right-aligned pager cluster | DEFERRED data (18); centering FAIL evidence |
| admin__dashboard-admin-module-admin-users-roles__390x844__before.png | dashboard-admin-module-admin-users-roles | 390x844 | Dense table density and pager | COMPACT_VALID; centering PARTIAL |
| admin__dashboard-admin-module-audit-log__390x844__before.png | dashboard-admin-module-audit-log | 390x844 | Best mobile density (14 rows), DETALLE column dominance desktop | COMPACT_VALID; 11px label UNDERREADABLE (mobile) |
| admin__dashboard-admin-module-admin-health__390x844__before.png | dashboard-admin-module-admin-health | 390x844 | Five status cards atop empty workspace (57-75% unused) | P2_DENSITY_WASTE (worst offender) |
| admin__dashboard-admin-module-admin-maintenance__390x844__before.png | dashboard-admin-module-admin-maintenance | 390x844 | 199px card in empty workspace | P2_DENSITY_WASTE |
| particular__particulares-authenticated__390x844__before.png | particulares-authenticated | 390x844 | Authenticated session panel inside public layout; page scrolls externally | P1_ZERO_OVERFLOW_FAILURE (all viewports) |
| clinic__dashboard-informes__430x932__before.png | dashboard-informes | 430x932 | Inline master-detail: internal scroller and buried/clipped detail | P1_CARD_CLIPPING + internal overflow |
| clinic__dashboard__768x1024__before.png | dashboard | 768x1024 | Clinic hub cockpit bounds, tile/KPI density, empty band below cockpit on desktop | P2_DENSITY_WASTE (desktop), COMPACT_VALID tiles |
| admin__dashboard-admin__768x1024__before.png | dashboard-admin | 768x1024 | Hub hero rail size vs content; launcher tile overexpansion mobile | P2_OVEREXPANDED_CARD (hero, mobile tiles) |
| clinic__dashboard-informes__1024x768__before.png | dashboard-informes | 1024x768 | Inline master-detail: internal scroller and buried/clipped detail | P1_CARD_CLIPPING + internal overflow |
| admin__dashboard-admin__1024x768__before.png | dashboard-admin | 1024x768 | Hub hero rail size vs content; launcher tile overexpansion mobile | P2_OVEREXPANDED_CARD (hero, mobile tiles) |
| clinic__dashboard__1366x768__before.png | dashboard | 1366x768 | Clinic hub cockpit bounds, tile/KPI density, empty band below cockpit on desktop | P2_DENSITY_WASTE (desktop), COMPACT_VALID tiles |
| clinic__dashboard-module-operaciones__1366x768__before.png | dashboard-module-operaciones | 1366x768 | Workspace bounds, KPI pills, panel composition | DENSITY_BALANCED; metric cards OVEREXPANDED mobile |
| clinic__dashboard-module-informes__1366x768__before.png | dashboard-module-informes | 1366x768 | Summary list density (3 rows at every viewport), pager placement | P2_UNDERUTILIZED_LIST_CAPACITY; pager cluster right-aligned |
| clinic__dashboard-module-logistica__1366x768__before.png | dashboard-module-logistica | 1366x768 | Summary list without pagination control | P1-adjacent: missing pager (see 24) |
| clinic__dashboard-module-perfil__1366x768__before.png | dashboard-module-perfil | 1366x768 | Profile tabs bounded in workspace | Supports PASS (no escape) |
| clinic__dashboard-module-tokens__1366x768__before.png | dashboard-module-tokens | 1366x768 | Empty state under fixture; toolbar/CTA bounds | DEFERRED: fixture gap (18) |
| clinic__dashboard-informes__1366x768__before.png | dashboard-informes | 1366x768 | Inline master-detail: internal scroller and buried/clipped detail | P1_CARD_CLIPPING + internal overflow |
| clinic__dashboard-logistica__1366x768__before.png | dashboard-logistica | 1366x768 | Low-density hub card, ~50% unused desktop | P2_DENSITY_WASTE / P2_UNDERUTILIZED_LIST_CAPACITY |
| clinic__dashboard-logistica-visitas__1366x768__before.png | dashboard-logistica-visitas | 1366x768 | Table column overflow on mobile, pager below fold; column imbalance desktop | P1_TABLE_COLUMN_COLLAPSE_FAILURE + P1_PAGINATION_OUT_OF_SURFACE (mobile); P2_COLUMN_SPACING_IMBALANCE |
| clinic__dashboard-logistica-rutas__1366x768__before.png | dashboard-logistica-rutas | 1366x768 | Same table family; date/badge columns oversized | P2_COLUMN_SPACING_IMBALANCE |
| clinic__dashboard-logistica-metricas__1366x768__before.png | dashboard-logistica-metricas | 1366x768 | Metric stack + table exceeding small-mobile viewport | P1_CARD_CLIPPING + P1_PAGINATION_OUT_OF_SURFACE (mobile) |
| admin__dashboard-admin__1366x768__before.png | dashboard-admin | 1366x768 | Hub hero rail size vs content; launcher tile overexpansion mobile | P2_OVEREXPANDED_CARD (hero, mobile tiles) |
| admin__dashboard-admin-module-admin__1366x768__before.png | dashboard-admin-module-admin | 1366x768 | Command center composition and status items | DENSITY_BALANCED |
| admin__dashboard-admin-module-admin-clinics__1366x768__before.png | dashboard-admin-module-admin-clinics | 1366x768 | Over-tall table rows (156.5px), action column width | P2_OVEREXPANDED_CARD rows + P2_COLUMN_SPACING_IMBALANCE |
| admin__dashboard-admin-module-admin-report-upload__1366x768__before.png | dashboard-admin-module-admin-report-upload | 1366x768 | Dense reference table (35.7px rows), pager placement | COMPACT_VALID; pager cluster right-aligned |
| admin__dashboard-admin-module-admin-particular-tokens__1366x768__before.png | dashboard-admin-module-admin-particular-tokens | 1366x768 | Dense table + mobile list parity | COMPACT_VALID |
| admin__dashboard-admin-module-admin-pricing__1366x768__before.png | dashboard-admin-module-admin-pricing | 1366x768 | Tabs + CompactPager placement | PARTIAL pagination centering |
| admin__dashboard-admin-module-admin-sessions__1366x768__before.png | dashboard-admin-module-admin-sessions | 1366x768 | Fixture gap error state; right-aligned pager cluster | DEFERRED data (18); centering FAIL evidence |
| admin__dashboard-admin-module-admin-users-roles__1366x768__before.png | dashboard-admin-module-admin-users-roles | 1366x768 | Dense table density and pager | COMPACT_VALID; centering PARTIAL |
| admin__dashboard-admin-module-audit-log__1366x768__before.png | dashboard-admin-module-audit-log | 1366x768 | Best mobile density (14 rows), DETALLE column dominance desktop | COMPACT_VALID; 11px label UNDERREADABLE (mobile) |
| admin__dashboard-admin-module-admin-health__1366x768__before.png | dashboard-admin-module-admin-health | 1366x768 | Five status cards atop empty workspace (57-75% unused) | P2_DENSITY_WASTE (worst offender) |
| admin__dashboard-admin-module-admin-maintenance__1366x768__before.png | dashboard-admin-module-admin-maintenance | 1366x768 | 199px card in empty workspace | P2_DENSITY_WASTE |
| particular__particulares-authenticated__1366x768__before.png | particulares-authenticated | 1366x768 | Authenticated session panel inside public layout; page scrolls externally | P1_ZERO_OVERFLOW_FAILURE (all viewports) |
| clinic__dashboard__1440x900__before.png | dashboard | 1440x900 | Clinic hub cockpit bounds, tile/KPI density, empty band below cockpit on desktop | P2_DENSITY_WASTE (desktop), COMPACT_VALID tiles |
| clinic__dashboard-module-operaciones__1440x900__before.png | dashboard-module-operaciones | 1440x900 | Workspace bounds, KPI pills, panel composition | DENSITY_BALANCED; metric cards OVEREXPANDED mobile |
| clinic__dashboard-module-informes__1440x900__before.png | dashboard-module-informes | 1440x900 | Summary list density (3 rows at every viewport), pager placement | P2_UNDERUTILIZED_LIST_CAPACITY; pager cluster right-aligned |
| clinic__dashboard-module-logistica__1440x900__before.png | dashboard-module-logistica | 1440x900 | Summary list without pagination control | P1-adjacent: missing pager (see 24) |
| clinic__dashboard-module-perfil__1440x900__before.png | dashboard-module-perfil | 1440x900 | Profile tabs bounded in workspace | Supports PASS (no escape) |
| clinic__dashboard-module-tokens__1440x900__before.png | dashboard-module-tokens | 1440x900 | Empty state under fixture; toolbar/CTA bounds | DEFERRED: fixture gap (18) |
| clinic__dashboard-informes__1440x900__before.png | dashboard-informes | 1440x900 | Inline master-detail: internal scroller and buried/clipped detail | P1_CARD_CLIPPING + internal overflow |
| clinic__dashboard-logistica__1440x900__before.png | dashboard-logistica | 1440x900 | Low-density hub card, ~50% unused desktop | P2_DENSITY_WASTE / P2_UNDERUTILIZED_LIST_CAPACITY |
| clinic__dashboard-logistica-visitas__1440x900__before.png | dashboard-logistica-visitas | 1440x900 | Table column overflow on mobile, pager below fold; column imbalance desktop | P1_TABLE_COLUMN_COLLAPSE_FAILURE + P1_PAGINATION_OUT_OF_SURFACE (mobile); P2_COLUMN_SPACING_IMBALANCE |
| clinic__dashboard-logistica-rutas__1440x900__before.png | dashboard-logistica-rutas | 1440x900 | Same table family; date/badge columns oversized | P2_COLUMN_SPACING_IMBALANCE |
| clinic__dashboard-logistica-metricas__1440x900__before.png | dashboard-logistica-metricas | 1440x900 | Metric stack + table exceeding small-mobile viewport | P1_CARD_CLIPPING + P1_PAGINATION_OUT_OF_SURFACE (mobile) |
| admin__dashboard-admin__1440x900__before.png | dashboard-admin | 1440x900 | Hub hero rail size vs content; launcher tile overexpansion mobile | P2_OVEREXPANDED_CARD (hero, mobile tiles) |
| admin__dashboard-admin-module-admin__1440x900__before.png | dashboard-admin-module-admin | 1440x900 | Command center composition and status items | DENSITY_BALANCED |
| admin__dashboard-admin-module-admin-clinics__1440x900__before.png | dashboard-admin-module-admin-clinics | 1440x900 | Over-tall table rows (156.5px), action column width | P2_OVEREXPANDED_CARD rows + P2_COLUMN_SPACING_IMBALANCE |
| admin__dashboard-admin-module-admin-report-upload__1440x900__before.png | dashboard-admin-module-admin-report-upload | 1440x900 | Dense reference table (35.7px rows), pager placement | COMPACT_VALID; pager cluster right-aligned |
| admin__dashboard-admin-module-admin-particular-tokens__1440x900__before.png | dashboard-admin-module-admin-particular-tokens | 1440x900 | Dense table + mobile list parity | COMPACT_VALID |
| admin__dashboard-admin-module-admin-pricing__1440x900__before.png | dashboard-admin-module-admin-pricing | 1440x900 | Tabs + CompactPager placement | PARTIAL pagination centering |
| admin__dashboard-admin-module-admin-sessions__1440x900__before.png | dashboard-admin-module-admin-sessions | 1440x900 | Fixture gap error state; right-aligned pager cluster | DEFERRED data (18); centering FAIL evidence |
| admin__dashboard-admin-module-admin-users-roles__1440x900__before.png | dashboard-admin-module-admin-users-roles | 1440x900 | Dense table density and pager | COMPACT_VALID; centering PARTIAL |
| admin__dashboard-admin-module-audit-log__1440x900__before.png | dashboard-admin-module-audit-log | 1440x900 | Best mobile density (14 rows), DETALLE column dominance desktop | COMPACT_VALID; 11px label UNDERREADABLE (mobile) |
| admin__dashboard-admin-module-admin-health__1440x900__before.png | dashboard-admin-module-admin-health | 1440x900 | Five status cards atop empty workspace (57-75% unused) | P2_DENSITY_WASTE (worst offender) |
| admin__dashboard-admin-module-admin-maintenance__1440x900__before.png | dashboard-admin-module-admin-maintenance | 1440x900 | 199px card in empty workspace | P2_DENSITY_WASTE |
| particular__particulares-authenticated__1440x900__before.png | particulares-authenticated | 1440x900 | Authenticated session panel inside public layout; page scrolls externally | P1_ZERO_OVERFLOW_FAILURE (all viewports) |


## 27. Surface Escape Failures

Everything that leaves — or measurably risks leaving — the rendered surface, with measured rects and evidence. All other 220 dashboard cells prove `external_scroll_delta = 0`, `horizontal_scroll_delta = 0` (document level), `topbar_visible = true`, `bottom_nav_visible_if_applicable = true`.

| Route | Viewport(s) | Component | Selector | Measured rect / delta | Failure type | Screenshot evidence | Remediation PR |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/particulares` (authenticated) | all 10 | Document | `html`/`body` | extV = 2472 / 2515 / 2315 / 2176 / 2139 / 1333 / 1389 / 1349 / 1217 / 1037 px (360×740 → 1920×1080) | **P1_ZERO_OVERFLOW_FAILURE** | `particular__particulares-authenticated__390x844__before.png` (+3) | PR-GD-7 |
| `/dashboard/informes` | all 10 | Inline case detail | `.dashboard-inline-detail` | h = 862–1484 px; visible 0% (360/375/390-class), 4.5–13.8% (mobile/laptop), 28.2% @1440, 48.8% @1920; clipped px² up to 945,404 | **P1_CARD_CLIPPING** | `clinic__dashboard-informes__1366x768__before.png`, `…__430x932__before.png` | PR-GD-5 |
| `/dashboard/informes` | all 10 | List scroller | `.dashboard-inline-scroll` | internal ΔV = 800–1981 px; overflow px² up to 1,452,000 @1920×1080 | P1-adjacent internal overflow (bounded scroller carrying the clipped detail) | same | PR-GD-5 |
| `/dashboard/logistica/visitas` | 360×740–430×932 | Data table wrapper | `.overflow-auto` table wrapper (`relative w-full overflow-auto …`) | internal ΔH = 538 / 523 / 508 / 487 / 469 px (table w=879 in a 390 px viewport) | **P1_TABLE_COLUMN_COLLAPSE_FAILURE** (no mobile row variant) | `clinic__dashboard-logistica-visitas__390x844__before.png`, `…__360x740__before.png` | PR-GD-4 |
| `/dashboard/logistica/visitas` | 390×844 | Pagination control | table pager footer | fullyVisible = false (below the clipped surface fold) | **P1_PAGINATION_OUT_OF_SURFACE** | same | PR-GD-4 |
| `/dashboard/logistica/metricas` | 390×844 | Pagination control | table pager footer | fullyVisible = false | **P1_PAGINATION_OUT_OF_SURFACE** | `clinic__dashboard-logistica-metricas__390x844__before.png` | PR-GD-4 |
| `/dashboard/logistica/metricas` | 360×740, 375×667 | Metrics surface | `.dashboard-surface` | h = 759 px in 740/667 px viewports (visible 33.35% @360 per quantum audit; card stack 4×134 px precedes the table) | **P1_CARD_CLIPPING** | `…__360x740__before.png`, `…__375x667__before.png` | PR-GD-4 |
| `/dashboard/logistica/visitas` | 360×740, 375×667 | Visits surface | `.dashboard-surface` | h = 590 px; visible 53.8–65.7%; clipped px² 347,628–397,399 | **P1_CARD_CLIPPING** | `…__360x740__before.png` | PR-GD-4 |
| `/dashboard/logistica/rutas` | mobile | Same table family | `table` | column overflow risk (same wrapper); measured below visitas but same pattern | P1 risk — verify in PR-GD-4 evidence | `clinic__dashboard-logistica-rutas__390x844__before.png` | PR-GD-4 |
| `?module=admin-health` / `admin-maintenance` | ≥768 wide | Workspace | stage/main free space | 57.2–74.7% of viewport unused | **P2_DENSITY_WASTE** | `admin__dashboard-admin-module-admin-health__1440x900__before.png` | PR-GD-5 |
| `/dashboard` (clinic hub) | ≥768 wide | Main free band | below cockpit | 46.6–64.3% unused (366,400–1,333,056 px²) | **P2_DENSITY_WASTE / P2_UNDERUTILIZED_LIST_CAPACITY** | `clinic__dashboard__1440x900__before.png` | PR-GD-3 |
| `/dashboard/admin` | ≥1366 wide | Hero rail | `[data-dashboard-hub-hero]` | 336×687.7 px for 5 data points (+430.7 px surplus) | **P2_OVEREXPANDED_CARD** | `admin__dashboard-admin__1440x900__before.png` | PR-GD-2 |
| `/dashboard/admin` | mobile | Launcher tiles | `[data-admin-mobile-hub-tile]` | 210.6 px tile vs 86 px min content (+124.6 px each) | **P2_OVEREXPANDED_CARD** | `admin__dashboard-admin__390x844__before.png` | PR-GD-2/6 |
| `?module=admin-clinics` | 1440×900 | Table rows | `tbody tr` | 156.5 px rows (stacked sublines) | **P2_OVEREXPANDED_CARD** | `admin__dashboard-admin-module-admin-clinics__1440x900__before.png` | PR-GD-5 |
| Clinic summaries (informes/logistica) | all | List capacity | summary lists | 3 visible rows at every viewport incl. 1920×1080 | **P2_UNDERUTILIZED_LIST_CAPACITY** | `clinic__dashboard-module-informes__1440x900__before.png` | PR-GD-5 |
| Logistics/audit tables | 1440×900 | Columns | see §25 | CLÍNICA 36.6%, FECHA PLANIFICADA 24.8%, DETALLE 45.9% | **P2_COLUMN_SPACING_IMBALANCE** | route screenshots @1440 | PR-GD-4/5 |
| Audit mobile card label | 390×844 | Chip/heading | audit mobile module | 11 px font (< 12 px floor) | P2 (UNDERREADABLE) | `admin__dashboard-admin-module-audit-log__390x844__before.png` | PR-GD-6 |

No `P1_PRIMARY_ACTION_OUT_OF_SURFACE` was found on dashboard surfaces: primary CTAs (upload, generate token, save, revoke, back-to-hub) were visible inside the viewport in all 220 dashboard cells.

## 28. Revised Implementation Priority

The pixel evidence changes the order. **List/table density, pagination geometry and the two P1 escape families are bigger blockers than the hub visuals.** The hubs waste space (P2) but nothing escapes them; the escapes live in Particular, informes full route, and the logistics full-route tables.

Revised PR order (supersedes §10/§14 ordering; scopes unchanged):

1. **PR-GD-1 — Fixed-viewport substrate** (unchanged, still first; everything below consumes its tokens).
2. **PR-GD-7 — Particular no-scroll integration** (moved up from 7th: it owns the only external-scroll failures in the product — 10/10 viewports, extV up to 2,515 px; independent scope, no dashboard-shell risk).
3. **PR-GD-4 — Full-route workspace grammar** (moved up: fixes P1 table column collapse + P1 pagination-out-of-surface + metricas/visitas card clipping on mobile; introduces mobile row variants for visitas/rutas/metricas and compact metric strips).
4. **PR-GD-5 — Density/pagination engine + page cache** (fixes P1 informes inline-detail clipping/overflow; centered shared pager everywhere; adaptive page sizes for the 3-row summaries; admin-health/maintenance/clinics density reallocation; column min/max/truncation locks).
5. **PR-GD-2 — Admin hub redesign** (hero compaction +430 px, launcher tile densification, activity feed reallocation).
6. **PR-GD-3 — Clinic hub redesign** (operational rails into the 53–64% empty band; cockpit contracts intact).
7. **PR-GD-6 — Mobile system pass** (11 px floor fix, tile status lines, family unification).
8. **PR-GD-8 — Runtime re-measurement evidence** (re-run this exact 230-cell protocol + screenshot set as the after-evidence; acceptance = §12 plus: unused ≤ 15% on any ≥768-wide workspace, ≤ 35% on hubs after rails, zero P1 rows in §27, pagination matrix 100% PASS).

Direct answers required by the addendum: the surfaces wasting the most operational space are `admin-health`/`admin-maintenance` (57–75% desktop/tablet), the clinic hub (47–64% desktop), `/dashboard/logistica` (50–59%) and the admin hub (40–50%). The most overexpanded components relative to font/content are the admin mobile launcher tiles (+124.6 px each), the admin hero rail (+430.7 px), admin clinics rows (+81.5 px) and the mobile metric cards (+38/+46 px). The lists that must gain visible rows are the clinic informes/logistica summaries (3 → 8–10 desktop), logistics full-route tables (3 → 17–21 capacity at desktop), and audit/users tables at ≥1440 (9 → 17+). The dashboards lacking proper central pagination are: clinic logistica summary (none), logistics visitas/metricas on mobile (out of surface), and every existing pager fails the centered-cluster requirement. The worst column geometry is visitas (CLÍNICA 36.6%), rutas (dates/badges oversized), admin clinics (stacked cells, 21.6% action column) and audit DETALLE (needs clamp). The components to redesign first are the informes inline detail, the logistics mobile tables, and the Particular authenticated layout. **Implementation starts with PR-GD-1, immediately followed by PR-GD-7 and PR-GD-4.**

