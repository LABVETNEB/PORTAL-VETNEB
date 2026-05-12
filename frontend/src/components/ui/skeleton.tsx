import { cn } from "@/lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-gradient-to-r from-vetneb-surface-muted via-card to-vetneb-surface-muted",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
