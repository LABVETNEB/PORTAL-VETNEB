"use client";

import {
  useEffect,
  useId,
  useMemo,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

export type ModuleTab = {
  id: string;
  label: string;
  badge?: ReactNode;
  content: ReactNode;
};

type ModuleTabsProps = {
  tabs: ModuleTab[];
  defaultTabId?: string;
  /** Notifies the parent when the active tab changes (e.g. to sync URL state). */
  onTabChange?: (tabId: string) => void;
  className?: string;
  ariaLabel?: string;
};

/**
 * Height-aware segmented tabs for the App Shell. The tablist stays fixed and the
 * active panel fills the remaining height (`flex-1 min-h-0`) so multi-section
 * modules switch content inside the same viewport with zero scroll. Only the
 * active panel is mounted to keep module isolation predictable.
 */
export function ModuleTabs({
  tabs,
  defaultTabId,
  onTabChange,
  className,
  ariaLabel = "Secciones del módulo",
}: ModuleTabsProps) {
  const baseId = useId();
  const renderableTabs = useMemo(
    () => tabs.filter((tab) => tab.content !== null && tab.content !== false),
    [tabs],
  );
  const fallbackId = renderableTabs[0]?.id ?? "";
  const initialId =
    renderableTabs.find((tab) => tab.id === defaultTabId)?.id ?? fallbackId;
  const [activeId, setActiveId] = useState(initialId);

  useEffect(() => {
    if (!renderableTabs.some((tab) => tab.id === activeId)) {
      setActiveId(initialId);
    }
  }, [renderableTabs, activeId, initialId]);

  if (!renderableTabs.length) return null;

  const activeTab =
    renderableTabs.find((tab) => tab.id === activeId) ?? renderableTabs[0];

  function selectTab(id: string) {
    setActiveId(id);
    onTabChange?.(id);
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    const forward = event.key === "ArrowRight" || event.key === "ArrowDown";
    const backward = event.key === "ArrowLeft" || event.key === "ArrowUp";
    const home = event.key === "Home";
    const end = event.key === "End";
    if (!forward && !backward && !home && !end) return;

    event.preventDefault();
    const last = renderableTabs.length - 1;
    const nextIndex = home
      ? 0
      : end
        ? last
        : (index + (forward ? 1 : -1) + renderableTabs.length) %
          renderableTabs.length;
    const next = renderableTabs[nextIndex];
    selectTab(next.id);
    window.requestAnimationFrame(() => {
      document.getElementById(`${baseId}-tab-${next.id}`)?.focus();
    });
  }

  return (
    <div className={cn("dashboard-module-tabs", className)} data-module-tabs="true">
      <div role="tablist" aria-label={ariaLabel} className="dashboard-module-tablist">
        {renderableTabs.map((tab, index) => {
          const isActive = tab.id === activeTab.id;
          return (
            <button
              key={tab.id}
              id={`${baseId}-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              data-module-tab={tab.id}
              onClick={() => selectTab(tab.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className="dashboard-module-tab dashboard-btn-interactive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2"
            >
              <span>{tab.label}</span>
              {tab.badge != null ? (
                <span className="shrink-0">{tab.badge}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div
        id={`${baseId}-panel-${activeTab.id}`}
        role="tabpanel"
        aria-label={activeTab.label}
        data-module-tabpanel={activeTab.id}
        className="dashboard-module-tabpanel focus-visible:outline-none"
      >
        {activeTab.content}
      </div>
    </div>
  );
}
