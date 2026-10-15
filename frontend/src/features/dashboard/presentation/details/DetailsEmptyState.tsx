import type { LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { cn } from "@/lib/utils";

export type DetailsEmptyStateProps = {
  title: string;
  description?: string;
  icon?: LucideIcon;
  ariaLabel?: string;
  className?: string;
};

// C13 reuses the C03 empty grammar; the consumer decides when nothing is selected.
export function DetailsEmptyState({ title, description, icon, ariaLabel, className }: DetailsEmptyStateProps) {
  return (
    <div data-details-empty-state="true" role={ariaLabel ? "group" : undefined} aria-label={ariaLabel} className={cn("min-w-0", className)}>
      <EmptyState title={title} description={description} icon={icon} size="sm" />
    </div>
  );
}
