import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type LoadingStateProps = {
  variant?: "table" | "cards" | "detail" | "timeline";
  rows?: number;
  className?: string;
};

function getRows(rows: number) {
  const safeRows = Number.isFinite(rows) ? Math.max(1, Math.floor(rows)) : 1;

  return Array.from({ length: safeRows });
}

export function LoadingState({
  variant = "cards",
  rows = 3,
  className,
}: LoadingStateProps) {
  const items = getRows(rows);

  if (variant === "table") {
    return (
      <div
        className={cn(
          "rounded-lg border border-vetneb-line/75 bg-card/92 p-4",
          className,
        )}
        aria-busy="true"
      >
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
        className={cn(
          "rounded-lg border border-vetneb-line/75 bg-card/92 p-5",
          className,
        )}
        aria-busy="true"
      >
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
        className={cn("space-y-4 rounded-lg border border-vetneb-line/75 bg-card/92 p-5", className)}
        aria-busy="true"
      >
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
      className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}
      aria-busy="true"
    >
      {items.map((_, index) => (
        <div
          key={index}
          className="min-h-32 rounded-lg border border-vetneb-line/75 bg-card/92 p-4"
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

