import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type StudyTimelineStepStatus =
  | "completed"
  | "current"
  | "pending"
  | "warning"
  | "error";

export type StudyTimelineStep = {
  id: string;
  label: string;
  date?: string | null;
  description?: string;
  status: StudyTimelineStepStatus;
};

export type StudyTimelineProps = {
  steps: StudyTimelineStep[];
  compact?: boolean;
  className?: string;
};

type TimelineStatusConfig = {
  label: string;
  icon: LucideIcon;
  markerClassName: string;
  labelClassName: string;
};

const TIMELINE_STATUS_CONFIG = {
  completed: {
    label: "Completado",
    icon: CheckCircle2,
    markerClassName: "border-vetneb-teal/35 bg-vetneb-teal/12 text-vetneb-teal",
    labelClassName: "text-vetneb-teal",
  },
  current: {
    label: "Actual",
    icon: LoaderCircle,
    markerClassName: "border-vetneb-cyan/35 bg-vetneb-cyan/14 text-vetneb-navy",
    labelClassName: "text-vetneb-navy",
  },
  pending: {
    label: "Pendiente",
    icon: Clock3,
    markerClassName: "border-vetneb-line bg-vetneb-surface-muted/80 text-vetneb-ink/70",
    labelClassName: "text-muted-foreground",
  },
  warning: {
    label: "Atención",
    icon: AlertTriangle,
    markerClassName: "border-vetneb-cyan/35 bg-vetneb-cyan/10 text-vetneb-navy",
    labelClassName: "text-vetneb-navy",
  },
  error: {
    label: "Error",
    icon: XCircle,
    markerClassName: "border-destructive/35 bg-destructive/10 text-destructive",
    labelClassName: "text-destructive",
  },
} satisfies Record<StudyTimelineStepStatus, TimelineStatusConfig>;

export function StudyTimeline({
  steps,
  compact = false,
  className,
}: StudyTimelineProps) {
  return (
    <ol
      className={cn(
        "space-y-3",
        compact ? "text-sm" : "text-base",
        className,
      )}
      aria-label="Línea de tiempo del estudio"
    >
      {steps.map((step, index) => {
        const config = TIMELINE_STATUS_CONFIG[step.status];
        const Icon = config.icon;
        const isLastStep = index === steps.length - 1;

        return (
          <li
            key={step.id}
            className="grid grid-cols-[auto_minmax(0,1fr)] gap-3"
            data-timeline-status={step.status}
          >
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full border",
                  config.markerClassName,
                )}
                aria-hidden="true"
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              {!isLastStep ? (
                <span
                  className="mt-2 h-full min-h-5 w-px bg-vetneb-line"
                  aria-hidden="true"
                />
              ) : null}
            </div>
            <div className={cn("min-w-0 pb-4", isLastStep ? "pb-0" : null)}>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-semibold text-vetneb-ink">{step.label}</p>
                <span
                  className={cn(
                    "inline-flex w-fit items-center rounded-md px-2 py-0.5 text-xs font-semibold",
                    config.markerClassName,
                  )}
                >
                  {config.label}
                </span>
              </div>
              <p className={cn("mt-1 text-sm font-medium", config.labelClassName)}>
                {step.date ?? "Pendiente"}
              </p>
              {step.description ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {step.description}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
