"use client";

import type { ReactNode } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Height ledger contribution of this bar, consumed by the dashboard substrate
 * (`styles/dashboard/zero-scroll.css`). Below `md` the bar leaves normal flow,
 * so its route declares this stable reserve before the first layout. Publishing
 * an intrinsic measurement after mount made the rows canvas lose half the bar
 * height during pagination (two stacked tracks), which is the A05 feedback
 * loop. Safe-area remains part of the declarative reservation.
 */
export const STICKY_ACTION_RESERVED_BLOCK_SIZE =
  "calc(5.5625rem + env(safe-area-inset-bottom, 0px))";

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
  if (visible === false) {
    return null;
  }

  const navigateToHref = (href: string) => {
    window.location.assign(href);
  };

  return (
    <section
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
