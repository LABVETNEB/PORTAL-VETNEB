"use client";

import { Eye } from "lucide-react";
import { ModuleDialog } from "@/components/dashboard/ModuleDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RoutePlan } from "@/types";
import { getRoutePlanStatusLabel, getRoutePlanStatusVariant, formatDate } from "@/lib/utils";

type RoutePlanDetailDialogProps = {
  plan: RoutePlan;
};

/**
 * Detail destination for route-plan fields that do not fit the compact
 * canonical row (id, visual progress bar). Mirrors `FieldVisitDetailDialog`.
 */
export function RoutePlanDetailDialog({ plan }: RoutePlanDetailDialogProps) {
  const progress =
    plan.totalStops > 0
      ? Math.round((plan.completedStops / plan.totalStops) * 100)
      : 0;

  return (
    <ModuleDialog
      title={plan.name}
      description={`Plan #${plan.id}`}
      scrollableBody
      trigger={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
          aria-label={`Ver detalle del plan ${plan.name}`}
        >
          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
          Ver
        </Button>
      }
    >
      <dl className="grid grid-cols-1 gap-x-4 gap-y-3 text-[13px] sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Estado
          </dt>
          <dd className="dashboard-detail-value mt-0.5">
            <Badge variant={getRoutePlanStatusVariant(plan.status)}>
              {getRoutePlanStatusLabel(plan.status)}
            </Badge>
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Fecha planificada
          </dt>
          <dd className="dashboard-detail-value mt-0.5 text-vetneb-ink">
            {plan.plannedDate ? formatDate(plan.plannedDate) : "—"}
          </dd>
        </div>
        <div className="min-w-0 sm:col-span-2">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Paradas
          </dt>
          <dd className="dashboard-detail-value mt-1 flex items-center gap-2">
            <div className="clinical-progress h-1.5 max-w-[160px] flex-1">
              <div
                className="h-full rounded-full"
                style={{ width: `${progress}%` }}
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {plan.completedStops}/{plan.totalStops} · {progress}%
            </span>
          </dd>
        </div>
      </dl>
    </ModuleDialog>
  );
}
