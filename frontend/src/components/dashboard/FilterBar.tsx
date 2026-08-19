import type { FormHTMLAttributes, LabelHTMLAttributes, ReactNode } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type FilterBarDensity = "comfortable" | "compact";

export type FilterBarProps = FormHTMLAttributes<HTMLFormElement> & {
  density?: FilterBarDensity;
};

export type FilterFieldProps = LabelHTMLAttributes<HTMLLabelElement> & {
  label: ReactNode;
  labelHidden?: boolean;
  density?: FilterBarDensity;
  children: ReactNode;
};

const filterBarDensityClassNames: Record<FilterBarDensity, string> = {
  // B04: the comfortable bar is persistent toolbar chrome, so its elevation is
  // retired here and stated as elevation-none on the
  // `[data-dashboard-filter-bar]` anchor in styles/dashboard/surfaces.css.
  // B05: the surface RELATIONSHIP is inverted — the container fill (formerly
  // `bg-card/82` / `bg-muted/15`) is removed here, and the tint moves onto
  // each field via the reserved field role on the same anchor in
  // surfaces.css (the only file that consumes it — see the B05 architecture
  // contract). Border, radius, gap and padding are untouched: only the fill
  // moved.
  comfortable:
    "grid grid-cols-1 items-end gap-3 rounded-xl border border-vetneb-line/75 p-3",
  compact:
    "grid grid-cols-1 items-end gap-2 rounded-lg border border-vetneb-line/70 px-2 py-2 md:gap-1.5 md:py-1",
};

const filterFieldDensityClassNames: Record<FilterBarDensity, string> = {
  comfortable: "gap-1.5",
  compact: "gap-1 md:gap-0.5",
};

export function dashboardFilterControlClassName(
  density: FilterBarDensity = "comfortable",
) {
  return cn("text-xs", density === "compact" ? "h-10 md:h-8" : "h-10");
}

export function dashboardFilterActionClassName(
  density: FilterBarDensity = "comfortable",
) {
  return cn(
    "text-xs",
    density === "compact"
      ? "h-10 min-h-10 px-2.5 md:h-8 md:min-h-8 md:px-2"
      : "h-10 min-h-10 px-3",
  );
}

export function FilterBar({
  density = "comfortable",
  className,
  ...props
}: FilterBarProps) {
  return (
    <form
      data-dashboard-filter-bar="true"
      data-dashboard-filter-density={density}
      className={cn(filterBarDensityClassNames[density], className)}
      {...props}
    />
  );
}

export function FilterField({
  label,
  labelHidden = false,
  density = "comfortable",
  className,
  children,
  ...props
}: FilterFieldProps) {
  return (
    <Label
      className={cn(
        "grid min-w-0 text-[11px] font-medium leading-normal text-muted-foreground",
        filterFieldDensityClassNames[density],
        className,
      )}
      {...props}
    >
      <span className={cn(labelHidden && "sr-only")}>{label}</span>
      {children}
    </Label>
  );
}
