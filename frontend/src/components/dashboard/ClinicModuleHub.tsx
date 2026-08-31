"use client";

import {
  CLINIC_MODULE_NAV_LABELS,
  DEFAULT_CLINIC_MODULE,
  type ClinicModule,
} from "@/features/dashboard/config";
import { ROUTES } from "@/lib/routes";
import { clinicModuleHref } from "@/lib/dashboard/navigation/clinicNavigationState";
import {
  DashboardModuleHub,
  type DashboardModuleCard,
} from "./DashboardModuleHub";
import { CLINIC_MODULE_ICONS } from "./dashboardModuleIcons";

/**
 * CMP-02 — the clinic Inicio/hub surface.
 *
 * The audit recorded DIF-041 (RC-015): Admin owns a real entry surface
 * (`?hub=1`, a paginated tile launcher) while the clinic bottom nav's "Inicio"
 * slot resolved silently to the default module, so Clínica had no entry surface
 * at all. This renders the SAME `DashboardModuleHub` Admin renders — same
 * launcher, same tiles, same pager, same mobile grammar — with clinic domain
 * content. Nothing visual is re-declared here.
 *
 * The tile catalog is DERIVED from `CLINIC_MODULE_NAV_LABELS`, never declared,
 * for the same reason the mobile context title is: a private label copy is what
 * drifts. Hrefs go through `clinicModuleHref`, so the default module is spelled
 * as the bare `/dashboard` and the hub cannot mint a second URL for one surface.
 *
 * CLIENT component by necessity, not by preference: the tiles carry Lucide icon
 * COMPONENTS, and `page.tsx` hands this element to the client-side controller.
 * Built on the server, those functions would have to cross the server→client
 * boundary, which React refuses ("Functions cannot be passed directly to Client
 * Components"). Building the catalog here keeps the icons entirely client-side.
 */

const MODULE_DESCRIPTIONS: Record<ClinicModule, string> = {
  operaciones: "Métricas operativas, informes recientes y visitas activas.",
  informes: "Consultar, filtrar y descargar informes veterinarios.",
  logistica: "Visitas de campo, planes de ruta y métricas de cumplimiento.",
  perfil: "Publicar y actualizar el perfil en el banco de especialidades.",
  tokens: "Generar y gestionar tokens de acceso para pacientes.",
};

const CLINIC_HUB_CARDS: DashboardModuleCard[] = CLINIC_MODULE_NAV_LABELS.map(
  (entry) => ({
    icon: CLINIC_MODULE_ICONS[entry.moduleId],
    title: entry.label,
    description: MODULE_DESCRIPTIONS[entry.moduleId],
    href: clinicModuleHref(
      ROUTES.dashboard,
      DEFAULT_CLINIC_MODULE,
      entry.moduleId,
    ),
    moduleId: entry.moduleId,
  }),
);

export function ClinicModuleHub() {
  return (
    <DashboardModuleHub
      heading="Clínica"
      description="Operaciones, informes, logística, perfil y tokens particulares."
      cards={CLINIC_HUB_CARDS}
    />
  );
}
