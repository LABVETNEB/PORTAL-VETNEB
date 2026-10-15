import { useId, type ReactNode } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";

export type DetailsAction = { id: string; label: string; onClick: () => void; icon?: ReactNode; variant?: ButtonProps["variant"]; disabled?: boolean; disabledReason?: string };
export type DetailsActionDockProps = { label: string; actions: readonly DetailsAction[]; description?: string; pending?: boolean };

export function DetailsActionDock({ label, actions, description, pending = false }: DetailsActionDockProps) {
  const baseId = useId();
  if (actions.length === 0) return null;
  return (
    <section data-details-action-dock="true" aria-label={label} className="sticky bottom-0 z-10 min-w-0 border-t border-vetneb-line/70 bg-vetneb-surface pt-3">
      {description ? <p className="dashboard-detail-value text-xs text-muted-foreground">{description}</p> : null}
      <div role="group" aria-label={label} aria-busy={pending || undefined} className="mt-2 flex min-w-0 flex-wrap gap-2">
        {actions.map((action) => {
          const reason = pending ? "Acción en curso" : action.disabledReason;
          const disabled = pending || action.disabled || Boolean(reason);
          const reasonId = `${baseId}-${action.id}-reason`;
          return (
            <div key={action.id} className="min-w-0">
              <Button type="button" variant={action.variant ?? "outline"} disabled={disabled} aria-label={action.label} aria-describedby={reason ? reasonId : undefined} onClick={action.onClick} className="min-h-11 max-w-full whitespace-normal focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-primary">
                {action.icon ? <span aria-hidden="true">{action.icon}</span> : null}<span>{action.label}</span>
              </Button>
              {reason ? <p id={reasonId} className="mt-1 text-xs text-muted-foreground">{reason}</p> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
