"use client";

import {
  useEffect,
  useId,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

export type AdminMobileStatusSection = {
  id: string;
  label: string;
  content: ReactNode;
};

type AdminMobileStatusModuleProps = {
  /** Module key exposed as `data-admin-mobile-status-module`. */
  moduleKey: string;
  ariaLabel: string;
  sections: AdminMobileStatusSection[];
};

/**
 * Mobile-only ("md:hidden") shell for Admin status modules (Administración /
 * Estado del sistema). The desktop ModuleTabs/grids collapse to one column on
 * mobile and overflow under the bottom nav; this primitive splits the same
 * content into compact chip sections so each fits the no-scroll content band.
 *
 * Only the active section is mounted, so fetch-backed sections (failed-login,
 * schema) load lazily when the chip is selected. The chip row is fixed and the
 * panel fills the remaining height (`flex-1 min-h-0`) with zero scroll.
 */
export function AdminMobileStatusModule({
  moduleKey,
  ariaLabel,
  sections,
}: AdminMobileStatusModuleProps) {
  const baseId = useId();
  const fallbackId = sections[0]?.id ?? "";
  const [activeId, setActiveId] = useState(fallbackId);

  useEffect(() => {
    if (!sections.some((section) => section.id === activeId)) {
      setActiveId(fallbackId);
    }
  }, [sections, activeId, fallbackId]);

  if (!sections.length) return null;

  const active = sections.find((section) => section.id === activeId) ?? sections[0];

  function handleKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    const forward = event.key === "ArrowRight" || event.key === "ArrowDown";
    const backward = event.key === "ArrowLeft" || event.key === "ArrowUp";
    if (!forward && !backward) return;
    event.preventDefault();
    const last = sections.length - 1;
    const nextIndex = (index + (forward ? 1 : -1) + sections.length) % sections.length;
    const next = sections[nextIndex] ?? sections[last];
    setActiveId(next.id);
    window.requestAnimationFrame(() => {
      document.getElementById(`${baseId}-chip-${next.id}`)?.focus();
    });
  }

  return (
    <section
      data-admin-mobile-status-module={moduleKey}
      aria-label={ariaLabel}
      className="dashboard-surface flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-vetneb-line/80 bg-card md:hidden"
    >
      <div
        role="tablist"
        aria-label={ariaLabel}
        className="flex shrink-0 items-center gap-1 overflow-hidden border-b border-vetneb-line/70 p-1.5"
      >
        {sections.map((section, index) => {
          const isActive = section.id === active.id;
          return (
            <button
              key={section.id}
              id={`${baseId}-chip-${section.id}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`${baseId}-panel-${section.id}`}
              tabIndex={isActive ? 0 : -1}
              data-admin-mobile-status-chip={section.id}
              data-active={isActive ? "true" : undefined}
              onClick={() => setActiveId(section.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={cn(
                "min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-[0.72rem] font-semibold leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-1",
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

      <div
        role="tabpanel"
        id={`${baseId}-panel-${active.id}`}
        aria-label={active.label}
        data-admin-mobile-status-panel={active.id}
        className="flex min-h-0 flex-1 flex-col overflow-hidden p-2"
      >
        {active.content}
      </div>
    </section>
  );
}
