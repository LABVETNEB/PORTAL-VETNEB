"use client";

import { Button } from "@/components/ui/button";
import { DASHBOARD_TOUCH_PAGER_RESERVATION } from "@/components/dashboard/DashboardPager";

type AdminMobileOpsPagerProps = {
  ariaLabel: string;
  page: number;
  pageCount: number;
  rangeLabel: string;
  previousDisabled: boolean;
  nextDisabled: boolean;
  disabled?: boolean;
  onPrevious: () => void;
  onNext: () => void;
};

export function AdminMobileOpsPager({
  ariaLabel,
  page,
  pageCount,
  rangeLabel,
  previousDisabled,
  nextDisabled,
  disabled = false,
  onPrevious,
  onNext,
}: AdminMobileOpsPagerProps) {
  return (
    <nav
      aria-label={ariaLabel}
      data-admin-mobile-ops-pager="true"
      data-dashboard-adaptive-reserved-region="pager"
      className="dashboard-pager flex min-h-10 shrink-0 items-center justify-center gap-1.5 overflow-hidden border-t border-vetneb-line/70 px-2 text-xs text-muted-foreground"
      style={DASHBOARD_TOUCH_PAGER_RESERVATION}
    >
      <span className="sr-only" aria-live="polite">
        {rangeLabel}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 px-2.5 text-xs"
        aria-label="Anterior"
        disabled={disabled || previousDisabled}
        onClick={onPrevious}
      >
        Anterior
      </Button>
      <span className="min-w-16 text-center tabular-nums">
        Pág. {page} / {pageCount}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 px-2.5 text-xs"
        aria-label="Siguiente"
        disabled={disabled || nextDisabled}
        onClick={onNext}
      >
        Siguiente
      </Button>
    </nav>
  );
}
