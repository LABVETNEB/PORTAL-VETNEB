import {
  ClipboardList,
  Clock3,
  Map,
  Route,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
  },
  {
    key: "pendingReports" as keyof DashboardStats,
    label: "Informes pendientes",
    icon: Clock3,
    description: "En proceso o subidos",
    tone: "text-vetneb-amber bg-vetneb-amber/10 border-vetneb-amber/25",
  },
  {
    key: "activeVisits" as keyof DashboardStats,
    label: "Visitas activas",
    icon: Route,
    description: "Programadas o en curso",
    tone: "text-vetneb-teal bg-vetneb-teal/10 border-vetneb-teal/25",
  },
  {
    key: "activePlans" as keyof DashboardStats,
    label: "Planes de ruta",
    icon: Map,
    description: "Liberados o en curso",
    tone: "text-vetneb-ink bg-vetneb-surface-muted border-vetneb-line",
  },
] satisfies Array<{
  key: keyof DashboardStats;
  label: string;
  icon: LucideIcon;
  description: string;
  tone: string;
}>;

export function StatsCards({ stats, loading }: StatsCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="overflow-hidden border-vetneb-line/80">
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
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {statConfig.map((config) => (
        <Card key={config.key} className="overflow-hidden border-vetneb-line/80">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <span
                className={`inline-flex h-8 w-8 items-center justify-center rounded-md border ${config.tone}`}
                aria-hidden="true"
              >
                <config.icon className="h-4 w-4" />
              </span>
              {config.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-vetneb-ink">
              {stats ? stats[config.key] : "—"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{config.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
