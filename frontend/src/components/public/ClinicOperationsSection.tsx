import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export interface ClinicOperationStep {
  step: number;
  icon: LucideIcon;
  title: string;
  detail: string;
  tag?: string;
}

interface ClinicOperationsSectionProps {
  steps: ClinicOperationStep[];
  className?: string;
}

export function ClinicOperationsSection({
  steps,
  className,
}: ClinicOperationsSectionProps) {
  return (
    <ol
      aria-label="Pasos operativos de derivación con VETNEB"
      className={cn("space-y-0", className)}
    >
      {steps.map((step, idx) => {
        const StepIcon = step.icon;
        const isLast = idx === steps.length - 1;

        return (
          <li
            key={step.step}
            data-clinic-op-step={step.step}
            className="relative flex gap-5 pb-7 last:pb-0"
          >
            {!isLast && (
              <div
                className="absolute left-4 top-9 h-[calc(100%-2.25rem)] w-px bg-gradient-to-b from-vetneb-teal/38 to-vetneb-line/28"
                aria-hidden="true"
              />
            )}
            <div className="shrink-0">
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full bg-vetneb-navy text-xs font-bold text-primary-foreground shadow-[0_4px_10px_hsl(var(--vetneb-navy)/0.26)] ring-2 ring-vetneb-teal/18"
                aria-hidden="true"
              >
                {String(step.step).padStart(2, "0")}
              </span>
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="mb-1 flex items-center gap-2">
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-vetneb-line/65 bg-card/80 text-vetneb-teal"
                  aria-hidden="true"
                >
                  <StepIcon className="h-3.5 w-3.5" strokeWidth={1.9} />
                </span>
                <p className="text-sm font-semibold text-vetneb-ink">
                  {step.title}
                </p>
              </div>
              <p className="pl-8 text-xs leading-relaxed text-muted-foreground">
                {step.detail}
              </p>
              {step.tag && (
                <span className="ml-8 mt-1.5 inline-block rounded border border-vetneb-teal/25 bg-vetneb-teal/[0.07] px-2 py-0.5 text-[0.68rem] font-semibold text-vetneb-navy">
                  {step.tag}
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
