import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type CanonicalOperationalRowProps = {
  /** Row-scoped data attributes (e.g. `data-logistics-mobile-row="visita"`). */
  dataAttributes?: Record<string, string | undefined>;
  /** Compact badge(s) rendered before the identity text, on the primary line. */
  badges?: ReactNode;
  /** Primary, truncated identity text — the row's single most important field. */
  identity: ReactNode;
  /** Secondary muted line, ` · `-joined metadata. Omit when there is none. */
  secondary?: ReactNode;
  /** Trailing action cluster (status badge, buttons, detail-dialog trigger). */
  trailing?: ReactNode;
  className?: string;
  /**
   * When set, the identity+secondary block renders as a button (the whole
   * row surface activates it) instead of static text — for rows that are
   * themselves a selection control (e.g. the informes master list).
   */
  onActivate?: () => void;
  activateLabel?: string;
  isActive?: boolean;
  activateId?: string;
};

/**
 * Canonical mobile operational row: identity+badges line, one muted secondary
 * line, trailing action cluster. Mirrors the live Admin row grammar shared by
 * `AdminSessionsReadOnlyCard`, `AdminUsersRolesReadOnlyCard` and
 * `AdminMobileAuditModule` — all three independently converge on this exact
 * shape — pinned to `--dash-row-pitch-regular` (44px) via
 * `data-dashboard-adaptive-row` in `zero-scroll.css`. A plain function
 * (no "use client"): every current consumer is a server component.
 */
export function CanonicalOperationalRow({
  dataAttributes,
  badges,
  identity,
  secondary,
  trailing,
  className,
  onActivate,
  activateLabel,
  isActive,
  activateId,
}: CanonicalOperationalRowProps) {
  const textBlock = (
    <div className="min-w-0 flex-1">
      <div className="flex min-w-0 items-center gap-1.5">
        {badges}
        <span className="min-w-0 truncate text-xs font-semibold text-vetneb-ink">
          {identity}
        </span>
      </div>
      {secondary ? (
        <p className="truncate text-[11px] text-muted-foreground">
          {secondary}
        </p>
      ) : null}
    </div>
  );

  return (
    <div
      data-dashboard-adaptive-row="true"
      {...dataAttributes}
      className={cn(
        "flex w-full min-w-0 max-w-full shrink-0 items-center gap-2 overflow-hidden px-2 py-1 min-h-11",
        className,
      )}
    >
      {onActivate ? (
        <button
          type="button"
          id={activateId}
          onClick={onActivate}
          aria-current={isActive ? "true" : undefined}
          aria-label={activateLabel}
          className={cn(
            "min-w-0 flex-1 rounded-md text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-inset",
            isActive && "bg-vetneb-cyan/12",
          )}
        >
          {textBlock}
        </button>
      ) : (
        textBlock
      )}
      {trailing ? (
        <div className="flex shrink-0 items-center gap-1.5">{trailing}</div>
      ) : null}
    </div>
  );
}
