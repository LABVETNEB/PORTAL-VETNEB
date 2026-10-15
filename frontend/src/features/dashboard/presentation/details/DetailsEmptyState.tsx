import type { LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/dashboard/EmptyState";

export type DetailsEmptyStateProps = {
  title: string;
  description?: string;
  icon?: LucideIcon;
};

// C13 reuses the C03 empty grammar; the consumer decides when nothing is selected.
export function DetailsEmptyState({ title, description, icon }: DetailsEmptyStateProps) {
  return (
    <div data-details-empty-state="true" className="min-w-0">
      <EmptyState title={title} description={description} icon={icon} size="sm" />
    </div>
  );
}
