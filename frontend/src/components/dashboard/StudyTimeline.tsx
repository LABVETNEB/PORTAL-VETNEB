import { DetailsActivity, type DetailsActivityProps, type DetailsActivityStatus, type DetailsActivityStep } from "@/features/dashboard/presentation/details/DetailsActivity";

export type StudyTimelineStepStatus = DetailsActivityStatus;
export type StudyTimelineStep = DetailsActivityStep;
export type StudyTimelineProps = Pick<DetailsActivityProps, "steps" | "compact" | "ariaLabel" | "className">;

export function StudyTimeline({ steps, compact, ariaLabel = "Línea de tiempo del estudio", className }: StudyTimelineProps) {
  return <DetailsActivity steps={steps} compact={compact} ariaLabel={ariaLabel} className={className} />;
}
