"use client";

import type { ReactNode } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
        "fixed inset-x-0 bottom-0 z-50 border-t border-vetneb-line/80 bg-card/95 px-3 py-3 shadow-md backdrop-blur md:sticky md:top-[4.75rem] md:bottom-auto md:rounded-lg md:border md:px-4 md:shadow-sm",
        className,
      )}
      data-sticky-action-bar="true"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-2 md:flex-row md:items-center md:justify-between">
        {context ? (
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            {context}
          </p>
        ) : null}
        <div
          role="group"
          aria-label={context ? `Acciones: ${context}` : "Acciones rápidas"}
          className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end"
        >
          {children ? (
            <div
              role="group"
              aria-label="Acciones contextuales"
              className="col-span-2 flex justify-start sm:justify-end"
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
                className="w-full focus-visible:ring-2 focus-visible:ring-ring/85 sm:w-auto"
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
