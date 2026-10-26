import { Fragment } from "react";
import { ModuleDialog } from "@/components/dashboard/ModuleDialog";
import { DetailsMetadata, DetailsPane } from "@/features/dashboard/presentation/details";
import { cn } from "@/lib/utils";

export type ModuleMetric = {
  key: string;
  label: string;
  value: string | number;
};

type ModuleMetricRunProps = {
  metrics: readonly ModuleMetric[];
  surfaceId: string;
  /** Compatibility hook for an existing canonical Admin consumer. */
  metricAttribute?: string;
  className?: string;
  /**
   * C25 F-T4 · opt-in full-value disclosure for a run its band truncates. The
   * run itself becomes the trigger of a read-only detail listing every metric;
   * its own box and grammar are unchanged. Consumers that never clip omit it.
   */
  detail?: { readonly title: string; readonly description: string };
};

/**
 * CMP-05 — the single inline mobile metric grammar. It comes verbatim from
 * AdminAuditFilterBar: metrics belong in their module header as text, never as
 * standalone cards or an additional layout band.
 */
export function ModuleMetricRun({
  metrics,
  surfaceId,
  metricAttribute = "data-metric",
  className,
  detail,
}: ModuleMetricRunProps) {
  const run = (
    <span
      data-dashboard-b14-metrics={surfaceId}
      className={cn(
        "flex shrink-0 items-baseline gap-1.5 whitespace-nowrap text-xs tabular-nums",
        className,
      )}
    >
      {metrics.map((metric, index) => (
        <Fragment key={metric.key}>
          {index > 0 ? <span aria-hidden="true">·</span> : null}
          <span {...{ [metricAttribute]: metric.key }}>
            {metric.value} {metric.label}
          </span>
        </Fragment>
      ))}
    </span>
  );

  if (!detail) return run;

  return (
    <ModuleDialog
      title={detail.title}
      description={detail.description}
      // 88vh cannot hold four rows on a short viewport (568x320): the body is
      // the dialog's single scroll owner so the trailing metrics stay reachable.
      scrollableBody
      trigger={
        <button
          type="button"
          data-dashboard-b14-metrics-detail={surfaceId}
          className="flex w-full min-w-0 items-baseline rounded-sm text-left focus-visible:!outline-offset-0"
        >
          {run}
          <span className="sr-only">, ver todas las métricas</span>
        </button>
      }
    >
      {/* Focusable so a keyboard user can scroll the body when it overflows
          (axe scrollable-region-focusable); it holds no control of its own. */}
      <div
        role="group"
        tabIndex={0}
        aria-label={detail.title}
        data-dashboard-b14-metrics-detail-list="true"
        className="rounded-sm"
      >
        <DetailsPane label={detail.title}>
          <DetailsMetadata
            items={metrics.map((metric) => ({
              id: metric.key,
              label: metric.label,
              value: String(metric.value),
            }))}
          />
        </DetailsPane>
      </div>
    </ModuleDialog>
  );
}
