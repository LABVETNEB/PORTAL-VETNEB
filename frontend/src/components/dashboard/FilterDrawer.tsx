"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  const activeCountLabel =
    activeCount === 0
      ? "Sin filtros activos"
      : activeCount === 1
        ? "1 filtro activo"
        : `${activeCount} filtros activos`;

  useEffect(() => {
    if (!open) {
      return;
    }

    panelRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
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
        <div className="fixed inset-0 z-[70]" data-filter-drawer-open="true">
          <div
            className="absolute inset-0 bg-vetneb-ink/30 backdrop-blur-[2px]"
            aria-hidden="true"
          />
          <div
            id={panelId}
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            tabIndex={-1}
            className="absolute right-0 top-0 flex h-dvh w-full max-w-md flex-col overflow-hidden border-l border-vetneb-line/80 bg-card shadow-lg"
          >
            <div className="flex items-start justify-between gap-4 border-b border-vetneb-line/80 px-4 py-4">
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
                onClick={() => setOpen(false)}
                className="shrink-0 focus-visible:ring-2 focus-visible:ring-ring/85"
              >
                <X className="h-4 w-4" aria-hidden="true" />
                <span>Cerrar</span>
              </Button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              {children}
            </div>

            {footer ? (
              <div className="border-t border-vetneb-line/80 px-4 py-4">
                {footer}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
