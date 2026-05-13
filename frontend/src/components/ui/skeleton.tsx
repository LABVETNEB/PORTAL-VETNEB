import { cn } from "@/lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-gradient-to-r from-vetneb-surface-muted/90 via-vetneb-surface-raised/95 to-vetneb-surface-muted/90",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
