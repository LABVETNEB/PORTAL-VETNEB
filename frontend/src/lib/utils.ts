import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ReportStatus, FieldVisitStatus, RoutePlanStatus } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Formateo de fechas ───────────────────────────────────────────────────────

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(dateString));
}

export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateString));
}

// ─── Labels de estado ─────────────────────────────────────────────────────────

export function getReportStatusLabel(status: ReportStatus): string {
  const labels: Record<ReportStatus, string> = {
    uploaded: "Subido",
    processing: "Procesando",
    ready: "Listo",
    delivered: "Entregado",
  };
  return labels[status] ?? status;
}

export function getFieldVisitStatusLabel(status: FieldVisitStatus): string {
  const labels: Record<FieldVisitStatus, string> = {
    pending: "Pendiente",
    scheduled: "Programado",
    in_progress: "En curso",
    done: "Completado",
    canceled: "Cancelado",
    no_show: "Sin presencia",
  };
  return labels[status] ?? status;
}

export function getRoutePlanStatusLabel(status: RoutePlanStatus): string {
  const labels: Record<RoutePlanStatus, string> = {
    draft: "Borrador",
    planned: "Planificado",
    released: "Liberado",
    in_progress: "En curso",
    completed: "Completado",
    canceled: "Cancelado",
  };
  return labels[status] ?? status;
}

// ─── Variantes de badge por estado ───────────────────────────────────────────

export function getReportStatusVariant(
  status: ReportStatus,
): "default" | "secondary" | "destructive" | "outline" {
  const variants: Record<
    ReportStatus,
    "default" | "secondary" | "destructive" | "outline"
  > = {
    uploaded: "outline",
    processing: "secondary",
    ready: "default",
    delivered: "default",
  };
  return variants[status] ?? "outline";
}

export function getFieldVisitStatusVariant(
  status: FieldVisitStatus,
): "default" | "secondary" | "destructive" | "outline" {
  const variants: Record<
    FieldVisitStatus,
    "default" | "secondary" | "destructive" | "outline"
  > = {
    pending: "outline",
    scheduled: "secondary",
    in_progress: "default",
    done: "default",
    canceled: "destructive",
    no_show: "destructive",
  };
  return variants[status] ?? "outline";
}

export function getRoutePlanStatusVariant(
  status: RoutePlanStatus,
): "default" | "secondary" | "destructive" | "outline" {
  const variants: Record<
    RoutePlanStatus,
    "default" | "secondary" | "destructive" | "outline"
  > = {
    draft: "outline",
    planned: "secondary",
    released: "secondary",
    in_progress: "default",
    completed: "default",
    canceled: "destructive",
  };
  return variants[status] ?? "outline";
}
