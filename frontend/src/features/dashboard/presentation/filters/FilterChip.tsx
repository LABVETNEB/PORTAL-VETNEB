"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * C11 · one applied filter, as the consumer states it (audit §46: chip 32 px,
 * width 96–160 px, padding 0 12px, radius 8, 1 px outline, body-sm w500, no shadow).
 * Presentation only: the consumer owns the filter, formats its value and decides what removing it does.
 */
export type ActiveFilter = {
  /** Stable, unique and non-empty: keys, focus restoration and the overflow follow it. */
  id: string;
  label: string;
  value: string;
  /** The consumer's removal; without it the filter is shown read-only. */
  onRemove?: () => void;
  disabled?: boolean;
};

export type FilterChipProps = {
  label: string;
  value: string;
  /** Runs once per activation; without it the chip is read-only. */
  onRemove?: () => void;
  removeLabel?: string;
  disabled?: boolean;
  className?: string;
};

export function filterChipName(label: string, value: string) {
  return `${label}: ${value}`;
}

export function FilterChip({ label, value, onRemove, removeLabel = "Quitar filtro", disabled = false, className }: FilterChipProps) {
  const name = filterChipName(label, value);
  return (
    <span
      data-filter-chip="true"
      className={cn(
        "inline-flex h-11 md:h-8 min-w-24 max-w-40 shrink-0 items-center gap-1 rounded-lg border border-input bg-transparent px-3 text-[0.8125rem] font-medium leading-5 text-foreground shadow-none",
        disabled && "text-muted-foreground",
        className,
      )}
    >
      <span className="min-w-0 flex-1 truncate" title={name}>
        <span className="text-muted-foreground">{label}: </span>
        {value}
      </span>
      {onRemove ? (
        <button
          type="button"
          aria-label={`${removeLabel} ${name}`}
          disabled={disabled}
          onClick={onRemove}
          className="-my-px -mr-3 flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-55 md:my-0 md:-mr-1.5 md:size-6"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      ) : null}
    </span>
  );
}
