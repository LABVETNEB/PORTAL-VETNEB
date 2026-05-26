import { desc, eq } from "drizzle-orm";

import { db } from "./db.ts";
import {
  clinics,
  reports,
  type ReportWorkflowStage,
} from "../drizzle/schema.ts";

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

export async function listAdminReportWorkflowItems(input: {
  limit: number;
  offset: number;
}): Promise<AdminReportWorkflowItem[]> {
  const rows = await db
    .select(workflowSelection)
    .from(reports)
    .leftJoin(clinics, eq(reports.clinicId, clinics.id))
    .orderBy(desc(reports.uploadDate), desc(reports.createdAt), desc(reports.id))
    .limit(input.limit)
    .offset(input.offset);

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

  return rows[0] ? getAdminReportWorkflowItem(rows[0].id) : null;
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

  return rows[0] ? getAdminReportWorkflowItem(rows[0].id) : null;
}
