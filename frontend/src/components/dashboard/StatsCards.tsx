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
    icon: "📋",
    description: "Informes registrados",
  },
  {
    key: "pendingReports" as keyof DashboardStats,
    label: "Informes pendientes",
    icon: "⏳",
    description: "En proceso o subidos",
  },
  {
    key: "activeVisits" as keyof DashboardStats,
    label: "Visitas activas",
    icon: "🚐",
    description: "Programadas o en curso",
  },
  {
    key: "activePlans" as keyof DashboardStats,
    label: "Planes de ruta",
    icon: "🗺️",
    description: "Liberados o en curso",
  },
];

export function StatsCards({ stats, loading }: StatsCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-gray-100">
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
        <Card key={config.key} className="border-gray-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <span aria-hidden="true">{config.icon}</span>
              {config.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">
              {stats ? stats[config.key] : "—"}
            </p>
            <p className="text-xs text-gray-400 mt-1">{config.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
