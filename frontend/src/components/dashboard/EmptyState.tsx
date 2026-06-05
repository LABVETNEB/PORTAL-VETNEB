import { Inbox, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: LucideIcon;
  eyebrow?: string;
  secondaryAction?: ReactNode;
  className?: string;
};

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
  eyebrow,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-[11rem] flex-col items-center justify-center rounded-lg border border-dashed border-vetneb-line bg-vetneb-surface-muted/60 px-6 py-8 text-center",
        className,
      )}
    >
      <div
        className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg border border-vetneb-teal/20 bg-vetneb-teal/10 text-vetneb-teal"
        aria-hidden="true"
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      {eyebrow ? (
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="text-base font-semibold text-vetneb-ink">{title}</h2>
      {description ? (
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
      {secondaryAction ? (
        <div className="mt-2 flex justify-center">{secondaryAction}</div>
      ) : null}
    </div>
  );
}
