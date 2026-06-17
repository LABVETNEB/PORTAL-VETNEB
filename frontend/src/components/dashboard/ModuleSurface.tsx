import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ModuleSurfaceProps = {
  /** Optional fixed toolbar row (filters, search, primary actions). */
  toolbar?: ReactNode;
  /** Growing body region — fills remaining viewport height without scroll. */
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  ariaLabel?: string;
};

/**
 * Standard single-viewport module frame for the App Shell.
 *
 * Establishes the bottom of the height chain: a flex column with `min-h-0` so
 * its body (`dashboard-module-body`) fills the available space and bounded
 * content (tables/lists via pagination, sections via tabs) fits one desktop
 * viewport without operational scroll.
 */
export function ModuleSurface({
  toolbar,
  children,
  className,
  bodyClassName,
  ariaLabel,
}: ModuleSurfaceProps) {
  return (
    <div
      className={cn("dashboard-module-surface", className)}
      data-dashboard-module-surface="true"
      aria-label={ariaLabel}
    >
      {toolbar ? (
        <div className="dashboard-module-toolbar" data-module-toolbar="true">
          {toolbar}
        </div>
      ) : null}
      <div className={cn("dashboard-module-body", bodyClassName)}>{children}</div>
    </div>
  );
}
