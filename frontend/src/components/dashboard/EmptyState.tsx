import {
  AlertCircle,
  AlertTriangle,
  Inbox,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type CollectionStateEmptyProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: LucideIcon;
  eyebrow?: string;
  secondaryAction?: ReactNode;
  size?: "sm" | "md";
  className?: string;
};

export type CollectionStateErrorProps = {
  title?: string;
  message: string;
  onRetry?: () => void;
  supportText?: string;
  tone?: "warning" | "critical";
  className?: string;
};

export type CollectionStateSkeleton = "table" | "cards" | "detail" | "timeline" | "list";

export type CollectionStateLoadingProps = {
  skeleton?: CollectionStateSkeleton;
  rows?: number;
  label?: string;
  compact?: boolean;
  className?: string;
};

export type CollectionStateProps =
  | ({ variant: "empty" } & CollectionStateEmptyProps)
  | ({ variant: "error" } & CollectionStateErrorProps)
  | ({ variant: "loading" } & CollectionStateLoadingProps);

// C03: single runtime owner of the collection empty/error/loading grammar.
export function CollectionState(props: CollectionStateProps) {
  switch (props.variant) {
    case "empty":
      return renderEmptyState(props);
    case "error":
      return renderErrorState(props);
    case "loading":
      return renderLoadingState(props);
  }
}

function renderEmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
  eyebrow,
  secondaryAction,
  size = "md",
  className,
}: CollectionStateEmptyProps) {
  const isSm = size === "sm";

  return (
    <div
      data-collection-state="empty"
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

function renderErrorState({
  title = "No se pudo completar la acción",
  message,
  onRetry,
  supportText,
  tone = "critical",
  className,
}: CollectionStateErrorProps) {
  const isWarning = tone === "warning";
  const Icon = isWarning ? AlertTriangle : AlertCircle;

  return (
    <div
      role="alert"
      data-collection-state="error"
      className={cn(
        "flex flex-col gap-3 rounded-lg border px-4 py-4 sm:flex-row sm:items-start sm:justify-between",
        isWarning
          ? "border-amber-500/25 bg-amber-500/8 text-amber-700"
          : "border-destructive/25 bg-destructive/8 text-destructive",
        className,
      )}
    >
      <div className="flex gap-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div>
          {title ? <h2 className="text-sm font-semibold">{title}</h2> : null}
          <p
            className={cn(
              "text-sm",
              isWarning ? "text-amber-700/88" : "text-destructive/88",
            )}
          >
            {message}
          </p>
          {supportText ? (
            <p
              className={cn(
                "mt-1 text-xs",
                isWarning ? "text-amber-600/75" : "text-destructive/65",
              )}
            >
              {supportText}
            </p>
          ) : null}
        </div>
      </div>
      {onRetry ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRetry}
          className={cn(
            "shrink-0 focus-visible:ring-2",
            isWarning
              ? "border-amber-500/30 text-amber-700 hover:border-amber-500/45 hover:bg-amber-500/10 hover:text-amber-700"
              : "border-destructive/30 text-destructive hover:border-destructive/45 hover:bg-destructive/10 hover:text-destructive",
          )}
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Reintentar
        </Button>
      ) : null}
    </div>
  );
}

function getRows(rows: number) {
  const safeRows = Number.isFinite(rows) ? Math.max(1, Math.floor(rows)) : 1;

  return Array.from({ length: safeRows });
}

const LOADING_ROOT_CLASS: Record<
  CollectionStateSkeleton,
  { base: string; regular: string; compact: string }
> = {
  table: { base: "rounded-lg border border-vetneb-line/75 bg-card/92", regular: "p-4", compact: "p-3" },
  detail: { base: "rounded-lg border border-vetneb-line/75 bg-card/92", regular: "p-5", compact: "p-4" },
  timeline: {
    base: "space-y-4 rounded-lg border border-vetneb-line/75 bg-card/92",
    regular: "p-5",
    compact: "p-4",
  },
  list: { base: "", regular: "space-y-3", compact: "space-y-2" },
  cards: { base: "grid sm:grid-cols-2 lg:grid-cols-3", regular: "gap-4", compact: "gap-3" },
};

function renderLoadingState({
  skeleton = "cards",
  rows = 3,
  label,
  compact = false,
  className,
}: CollectionStateLoadingProps) {
  const rootClass = LOADING_ROOT_CLASS[skeleton];

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-collection-state="loading"
      className={cn(rootClass.base, compact ? rootClass.compact : rootClass.regular, className)}
    >
      <span className="sr-only">{label ?? "Cargando..."}</span>
      {renderLoadingSkeleton(skeleton, getRows(rows), compact)}
    </div>
  );
}

function renderLoadingSkeleton(
  skeleton: CollectionStateSkeleton,
  items: unknown[],
  compact: boolean,
) {
  if (skeleton === "table") {
    return (
      <>
        <div className="grid grid-cols-4 gap-3 border-b border-vetneb-line/60 pb-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-4 w-full" />
          ))}
        </div>
        <div className="space-y-3 pt-3">
          {items.map((_, index) => (
            <div key={index} className="grid min-h-10 grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((__, cellIndex) => (
                <Skeleton key={cellIndex} className="h-4 w-full self-center" />
              ))}
            </div>
          ))}
        </div>
      </>
    );
  }

  if (skeleton === "detail") {
    return (
      <>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-3 h-4 w-3/4" />
        <Skeleton className="mt-2 h-4 w-1/2" />
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {items.map((_, index) => (
            <Skeleton key={index} className="h-20 w-full" />
          ))}
        </div>
      </>
    );
  }

  if (skeleton === "timeline") {
    return items.map((_, index) => (
      <div key={index} className="flex min-h-14 gap-3">
        <Skeleton className="h-9 w-9 rounded-full" />
        <div className="flex-1 space-y-2 pt-1">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-full max-w-md" />
        </div>
      </div>
    ));
  }

  if (skeleton === "list") {
    return items.map((_, index) => (
      <div
        key={index}
        className={cn(
          "flex items-center gap-3 rounded-md border border-vetneb-line/75 bg-card/92",
          compact ? "p-2.5" : "p-3",
        )}
      >
        <Skeleton className="h-8 w-8 shrink-0 rounded-md" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <Skeleton className="h-5 w-14 shrink-0 rounded-full" />
      </div>
    ));
  }

  return items.map((_, index) => (
    <div
      key={index}
      className={cn(
        "rounded-lg border border-vetneb-line/75 bg-card/92 p-4",
        compact ? "min-h-24" : "min-h-32",
      )}
    >
      <Skeleton className="h-4 w-28" />
      <Skeleton className="mt-4 h-8 w-16" />
      <Skeleton className="mt-3 h-3 w-full" />
      <Skeleton className="mt-2 h-3 w-2/3" />
    </div>
  ));
}

export type EmptyStateProps = CollectionStateEmptyProps;

export function EmptyState(props: EmptyStateProps) {
  return <CollectionState {...props} variant="empty" />;
}
