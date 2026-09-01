"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/**
 * CMP-04 — the ONE mobile module card of the dashboard.
 *
 * Extracted verbatim from `AdminMobileStatusModule`, which the white-box audit
 * established as the canonical Admin mobile surface (grammar G-004/G-005/G-007):
 * exactly one `.dashboard-surface` per module, filling the canvas, with an optional
 * chip band and a panel that owns the remaining height at zero scroll.
 *
 * The audit measured Clínica at `surfaceCount = 0` on all five modules (DIF-011),
 * with none of the card's framing tokens (DIF-012) and four extra nesting levels
 * between the module viewport and the content (DIF-013), because it composed
 * `ClinicMobileModuleFrame > ClinicCommandCenter > ModuleSurface > module-body >
 * module-tabs` instead of this card (RC-004).
 *
 * Both roles consume these primitives now. Role and domain differences live in
 * props, data and labels — never in duplicated visual code.
 */

const CARD_CLASS =
  "dashboard-surface flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-vetneb-line/80 bg-card";

/**
 * CMP-07 (regression found during certification) — 'dashboard-module-card-chips'
 * is a stable hook for the shared fluid-rhythm override in mobile-chrome.css.
 * Before it existed, only Admin's chip band was reachable by the admin-only
 * 'module-rhythm-fluid' block in mobile-admin.css (it targeted
 * '[data-admin-mobile-status-chip]' etc.), so Admin's tablist scaled with the
 * viewport (fluid --admin-mobile-chip-* tokens) while Clinic's rendered the
 * component's raw fixed-px Tailwind arbitrary values — a real, reproducible
 * ~1.5px divergence at wide viewports (412x915, 430x932), caught by
 * dashboard-clinic-module-card-parity.spec.ts's per-viewport live-Admin
 * comparison. Both roles style through this ONE class now.
 */
const CHIP_BAND_CLASS =
  "dashboard-module-card-chips flex shrink-0 items-center gap-1 overflow-hidden border-b border-vetneb-line/70 p-[5.36px]";

const CHIP_CLASS =
  "dashboard-module-card-chip min-w-0 flex-1 truncate rounded-md px-[6.4px] py-[5px] text-[10.56px] font-semibold leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-1";

const PANEL_CLASS =
  "dashboard-module-card-panel flex min-h-0 flex-1 flex-col overflow-hidden p-2";

export type ModuleCardSection = {
  id: string;
  label: string;
  content: ReactNode;
};

interface ModuleCardProps {
  readonly ariaLabel: string;
  /** Extra classes for the card element — e.g. `md:hidden` for a mobile-only mount. */
  readonly className?: string;
  /** Structural data-* hooks the consuming surface owns (never styling). */
  readonly dataAttributes?: Readonly<Record<string, string | undefined>>;
  readonly children: ReactNode;
}

/** The card itself: one `.dashboard-surface` that fills the module canvas. */
export function ModuleCard({
  ariaLabel,
  className,
  dataAttributes,
  children,
}: ModuleCardProps) {
  return (
    <section aria-label={ariaLabel} className={cn(CARD_CLASS, className)} {...dataAttributes}>
      {children}
    </section>
  );
}

interface ModuleCardChipsProps {
  readonly ariaLabel: string;
  readonly sections: readonly ModuleCardSection[];
  readonly activeId: string;
  readonly onSelect: (id: string) => void;
  readonly baseId: string;
  /** Attribute name carrying the chip id, e.g. `data-admin-mobile-status-chip`. */
  readonly chipAttribute: string;
}

/**
 * The chip band: equal-width (`flex-1`) truncating chips inside the card, which is
 * what keeps Admin's row at one line. Clínica's `.dashboard-module-tablist` used
 * content-width chips and wrapped to two lines at every viewport (DIF-038..040).
 */
export function ModuleCardChips({
  ariaLabel,
  sections,
  activeId,
  onSelect,
  baseId,
  chipAttribute,
}: ModuleCardChipsProps) {
  const tablistRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  /**
   * CMP-07 (regression found during certification) — the proxy used to be a
   * single 44x44 button CENTERED on the chip, which therefore covered the
   * chip's OWN box too. Since the proxy paints on top (it has to, to catch
   * taps in the margin the chip itself doesn't cover) and its pointer-events
   * are never disabled (it has to receive touches), it silently intercepted
   * EVERY click aimed at the visible chip — including `getByRole("tab").click()`
   * from Playwright, which correctly refuses to click through an obscuring
   * element and hangs until timeout instead. A real user's tap was never
   * actually landing on the semantic chip either; it only worked because the
   * proxy's onClick delegates to `chip.click()`.
   *
   * Fixed by covering ONLY the margin outside the chip's own box: up to four
   * thin strips (top/bottom/left/right) that together tile the 44x44 target
   * minus the chip's own rectangle, computed exactly — never overlapping it.
   * A tap anywhere in the 44x44 area still resolves to either the real chip
   * (native, no proxy involved) or a margin strip (delegates to chip.click()).
   */
  const [proxyStrips, setProxyStrips] = useState<
    readonly { id: string; key: string; left: number; top: number; width: number; height: number }[]
  >([]);

  const syncProxyTargets = useCallback(() => {
    if (window.innerWidth >= 768) {
      setProxyStrips([]);
      return;
    }

    const MIN_TARGET = 44;
    setProxyStrips(
      sections.flatMap((section) => {
        const chip = chipRefs.current[section.id];
        if (!chip) return [];

        const rect = chip.getBoundingClientRect();
        const targetLeft = rect.left + (rect.width - MIN_TARGET) / 2;
        const targetTop = rect.top + (rect.height - MIN_TARGET) / 2;
        const targetRight = targetLeft + MIN_TARGET;
        const targetBottom = targetTop + MIN_TARGET;

        const strips: { id: string; key: string; left: number; top: number; width: number; height: number }[] = [];
        const topHeight = rect.top - targetTop;
        const bottomHeight = targetBottom - (rect.top + rect.height);
        const leftWidth = rect.left - targetLeft;
        const rightWidth = targetRight - (rect.left + rect.width);

        // Top/bottom strips span the full target width so they also cover the
        // corners; left/right strips span only the chip's own height so they
        // never re-cover territory the top/bottom strips already own.
        if (topHeight > 0) {
          strips.push({ id: section.id, key: `${section.id}-top`, left: targetLeft, top: targetTop, width: MIN_TARGET, height: topHeight });
        }
        if (bottomHeight > 0) {
          strips.push({ id: section.id, key: `${section.id}-bottom`, left: targetLeft, top: rect.top + rect.height, width: MIN_TARGET, height: bottomHeight });
        }
        if (leftWidth > 0) {
          strips.push({ id: section.id, key: `${section.id}-left`, left: targetLeft, top: rect.top, width: leftWidth, height: rect.height });
        }
        if (rightWidth > 0) {
          strips.push({ id: section.id, key: `${section.id}-right`, left: rect.left + rect.width, top: rect.top, width: rightWidth, height: rect.height });
        }
        return strips;
      }),
    );
  }, [sections]);

  useLayoutEffect(() => {
    syncProxyTargets();

    const observer = new ResizeObserver(syncProxyTargets);
    if (tablistRef.current) observer.observe(tablistRef.current);
    Object.values(chipRefs.current).forEach((chip) => {
      if (chip) observer.observe(chip);
    });

    window.addEventListener("resize", syncProxyTargets);
    window.addEventListener("scroll", syncProxyTargets, true);
    // The strips are viewport-fixed copies of a `getBoundingClientRect()`
    // snapshot, so they desynchronise whenever the chip MOVES. ResizeObserver
    // only reports size, and a transform moves without resizing anything:
    // `dashboard-workspace-enter` (styles/dashboard/navigation.css) animates the
    // module workspace `translateY(6px) -> 0` over `--motion-base`, so on every
    // clinic module mount the whole band travels 6px upward while every
    // re-sync trigger above stays silent. A sync landing inside that window
    // froze the strips up to 6px BELOW the settled chip — the top strip then
    // covering the chip's own edge, which is the exact interception CMP-07
    // exists to forbid. Admin never showed it because mobile-admin.css kills
    // that animation for its surface. Capture phase, like `scroll` above, so a
    // stopped propagation cannot swallow the correction.
    window.addEventListener("animationend", syncProxyTargets, true);
    window.addEventListener("transitionend", syncProxyTargets, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncProxyTargets);
      window.removeEventListener("scroll", syncProxyTargets, true);
      window.removeEventListener("animationend", syncProxyTargets, true);
      window.removeEventListener("transitionend", syncProxyTargets, true);
    };
  }, [syncProxyTargets]);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const forward = event.key === "ArrowRight" || event.key === "ArrowDown";
    const backward = event.key === "ArrowLeft" || event.key === "ArrowUp";
    if (!forward && !backward) return;
    event.preventDefault();
    const last = sections.length - 1;
    const nextIndex = (index + (forward ? 1 : -1) + sections.length) % sections.length;
    const next = sections[nextIndex] ?? sections[last];
    onSelect(next.id);
    window.requestAnimationFrame(() => {
      document.getElementById(`${baseId}-chip-${next.id}`)?.focus();
    });
  }

  return (
    <>
      <div ref={tablistRef} role="tablist" aria-label={ariaLabel} className={CHIP_BAND_CLASS}>
        {sections.map((section, index) => {
          const isActive = section.id === activeId;
          return (
            <button
              key={section.id}
              ref={(element) => {
                chipRefs.current[section.id] = element;
              }}
              id={`${baseId}-chip-${section.id}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`${baseId}-panel-${section.id}`}
              tabIndex={isActive ? 0 : -1}
              {...{ [chipAttribute]: section.id }}
              data-module-card-chip={section.id}
              data-active={isActive ? "true" : undefined}
              onClick={() => onSelect(section.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={cn(
                CHIP_CLASS,
                isActive
                  ? "bg-vetneb-navy text-white shadow-sm"
                  : "bg-vetneb-surface-muted/60 text-muted-foreground hover:bg-vetneb-surface-muted",
              )}
            >
              {section.label}
            </button>
          );
        })}
      </div>
      {typeof document !== "undefined"
        ? createPortal(
            proxyStrips.map((strip) => (
              <button
                key={strip.key}
                type="button"
                tabIndex={-1}
                aria-hidden="true"
                data-module-card-chip-proxy={strip.id}
                onPointerDown={(event) => event.preventDefault()}
                onClick={(event) => {
                  const chip = chipRefs.current[strip.id];
                  chip?.focus({ preventScroll: true });
                  chip?.click();
                  event.currentTarget.blur();
                }}
                style={{
                  position: "fixed",
                  left: strip.left,
                  top: strip.top,
                  width: strip.width,
                  height: strip.height,
                  zIndex: 64,
                  opacity: 0,
                  border: 0,
                  padding: 0,
                }}
              />
            )),
            document.body,
          )
        : null}
    </>
  );
}

interface ModuleCardPanelProps {
  readonly id: string;
  readonly ariaLabel: string;
  readonly dataAttributes?: Readonly<Record<string, string | undefined>>;
  readonly children: ReactNode;
}

/** The panel: owns the remaining height at zero scroll. */
export function ModuleCardPanel({
  id,
  ariaLabel,
  dataAttributes,
  children,
}: ModuleCardPanelProps) {
  return (
    <div
      role="tabpanel"
      id={id}
      aria-label={ariaLabel}
      className={PANEL_CLASS}
      {...dataAttributes}
    >
      {children}
    </div>
  );
}

interface ModuleCardSectionsProps {
  readonly ariaLabel: string;
  readonly sections: readonly ModuleCardSection[];
  readonly className?: string;
  /** Additional structural hooks for a domain module root. */
  readonly cardDataAttributes?: Readonly<Record<string, string | undefined>>;
  /** Optional domain controls that belong above the canonical chip band. */
  readonly header?: ReactNode;
  /** Optional domain feedback/actions that belong below the canvas. */
  readonly footer?: ReactNode;
  /** Lets a domain surface coordinate chip state with its own controls. */
  readonly activeId?: string;
  readonly onActiveIdChange?: (id: string) => void;
  readonly cardAttribute: string;
  readonly cardAttributeValue: string;
  readonly chipAttribute: string;
  readonly panelAttribute: string;
}

/**
 * Card + chip band + panel, with only the active section mounted so fetch-backed
 * sections load lazily when their chip is selected. This is the whole "status /
 * config" archetype, and it is what both roles compose.
 */
export function ModuleCardSections({
  ariaLabel,
  sections,
  className,
  cardDataAttributes,
  header,
  footer,
  activeId: controlledActiveId,
  onActiveIdChange,
  cardAttribute,
  cardAttributeValue,
  chipAttribute,
  panelAttribute,
}: ModuleCardSectionsProps) {
  const baseId = useId();
  const fallbackId = sections[0]?.id ?? "";
  const [uncontrolledActiveId, setUncontrolledActiveId] = useState(fallbackId);
  const activeId = controlledActiveId ?? uncontrolledActiveId;

  useEffect(() => {
    if (!sections.some((section) => section.id === activeId)) {
      setUncontrolledActiveId(fallbackId);
    }
  }, [sections, activeId, fallbackId]);

  if (!sections.length) return null;

  const active = sections.find((section) => section.id === activeId) ?? sections[0];
  const selectActiveId = (id: string) => {
    if (controlledActiveId === undefined) {
      setUncontrolledActiveId(id);
    }
    onActiveIdChange?.(id);
  };

  return (
    <ModuleCard
      ariaLabel={ariaLabel}
      className={className}
      dataAttributes={{ ...cardDataAttributes, [cardAttribute]: cardAttributeValue }}
    >
      {header}
      <ModuleCardChips
        ariaLabel={ariaLabel}
        sections={sections}
        activeId={active.id}
        onSelect={selectActiveId}
        baseId={baseId}
        chipAttribute={chipAttribute}
      />
      <ModuleCardPanel
        id={`${baseId}-panel-${active.id}`}
        ariaLabel={active.label}
        dataAttributes={{ [panelAttribute]: active.id }}
      >
        {active.content}
      </ModuleCardPanel>
      {footer}
    </ModuleCard>
  );
}
