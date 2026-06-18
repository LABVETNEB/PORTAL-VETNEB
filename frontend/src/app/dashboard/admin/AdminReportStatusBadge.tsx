import type { AdminReportWorkflowStage } from "@/lib/api";

const STATUS_META: Record<
  AdminReportWorkflowStage,
  { label: string; className: string }
> = {
  sample_received: {
    label: "Muestra recibida",
    className: "border-slate-300 bg-slate-50 text-slate-700",
  },
  processing: {
    label: "Procesamiento",
    className: "border-sky-200 bg-sky-50 text-sky-800",
  },
  evaluation: {
    label: "Evaluación",
    className: "border-amber-200 bg-amber-50 text-amber-800",
  },
  report_development: {
    label: "Desarrollo",
    className: "border-violet-200 bg-violet-50 text-violet-800",
  },
  delivered: {
    label: "Entregado",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
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
