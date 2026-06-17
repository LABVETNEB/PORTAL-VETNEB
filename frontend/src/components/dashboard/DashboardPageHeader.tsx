import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type DashboardPageHeaderProps = {
  title: string;
  description?: string;
  badge?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function DashboardPageHeader({
  title,
  description,
  badge,
  actions,
  className,
}: DashboardPageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-b border-vetneb-line/70 pb-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:pb-5",
        className,
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold text-vetneb-ink">{title}</h1>
          {badge ? <div className="shrink-0">{badge}</div> : null}
        </div>
        {description ? (
          <p className="mt-1 hidden max-w-3xl text-sm text-muted-foreground sm:block">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

