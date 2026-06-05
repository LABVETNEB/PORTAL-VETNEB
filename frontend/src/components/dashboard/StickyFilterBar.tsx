import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type ActiveFilter = {
  label: string;
  value: string;
};

export type StickyFilterBarProps = {
  title?: string;
  activeFilters?: ActiveFilter[];
  actions?: ReactNode;
  drawer?: ReactNode;
  className?: string;
};

export function StickyFilterBar({
  title = "Filtros",
  activeFilters = [],
  actions,
  drawer,
  className,
}: StickyFilterBarProps) {
  return (
    <section
      aria-label="Filtros del dashboard"
      data-sticky-filter-bar="true"
      className={cn(
        "sticky top-3 z-40 min-w-0 rounded-lg border border-vetneb-line/80 bg-card/95 px-3 py-3 shadow-sm backdrop-blur md:top-[8.75rem] md:px-4",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-2">
          {title ? (
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              {title}
            </p>
          ) : null}
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {activeFilters.length ? (
              activeFilters.map((filter) => (
                <span
                  key={`${filter.label}-${filter.value}`}
                  className="inline-flex max-w-full items-center gap-1 rounded-md border border-vetneb-line/80 bg-vetneb-surface-muted/80 px-2.5 py-1 text-xs font-semibold text-vetneb-ink"
                >
                  <span className="text-muted-foreground">{filter.label}</span>
                  <span className="min-w-0 truncate">{filter.value}</span>
                </span>
              ))
            ) : (
              <span className="inline-flex rounded-md border border-vetneb-line/80 bg-vetneb-surface-muted/80 px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                Sin filtros activos
              </span>
            )}
          </div>
        </div>

        {drawer || actions ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end [&_button]:focus-visible:ring-2 [&_button]:focus-visible:ring-ring/85">
            {drawer}
            {actions}
          </div>
        ) : null}
      </div>
    </section>
  );
}
