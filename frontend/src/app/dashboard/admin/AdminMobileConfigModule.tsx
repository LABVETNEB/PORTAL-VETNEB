"use client";

import {
  ModuleCardSections,
  type ModuleCardSection,
} from "@/components/dashboard/ModuleCard";

export type AdminMobileConfigSection = ModuleCardSection;

type AdminMobileConfigModuleProps = {
  /** Module key exposed as `data-admin-mobile-config-module`. */
  moduleKey: string;
  ariaLabel: string;
  sections: AdminMobileConfigSection[];
};

/**
 * Mobile-only ("md:hidden") chip-segmented shell for Admin CONFIG modules
 * (Precios / Mantenimiento). Mirrors AdminMobileStatusModule and exposes
 * `data-admin-mobile-config-*` hooks so the no-scroll/gutter CSS + e2e stay
 * scoped per family. Only the active section mounts (lazy fetch), the chip row
 * is fixed and the panel fills the remaining height with zero scroll.
 *
 * CMP-07 (regression found during certification) — migrated to the shared
 * `ModuleCard` primitive, matching AdminMobileStatusModule's CMP-04 migration.
 * This component was the one Admin archetype still on its own parallel
 * markup: retiring the admin-only fluid-rhythm CSS override that used to keep
 * it in sync with the shared chip band (mobile-admin.css block
 * `admin-mobile-module-rhythm-fluid`) broke its geometry the moment nothing
 * targeted `[data-admin-mobile-config-chip]` any more. Consuming the shared
 * primitive removes the duplication at its root instead of re-adding a second,
 * now-redundant CSS override.
 */
export function AdminMobileConfigModule({
  moduleKey,
  ariaLabel,
  sections,
}: AdminMobileConfigModuleProps) {
  return (
    <ModuleCardSections
      ariaLabel={ariaLabel}
      sections={sections}
      className="md:hidden"
      cardAttribute="data-admin-mobile-config-module"
      cardAttributeValue={moduleKey}
      chipAttribute="data-admin-mobile-config-chip"
      panelAttribute="data-admin-mobile-config-panel"
    />
  );
}
