import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  wrapperClassName?: string;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, wrapperClassName, children, ...props }, ref) => {
    return (
      <div className={cn("relative w-full", wrapperClassName)}>
        <select
          className={cn(
            "flex h-10 w-full appearance-none rounded-md border border-input bg-card/96 px-3 py-2 pr-10 text-sm text-foreground shadow-[0_1px_2px_rgba(15,45,62,0.05)] ring-offset-background transition-[border-color,box-shadow,background-color] hover:border-vetneb-teal/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55",
            className,
          )}
          ref={ref}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
      </div>
    );
  },
);
Select.displayName = "Select";

export { Select };
