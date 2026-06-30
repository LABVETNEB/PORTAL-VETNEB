import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold tracking-[0.01em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-vetneb-teal/30 bg-vetneb-teal/12 text-vetneb-teal hover:bg-vetneb-teal/20",
        secondary:
          "border-vetneb-cyan/30 bg-vetneb-cyan/12 text-vetneb-navy hover:bg-vetneb-cyan/20",
        destructive:
          "border-destructive/30 bg-destructive/12 text-destructive hover:bg-destructive/20",
        outline: "border-vetneb-line/90 bg-card/80 text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
