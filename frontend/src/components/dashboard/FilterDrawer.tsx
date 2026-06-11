"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export type FilterDrawerProps = {
  title: string;
  description?: string;
  triggerLabel?: string;
  activeCount?: number;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export function FilterDrawer({
  title,
  description,
  triggerLabel = "Filtros",
  activeCount = 0,
  children,
  footer,
  className,
}: FilterDrawerProps) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const descriptionId = useId();
  const panelId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const activeCountLabel =
    activeCount === 0
      ? "Sin filtros activos"
      : activeCount === 1
        ? "1 filtro activo"
        : `${activeCount} filtros activos`;

  function closePanel() {
    setOpen(false);
    window.requestAnimationFrame(() => {
      triggerRef.current?.focus();
    });
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    panelRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePanel();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const panel = panelRef.current;
      if (!panel) return;

      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className={cn("min-w-0", className)}>
      <Button
        ref={triggerRef}
        type="button"
        variant="outline"
        size="sm"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`${triggerLabel}. ${activeCountLabel}`}
        onClick={() => setOpen(true)}
        className="w-full focus-visible:ring-2 focus-visible:ring-ring/85 sm:w-auto"
      >
        <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
        <span>{triggerLabel}</span>
        {activeCount > 0 ? (
          <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-md border border-vetneb-teal/30 bg-vetneb-teal/12 px-1.5 text-xs font-semibold text-vetneb-teal">
            {activeCount}
          </span>
        ) : null}
        <span className="sr-only">{activeCountLabel}</span>
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-[70] overflow-hidden"
          data-filter-drawer-open="true"
        >
          <div
            className="absolute inset-0 bg-vetneb-ink/30 backdrop-blur-[2px]"
            aria-hidden="true"
            data-filter-backdrop="true"
            onClick={closePanel}
          />
          <div
            id={panelId}
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            tabIndex={-1}
            className="absolute inset-y-0 right-0 flex h-dvh w-full max-w-md max-h-dvh flex-col overflow-hidden border-l border-vetneb-line/80 bg-card pb-[env(safe-area-inset-bottom)] dashboard-filter-panel dashboard-focus-trap-container"
          >
            <div className="shrink-0 flex items-start justify-between gap-4 border-b border-vetneb-line/80 px-4 py-4">
              <div className="min-w-0">
                <h2 id={titleId} className="text-base font-semibold text-vetneb-ink">
                  {title}
                </h2>
                {description ? (
                  <p id={descriptionId} className="mt-1 text-sm text-muted-foreground">
                    {description}
                  </p>
                ) : null}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Cerrar panel de filtros"
                onClick={closePanel}
                className="shrink-0 focus-visible:ring-2 focus-visible:ring-ring/85"
              >
                <X className="h-4 w-4" aria-hidden="true" />
                <span>Cerrar</span>
              </Button>
            </div>

            <div className="min-h-0 flex-1 overscroll-contain overflow-y-auto px-4 py-4">
              {children}
            </div>

            {footer ? (
              <div className="shrink-0 border-t border-vetneb-line/80 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4">
                {footer}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
