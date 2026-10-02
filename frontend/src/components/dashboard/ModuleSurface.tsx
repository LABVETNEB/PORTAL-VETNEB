"use client";

import { Children, useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { WorkspaceHeader } from "./WorkspaceHeader";

export type ModuleSurfaceProps = {
  /** Optional fixed toolbar row (filters, search, primary actions). */
  toolbar?: ReactNode;
  /** Growing body region — fills remaining viewport height without scroll. */
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  ariaLabel?: string;
};

/**
 * Standard single-viewport module frame for the App Shell.
 *
 * Establishes the bottom of the height chain: a flex column with `min-h-0` so
 * its body (`dashboard-module-body`) fills the available space and bounded
 * content (tables/lists via pagination, sections via tabs) fits one desktop
 * viewport without operational scroll.
 */
export function ModuleSurface({
  toolbar,
  children,
  className,
  bodyClassName,
  ariaLabel,
}: ModuleSurfaceProps) {
  return <WorkspaceScaffold kind="surface" toolbar={toolbar} collection={children} className={className} bodyClassName={bodyClassName} ariaLabel={ariaLabel} />;
}
type Regions = {
  toolbar?: ReactNode;
  filters?: ReactNode;
  collection?: ReactNode;
  details?: ReactNode;
  footer?: ReactNode;
};

export type UtilitySidePanelProps = {
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  children: ReactNode;
  label?: string;
};

export function UtilitySidePanel({ expanded, onExpandedChange, children, label = "Panel utilitario" }: UtilitySidePanelProps) {
  const contentId = useId();
  return (
    <aside className="dashboard-utility-side-panel" data-expanded={expanded} aria-label={label}>
      <button
        type="button"
        className="dashboard-utility-side-panel-toggle"
        aria-label={expanded ? "Contraer panel utilitario" : "Expandir panel utilitario"}
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={() => onExpandedChange(!expanded)}
      >
        {expanded ? "›" : "‹"}
      </button>
      <div id={contentId} className="dashboard-utility-side-panel-content" hidden={!expanded}>
        {children}
      </div>
    </aside>
  );
}

export type WorkspaceScaffoldProps =
  | (Regions & { kind: "module"; moduleId: string; title: string; titleId: string; description?: string; descriptionId?: string; leadingAction?: ReactNode })
  | { kind: "page-header"; title: string; description?: string; badge?: ReactNode; actions?: ReactNode; className?: string }
  | (Regions & { kind: "surface"; className?: string; bodyClassName?: string; ariaLabel?: string })
  | { kind: "mobile"; moduleId: string; children: ReactNode }
  | (Regions & { kind: "full-route"; moduleId: string });

function WorkspaceRegions({ toolbar, filters, collection, details, footer }: Regions) {
  return <>{toolbar}{filters}{collection}{details}{footer}</>;
}

function renderRegions(regions: Regions) {
  if (regions.toolbar || regions.filters || regions.details || regions.footer) {
    return <WorkspaceRegions {...regions} />;
  }
  return Children.toArray(regions.collection);
}

/** B15 composition owner. It preserves the existing DOM nodes and CSS geometry. */
export function WorkspaceScaffold(props: WorkspaceScaffoldProps) {
  const [panelExpanded, setPanelExpanded] = useState(false);
  if (props.kind === "module") {
    return (
      <section className="flex min-h-0 flex-1 flex-col dashboard-workspace-enter" data-dashboard-module-workspace={props.moduleId} data-workspace-scaffold="true" aria-labelledby={props.titleId} aria-describedby={props.description ? props.descriptionId : undefined}>
        <WorkspaceHeader title={props.title} titleId={props.titleId} description={props.description} descriptionId={props.descriptionId} leadingAction={props.leadingAction} />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col pt-4" data-dashboard-module-viewport={props.moduleId}>
          {props.details ? (
            <div className="dashboard-workspace-with-panel">
              <div className="dashboard-workspace-primary">{props.toolbar}{props.filters}{props.collection}</div>
              <UtilitySidePanel expanded={panelExpanded} onExpandedChange={setPanelExpanded}>{props.details}</UtilitySidePanel>
            </div>
          ) : renderRegions(props)}
          {props.details ? props.footer : null}
        </div>
      </section>
    );
  }
  if (props.kind === "page-header") {
    return (
      <div className={cn("flex flex-col gap-3 border-b border-vetneb-line/70 pb-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:pb-5", props.className)}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-vetneb-ink">{props.title}</h1>
            {props.badge ? <div className="shrink-0">{props.badge}</div> : null}
          </div>
          {props.description ? <p className="mt-1 hidden max-w-3xl text-sm text-muted-foreground sm:block">{props.description}</p> : null}
        </div>
        {props.actions ? <div className="flex flex-wrap items-center gap-2 sm:justify-end">{props.actions}</div> : null}
      </div>
    );
  }
  if (props.kind === "surface") {
    return (
      <div className={cn("dashboard-module-surface", props.className)} data-dashboard-module-surface="true" aria-label={props.ariaLabel}>
        {props.toolbar ? <div className="dashboard-module-toolbar" data-module-toolbar="true">{props.toolbar}</div> : null}
        <div className={cn("dashboard-module-body", props.bodyClassName)}>
          {props.details ? (
            <div className="dashboard-workspace-with-panel">
              <div className="dashboard-workspace-primary">{props.filters}{props.collection}</div>
              <UtilitySidePanel expanded={panelExpanded} onExpandedChange={setPanelExpanded}>{props.details}</UtilitySidePanel>
            </div>
          ) : renderRegions({ filters: props.filters, collection: props.collection, details: props.details, footer: props.footer })}
          {props.details ? props.footer : null}
        </div>
      </div>
    );
  }
  if (props.kind === "mobile") {
    return <section data-clinic-mobile-module={props.moduleId} className="clinic-mobile-module-frame">{props.children}</section>;
  }
  return (
    <section data-dashboard-module-workspace={props.moduleId} data-workspace-scaffold="true" className="flex min-h-0 flex-1 flex-col">
      <div data-dashboard-module-viewport={props.moduleId} className="flex min-h-0 min-w-0 flex-1 flex-col">
        {props.details ? (
          <div className="dashboard-workspace-with-panel">
            <div className="dashboard-workspace-primary">{props.toolbar}{props.filters}{props.collection}</div>
            <UtilitySidePanel expanded={panelExpanded} onExpandedChange={setPanelExpanded}>{props.details}</UtilitySidePanel>
          </div>
        ) : renderRegions(props)}
        {props.details ? props.footer : null}
      </div>
    </section>
  );
}
