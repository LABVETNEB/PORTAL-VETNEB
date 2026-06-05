"use client";

import {
  useEffect,
  useId,
  useMemo,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

export type AdminSectionTab = {
  id: string;
  label: string;
  description?: string;
  badge?: ReactNode;
  content: ReactNode;
  anchorIds?: string[];
};

type AdminSectionTabsProps = {
  tabs: AdminSectionTab[];
  defaultTabId?: string;
  className?: string;
};

function isRenderableContent(content: ReactNode) {
  return content !== null && content !== undefined && content !== false;
}

export function AdminSectionTabs({
  tabs,
  defaultTabId,
  className,
}: AdminSectionTabsProps) {
  const baseId = useId();
  const availableTabs = useMemo(
    () => tabs.filter((tab) => isRenderableContent(tab.content)),
    [tabs],
  );
  const fallbackTabId = availableTabs[0]?.id ?? "";
  const initialTabId =
    availableTabs.find((tab) => tab.id === defaultTabId)?.id ?? fallbackTabId;
  const [activeTabId, setActiveTabId] = useState(initialTabId);

  useEffect(() => {
    if (availableTabs.some((tab) => tab.id === activeTabId)) {
      return;
    }

    setActiveTabId(initialTabId);
  }, [activeTabId, availableTabs, initialTabId]);

  useEffect(() => {
    const selectTabFromHash = () => {
      const anchorId = decodeURIComponent(window.location.hash.slice(1));

      if (!anchorId) {
        return;
      }

      const matchingTab = availableTabs.find((tab) =>
        tab.anchorIds?.includes(anchorId),
      );

      if (!matchingTab) {
        return;
      }

      setActiveTabId(matchingTab.id);
      window.setTimeout(() => {
        document.getElementById(anchorId)?.scrollIntoView({ block: "start" });
      }, 0);
    };

    selectTabFromHash();
    window.addEventListener("hashchange", selectTabFromHash);

    return () => {
      window.removeEventListener("hashchange", selectTabFromHash);
    };
  }, [availableTabs]);

  if (!availableTabs.length) {
    return null;
  }

  const activeTab = availableTabs.find((tab) => tab.id === activeTabId);

  const handleTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    tabIndex: number,
  ) => {
    const isForwardKey = event.key === "ArrowRight" || event.key === "ArrowDown";
    const isBackwardKey = event.key === "ArrowLeft" || event.key === "ArrowUp";

    if (!isForwardKey && !isBackwardKey) {
      return;
    }

    event.preventDefault();
    const direction = isForwardKey ? 1 : -1;
    const nextTabIndex =
      (tabIndex + direction + availableTabs.length) % availableTabs.length;
    const nextTab = availableTabs[nextTabIndex];

    setActiveTabId(nextTab.id);
    window.requestAnimationFrame(() => {
      document.getElementById(`${baseId}-tab-${nextTab.id}`)?.focus();
    });
  };

  return (
    <section
      className={["space-y-4", className].filter(Boolean).join(" ")}
      aria-label="Secciones administrativas"
    >
      <div
        role="tablist"
        aria-label="Secciones de administración"
        className="flex max-w-full gap-1 overflow-x-auto rounded-md border border-vetneb-line/80 bg-card/80 p-1"
      >
        {availableTabs.map((tab, index) => {
          const isActive = tab.id === activeTabId;

          return (
            <button
              key={tab.id}
              id={`${baseId}-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveTabId(tab.id)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              className={[
                "inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2",
                isActive
                  ? "bg-vetneb-navy text-primary-foreground"
                  : "text-foreground/78 hover:bg-accent/70 hover:text-accent-foreground",
              ].join(" ")}
            >
              <span>{tab.label}</span>
              {tab.badge ? <span className="shrink-0">{tab.badge}</span> : null}
            </button>
          );
        })}
      </div>

      {activeTab?.description ? (
        <p className="text-sm text-muted-foreground">{activeTab.description}</p>
      ) : null}

      {availableTabs.map((tab) => (
        <div
          key={tab.id}
          id={`${baseId}-panel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${tab.id}`}
          tabIndex={0}
          hidden={tab.id !== activeTabId}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2"
        >
          {tab.content}
        </div>
      ))}
    </section>
  );
}
