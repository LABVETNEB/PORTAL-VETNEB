"use client";

import { usePathname, useSearchParams } from "next/navigation";
import {
  ADMIN_MODULE_NAV_LABELS,
  CLINIC_MODULE_NAV_LABELS,
  DEFAULT_CLINIC_MODULE,
  parseAdminModule,
  parseClinicModule,
} from "@/features/dashboard/config";
import {
  MODULE_QUERY_PARAM,
  isHubRequested,
} from "@/features/dashboard/application";
import { ROUTES } from "@/lib/routes";

/** The canonical Inicio/hub identity, shared by both roles. */
const HUB_TITLE = "Inicio";

/**
 * CMP-01 — the ONE mobile context title of the dashboard app bar.
 *
 * Extracted from `DashboardTopbar`, where it existed as `AdminMobileContextTitle`
 * behind an `isAdmin ? ... : null` guard. The white-box audit traced DIF-002 and
 * DIF-003 to exactly that guard (RC-001): Clínica never received a context title, so
 * its app bar showed the static product name "Dashboard Clínica" on all five modules
 * while Admin showed the active module ("Resumen", "Sesiones", "Clínicas"...).
 *
 * The label is DERIVED from the canonical per-role catalog, never declared here: a
 * private label table is what had already drifted once before B09 retired it.
 */

const LABEL_BY_MODULE = {
  admin: new Map(ADMIN_MODULE_NAV_LABELS.map((entry) => [entry.moduleId, entry.label])),
  clinic: new Map(CLINIC_MODULE_NAV_LABELS.map((entry) => [entry.moduleId, entry.label])),
} as const;

export type ModuleContextSurface = "admin" | "clinic";

interface ModuleContextTitleProps {
  readonly surface: ModuleContextSurface;
  /**
   * Rendered when the current location resolves to no module. Admin passes "Inicio"
   * (its hub); Clínica passes the page title, which is already the correct identity
   * for the five full routes that live outside the module shell.
   */
  readonly fallback: string;
}

export function ModuleContextTitle({ surface, fallback }: ModuleContextTitleProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const rawModule = searchParams.get(MODULE_QUERY_PARAM);

  // CMP-02 — the hub is a state of the route, not a module, on BOTH roles. Admin
  // reached "Inicio" implicitly (no `?module=` on `?hub=1`, so the parser returned
  // null and the fallback applied); Clínica needs it explicitly because its module
  // branch defaults a bare URL to the operational module.
  if (isHubRequested(searchParams)) {
    return <>{HUB_TITLE}</>;
  }

  if (surface === "admin") {
    const moduleId = parseAdminModule(rawModule);
    return <>{(moduleId && LABEL_BY_MODULE.admin.get(moduleId)) || fallback}</>;
  }

  // Clínica: only the module shell at `/dashboard` carries `?module=`. A bare
  // `/dashboard` canonicalises to DEFAULT_CLINIC_MODULE, so the title has to resolve
  // to that module's label rather than to the fallback — otherwise the entry surface
  // would be the one place still showing the product name.
  if (pathname === ROUTES.dashboard) {
    const moduleId = parseClinicModule(rawModule) ?? DEFAULT_CLINIC_MODULE;
    return <>{LABEL_BY_MODULE.clinic.get(moduleId) || fallback}</>;
  }

  return <>{fallback}</>;
}
