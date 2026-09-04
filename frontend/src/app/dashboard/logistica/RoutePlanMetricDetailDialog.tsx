"use client";

import { Eye } from "lucide-react";
import { ModuleDialog } from "@/components/dashboard/ModuleDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RouteMetrics } from "@/types";

type RoutePlanMetricDetailDialogProps = {
  metric: RouteMetrics;
  planName: string;
};

/**
 * Detail destination for the route-metric stat breakdown (total/completed/
 * skipped/no-show stops, average duration, compliance progress bar) that does
 * not fit the compact canonical row. All fields visible on the previous
 * "block" (168px) card are preserved here, none dropped.
 */
export function RoutePlanMetricDetailDialog({
  metric,
  planName,
}: RoutePlanMetricDetailDialogProps) {
  return (
    <ModuleDialog
      title={planName}
      description={`Plan #${metric.routePlanId}`}
      scrollableBody
      trigger={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
          aria-label={`Ver detalle de métricas del plan ${planName}`}
        >
          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
          Ver
        </Button>
      }
    >
      <dl className="grid grid-cols-1 gap-x-4 gap-y-3 text-[13px] sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Cumplimiento
          </dt>
          <dd className="dashboard-detail-value mt-0.5">
            <Badge
              variant={
                metric.complianceRate >= 90
                  ? "default"
                  : metric.complianceRate >= 60
                    ? "secondary"
                    : "destructive"
              }
            >
              {metric.complianceRate}%
            </Badge>
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Duración promedio
          </dt>
          <dd className="dashboard-detail-value mt-0.5 text-vetneb-ink">
            {metric.averageDurationMinutes === null
              ? "—"
              : `${metric.averageDurationMinutes} min`}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Total paradas
          </dt>
          <dd className="dashboard-detail-value mt-0.5 font-semibold text-vetneb-ink">
            {metric.totalStops}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Completadas
          </dt>
          <dd className="dashboard-detail-value mt-0.5 font-semibold text-vetneb-teal">
            {metric.completedStops}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Omitidas
          </dt>
          <dd className="dashboard-detail-value mt-0.5 font-semibold text-vetneb-amber">
            {metric.skippedStops}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Sin presencia
          </dt>
          <dd className="dashboard-detail-value mt-0.5 font-semibold text-destructive">
            {metric.noShowStops}
          </dd>
        </div>
        <div className="min-w-0 sm:col-span-2">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Progreso
          </dt>
          <dd className="dashboard-detail-value mt-1">
            <div className="clinical-progress h-2 w-full">
              <div
                className="h-full rounded-full"
                style={{ width: `${metric.complianceRate}%` }}
                role="progressbar"
                aria-valuenow={metric.complianceRate}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Cumplimiento: ${metric.complianceRate}%`}
              />
            </div>
          </dd>
        </div>
      </dl>
    </ModuleDialog>
  );
}
