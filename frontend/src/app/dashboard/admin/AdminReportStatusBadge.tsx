import type { AdminReportWorkflowStage } from "@/lib/api";

const STATUS_META: Record<
  AdminReportWorkflowStage,
  { label: string; className: string }
> = {
  sample_received: {
    label: "Muestra recibida",
    className: "border-vetneb-line bg-vetneb-surface-muted/80 text-vetneb-ink/78",
  },
  processing: {
    label: "Procesamiento",
    className: "border-vetneb-cyan/35 bg-vetneb-cyan/12 text-vetneb-navy",
  },
  evaluation: {
    label: "Evaluación",
    className: "border-vetneb-amber/35 bg-vetneb-amber/10 text-vetneb-amber",
  },
  report_development: {
    label: "Desarrollo",
    className: "border-vetneb-navy/25 bg-vetneb-navy/8 text-vetneb-navy",
  },
  delivered: {
    label: "Entregado",
    className: "border-vetneb-teal/35 bg-vetneb-teal/12 text-vetneb-teal",
  },
};

export const ADMIN_REPORT_STAGE_OPTIONS = (
  Object.entries(STATUS_META) as Array<
    [AdminReportWorkflowStage, (typeof STATUS_META)[AdminReportWorkflowStage]]
  >
).map(([value, meta]) => ({ value, label: meta.label }));

type AdminReportStatusBadgeProps = {
  stage: AdminReportWorkflowStage;
};

export function AdminReportStatusBadge({ stage }: AdminReportStatusBadgeProps) {
  const meta = STATUS_META[stage];

  return (
    <span
      className={`inline-flex h-5 items-center rounded-md border px-1.5 text-[0.6875rem] font-semibold ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}
