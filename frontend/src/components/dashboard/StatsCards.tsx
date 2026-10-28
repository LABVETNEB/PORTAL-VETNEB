import {
  ClipboardList,
  Clock3,
  Map,
  Route,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { DashboardStats } from "@/types";

interface StatsCardsProps {
  stats: DashboardStats | null;
  loading?: boolean;
}

const statConfig = [
  {
    key: "totalReports" as keyof DashboardStats,
    label: "Informes totales",
    icon: ClipboardList,
    description: "Informes registrados",
    tone: "text-vetneb-navy bg-vetneb-cyan/10 border-vetneb-cyan/25",
    cardClassName: "",
    emphasisLabel: null,
  },
  {
    key: "pendingReports" as keyof DashboardStats,
    label: "Informes pendientes",
    icon: Clock3,
    description: "En proceso o subidos",
    tone: "text-vetneb-amber bg-vetneb-amber/10 border-vetneb-amber/25",
    cardClassName: "border-vetneb-amber/45",
    emphasisLabel: "Prioridad",
  },
  {
    key: "activeVisits" as keyof DashboardStats,
    label: "Visitas activas",
    icon: Route,
    description: "Programadas o en curso",
    tone: "text-vetneb-teal bg-vetneb-teal/10 border-vetneb-teal/25",
    cardClassName: "",
    emphasisLabel: null,
  },
  {
    key: "activePlans" as keyof DashboardStats,
    label: "Planes de ruta",
    icon: Map,
    description: "Liberados o en curso",
    tone: "text-vetneb-ink bg-vetneb-surface-muted border-vetneb-line",
    cardClassName: "",
    emphasisLabel: null,
  },
] satisfies Array<{
  key: keyof DashboardStats;
  label: string;
  icon: LucideIcon;
  description: string;
  tone: string;
  cardClassName: string;
  emphasisLabel: string | null;
}>;

export function StatsCards({ stats, loading }: StatsCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="dashboard-metric-card overflow-hidden p-0">
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-1" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {statConfig.map((config) => (
        <Card
          key={config.key}
          className={cn("dashboard-metric-card overflow-hidden p-0", config.cardClassName)}
        >
          <CardHeader className="px-4 pb-1.5 pt-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-vetneb-ink">
              <span
                className={`inline-flex h-7 w-7 items-center justify-center rounded-md border ${config.tone}`}
                aria-hidden="true"
              >
                <config.icon className="h-4 w-4" />
              </span>
              {/* C25 F-T5: the label never truncates; "Prioridad" sits on the
                  value row, which is taller than the pill, so the card keeps
                  its height and the label keeps the whole title width. */}
              <span className="min-w-0 break-words">{config.label}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xl font-bold tracking-tight text-vetneb-ink">
                {stats ? stats[config.key] : "—"}
              </p>
              {config.emphasisLabel ? (
                <span className="clinical-pill shrink-0 px-2 py-0.5 text-[0.62rem]">
                  {config.emphasisLabel}
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{config.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
