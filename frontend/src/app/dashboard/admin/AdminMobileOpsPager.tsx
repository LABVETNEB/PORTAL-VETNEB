"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

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
      className="flex min-h-10 shrink-0 items-center justify-between gap-2 overflow-hidden border-t border-vetneb-line/70 px-2 py-1 text-[11px] text-muted-foreground"
    >
      <span className="min-w-0 truncate" aria-live="polite">
        {rangeLabel}
      </span>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-7 w-7"
          aria-label="Anterior"
          disabled={disabled || previousDisabled}
          onClick={onPrevious}
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
        <span className="min-w-14 text-center tabular-nums">
          {page} / {pageCount}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-7 w-7"
          aria-label="Siguiente"
          disabled={disabled || nextDisabled}
          onClick={onNext}
        >
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
