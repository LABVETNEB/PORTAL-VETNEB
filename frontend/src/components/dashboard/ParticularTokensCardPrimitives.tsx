import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/lib/utils";

type ParticularTokensMetric = {
  label: ReactNode;
  value: ReactNode;
};

type ParticularTokensMetricStripProps = ComponentPropsWithoutRef<"div"> & {
  metrics: ParticularTokensMetric[];
  itemClassName?: string;
  labelClassName?: string;
  valueClassName?: string;
};

export function ParticularTokensMetricStrip({
  metrics,
  className,
  itemClassName,
  labelClassName,
  valueClassName,
  ...props
}: ParticularTokensMetricStripProps) {
  return (
    <div
      className={cn(
        "divide-x divide-vetneb-line/70 border border-vetneb-line/75 bg-vetneb-surface-muted/45 text-center",
        className,
      )}
      {...props}
    >
      {metrics.map((metric) => (
        <div key={String(metric.label)} className={itemClassName}>
          <p
            className={cn(
              "text-[0.6875rem] text-muted-foreground",
              labelClassName,
            )}
          >
            {metric.label}
          </p>
          <p
            className={cn(
              "font-semibold leading-tight text-vetneb-ink",
              valueClassName,
            )}
          >
            {metric.value}
          </p>
        </div>
      ))}
    </div>
  );
}

export function ParticularTokensPanel({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-vetneb-line/75 bg-card/82",
        className,
      )}
      {...props}
    />
  );
}

export function ParticularTokensPanelHeader({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-between gap-3 border-b border-vetneb-line/70 px-3 py-2",
        className,
      )}
      {...props}
    />
  );
}

export function ParticularTokensPanelBody({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", className)}
      {...props}
    />
  );
}

export function ParticularTokensPanelFooter({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn(
        "flex min-h-10 shrink-0 items-center justify-end border-t border-vetneb-line/65 px-3 py-2 text-xs text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function ParticularTokensMobileList({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn(
        "min-h-0 flex-1 divide-y divide-vetneb-line/60 overflow-hidden rounded-lg border border-vetneb-line/75",
        className,
      )}
      {...props}
    />
  );
}

export function ParticularTokensEmptyPanel({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 rounded-lg border border-vetneb-line/75 bg-card/82 p-3",
        className,
      )}
      {...props}
    />
  );
}
