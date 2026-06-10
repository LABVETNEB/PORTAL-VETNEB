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
  size?: "sm" | "md";
  className?: string;
};

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
  eyebrow,
  secondaryAction,
  size = "md",
  className,
}: EmptyStateProps) {
  const isSm = size === "sm";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-vetneb-line bg-vetneb-surface-muted/60 text-center",
        isSm ? "min-h-[8rem] px-4 py-5" : "min-h-[11rem] px-6 py-8",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-lg border border-vetneb-teal/20 bg-vetneb-teal/10 text-vetneb-teal",
          isSm ? "mb-2 h-9 w-9" : "mb-3 h-11 w-11",
        )}
        aria-hidden="true"
      >
        <Icon className={isSm ? "h-4 w-4" : "h-5 w-5"} aria-hidden="true" />
      </div>
      {eyebrow ? (
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {eyebrow}
        </p>
      ) : null}
      <h2 className={cn(isSm ? "text-sm" : "text-base", "font-semibold text-vetneb-ink")}>
        {title}
      </h2>
      {description ? (
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
      {secondaryAction ? (
        <div className="mt-2 flex justify-center">{secondaryAction}</div>
      ) : null}
    </div>
  );
}
