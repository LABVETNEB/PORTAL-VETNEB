import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type LoadingStateProps = {
  variant?: "table" | "cards" | "detail" | "timeline";
  rows?: number;
  label?: string;
  compact?: boolean;
  className?: string;
};

function getRows(rows: number) {
  const safeRows = Number.isFinite(rows) ? Math.max(1, Math.floor(rows)) : 1;

  return Array.from({ length: safeRows });
}

export function LoadingState({
  variant = "cards",
  rows = 3,
  label,
  compact = false,
  className,
}: LoadingStateProps) {
  const items = getRows(rows);
  const loadingLabel = label ?? "Cargando...";

  if (variant === "table") {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className={cn(
          "rounded-lg border border-vetneb-line/75 bg-card/92",
          compact ? "p-3" : "p-4",
          className,
        )}
      >
        <span className="sr-only">{loadingLabel}</span>
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
      </div>
    );
  }

  if (variant === "detail") {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className={cn(
          "rounded-lg border border-vetneb-line/75 bg-card/92",
          compact ? "p-4" : "p-5",
          className,
        )}
      >
        <span className="sr-only">{loadingLabel}</span>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-3 h-4 w-3/4" />
        <Skeleton className="mt-2 h-4 w-1/2" />
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {items.map((_, index) => (
            <Skeleton key={index} className="h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (variant === "timeline") {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className={cn(
          "space-y-4 rounded-lg border border-vetneb-line/75 bg-card/92",
          compact ? "p-4" : "p-5",
          className,
        )}
      >
        <span className="sr-only">{loadingLabel}</span>
        {items.map((_, index) => (
          <div key={index} className="flex min-h-14 gap-3">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex-1 space-y-2 pt-1">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-full max-w-md" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        "grid sm:grid-cols-2 lg:grid-cols-3",
        compact ? "gap-3" : "gap-4",
        className,
      )}
    >
      <span className="sr-only">{loadingLabel}</span>
      {items.map((_, index) => (
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
      ))}
    </div>
  );
}
