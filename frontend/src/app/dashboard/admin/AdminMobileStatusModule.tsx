"use client";

import {
  ModuleCardSections,
  type ModuleCardSection,
} from "@/components/dashboard/ModuleCard";

export type AdminMobileStatusSection = ModuleCardSection;

type AdminMobileStatusModuleProps = {
  /** Module key exposed as `data-admin-mobile-status-module`. */
  moduleKey: string;
  ariaLabel: string;
  sections: AdminMobileStatusSection[];
};

/**
 * Mobile-only ("md:hidden") shell for Admin status modules (Administración /
 * Estado del sistema). The desktop ModuleTabs/grids collapse to one column on
 * mobile and overflow under the bottom nav; this primitive splits the same
 * content into compact chip sections so each fits the no-scroll content band.
 *
 * Only the active section is mounted, so fetch-backed sections (failed-login,
 * schema) load lazily when the chip is selected. The chip row is fixed and the
 * panel fills the remaining height (`flex-1 min-h-0`) with zero scroll.
 *
 * CMP-04 — the markup moved to `ModuleCard`, the shared module-card primitive, so
 * Clínica composes the SAME card instead of its own four-layer stack (audit
 * DIF-011/012/013, RC-004). This module keeps its name, its data hooks and its
 * emitted DOM: it now supplies them to the shared owner rather than declaring them.
 */
export function AdminMobileStatusModule({
  moduleKey,
  ariaLabel,
  sections,
}: AdminMobileStatusModuleProps) {
  return (
    <ModuleCardSections
      ariaLabel={ariaLabel}
      sections={sections}
      className="md:hidden"
      cardAttribute="data-admin-mobile-status-module"
      cardAttributeValue={moduleKey}
      chipAttribute="data-admin-mobile-status-chip"
      panelAttribute="data-admin-mobile-status-panel"
    />
  );
}
