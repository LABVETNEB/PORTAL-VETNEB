import type { ReactNode } from "react";

export type DetailsHeaderProps = {
  title: string;
  context?: string;
  identifier?: string;
  status?: ReactNode;
  headingLevel?: 2 | 3 | 4;
  titleId?: string;
};

export function DetailsHeader({ title, context, identifier, status, headingLevel = 2, titleId }: DetailsHeaderProps) {
  const Heading = `h${headingLevel}` as const;
  return (
    <header data-details-header="true" className="flex min-w-0 items-start justify-between gap-3 border-b border-vetneb-line/70 pb-3">
      <div className="min-w-0">
        {context ? (
          <p data-details-header-context="true" className="dashboard-detail-value text-[11px] font-medium leading-4 text-muted-foreground">{context}</p>
        ) : null}
        <Heading id={titleId} className="dashboard-detail-value text-base font-semibold leading-6 text-vetneb-ink">{title}</Heading>
        {identifier ? (
          <p data-details-header-identifier="true" className="dashboard-detail-value font-mono text-xs leading-4 text-muted-foreground">{identifier}</p>
        ) : null}
      </div>
      {status ? <div data-details-header-status="true" className="shrink-0">{status}</div> : null}
    </header>
  );
}
