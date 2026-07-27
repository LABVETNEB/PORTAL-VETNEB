import { and, eq, sql } from "drizzle-orm";

import { db } from "../../../db.ts";
import {
  reports,
  reportStatusHistory,
  type Report,
  type ReportStatus,
} from "../../../../drizzle/schema.ts";
type ReportCommandDatabase = typeof db;
type ReportCommandTransaction = Parameters<
  Parameters<ReportCommandDatabase["transaction"]>[0]
>[0];

type HistoryInput = {
  reportId: number;
  fromStatus: ReportStatus | null;
  toStatus: ReportStatus;
  changedByClinicUserId: number | null;
  changedByAdminUserId: number | null;
  note: string | null;
  createdAt: Date;
};

type CreateOrEditReportPersistenceInput = {
  clinicId: number;
  uploadDate?: Date | null;
  studyType?: string | null;
  patientName?: string | null;
  fileName?: string | null;
  storagePath: string;
  createdByClinicUserId?: number | null;
  createdByAdminUserId?: number | null;
};

type PersistReportStatusTransitionCommand = {
  reportId: number;
  expectedFromStatus: ReportStatus;
  toStatus: ReportStatus;
  note?: string | null;
  changedByClinicUserId?: number | null;
  changedByAdminUserId?: number | null;
};

async function insertCompatibleReportStatusHistory(
  tx: ReportCommandTransaction,
  input: HistoryInput,
) {
  const changedBy =
    input.changedByClinicUserId ?? input.changedByAdminUserId ?? null;
  const changedByType =
    input.changedByClinicUserId != null
      ? "clinic_user"
      : input.changedByAdminUserId != null
        ? "admin_user"
        : "system";

  try {
    await tx.execute(sql`
      INSERT INTO "report_status_history" (
        "report_id",
        "status",
        "previous_status",
        "changed_by",
        "changed_by_type",
        "notes",
        "created_at",
        "from_status",
        "to_status",
        "changed_by_clinic_user_id",
        "changed_by_admin_user_id",
        "note"
      )
      VALUES (
        ${input.reportId},
        ${input.toStatus},
        ${input.fromStatus},
        ${changedBy},
        ${changedByType},
        ${input.note},
        ${input.createdAt.toISOString()},
        ${input.fromStatus},
        ${input.toStatus},
        ${input.changedByClinicUserId},
        ${input.changedByAdminUserId},
        ${input.note}
      )
    `);
  } catch (error) {
    if (
      typeof error !== "object" ||
      error === null ||
      !("code" in error) ||
      error.code !== "42703"
    ) {
      throw error;
    }

    await tx.insert(reportStatusHistory).values({
      reportId: input.reportId,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      changedByClinicUserId: input.changedByClinicUserId,
      changedByAdminUserId: input.changedByAdminUserId,
      note: input.note,
      createdAt: input.createdAt,
    });
  }
}

export function createReportCommandRepository(dependencies?: {
  database?: ReportCommandDatabase;
  now?: () => Date;
}) {
  const database = dependencies?.database ?? db;
  const now = dependencies?.now ?? (() => new Date());

  return {
    async findReportById(reportId: number) {
      const result = await database
        .select()
        .from(reports)
        .where(eq(reports.id, reportId))
        .limit(1);

      return result[0];
    },

    async createOrEditReport(input: CreateOrEditReportPersistenceInput) {
      const operationTimestamp = now();

      return database.transaction(async (tx) => {
        const existing = await tx
          .select()
          .from(reports)
          .where(eq(reports.storagePath, input.storagePath))
          .limit(1);

        if (existing[0]) {
          const updated = await tx
            .update(reports)
            .set({
              uploadDate: input.uploadDate ?? null,
              studyType: input.studyType ?? null,
              patientName: input.patientName ?? null,
              fileName: input.fileName ?? null,
              updatedAt: operationTimestamp,
            })
            .where(eq(reports.id, existing[0].id))
            .returning();

          return updated[0];
        }

        const inserted = await tx
          .insert(reports)
          .values({
            clinicId: input.clinicId,
            uploadDate: input.uploadDate ?? null,
            studyType: input.studyType ?? null,
            patientName: input.patientName ?? null,
            fileName: input.fileName ?? null,
            storagePath: input.storagePath,
            previewUrl: null,
            downloadUrl: null,
            currentStatus: "uploaded",
            statusChangedAt: operationTimestamp,
            statusChangedByClinicUserId:
              input.createdByClinicUserId ?? null,
            statusChangedByAdminUserId: input.createdByAdminUserId ?? null,
            createdAt: operationTimestamp,
            updatedAt: operationTimestamp,
          })
          .returning();
        const report = inserted[0];

        await insertCompatibleReportStatusHistory(tx, {
          reportId: report.id,
          fromStatus: null,
          toStatus: "uploaded",
          changedByClinicUserId: input.createdByClinicUserId ?? null,
          changedByAdminUserId: input.createdByAdminUserId ?? null,
          note: "Informe cargado inicialmente",
          createdAt: operationTimestamp,
        });

        return report;
      });
    },

    async persistReportStatusTransition(
      input: PersistReportStatusTransitionCommand,
    ) {
      const operationTimestamp = now();

      return database.transaction(async (tx) => {
        const existing = await tx
          .select()
          .from(reports)
          .where(eq(reports.id, input.reportId))
          .limit(1);
        const report = existing[0];

        if (!report) {
          return undefined;
        }

        if (report.currentStatus !== input.expectedFromStatus) {
          return undefined;
        }

        const updated = await tx
          .update(reports)
          .set({
            currentStatus: input.toStatus,
            statusChangedAt: operationTimestamp,
            statusChangedByClinicUserId:
              input.changedByClinicUserId ?? null,
            statusChangedByAdminUserId: input.changedByAdminUserId ?? null,
            updatedAt: operationTimestamp,
          })
          .where(
            and(
              eq(reports.id, input.reportId),
              eq(reports.currentStatus, input.expectedFromStatus),
            ),
          )
          .returning();
        const updatedReport = updated[0];

        if (!updatedReport) {
          return undefined;
        }

        await insertCompatibleReportStatusHistory(tx, {
          reportId: report.id,
          fromStatus: input.expectedFromStatus,
          toStatus: input.toStatus,
          changedByClinicUserId: input.changedByClinicUserId ?? null,
          changedByAdminUserId: input.changedByAdminUserId ?? null,
          note: input.note ?? null,
          createdAt: operationTimestamp,
        });

        return updatedReport;
      });
    },
  };
}

export function getReportById(id: number): Promise<Report> {
  return createReportCommandRepository().findReportById(
    id,
  ) as Promise<Report>;
}

export function upsertReport(input: CreateOrEditReportPersistenceInput) {
  return createReportCommandRepository().createOrEditReport(input);
}
