import { desc, eq } from "drizzle-orm";

import { db } from "./db.ts";
import {
  clinics,
  reports,
  type ReportWorkflowStage,
} from "../drizzle/schema.ts";
import { normalizeListPagination } from "./lib/list-pagination.ts";
import { createReportWorkflowNotification } from "./features/reports/composition/index.ts";

export type AdminReportWorkflowItem = {
  id: number;
  clinicId: number;
  clinicName: string | null;
  patientName: string | null;
  fileName: string | null;
  studyType: string | null;
  uploadDate: string | null;
  createdAt: string;
  workflowStage: ReportWorkflowStage;
  specialStainRequested: boolean;
  specialStainAt: string | null;
  workflowUpdatedAt: string | null;
};

type AdminReportWorkflowRow = {
  id: number;
  clinicId: number;
  clinicName: string | null;
  patientName: string | null;
  fileName: string | null;
  studyType: string | null;
  uploadDate: Date | null;
  createdAt: Date;
  workflowStage: ReportWorkflowStage;
  specialStainRequested: boolean;
  specialStainAt: Date | null;
  workflowUpdatedAt: Date | null;
};

const workflowSelection = {
  id: reports.id,
  clinicId: reports.clinicId,
  clinicName: clinics.name,
  patientName: reports.patientName,
  fileName: reports.fileName,
  studyType: reports.studyType,
  uploadDate: reports.uploadDate,
  createdAt: reports.createdAt,
  workflowStage: reports.workflowStage,
  specialStainRequested: reports.specialStainRequested,
  specialStainAt: reports.specialStainAt,
  workflowUpdatedAt: reports.workflowUpdatedAt,
};

function serializeAdminReportWorkflowItem(
  row: AdminReportWorkflowRow,
): AdminReportWorkflowItem {
  return {
    id: row.id,
    clinicId: row.clinicId,
    clinicName: row.clinicName ?? null,
    patientName: row.patientName ?? null,
    fileName: row.fileName ?? null,
    studyType: row.studyType ?? null,
    uploadDate: row.uploadDate?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    workflowStage: row.workflowStage,
    specialStainRequested: row.specialStainRequested,
    specialStainAt: row.specialStainAt?.toISOString() ?? null,
    workflowUpdatedAt: row.workflowUpdatedAt?.toISOString() ?? null,
  };
}

function getWorkflowStageLabel(value: ReportWorkflowStage): string {
  switch (value) {
    case "sample_received":
      return "Muestra recibida";
    case "processing":
      return "Procesamiento";
    case "evaluation":
      return "Evaluación";
    case "report_development":
      return "Desarrollo de informe";
    case "delivered":
      return "Entregado";
  }
}

async function createWorkflowCommunicationSafely(input: {
  reportId: number;
  type: string;
  title: string;
  message: string;
}) {
  try {
    const result = await createReportWorkflowNotification(input);

    if (!result.notificationCreated) {
      console.warn("[REPORT_WORKFLOW] notification skipped", {
        reportId: input.reportId,
        type: input.type,
        warning: result.warning,
      });
    }
  } catch (error) {
    console.error("[REPORT_WORKFLOW] notification failed", {
      reportId: input.reportId,
      type: input.type,
      errorName: error instanceof Error ? error.name : "unknown_error",
    });
  }
}

export async function listAdminReportWorkflowItems(input: {
  limit?: number;
  offset?: number;
} = {}): Promise<AdminReportWorkflowItem[]> {
  const { limit, offset } = normalizeListPagination(input, {
    defaultLimit: 20,
    maxLimit: 21,
  });
  const rows = await db
    .select(workflowSelection)
    .from(reports)
    .leftJoin(clinics, eq(reports.clinicId, clinics.id))
    .orderBy(desc(reports.uploadDate), desc(reports.createdAt), desc(reports.id))
    .limit(limit)
    .offset(offset);

  return rows.map((row) =>
    serializeAdminReportWorkflowItem(row as AdminReportWorkflowRow),
  );
}

export async function getAdminReportWorkflowItem(
  id: number,
): Promise<AdminReportWorkflowItem | null> {
  const rows = await db
    .select(workflowSelection)
    .from(reports)
    .leftJoin(clinics, eq(reports.clinicId, clinics.id))
    .where(eq(reports.id, id))
    .limit(1);

  const row = rows[0];
  return row
    ? serializeAdminReportWorkflowItem(row as AdminReportWorkflowRow)
    : null;
}

export async function updateAdminReportWorkflowStage(
  id: number,
  workflowStage: ReportWorkflowStage,
  now: Date,
): Promise<AdminReportWorkflowItem | null> {
  const rows = await db
    .update(reports)
    .set({
      workflowStage,
      workflowUpdatedAt: now,
      updatedAt: now,
    })
    .where(eq(reports.id, id))
    .returning({ id: reports.id });

  if (!rows[0]) {
    return null;
  }

  const report = await getAdminReportWorkflowItem(rows[0].id);

  if (report) {
    await createWorkflowCommunicationSafely({
      reportId: report.id,
      type: "stage_changed",
      title: "Estado de informe actualizado",
      message: `El informe cambió de etapa: ${getWorkflowStageLabel(report.workflowStage)}.`,
    });
  }

  return report;
}

export async function updateAdminReportSpecialStain(
  id: number,
  requested: boolean,
  now: Date,
): Promise<AdminReportWorkflowItem | null> {
  const rows = await db
    .update(reports)
    .set({
      specialStainRequested: requested,
      specialStainAt: requested ? now : null,
      workflowUpdatedAt: now,
      updatedAt: now,
    })
    .where(eq(reports.id, id))
    .returning({ id: reports.id });

  if (!rows[0]) {
    return null;
  }

  const report = await getAdminReportWorkflowItem(rows[0].id);

  if (report) {
    await createWorkflowCommunicationSafely({
      reportId: report.id,
      type: requested ? "special_stain_required" : "special_stain_resolved",
      title: requested ? "Se requiere tinción especial" : "Tinción especial resuelta",
      message: requested
        ? "El informe requiere tinción especial. Revisá el seguimiento para continuar la gestión."
        : "La solicitud de tinción especial del informe fue resuelta.",
    });
  }

  return report;
}
