"use client";

import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FilterChip, type ActiveFilter } from "./FilterChip";
import { FilterOverflow } from "./FilterOverflow";

/**
 * C11 · the consumer's applied filters on one row of the filter region. Chips
 * that do not fit move, in order, to the C08 overflow; when no chip fits, the
 * global clear moves there too. The row keeps no copy of the filters: only how
 * many fit and where focus goes after a removal.
 */
export type ActiveFilterChipsProps = {
  /** Applied filters in the consumer's normative order. Read on every render, never stored. */
  filters: readonly ActiveFilter[];
  /** Only when the consumer's contract has a global clear. */
  onClearAll?: () => void;
  clearAllLabel?: string;
  removeLabel?: string;
  label?: string;
  disabled?: boolean;
  /** Receives focus when the focused control leaves and no chip or overflow can take its place. */
  returnFocusRef?: RefObject<HTMLElement | null>;
  className?: string;
};

type Fit = { visible: number; reserve: number };
type RemovalIntent = { index: number; from: "chip" | "overflow" | "clear" };

function assertIdentities(filters: readonly ActiveFilter[]) {
  const seen = new Set<string>();
  for (const filter of filters) {
    if (!filter.id.trim()) throw new Error("ActiveFilterChips: every filter needs a non-empty id");
    if (seen.has(filter.id)) throw new Error(`ActiveFilterChips: duplicate filter id "${filter.id}"`);
    seen.add(filter.id);
  }
}

const CLEAR_CLASS = "h-11 min-w-[88px] shrink-0 rounded-lg px-3 text-[0.8125rem] focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-primary md:h-8";

export function ActiveFilterChips({
  filters,
  onClearAll,
  clearAllLabel = "Limpiar filtros",
  removeLabel = "Quitar filtro",
  label = "Filtros activos",
  disabled = false,
  returnFocusRef,
  className,
}: ActiveFilterChipsProps) {
  assertIdentities(filters);
  const row = useRef<HTMLDivElement>(null);
  const measure = useRef<HTMLDivElement>(null);
  const intent = useRef<RemovalIntent | null>(null);
  const disappearingOverflowFocus = useRef(false);
  const [fit, setFit] = useState<Fit | null>(null);
  const clearable = Boolean(onClearAll);
  const empty = filters.length === 0;

  const layout = useCallback(() => {
    const host = row.current;
    const probe = measure.current;
    if (!host || !probe) return;
    const width = (selector: string) => [...probe.querySelectorAll<HTMLElement>(selector)].map((element) => element.getBoundingClientRect().width);
    const gap = parseFloat(getComputedStyle(host).columnGap) || 0;
    const span = (widths: number[]) => widths.reduce((total, next) => total + next, 0) + gap * Math.max(0, widths.length - 1);
    const chips = width('[data-filter-measure="chip"]');
    const [trigger = 0] = width('[data-filter-measure="overflow"]');
    const clear = width('[data-filter-measure="clear"]');
    const available = host.clientWidth;
    let visible = 0;
    if (span([...chips, ...clear]) <= available) visible = chips.length;
    else {
      for (let count = chips.length - 1; count >= 1; count -= 1) {
        if (span([...chips.slice(0, count), trigger, ...clear]) <= available) {
          visible = count;
          break;
        }
      }
    }
    const overflow = host.querySelector<HTMLButtonElement>(":scope > [data-action-menu-trigger]");
    if (visible === chips.length && overflow && document.activeElement === overflow) {
      disappearingOverflowFocus.current = true;
    }
    setFit((current) => (current?.visible === visible && current.reserve === trigger ? current : { visible, reserve: trigger }));
  }, []);

  useLayoutEffect(layout, [layout, filters, clearable, clearAllLabel, removeLabel]);

  useLayoutEffect(() => {
    const host = row.current;
    const probe = measure.current;
    if (!host || !probe) return;
    const observer = new ResizeObserver(() => layout());
    observer.observe(host);
    observer.observe(probe);
    return () => observer.disconnect();
  }, [layout, empty]);

  useLayoutEffect(() => {
    if (!disappearingOverflowFocus.current) return;
    disappearingOverflowFocus.current = false;
    const active = document.activeElement;
    if (active && active !== document.body && active.isConnected) return;
    const target = row.current?.querySelector<HTMLButtonElement>(":scope > ul [data-filter-chip] button:not(:disabled)");
    (target ?? returnFocusRef?.current)?.focus({ preventScroll: true });
  }, [fit, returnFocusRef]);

  useLayoutEffect(() => {
    const pending = intent.current;
    if (!pending) return;
    intent.current = null;
    const active = document.activeElement;
    if (active && active !== document.body && active.isConnected) return;
    const host = row.current;
    const removers = host ? [...host.querySelectorAll<HTMLButtonElement>(":scope > ul [data-filter-chip] button:not(:disabled)")] : [];
    const overflow = host?.querySelector<HTMLButtonElement>(":scope > [data-action-menu-trigger]");
    const target =
      pending.from === "chip"
        ? removers[pending.index] ?? removers[removers.length - 1] ?? overflow
        : pending.from === "overflow"
          ? overflow ?? removers[removers.length - 1]
          : null;
    (target ?? returnFocusRef?.current)?.focus({ preventScroll: true });
  }, [filters, returnFocusRef]);

  if (empty) return null;

  const visible = Math.min(fit?.visible ?? filters.length, filters.length);
  const shown = filters.slice(0, visible);
  const hidden = filters.slice(visible).map((filter, offset) => ({
    ...filter,
    onRemove: filter.onRemove && (() => {
      intent.current = { index: visible + offset, from: "overflow" };
      filter.onRemove?.();
    }),
  }));
  const clearOutside = clearable && visible > 0;
  const clearAll = onClearAll && (() => {
    intent.current = { index: 0, from: "clear" };
    onClearAll();
  });

  return (
    <div
      ref={row}
      role="group"
      aria-label={label}
      data-active-filter-chips="true"
      className={cn("relative flex h-10 min-w-0 flex-1 items-center gap-2", className)}
      style={fit ? { minWidth: fit.reserve } : undefined}
    >
      {shown.length > 0 ? (
        <ul className="flex min-w-0 items-center gap-2">
          {shown.map((filter, index) => (
            <li key={filter.id} className="flex shrink-0">
              <FilterChip
                label={filter.label}
                value={filter.value}
                removeLabel={removeLabel}
                disabled={disabled || filter.disabled}
                onRemove={filter.onRemove && (() => {
                  intent.current = { index, from: "chip" };
                  filter.onRemove?.();
                })}
              />
            </li>
          ))}
        </ul>
      ) : null}
      <FilterOverflow
        filters={hidden}
        onClearAll={clearOutside ? undefined : clearAll}
        clearAllLabel={clearAllLabel}
        removeLabel={removeLabel}
        disabled={disabled}
      />
      {clearOutside ? (
        <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={clearAll} className={CLEAR_CLASS}>
          {clearAllLabel}
        </Button>
      ) : null}
      <div aria-hidden="true" inert className="pointer-events-none invisible absolute left-0 top-0 h-0 w-0 overflow-hidden">
        <div ref={measure} className="flex w-max items-center">
          {filters.map((filter) => (
            <div key={filter.id} data-filter-measure="chip" className="flex shrink-0">
              <FilterChip label={filter.label} value={filter.value} removeLabel={removeLabel} onRemove={filter.onRemove} />
            </div>
          ))}
          <div data-filter-measure="overflow" className="flex shrink-0">
            <FilterOverflow filters={filters} />
          </div>
          {onClearAll ? (
            <div data-filter-measure="clear" className="flex shrink-0">
              <Button type="button" variant="ghost" size="sm" tabIndex={-1} className={CLEAR_CLASS}>
                {clearAllLabel}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
