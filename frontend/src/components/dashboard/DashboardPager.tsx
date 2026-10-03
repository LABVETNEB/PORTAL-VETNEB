"use client";

import type { CSSProperties, ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * C02 — single runtime owner of the dashboard pager and of its reservations.
 * `CollectionPager` is published through `presentation/surfaces`; the legacy
 * `DashboardPager` (below) and `CompactPager` (its own module) are thin
 * adapters that pin a variant. It lives in this module, as C01 lives in
 * `ui/table`, because the 14 reservation consumers already import from here.
 */
/**
 * Canonical pager reservation, shared by every surface that owns pager markup
 * of its own instead of rendering this component.
 *
 * A reserved region declared only with `shrink-0` and a `min-h-*` floor is NOT
 * reserved: `max-block-size` stays `none` and `flex-basis` stays `auto`, so the
 * region grows with its own content, the sibling rows canvas (`flex-1 min-h-0`)
 * gives the pixels back 1:1, and the capacity engine recomputes a different
 * adaptive limit from a canvas that only moved because the pager did.
 *
 * The trio is applied INLINE on purpose: Tailwind utilities outrank the
 * `components` layer that carries `.dashboard-pager`, so a `min-h-*` left on
 * the consumer would otherwise win over the primitive's own reservation.
 */
export const DASHBOARD_PAGER_RESERVATION = {
  "--dash-adaptive-pager-reserved-block-size": "var(--dash-pagination-h, 2.5rem)",
  blockSize: "var(--dash-adaptive-pager-reserved-block-size)",
  minBlockSize: "var(--dash-adaptive-pager-reserved-block-size)",
  maxBlockSize: "var(--dash-adaptive-pager-reserved-block-size)",
} as CSSProperties;

/**
 * Same reservation for the pagers whose controls are touch targets.
 *
 * `--dash-pagination-h` floors at 2.25rem, which is SMALLER than the 2.25rem
 * button plus its 1px separator, so pinning those regions to the plain token
 * would clip a control that `test/unit/ui/admin/admin-mobile-*-pager-canonical-
 * layout.test.ts` pins at >=36px on purpose. The floor raised here is the
 * `min-h-10` those pagers already declare — the reservation stops being a
 * minimum and becomes exact, which is the whole defect being fixed; the touch
 * target itself is left untouched.
 */
export const DASHBOARD_TOUCH_PAGER_RESERVATION = {
  "--dash-adaptive-pager-reserved-block-size":
    "max(var(--dash-pagination-h, 2.5rem), 2.5rem)",
  blockSize: "var(--dash-adaptive-pager-reserved-block-size)",
  minBlockSize: "var(--dash-adaptive-pager-reserved-block-size)",
  maxBlockSize: "var(--dash-adaptive-pager-reserved-block-size)",
} as CSSProperties;

/**
 * Reservation for a pager that is NOT a footer: a compact prev/next cluster
 * sitting inside a toolbar row (Clínicas). Reserving the full pagination
 * footer height there would inflate the toolbar by ~11px for nothing, so the
 * region reserves the control token it actually renders. Still exact, still
 * content-independent — only the magnitude is the right one for the row.
 */
export const DASHBOARD_INLINE_PAGER_RESERVATION = {
  "--dash-adaptive-pager-reserved-block-size": "var(--dash-control-h, 2rem)",
  blockSize: "var(--dash-adaptive-pager-reserved-block-size)",
  minBlockSize: "var(--dash-adaptive-pager-reserved-block-size)",
  maxBlockSize: "var(--dash-adaptive-pager-reserved-block-size)",
} as CSSProperties;

type CollectionPagerBaseProps = {
  className?: string;
  /** Zero-based page index. */
  page?: number;
  pageCount?: number;
  hasPrev?: boolean;
  hasNext?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  disabled?: boolean;
};

/**
 * Centered footer `Anterior | Pág. X / Y | Siguiente` inside a `nav` landmark
 * and the touch reservation. Slot mode (`prevControl`/`stateControl`/
 * `nextControl`) lets a surface own pinned control markup while the pager
 * keeps the centered geometry and the stable selectors.
 */
export type CollectionPagerCenteredProps = CollectionPagerBaseProps & {
  variant: "centered";
  /** Accessible name of the pagination landmark. */
  "aria-label": string;
  prevControl?: ReactNode;
  stateControl?: ReactNode;
  nextControl?: ReactNode;
  /**
   * CMP-09 — accessible range/total announcement (e.g. "1–13 de 60"),
   * rendered `sr-only` like Admin's `AdminMobileOpsPager`. Omit when no total
   * is known (the logistics full routes' backend does not expose one).
   */
  rangeLabel?: string;
};

/**
 * Compact bar pinned to the bottom of a module body: visible range/total
 * announcement, then `Pág. X / Y` and icon controls, inside the standard
 * reservation.
 */
export type CollectionPagerCompactProps = CollectionPagerBaseProps & {
  variant: "compact";
  /** 1-based index of the first visible item (0 when empty). */
  rangeStart: number;
  rangeEnd: number;
  total: number;
  /** Plural noun for the range label, e.g. "registros". */
  itemLabel?: string;
};

export type CollectionPagerProps =
  | CollectionPagerCenteredProps
  | CollectionPagerCompactProps;

type CollectionPagerVariant = CollectionPagerProps["variant"];

const PAGER_STEPS = {
  prev: { label: "Página anterior", text: "Anterior", Icon: ChevronLeft },
  next: { label: "Página siguiente", text: "Siguiente", Icon: ChevronRight },
} as const;

const PAGER_CONTROL_CLASS_NAME =
  "inline-flex h-8 items-center justify-center rounded-md border border-input bg-card/95 text-foreground hover:border-vetneb-teal/45 hover:bg-accent/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

const PAGER_CONTROL_VARIANT_CLASS_NAME: Record<CollectionPagerVariant, string> = {
  centered: "dashboard-pagination-btn px-3 text-xs font-semibold shadow-sm transition-colors",
  compact: "w-8 dashboard-btn-interactive",
};

function renderPagerControl(
  step: keyof typeof PAGER_STEPS,
  variant: CollectionPagerVariant,
  disabled: boolean,
  onClick: (() => void) | undefined,
) {
  const { label, text, Icon } = PAGER_STEPS[step];
  const compact = variant === "compact";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-dashboard-pager-prev={compact && step === "prev" ? "true" : undefined}
      data-dashboard-pager-next={compact && step === "next" ? "true" : undefined}
      aria-label={label}
      className={`${PAGER_CONTROL_CLASS_NAME} ${PAGER_CONTROL_VARIANT_CLASS_NAME[variant]}`}
    >
      {compact ? <Icon className="h-4 w-4" aria-hidden="true" /> : text}
    </button>
  );
}

export function CollectionPager(props: CollectionPagerProps) {
  const {
    variant,
    className,
    page = 0,
    pageCount = 1,
    hasPrev,
    hasNext,
    onPrev,
    onNext,
    disabled = false,
  } = props;
  const safePageCount = Math.max(1, pageCount);
  const displayPage = Math.min(Math.max(1, page + 1), safePageCount);
  const prevDisabled = disabled || !(hasPrev ?? displayPage > 1);
  const nextDisabled = disabled || !(hasNext ?? displayPage < safePageCount);
  const pageState = `Pág. ${displayPage} / ${safePageCount}`;

  if (props.variant === "compact") {
    const { rangeStart, rangeEnd, total, itemLabel = "elementos" } = props;

    return (
      <div
        className={cn("dashboard-compact-pager overflow-hidden pt-0", className)}
        style={DASHBOARD_PAGER_RESERVATION}
        data-collection-pager={variant}
        data-dashboard-compact-pager="true"
        data-dashboard-pager="compact"
        data-dashboard-adaptive-reserved-region="pager"
      >
        <span aria-live="polite" aria-atomic="true">
          {total === 0
            ? `Sin ${itemLabel}`
            : `${rangeStart}–${rangeEnd} de ${total} ${itemLabel}`}
        </span>
        <div className="flex items-center gap-2">
          <span
            className="text-xs text-muted-foreground"
            data-dashboard-pager-state="true"
          >
            {pageState}
          </span>
          {renderPagerControl("prev", variant, prevDisabled, onPrev)}
          {renderPagerControl("next", variant, nextDisabled, onNext)}
        </div>
      </div>
    );
  }

  const {
    "aria-label": ariaLabel,
    prevControl,
    stateControl,
    nextControl,
    rangeLabel,
  } = props;

  return (
    <nav
      aria-label={ariaLabel}
      data-collection-pager={variant}
      data-dashboard-pager="true"
      data-dashboard-adaptive-reserved-region="pager"
      className={cn("dashboard-pager min-h-10", className)}
      style={DASHBOARD_TOUCH_PAGER_RESERVATION}
    >
      {rangeLabel ? (
        <span className="sr-only" aria-live="polite">
          {rangeLabel}
        </span>
      ) : null}
      <span data-dashboard-pager-prev="true" className="inline-flex">
        {prevControl ??
          renderPagerControl("prev", variant, prevDisabled, onPrev)}
      </span>
      <span
        data-dashboard-pager-state="true"
        className="text-xs text-muted-foreground"
      >
        {stateControl ?? (
          <span className="dashboard-pagination-context">{pageState}</span>
        )}
      </span>
      <span data-dashboard-pager-next="true" className="inline-flex">
        {nextControl ??
          renderPagerControl("next", variant, nextDisabled, onNext)}
      </span>
    </nav>
  );
}

export type DashboardPagerProps = Omit<CollectionPagerCenteredProps, "variant">;

/** Legacy name of the centered variant (C02 compatibility adapter). */
export function DashboardPager(props: DashboardPagerProps) {
  return <CollectionPager {...props} variant="centered" />;
}
