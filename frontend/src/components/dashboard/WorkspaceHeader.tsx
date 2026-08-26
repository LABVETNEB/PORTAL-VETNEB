import type { ReactNode } from "react";

export type WorkspaceHeaderProps = {
  title: string;
  titleId: string;
  description?: string;
  descriptionId?: string;
  leadingAction?: ReactNode;
  actions?: ReactNode;
};

/** Canonical 40px owner for an in-shell workspace title and its actions. */
export function WorkspaceHeader({
  title,
  titleId,
  description,
  descriptionId,
  leadingAction,
  actions,
}: WorkspaceHeaderProps) {
  return (
    <header
      className="dashboard-workspace-header flex shrink-0 items-center justify-between gap-3"
      data-workspace-header="true"
    >
      <div className="flex min-w-0 items-center gap-3">
        {leadingAction}
        <div className="min-w-0">
          <h2 id={titleId} className="dashboard-workspace-header-title truncate">
            {title}
          </h2>
          {description && descriptionId ? (
            <p
              id={descriptionId}
              className="sr-only"
              data-workspace-header-description="true"
            >
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
