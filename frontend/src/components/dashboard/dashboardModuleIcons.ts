import {
  Activity,
  Building2,
  ClipboardPlus,
  FileText,
  KeyRound,
  LayoutDashboard,
  ReceiptText,
  Route,
  ScrollText,
  Settings2,
  ShieldCheck,
  TicketCheck,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import type {
  AdminModule,
  ClinicModule,
} from "@/features/dashboard/config";

/**
 * Dashboard · module icon owner (B07).
 *
 * The ONE place that maps a canonical module id to its glyph. Icons are React
 * components, so they cannot live in `features/dashboard/config` — that layer
 * is React-free by contract — but they were also the last piece of the module
 * table still copied per component (`DashboardModuleRail`,
 * `AdminMobileModuleMenu`, `ClinicMobileBottomNav`, the admin controller). B07
 * adds NO fourth copy: the drawer and the rail read their glyphs from here.
 *
 * NOT a second catalog. This module owns no label, no order, no alias, no
 * `?module=` grammar and no validation: those stay single-owned by
 * `config/dashboardModules.ts` and `application/dashboardModuleNavigation.ts`.
 * Its exhaustiveness is a TYPE property — `Record<AdminModule, LucideIcon>`
 * fails typecheck the moment the catalog grows a module without a glyph — so
 * the mapping cannot drift away from the registry it serves.
 *
 * Scope fence: the legacy copies in the components above are NOT migrated here.
 * Retiring the horizontal nav and the clinic rail is B08, the mobile chrome is
 * B09 and the hub is B13; rewriting their icon tables now would move surfaces
 * those blocks own.
 *
 * @see docs/implementation/dashboard-b07-navigation-drawer-rail.md
 */

/** Glyph type for a dashboard module, so consumers never import lucide-react. */
export type DashboardModuleIcon = LucideIcon;

export const ADMIN_MODULE_ICONS: Record<AdminModule, LucideIcon> = {
  admin: Settings2,
  "admin-report-upload": ClipboardPlus,
  "admin-health": Activity,
  "admin-clinics": Building2,
  "admin-particular-tokens": TicketCheck,
  "admin-pricing": ReceiptText,
  "admin-sessions": KeyRound,
  "admin-users-roles": UsersRound,
  "audit-log": ScrollText,
  "admin-maintenance": ShieldCheck,
};

export const CLINIC_MODULE_ICONS: Record<ClinicModule, LucideIcon> = {
  operaciones: LayoutDashboard,
  informes: FileText,
  logistica: Route,
  perfil: Building2,
  tokens: KeyRound,
};
