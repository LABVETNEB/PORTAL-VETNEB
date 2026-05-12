import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-vetneb-teal/25 bg-vetneb-teal/10 text-vetneb-teal hover:bg-vetneb-teal/20",
        secondary:
          "border-vetneb-cyan/25 bg-vetneb-cyan/10 text-vetneb-navy hover:bg-vetneb-cyan/20",
        destructive:
          "border-destructive/25 bg-destructive/10 text-destructive hover:bg-destructive/20",
        outline: "border-vetneb-line bg-card/70 text-foreground",
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
