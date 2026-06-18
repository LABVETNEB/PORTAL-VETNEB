"use client";

import { PublicRouteControl } from "@/components/public/PublicRouteControl";
import { ROUTES } from "@/lib/routes";

const QUICK_LINKS: Array<{ label: string; module: string }> = [
  { label: "Clínicas", module: "admin-clinics" },
  { label: "Informes", module: "admin-report-upload" },
  { label: "Tokens", module: "admin-particular-tokens" },
  { label: "Auditoría", module: "audit-log" },
  { label: "Usuarios", module: "admin-users-roles" },
  { label: "Sesiones", module: "admin-sessions" },
];

export function AdminOverviewQuickLinks() {
  return (
    <nav className="surface-soft min-h-0" aria-label="Módulos operativos">
      <p className="text-[0.8rem] font-semibold text-vetneb-ink">Módulos operativos</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {QUICK_LINKS.map((link) => (
          <PublicRouteControl
            key={link.module}
            href={`${ROUTES.dashboardAdmin}?module=${link.module}`}
            prefetch={false}
            variant="bare"
            aria-label={`Ir a ${link.label}`}
            className="inline-flex items-center rounded-md border border-input bg-background px-2.5 py-1 text-[0.72rem] font-semibold text-foreground dashboard-nav-interactive hover:bg-accent/60 focus-visible:ring-offset-2"
          >
            {link.label}
          </PublicRouteControl>
        ))}
      </div>
    </nav>
  );
}
