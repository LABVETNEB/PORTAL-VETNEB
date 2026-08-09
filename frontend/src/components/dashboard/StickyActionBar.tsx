"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Height ledger contribution of this bar, consumed by the dashboard substrate
 * (`styles/dashboard/zero-scroll.css`). Below `md` the bar is a fixed overlay
 * and therefore leaves the flow: whatever sits at the bottom of the surface —
 * on the logistics hub, the second list's pager — would render underneath it
 * and stop receiving pointer events. The reserve is the bar's OWN measured
 * height, so it stays correct when the action count, the label wrapping or the
 * safe-area inset change. From `md` up the bar is sticky, already occupies
 * flow, and contributes zero.
 *
 * Both out-of-flow positions count: the clinic mobile shell re-anchors the bar
 * to `absolute` so it clears the role bottom nav (see zero-scroll.css).
 */
const STICKY_ACTION_HEIGHT_VAR = "--dash-sticky-action-h";

export type StickyActionBarAction = {
  label: string;
  href?: string;
  onClick?: () => void;
  variant?: ButtonProps["variant"];
  disabled?: boolean;
  icon?: ReactNode;
  "aria-label"?: string;
};

export type StickyActionBarProps = {
  context?: string;
  actions: StickyActionBarAction[];
  children?: ReactNode;
  visible?: boolean;
  className?: string;
};

export function StickyActionBar({
  context,
  actions,
  children,
  visible = true,
  className,
}: StickyActionBarProps) {
  const barRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const node = barRef.current;

    if (!node) {
      root.style.removeProperty(STICKY_ACTION_HEIGHT_VAR);
      return;
    }

    const publish = () => {
      const position = window.getComputedStyle(node).position;
      const isOverlay = position === "fixed" || position === "absolute";
      root.style.setProperty(
        STICKY_ACTION_HEIGHT_VAR,
        isOverlay ? `${node.getBoundingClientRect().height}px` : "0px",
      );
    };

    publish();

    // The bar re-measures on its own resize (action wrap, safe area) and on
    // viewport changes, which is also what flips it between fixed and sticky.
    const observer = new ResizeObserver(publish);
    observer.observe(node);
    window.addEventListener("resize", publish);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", publish);
      root.style.removeProperty(STICKY_ACTION_HEIGHT_VAR);
    };
  }, [visible]);

  if (visible === false) {
    return null;
  }

  const navigateToHref = (href: string) => {
    window.location.assign(href);
  };

  return (
    <section
      ref={barRef}
      aria-label={context ? `${context} del dashboard` : "Acciones del dashboard"}
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-50 border-t border-vetneb-line/80 bg-card/95 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-md backdrop-blur md:pointer-events-auto md:sticky md:top-[4.75rem] md:bottom-auto md:rounded-lg md:border md:px-4 md:py-3 md:shadow-sm",
        className,
      )}
      data-sticky-action-bar="true"
    >
      <div className="pointer-events-auto mx-auto flex max-w-6xl min-w-0 flex-col gap-2 md:flex-row md:items-center md:justify-between">
        {context ? (
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            {context}
          </p>
        ) : null}
        <div
          role="group"
          aria-label={context ? `Acciones: ${context}` : "Acciones rápidas"}
          className="grid min-w-0 grid-flow-col auto-cols-fr gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end"
        >
          {children ? (
            <div
              role="group"
              aria-label="Acciones contextuales"
              className="col-span-full flex min-w-0 justify-start sm:justify-end"
            >
              {children}
            </div>
          ) : null}
          {actions.map((action, index) => {
            const ariaLabel = action["aria-label"] ?? action.label;
            const content = (
              <>
                {action.icon ? (
                  <span className="shrink-0" aria-hidden="true">
                    {action.icon}
                  </span>
                ) : null}
                <span>{action.label}</span>
              </>
            );

            return (
              <Button
                key={`${action.label}-${index}`}
                type="button"
                variant={action.variant ?? "outline"}
                size="sm"
                disabled={action.disabled}
                onClick={() => {
                  action.onClick?.();

                  if (action.href) {
                    navigateToHref(action.href);
                  }
                }}
                aria-label={ariaLabel}
                className="min-h-10 w-full whitespace-normal dashboard-btn-interactive focus-visible:ring-2 focus-visible:ring-ring/85 sm:w-auto sm:whitespace-nowrap"
              >
                {content}
              </Button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
