"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  Building2,
  ClipboardPlus,
  KeyRound,
  ReceiptText,
  ScrollText,
  Settings2,
  ShieldCheck,
  TicketCheck,
  UsersRound,
  X,
} from "lucide-react";
import { PublicRouteControl } from "@/components/public/PublicRouteControl";
import { ROUTES } from "@/lib/routes";

const MODULES = [
  { label: "Administración", moduleId: "admin", icon: Settings2 },
  { label: "Informes", moduleId: "admin-report-upload", icon: ClipboardPlus },
  { label: "Estado", moduleId: "admin-health", icon: Activity },
  { label: "Clínicas", moduleId: "admin-clinics", icon: Building2 },
  { label: "Tokens", moduleId: "admin-particular-tokens", icon: TicketCheck },
  { label: "Precios", moduleId: "admin-pricing", icon: ReceiptText },
  { label: "Sesiones", moduleId: "admin-sessions", icon: KeyRound },
  { label: "Usuarios", moduleId: "admin-users-roles", icon: UsersRound },
  { label: "Auditoría", moduleId: "audit-log", icon: ScrollText },
  { label: "Mantenimiento", moduleId: "admin-maintenance", icon: ShieldCheck },
] as const;

const PAGE_SIZE = 5;

type AdminMobileModuleMenuProps = {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (moduleId: string) => void;
};

export function AdminMobileModuleMenu({
  isOpen,
  onClose,
  onNavigate,
}: AdminMobileModuleMenuProps) {
  const [page, setPage] = useState(0);
  const pageCount = Math.ceil(MODULES.length / PAGE_SIZE);
  const visibleModules = MODULES.slice(
    page * PAGE_SIZE,
    page * PAGE_SIZE + PAGE_SIZE,
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

  return (
    <section
      id="admin-mobile-module-menu"
      aria-label="Todos los módulos de administración"
      data-admin-mobile-module-menu="true"
      className="admin-mobile-module-menu md:hidden"
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-vetneb-ink">
            Módulos
          </h2>
          <p className="text-[0.68rem] text-muted-foreground">
            Página {page + 1} de {pageCount}
          </p>
        </div>
        <button
          type="button"
          aria-label="Cerrar menú de módulos"
          onClick={onClose}
          className="admin-mobile-icon-button"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="admin-mobile-module-grid">
        {visibleModules.map((module) => {
          const Icon = module.icon;
          return (
            <PublicRouteControl
              key={module.moduleId}
              href={`${ROUTES.dashboardAdmin}?module=${module.moduleId}`}
              prefetch={false}
              variant="bare"
              data-admin-mobile-module-link="true"
              onClick={() => {
                onNavigate(module.moduleId);
                onClose();
              }}
              className="admin-mobile-module-link"
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span className="truncate">{module.label}</span>
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
          className="admin-mobile-page-button"
        >
          Anterior
        </button>
        <div className="flex items-center gap-1" aria-label="Páginas de módulos">
          {Array.from({ length: pageCount }, (_, index) => (
            <span
              key={index}
              aria-current={index === page ? "page" : undefined}
              className="admin-mobile-page-dot"
            />
          ))}
        </div>
        <button
          type="button"
          aria-label="Página siguiente de módulos"
          disabled={page === pageCount - 1}
          onClick={() =>
            setPage((current) => Math.min(pageCount - 1, current + 1))
          }
          className="admin-mobile-page-button"
        >
          Siguiente
        </button>
      </div>
    </section>
  );
}
