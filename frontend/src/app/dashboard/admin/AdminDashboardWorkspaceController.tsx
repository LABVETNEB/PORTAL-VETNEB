"use client";

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
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
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DashboardModuleHub } from "@/components/dashboard/DashboardModuleHub";
import { DashboardModuleWorkspace } from "@/components/dashboard/DashboardModuleWorkspace";

type AdminWorkspaceSlots = {
  commandCenter: ReactNode;
  alertsSection: ReactNode;
  sectionTabs: ReactNode;
};

type AdminDashboardWorkspaceControllerProps = {
  workspaces: AdminWorkspaceSlots;
  systemStatus: string;
  systemStatusLabel: string;
  systemStatusVariant: "default" | "secondary" | "destructive" | "outline";
};

export function AdminDashboardWorkspaceController({
  workspaces,
  systemStatus,
  systemStatusLabel,
  systemStatusVariant,
}: AdminDashboardWorkspaceControllerProps) {
  const router = useRouter();
  const [showWorkspace, setShowWorkspace] = useState(false);
  const pendingHashRef = useRef<string | null>(null);

  useEffect(() => {
    if (showWorkspace && pendingHashRef.current) {
      window.location.hash = pendingHashRef.current;
      pendingHashRef.current = null;
    }
  }, [showWorkspace]);

  const activateWorkspace = useCallback((hash: string) => {
    pendingHashRef.current = hash;
    setShowWorkspace(true);
  }, []);

  const backToHub = useCallback(() => {
    setShowWorkspace(false);
    pendingHashRef.current = null;
    history.replaceState(null, "", window.location.pathname);
    router.replace("/dashboard/admin", { scroll: false });
  }, [router]);

  const adminCards = [
    {
      icon: Settings2,
      title: "Administración",
      description: "Resumen operativo, auditoría y salud del sistema.",
      moduleId: "admin-command-center",
      onClick: () => activateWorkspace("admin-command-center"),
      actionLabel: "Ver resumen",
    },
    {
      icon: ClipboardPlus,
      title: "Subir informe",
      description: "Cargar nuevos informes vinculados a tokens de clínica.",
      moduleId: "admin-report-upload",
      onClick: () => activateWorkspace("admin-report-upload"),
      actionLabel: "Ir a carga",
    },
    {
      icon: Activity,
      title: "Estado del sistema",
      description: "Salud de servicios, esquema y mantenimiento backend.",
      moduleId: "admin-health",
      onClick: () => activateWorkspace("admin-health"),
      badge:
        systemStatus !== "ok" ? (
          <Badge variant={systemStatusVariant}>{systemStatusLabel}</Badge>
        ) : null,
      actionLabel: "Ver estado",
    },
    {
      icon: Building2,
      title: "Clínicas",
      description: "Crear, buscar y editar clínicas registradas en el portal.",
      moduleId: "admin-clinics",
      onClick: () => activateWorkspace("admin-clinics"),
      actionLabel: "Gestionar",
    },
    {
      icon: TicketCheck,
      title: "Tokens particulares",
      description: "Revisar y gestionar tokens de acceso para particulares.",
      moduleId: "admin-particular-tokens",
      onClick: () => activateWorkspace("admin-particular-tokens"),
      actionLabel: "Ver tokens",
    },
    {
      icon: ReceiptText,
      title: "Precios",
      description: "Actualizar precios del portal visibles en /precios.",
      moduleId: "admin-pricing",
      onClick: () => activateWorkspace("admin-pricing"),
      actionLabel: "Editar precios",
    },
    {
      icon: KeyRound,
      title: "Sesiones",
      description: "Consultar y revocar sesiones activas de clínicas.",
      moduleId: "admin-sessions",
      onClick: () => activateWorkspace("admin-sessions"),
      actionLabel: "Ver sesiones",
    },
    {
      icon: UsersRound,
      title: "Roles clínica",
      description: "Auditoría de cambios de rol en usuarios de clínicas.",
      moduleId: "admin-users-roles",
      onClick: () => activateWorkspace("admin-users-roles"),
      actionLabel: "Ver roles",
    },
    {
      icon: ScrollText,
      title: "Auditoría",
      description: "Log de eventos con filtros por tipo de evento y actor.",
      moduleId: "audit-log",
      onClick: () => activateWorkspace("audit-log"),
      actionLabel: "Ver log",
    },
    {
      icon: ShieldCheck,
      title: "Mantenimiento",
      description: "Dry-run de mantenimiento y verificación de esquema.",
      moduleId: "admin-maintenance",
      onClick: () => activateWorkspace("admin-maintenance"),
      actionLabel: "Ver mantenimiento",
    },
  ];

  if (showWorkspace) {
    return (
      <DashboardModuleWorkspace
        title="Administración"
        description="Gestión operativa, alertas, configuración y auditoría."
        moduleId="admin"
        onBack={backToHub}
      >
        <div className="space-y-6">
          {workspaces.commandCenter}
          {workspaces.alertsSection}
          {workspaces.sectionTabs}
        </div>
      </DashboardModuleWorkspace>
    );
  }

  return (
    <DashboardModuleHub
      heading="Módulos de administración"
      description="Acceso a clínicas, precios, sesiones, auditoría y estado del sistema."
      cards={adminCards}
    />
  );
}
