"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";
import { Home, Menu, X } from "lucide-react";
import { PublicRouteControl } from "@/components/public/PublicRouteControl";
import {
  requestAdminHubReset,
  requestAdminModuleActivate,
} from "@/lib/admin-hub-reset";
import {
  requestClinicHubReset,
  requestClinicModuleActivate,
  subscribeClinicHubReset,
  subscribeClinicModuleActivate,
} from "@/lib/clinic-hub-reset";
import {
  ADMIN_LAST_MODULE_STORAGE_KEY,
  CLINIC_LAST_MODULE_STORAGE_KEY,
  writeDashboardLastModule,
} from "@/lib/dashboard-last-module";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import {
  ADMIN_MOBILE_PRIMARY_MODULE_IDS,
  ADMIN_MODULE_NAV_LABELS,
  CLINIC_MODULE_NAV_LABELS,
  parseAdminModule,
  parseClinicModule,
} from "@/features/dashboard/config";
import {
  MODULE_QUERY_PARAM,
  buildDashboardModuleHref,
} from "@/features/dashboard/application";
import {
  ADMIN_MODULE_ICONS,
  CLINIC_MODULE_ICONS,
  type DashboardModuleIcon,
} from "./dashboardModuleIcons";

/**
 * B09 - DashboardMobileNav, the single mobile navigation model (<768px).
 *
 * ONE OWNER FOR WHAT WERE FOUR. Before B09 the phone had four navigation
 * components for one function: `AdminMobileBottomNav` (its own id/label/icon
 * literals), `AdminMobileModuleMenu` (a second, drifting copy of the whole
 * admin catalog), `ClinicMobileBottomNav` (suppressed on `/dashboard` by an
 * early return) and `DashboardModuleRail` (the only navigation `/dashboard`
 * had on a phone, kept alive by B08 precisely because of that early return).
 * This module replaces all four and closes
 * `LEGACY_MODULE_RAIL_PHYSICAL_RETIREMENT = DEFERRED_TO_B09`.
 *
 * IT OWNS NOTHING. Module ids, order and labels come from
 * `features/dashboard/config`, the primary-slot cut from
 * `ADMIN_MOBILE_PRIMARY_MODULE_IDS` in that same catalog, glyphs from
 * `dashboardModuleIcons` (B07), the `?module=` grammar from
 * `features/dashboard/application` and the geometry from
 * `styles/dashboard/tokens.css` - never restated here as a literal.
 *
 * DESTINATIONS, NOT ACTIONS. The overflow this component owns is a DESTINATION
 * overflow: the same ordered catalog, behind a "Más" entry, when the role has
 * more modules than the bar has slots. The ACTION overflow (theme,
 * notifications, password, public site, logout) stays in
 * `AdminMobileKebabMenu`, injected into the app bar by `DashboardTopbar`.
 * Merging them is not a simplification: that menu composes
 * `DashboardLogoutControl` and `DashboardNotificationsBell`, both of which
 * import `@/lib/api`, so folding it in here would drag the data layer across
 * the `presentation/navigation` boundary that
 * `test/architecture/dashboard-presentation-import-boundaries.test.ts` walks.
 *
 * INLINE FLOW, NEVER AN OVERLAY. The bar is a real flex item at shell level,
 * a sibling of `main` with `flex: 0 0 auto`, so the shell subtracts its height
 * instead of letting it cover content. The safe-area inset is ADDED to the
 * band and SUBTRACTED again as bottom padding, so the touch row keeps its full
 * height on a notched device.
 *
 * ACTIVE MODULE. Resolved from the live URL through the catalog parsers, and
 * corrected optimistically by the activation signals the controllers already
 * publish. The old admin bar read `?module=` RAW, so an unknown value marked
 * "Más" as `aria-current` while the controller painted the hub; parsing
 * through `parseAdminModule` converges both on the hub instead, and also makes
 * the alias table (`?module=maintenance`) light the right entry.
 *
 * @see docs/implementation/dashboard-b09-mobile-navigation-unification.md
 */

// ─────────────────────────────────────────────────────────────────────────────
// Model
// ─────────────────────────────────────────────────────────────────────────────

export type DashboardMobileNavSurface = "admin" | "clinic";

export type DashboardMobileNavProps = {
  /** Which role's shell is mounting the bar. Nothing else is configurable. */
  readonly surface: DashboardMobileNavSurface;
};

type MobileNavDestination = {
  readonly moduleId: string;
  readonly label: string;
  readonly shortLabel: string;
  readonly icon: DashboardModuleIcon;
};

function destinationsFor(
  surface: DashboardMobileNavSurface,
): readonly MobileNavDestination[] {
  if (surface === "admin") {
    return ADMIN_MODULE_NAV_LABELS.map((entry) => ({
      moduleId: entry.moduleId,
      label: entry.label,
      shortLabel: entry.shortLabel,
      icon: ADMIN_MODULE_ICONS[entry.moduleId],
    }));
  }
  return CLINIC_MODULE_NAV_LABELS.map((entry) => ({
    moduleId: entry.moduleId,
    label: entry.label,
    shortLabel: entry.shortLabel,
    icon: CLINIC_MODULE_ICONS[entry.moduleId],
  }));
}

/**
 * Primary slots after "Inicio". Admin promotes a curated cut declared in the
 * catalog and sends the rest to the overflow; clinic has five modules, which
 * fit next to "Inicio" without one.
 */
function primaryDestinations(
  surface: DashboardMobileNavSurface,
  all: readonly MobileNavDestination[],
): readonly MobileNavDestination[] {
  if (surface !== "admin") {
    return all;
  }
  return ADMIN_MOBILE_PRIMARY_MODULE_IDS.map((moduleId) => {
    const destination = all.find((item) => item.moduleId === moduleId);
    if (!destination) {
      throw new Error(
        `B09: ${moduleId} is promoted to the mobile bar but is not in the admin catalog`,
      );
    }
    return destination;
  });
}

const SURFACE_LANDMARK: Record<DashboardMobileNavSurface, string> = {
  admin: "Navegación móvil de administración",
  clinic: "Navegación móvil de clínica",
};

const SURFACE_BASE_PATH: Record<DashboardMobileNavSurface, string> = {
  admin: ROUTES.dashboardAdmin,
  clinic: ROUTES.dashboard,
};

const OVERFLOW_ID = "dashboard-mobile-nav-overflow";
const OVERFLOW_PAGE_SIZE = 5;

// ─────────────────────────────────────────────────────────────────────────────
// Destination overflow
// ─────────────────────────────────────────────────────────────────────────────

type DashboardMobileNavOverflowProps = {
  readonly isOpen: boolean;
  readonly destinations: readonly MobileNavDestination[];
  readonly basePath: string;
  readonly onClose: () => void;
  readonly onNavigate: (moduleId: string) => void;
};

function DashboardMobileNavOverflow({
  isOpen,
  destinations,
  basePath,
  onClose,
  onNavigate,
}: DashboardMobileNavOverflowProps) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(destinations.length / OVERFLOW_PAGE_SIZE));
  const visible = destinations.slice(
    page * OVERFLOW_PAGE_SIZE,
    page * OVERFLOW_PAGE_SIZE + OVERFLOW_PAGE_SIZE,
  );

  useEffect(() => {
    if (!isOpen) return;

    setPage(0);
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Only admin ever reaches an overflow (clinic's five modules fit on the bar),
  // so the shipped admin landmark name is preserved verbatim.
  return (
    <section
      id={OVERFLOW_ID}
      aria-label="Todos los módulos de administración"
      data-dashboard-mobile-nav-overflow="true"
      className="dashboard-mobile-nav-overflow"
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-vetneb-ink">Módulos</h2>
          <p className="text-[0.68rem] text-muted-foreground">
            Página {page + 1} de {pageCount}
          </p>
        </div>
        <button
          type="button"
          aria-label="Cerrar menú de módulos"
          onClick={onClose}
          data-dashboard-mobile-nav-overflow-close="true"
          className="dashboard-mobile-nav-icon-button"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="dashboard-mobile-nav-overflow-grid">
        {visible.map((destination) => {
          const Icon = destination.icon;
          return (
            <PublicRouteControl
              key={destination.moduleId}
              href={buildDashboardModuleHref(basePath, destination.moduleId)}
              prefetch={false}
              variant="bare"
              aria-label={destination.label}
              data-dashboard-mobile-nav-overflow-link={destination.moduleId}
              onClick={() => onNavigate(destination.moduleId)}
              className="dashboard-mobile-nav-overflow-link"
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{destination.label}</span>
            </PublicRouteControl>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          aria-label="Página anterior de módulos"
          disabled={page === 0}
          onClick={() => setPage((current) => Math.max(0, current - 1))}
          data-dashboard-mobile-nav-overflow-page="prev"
          className="dashboard-mobile-nav-page-button"
        >
          Anterior
        </button>
        <div className="flex items-center gap-1" aria-label="Páginas de módulos">
          {Array.from({ length: pageCount }, (_, index) => (
            <span
              key={index}
              aria-current={index === page ? "page" : undefined}
              className="dashboard-mobile-nav-page-dot"
            />
          ))}
        </div>
        <button
          type="button"
          aria-label="Página siguiente de módulos"
          disabled={page === pageCount - 1}
          onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
          data-dashboard-mobile-nav-overflow-page="next"
          className="dashboard-mobile-nav-page-button"
        >
          Siguiente
        </button>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bar
// ─────────────────────────────────────────────────────────────────────────────

type MobileNavBarProps = {
  readonly surface: DashboardMobileNavSurface;
  /**
   * True for the real, URL-driven bar; false for the Suspense fallback
   * painted below. Both instances can be mounted at once across a
   * `useSearchParams()` suspend/resolve tick, so only the identified one may
   * carry `data-dashboard-mobile-nav` — the selector every contract and test
   * targets — or that attribute would resolve to two nodes.
   */
  readonly identify: boolean;
  readonly activeModule: string | null;
  readonly onActivate: (moduleId: string) => void;
  readonly onHome: () => void;
  readonly overflowOpen: boolean;
  readonly onToggleOverflow: () => void;
  readonly children?: ReactNode;
};

function DashboardMobileNavBar({
  surface,
  identify,
  activeModule,
  onActivate,
  onHome,
  overflowOpen,
  onToggleOverflow,
  children,
}: MobileNavBarProps) {
  const all = useMemo(() => destinationsFor(surface), [surface]);
  const primary = useMemo(() => primaryDestinations(surface, all), [surface, all]);
  const hasOverflow = primary.length < all.length;
  const basePath = SURFACE_BASE_PATH[surface];

  // "Más" reports current only while a module that is NOT on the bar is open —
  // never for an unknown `?module=`, which the parser already resolved to the
  // hub/home state.
  const overflowIsCurrent =
    hasOverflow &&
    activeModule !== null &&
    !primary.some((destination) => destination.moduleId === activeModule);

  return (
    <>
      {children}
      <nav
        aria-label={SURFACE_LANDMARK[surface]}
        aria-hidden={identify ? undefined : true}
        data-dashboard-mobile-nav={identify ? surface : undefined}
        className="dashboard-mobile-nav"
      >
        <PublicRouteControl
          href={basePath}
          prefetch={false}
          variant="bare"
          aria-label="Inicio"
          aria-current={!activeModule ? "page" : undefined}
          data-dashboard-mobile-nav-item="home"
          onClick={onHome}
          className={cn(
            "dashboard-mobile-nav-item",
            !activeModule && "dashboard-mobile-nav-item-active",
          )}
        >
          <Home className="dashboard-mobile-nav-glyph" aria-hidden="true" />
          <span>Inicio</span>
        </PublicRouteControl>

        {primary.map((destination) => {
          const Icon = destination.icon;
          const isActive = activeModule === destination.moduleId;
          return (
            <PublicRouteControl
              key={destination.moduleId}
              href={buildDashboardModuleHref(basePath, destination.moduleId)}
              prefetch={false}
              variant="bare"
              aria-label={destination.label}
              aria-current={isActive ? "page" : undefined}
              data-dashboard-mobile-nav-item={destination.moduleId}
              onClick={() => onActivate(destination.moduleId)}
              className={cn(
                "dashboard-mobile-nav-item",
                isActive && "dashboard-mobile-nav-item-active",
              )}
            >
              <Icon className="dashboard-mobile-nav-glyph" aria-hidden="true" />
              <span>{destination.shortLabel}</span>
            </PublicRouteControl>
          );
        })}

        {hasOverflow ? (
          <button
            type="button"
            aria-label="Más"
            aria-expanded={overflowOpen}
            aria-current={overflowIsCurrent ? "page" : undefined}
            aria-controls={overflowOpen ? OVERFLOW_ID : undefined}
            data-dashboard-mobile-nav-item="overflow"
            onClick={onToggleOverflow}
            className={cn(
              "dashboard-mobile-nav-item",
              (overflowOpen || overflowIsCurrent) &&
                "dashboard-mobile-nav-item-active",
            )}
          >
            <Menu className="dashboard-mobile-nav-glyph" aria-hidden="true" />
            <span>Más</span>
          </button>
        ) : null}
      </nav>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Owner
// ─────────────────────────────────────────────────────────────────────────────

function MobileNavWithUrl({ surface }: DashboardMobileNavProps) {
  const searchParams = useSearchParams();
  const urlModule = searchParams.get(MODULE_QUERY_PARAM);
  const parsed = useMemo(
    () =>
      surface === "admin"
        ? parseAdminModule(urlModule)
        : parseClinicModule(urlModule),
    [surface, urlModule],
  );

  const [activeModule, setActiveModule] = useState<string | null>(parsed);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const closeOverflow = useCallback(() => setOverflowOpen(false), []);

  useEffect(() => {
    setActiveModule(parsed);
  }, [parsed]);

  useEffect(() => {
    if (surface !== "clinic") return;
    return subscribeClinicModuleActivate((moduleId) => {
      const clinicModule = parseClinicModule(moduleId);
      if (!clinicModule) return;
      setActiveModule(clinicModule);
    });
  }, [surface]);

  useEffect(() => {
    if (surface !== "clinic") return;
    return subscribeClinicHubReset(() => setActiveModule(null));
  }, [surface]);

  const activate = useCallback(
    (moduleId: string) => {
      setActiveModule(moduleId);
      if (surface === "admin") {
        requestAdminModuleActivate(moduleId);
      } else {
        requestClinicModuleActivate(moduleId);
      }
      setOverflowOpen(false);
    },
    [surface],
  );

  const goHome = useCallback(() => {
    setActiveModule(null);
    setOverflowOpen(false);
    if (surface === "admin") {
      writeDashboardLastModule(ADMIN_LAST_MODULE_STORAGE_KEY, "");
      // Force the workspace controller back to the hub even when the URL push
      // collapses into a same-URL no-op (in-flight module navigation not yet
      // committed).
      requestAdminHubReset();
      return;
    }
    writeDashboardLastModule(CLINIC_LAST_MODULE_STORAGE_KEY, "");
    requestClinicHubReset();
  }, [surface]);

  const all = useMemo(() => destinationsFor(surface), [surface]);

  return (
    <DashboardMobileNavBar
      surface={surface}
      identify
      activeModule={activeModule}
      onActivate={activate}
      onHome={goHome}
      overflowOpen={overflowOpen}
      onToggleOverflow={() => setOverflowOpen((current) => !current)}
    >
      <DashboardMobileNavOverflow
        isOpen={overflowOpen}
        destinations={all}
        basePath={SURFACE_BASE_PATH[surface]}
        onClose={closeOverflow}
        onNavigate={activate}
      />
    </DashboardMobileNavBar>
  );
}

export function DashboardMobileNav({ surface }: DashboardMobileNavProps) {
  // The fallback paints the SAME bar with the same slot count and the same
  // height, so a suspended tick can never move `main`: only the active
  // highlight is deferred. It is never identified (`identify={false}`) and
  // always `aria-hidden`, so even when both instances are mounted across the
  // suspend/resolve tick, exactly one node ever carries
  // `data-dashboard-mobile-nav` and exposes a landmark to assistive tech.
  return (
    <Suspense
      fallback={
        <DashboardMobileNavBar
          surface={surface}
          identify={false}
          activeModule={null}
          onActivate={noop}
          onHome={noop}
          overflowOpen={false}
          onToggleOverflow={noop}
        />
      }
    >
      <MobileNavWithUrl surface={surface} />
    </Suspense>
  );
}

function noop() {}
