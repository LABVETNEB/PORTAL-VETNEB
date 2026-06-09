# PR5 — feat(dashboard): add card-based navigation shell

## Summary

Replaces sidebar list navigation with a visual card-based navigation hub in both clinic and admin dashboards. The sidebar becomes a compact icon-only rail (always `w-[4.5rem]`). The shell viewport is fixed to `h-dvh overflow-hidden` to prevent global body scroll; all scrolling happens inside the main content area.

**Files changed:**

| File | Change |
|---|---|
| `frontend/src/components/dashboard/DashboardShellRouter.tsx` | `min-h-screen` → `h-dvh overflow-hidden`; inner div reordered |
| `frontend/src/components/dashboard/DashboardSidebarFrame.tsx` | Removed `sm:w-64`; text labels → `sr-only`; added `aria-label`/`title` attrs |
| `frontend/src/app/globals.css` | `.dashboard-main` gains `overflow-y-auto` |
| `frontend/src/components/dashboard/DashboardModuleHub.tsx` | New server component — renders card grid |
| `frontend/src/app/dashboard/page.tsx` | Added `DashboardModuleHub` with 5 clinic cards; removed `StickyActionBar` |
| `frontend/src/app/dashboard/admin/page.tsx` | Added `DashboardModuleHub` with 10 admin cards; removed `StickyActionBar` |
| `frontend/e2e/dashboard-card-navigation-shell.spec.ts` | New e2e test suite |

---

## Visual architecture

```
┌────────────────────────────────────────────────────────┐  h-dvh overflow-hidden (DashboardShellRouter)
│ [icon rail]  [DashboardTopbar ─ sticky top-0]          │
│  w-[4.5rem]  [─────────────────────────────────────]  │
│              [dashboard-main: flex-1 overflow-y-auto]  │
│              │  DashboardPageHeader                    │
│              │  DashboardModuleHub ◄── card grid       │
│              │    ┌──────┐ ┌──────┐ ┌──────┐          │
│              │    │ card │ │ card │ │ card │  ...      │
│              │    └──────┘ └──────┘ └──────┘          │
│              │  ClinicCommandCenter (id="clinic-command-center") │
│              │  ClinicPublicProfileCard                │
│              │  ClinicParticularTokensCard             │
│              └────────────────────────────────────────┘
└────────────────────────────────────────────────────────┘
```

---

## Dashboard clinic behavior

`/dashboard` renders 5 module cards:

| Card | Icon | href | Badge |
|---|---|---|---|
| Centro de operaciones | `LayoutDashboard` | `/dashboard#clinic-command-center` | `pendingReports` (destructive) |
| Informes | `FileText` | `/dashboard/informes` | — |
| Logística | `Route` | `/dashboard/logistica` | `activeVisits` (default) |
| Perfil público | `Building2` | `/dashboard#clinic-public-profile` | — |
| Tokens particulares | `KeyRound` | `/dashboard#clinic-particular-tokens` | — |

Hash cards (Centro de operaciones, Perfil público, Tokens particulares) scroll within the current page — the target sections already have `id` and `scroll-mt-20` for topbar compensation.

---

## Dashboard admin behavior

`/dashboard/admin` renders 10 module cards:

| Card | Icon | href | Badge |
|---|---|---|---|
| Administración | `Settings2` | `#admin-command-center` | — |
| Subir informe | `ClipboardPlus` | `#admin-report-upload` | — |
| Estado del sistema | `Activity` | `#admin-health` | system status (if not "ok") |
| Clínicas | `Building2` | `#admin-clinics` | — |
| Tokens particulares | `TicketCheck` | `#admin-particular-tokens` | — |
| Precios | `ReceiptText` | `#admin-pricing` | — |
| Sesiones | `KeyRound` | `#admin-sessions` | — |
| Roles clínica | `UsersRound` | `#admin-users-roles` | — |
| Auditoría | `ScrollText` | `#audit-log` | — |
| Mantenimiento | `ShieldCheck` | `#admin-maintenance` | — |

Hash navigation triggers `hashchange` → `AdminSectionTabs` switches to the matching tab and scrolls to the anchor element.

---

## No-global-scroll strategy

**Problem:** default `min-h-screen` shell allows body to grow beyond viewport → browser shows global scrollbar.

**Solution:**

1. `DashboardShellRouter` → `flex h-dvh overflow-hidden` clips the shell to the device viewport height. `overflow-hidden` prevents body scroll.
2. The content column (`flex-1 flex-col`) inherits full height via flex `align-items: stretch`.
3. `DashboardTopbar` uses `sticky top-0` — it stays pinned within the now-fixed content column, never affecting body scroll.
4. `.dashboard-main` (`<main>`) gains `overflow-y-auto` → becomes the only scroll container. Content scrolls inside this element.
5. Radix UI dialogs/sheets use `ReactDOM.createPortal` to `document.body` → not clipped by `overflow-hidden`.

---

## Accessibility notes

- Cards are rendered as `<button>` elements (via `PublicRouteControl variant="bare"`).
- Each card has `aria-label="{title}: {description}"` — screen readers announce both context and purpose.
- Icon containers carry `aria-hidden="true"` — decorative SVGs are skipped by AT.
- Badge `aria-label` on pending counts (e.g., `"3 informes pendientes"`) — numeric context is readable.
- `focus-visible:ring-2` on every card — keyboard focus is visible.
- Sidebar nav buttons have `aria-label` + `title` (tooltip) replacing hidden text labels.
- Sidebar label text is `sr-only` (not `display:none`) — accessible to screen readers.

---

## Tests

**File:** `frontend/e2e/dashboard-card-navigation-shell.spec.ts`

**Suites:**

| Suite | Tests |
|---|---|
| Scope guard | 2 (structural assertions) |
| Clinic dashboard — module hub | 9 (render + accessibility + navigation) |
| Admin dashboard — module hub | 7 (render + accessibility + tab switch) |
| Dashboard shell — no global scroll | 3 (DOM structure + computed style + body scroll) |
| Dashboard sidebar — compact rail | 3 (width + aria-labels + footer) |

Total: 24 tests.

---

## Validation results

Run before submitting PR:

```powershell
# Terminal 1
pnpm --dir frontend lint
pnpm --dir frontend typecheck
pnpm --dir frontend build

# Terminal 2 (requires dev server running on :3000)
pnpm --dir frontend e2e -- --workers=2
```

---

## Risks / rollback

**Risks:**

- `h-dvh` has broad browser support (Chrome 108+, Safari 15.4+, FF 101+). Fallback: `h-screen` if an older browser target is required.
- `overflow-hidden` on the shell clips children with `position: fixed` that are NOT portaled. All existing Radix UI components (Dialog, Sheet, Dropdown) use portals → not affected.
- Hash navigation on clinic page (`/dashboard#clinic-command-center`) relies on the browser scrolling the `<main>` scroll container to the anchor. `scroll-mt-20` compensates for the topbar height.
- `AdminSectionTabs` must fire `hashchange` before the tab panel is active. The existing implementation handles this with `window.addEventListener("hashchange", ...)` on mount.

**Rollback:**

1. Revert `DashboardShellRouter.tsx`: change `h-dvh overflow-hidden` back to `min-h-screen`.
2. Revert `globals.css`: remove `overflow-y-auto` from `.dashboard-main`.
3. Revert `DashboardSidebarFrame.tsx`: restore `sm:w-64` and inline text labels.
4. Revert `dashboard/page.tsx` and `dashboard/admin/page.tsx`: restore `StickyActionBar` and remove `DashboardModuleHub`.
5. Delete `DashboardModuleHub.tsx`.
