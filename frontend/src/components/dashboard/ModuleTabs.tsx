"use client";

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
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
  /**
   * Opt-in action region painted at the end of the tab bar. A tab panel can
   * also hand its own actions to it through {@link ModuleTabsActions}. Omitted,
   * the tablist renders exactly as before.
   */
  actions?: ReactNode;
  withActionsSlot?: boolean;
};

const ModuleTabsActionsSlotContext = createContext<HTMLElement | null>(null);

/**
 * Renders its children in the tab bar of the nearest {@link ModuleTabs} that
 * opted into an action region; renders nothing anywhere else.
 */
export function ModuleTabsActions({ children }: { children: ReactNode }) {
  const slot = useContext(ModuleTabsActionsSlotContext);
  return slot ? createPortal(children, slot) : null;
}

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
  actions,
  withActionsSlot = false,
}: ModuleTabsProps) {
  const baseId = useId();
  const [actionsSlot, setActionsSlot] = useState<HTMLElement | null>(null);
  const hasActionRegion = withActionsSlot || actions != null;
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

  const tablist = (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn("dashboard-module-tablist", hasActionRegion && "min-w-0 flex-1")}
    >
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
  );

  return (
    <div className={cn("dashboard-module-tabs", className)} data-module-tabs="true">
      {hasActionRegion ? (
        <div className="flex min-w-0 shrink-0 items-center gap-2" data-module-tabs-bar="true">
          {tablist}
          <div
            ref={setActionsSlot}
            className="flex shrink-0 items-center gap-2 empty:hidden"
            data-module-tabs-actions="true"
          >
            {actions}
          </div>
        </div>
      ) : (
        tablist
      )}

      <div
        id={`${baseId}-panel-${activeTab.id}`}
        role="tabpanel"
        aria-label={activeTab.label}
        data-module-tabpanel={activeTab.id}
        className="dashboard-module-tabpanel focus-visible:outline-none"
      >
        <ModuleTabsActionsSlotContext.Provider value={actionsSlot}>
          {activeTab.content}
        </ModuleTabsActionsSlotContext.Provider>
      </div>
    </div>
  );
}
