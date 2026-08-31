import { Fragment } from "react";
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
}: ModuleMetricRunProps) {
  return (
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
}
