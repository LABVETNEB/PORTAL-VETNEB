import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export interface SpecimenStage {
  step: number;
  icon: LucideIcon;
  title: string;
  detail: string;
  protocol?: string;
}

interface SpecimenJourneySectionProps {
  stages: SpecimenStage[];
  className?: string;
}

export function SpecimenJourneySection({
  stages,
  className,
}: SpecimenJourneySectionProps) {
  return (
    <ol
      aria-label="Etapas del recorrido de la muestra"
      className={cn(
        "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5",
        className,
      )}
    >
      {stages.map((stage) => {
        const StageIcon = stage.icon;

        return (
          <li
            key={stage.step}
            data-specimen-stage={stage.step}
            className="flex gap-4 lg:flex-col lg:gap-3"
          >
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-vetneb-navy text-sm font-bold text-primary-foreground shadow-[0_6px_16px_hsl(var(--vetneb-navy)/0.22)] ring-2 ring-primary/20"
              aria-hidden="true"
            >
              {stage.step}
            </span>

            <div className="min-w-0">
              <span
                className="mb-2.5 hidden h-9 w-9 items-center justify-center rounded-lg border border-vetneb-line/80 bg-secondary/60 text-vetneb-teal lg:flex"
                aria-hidden="true"
              >
                <StageIcon className="h-5 w-5" />
              </span>

              <p className="text-sm font-semibold leading-snug text-vetneb-ink">
                {stage.title}
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {stage.detail}
              </p>
              {stage.protocol && (
                <span className="mt-2 inline-block rounded border border-vetneb-teal/28 bg-vetneb-teal/[0.08] px-2 py-0.5 text-[0.68rem] font-semibold text-vetneb-navy">
                  {stage.protocol}
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
