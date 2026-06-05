import {
  Activity,
  AlertCircle,
  CheckCircle2,
  CircleHelp,
  CirclePause,
  Clock3,
  CloudUpload,
  LoaderCircle,
  PackageCheck,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusBadgeSize = "sm" | "md";

type StatusBadgeConfig = {
  label: string;
  icon: LucideIcon;
  variant: "default" | "secondary" | "destructive" | "outline";
  semanticClass: string;
  toneClassName: string;
};

export type StatusBadgeProps = {
  status: string;
  label?: string;
  size?: StatusBadgeSize;
  className?: string;
};

const statusBadgeConfig = {
  uploaded: {
    label: "Subido",
    icon: CloudUpload,
    variant: "outline",
    semanticClass: "status-badge-uploaded",
    toneClassName:
      "border-vetneb-cyan/35 bg-vetneb-cyan/12 text-vetneb-navy",
  },
  processing: {
    label: "Procesando",
    icon: LoaderCircle,
    variant: "secondary",
    semanticClass: "status-badge-processing",
    toneClassName:
      "border-vetneb-cyan/35 bg-vetneb-cyan/14 text-vetneb-navy",
  },
  ready: {
    label: "Listo",
    icon: CheckCircle2,
    variant: "default",
    semanticClass: "status-badge-ready",
    toneClassName:
      "border-vetneb-teal/35 bg-vetneb-teal/12 text-vetneb-teal",
  },
  delivered: {
    label: "Entregado",
    icon: PackageCheck,
    variant: "default",
    semanticClass: "status-badge-delivered",
    toneClassName:
      "border-vetneb-teal/35 bg-vetneb-teal/12 text-vetneb-teal",
  },
  pending: {
    label: "Pendiente",
    icon: Clock3,
    variant: "outline",
    semanticClass: "status-badge-pending",
    toneClassName:
      "border-vetneb-line bg-vetneb-surface-muted/80 text-vetneb-ink/78",
  },
  in_progress: {
    label: "En curso",
    icon: LoaderCircle,
    variant: "secondary",
    semanticClass: "status-badge-in-progress",
    toneClassName:
      "border-vetneb-cyan/35 bg-vetneb-cyan/14 text-vetneb-navy",
  },
  done: {
    label: "Completado",
    icon: CheckCircle2,
    variant: "default",
    semanticClass: "status-badge-done",
    toneClassName:
      "border-vetneb-teal/35 bg-vetneb-teal/12 text-vetneb-teal",
  },
  canceled: {
    label: "Cancelado",
    icon: XCircle,
    variant: "destructive",
    semanticClass: "status-badge-canceled",
    toneClassName:
      "border-destructive/35 bg-destructive/12 text-destructive",
  },
  error: {
    label: "Error",
    icon: AlertCircle,
    variant: "destructive",
    semanticClass: "status-badge-error",
    toneClassName:
      "border-destructive/35 bg-destructive/12 text-destructive",
  },
  failed: {
    label: "Fallido",
    icon: AlertCircle,
    variant: "destructive",
    semanticClass: "status-badge-failed",
    toneClassName:
      "border-destructive/35 bg-destructive/12 text-destructive",
  },
  active: {
    label: "Activo",
    icon: Activity,
    variant: "default",
    semanticClass: "status-badge-active",
    toneClassName:
      "border-vetneb-teal/35 bg-vetneb-teal/12 text-vetneb-teal",
  },
  inactive: {
    label: "Inactivo",
    icon: CirclePause,
    variant: "outline",
    semanticClass: "status-badge-inactive",
    toneClassName:
      "border-vetneb-line bg-vetneb-surface-muted/80 text-vetneb-ink/64",
  },
  unknown: {
    label: "Desconocido",
    icon: CircleHelp,
    variant: "outline",
    semanticClass: "status-badge-unknown",
    toneClassName:
      "border-vetneb-line bg-card/80 text-muted-foreground",
  },
} satisfies Record<string, StatusBadgeConfig>;

type KnownStatus = keyof typeof statusBadgeConfig;

function isKnownStatus(status: string): status is KnownStatus {
  return status in statusBadgeConfig;
}

function normalizeStatus(status: string): KnownStatus {
  return isKnownStatus(status) ? status : "unknown";
}

export function StatusBadge({
  status,
  label,
  size = "md",
  className,
}: StatusBadgeProps) {
  const normalizedStatus = normalizeStatus(status);
  const config = statusBadgeConfig[normalizedStatus];
  const Icon = config.icon;

  return (
    <Badge
      variant={config.variant}
      className={cn(
        "status-badge inline-flex whitespace-nowrap",
        config.semanticClass,
        config.toneClassName,
        size === "sm" ? "gap-1 px-2 py-0 text-[0.68rem]" : "gap-1.5",
        className,
      )}
      data-status={normalizedStatus}
    >
      <Icon
        className={cn("shrink-0", size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5")}
        aria-hidden="true"
      />
      <span>{label ?? config.label}</span>
    </Badge>
  );
}
