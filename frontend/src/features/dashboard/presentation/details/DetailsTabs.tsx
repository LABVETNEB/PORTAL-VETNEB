"use client";

import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";

export type DetailsTab = {
  id: string;
  label: string;
  content: ReactNode;
  disabled?: boolean;
};

export type DetailsTabsProps = {
  label: string;
  tabs: readonly DetailsTab[];
  activeId: string;
  onActiveIdChange: (id: string) => void;
};

const NAVIGATION_KEYS = ["ArrowRight", "ArrowLeft", "Home", "End"];

// C13: controlled WAI-ARIA tabs with automatic activation. The consumer owns the active id; an
// unknown or disabled id renders the first enabled tab without writing back to the consumer.
export function DetailsTabs({ label, tabs, activeId, onActiveIdChange }: DetailsTabsProps) {
  const baseId = useId();
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  const enabled = tabs.filter((tab) => !tab.disabled);
  const currentId = enabled.find((tab) => tab.id === activeId)?.id ?? enabled[0]?.id;
  if (!tabs.length) return null;

  const tabId = (id: string) => `${baseId}-tab-${id}`;
  const panelId = (id: string) => `${baseId}-panel-${id}`;

  function activate(id: string) {
    if (id !== currentId) onActiveIdChange(id);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, id: string) {
    if (!NAVIGATION_KEYS.includes(event.key) || !enabled.length) return;
    event.preventDefault();
    const index = enabled.findIndex((tab) => tab.id === id);
    const last = enabled.length - 1;
    const nextIndex =
      event.key === "Home" ? 0 : event.key === "End" ? last : event.key === "ArrowRight" ? (index + 1) % enabled.length : (index - 1 + enabled.length) % enabled.length;
    const next = enabled[nextIndex];
    tabRefs.current.get(next.id)?.focus();
    activate(next.id);
  }

  return (
    <div data-details-tabs="true" className="flex min-w-0 flex-col gap-3">
      <div role="tablist" aria-label={label} className="dashboard-module-tablist">
        {tabs.map((tab) => {
          const selected = !tab.disabled && tab.id === currentId;
          return (
            <button
              key={tab.id}
              ref={(node) => {
                if (node) tabRefs.current.set(tab.id, node);
                else tabRefs.current.delete(tab.id);
              }}
              id={tabId(tab.id)}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={panelId(tab.id)}
              tabIndex={selected ? 0 : -1}
              disabled={tab.disabled}
              data-details-tab={tab.id}
              onClick={() => activate(tab.id)}
              onKeyDown={(event) => handleKeyDown(event, tab.id)}
              className="dashboard-module-tab dashboard-btn-interactive min-w-0 max-w-full whitespace-normal [overflow-wrap:anywhere] focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-55"
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          id={panelId(tab.id)}
          role="tabpanel"
          aria-labelledby={tabId(tab.id)}
          tabIndex={0}
          hidden={tab.id !== currentId}
          data-details-tabpanel={tab.id}
          className="min-w-0 rounded-md focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
