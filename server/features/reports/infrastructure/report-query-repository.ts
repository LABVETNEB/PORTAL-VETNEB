import { and, desc, eq, ilike, or, sql } from "drizzle-orm";

import { db } from "../../../db.ts";
import {
  reports,
  reportStatusHistory,
  type ReportStatus,
} from "../../../../drizzle/schema.ts";
import { getReportStudyTypes as getCanonicalReportStudyTypes } from "../domain/index.ts";

type ReportQueryDatabase = typeof db;

function buildSearchFilters(
  clinicId: number,
  query?: string,
  studyType?: string,
  currentStatus?: ReportStatus,
) {
  const filters = [eq(reports.clinicId, clinicId)];

  if (studyType) {
    filters.push(eq(reports.studyType, studyType));
  }

  if (currentStatus) {
    filters.push(eq(reports.currentStatus, currentStatus));
  }

  if (query) {
    filters.push(
      or(
        ilike(reports.patientName, "%" + query + "%"),
        ilike(reports.fileName, "%" + query + "%"),
        ilike(reports.studyType, "%" + query + "%"),
      )!,
    );
  }

  return filters;
}

export function createReportQueryRepository(dependencies?: {
  database?: ReportQueryDatabase;
}) {
  const database = dependencies?.database ?? db;

  return {
    async findClinicScopedReportById(reportId: number, clinicId: number) {
      const result = await database
        .select()
        .from(reports)
        .where(
          and(
            eq(reports.id, reportId),
            eq(reports.clinicId, clinicId),
          ),
        )
        .limit(1);

      return result[0];
    },

    listReportsByClinicId(
      clinicId: number,
      limit = 50,
      offset = 0,
      currentStatus?: ReportStatus,
    ) {
      const filters = [eq(reports.clinicId, clinicId)];

      if (currentStatus) {
        filters.push(eq(reports.currentStatus, currentStatus));
      }

      return database
        .select()
        .from(reports)
        .where(and(...filters))
        .orderBy(desc(reports.createdAt))
        .limit(limit)
        .offset(offset);
    },

    searchReports(
      clinicId: number,
      filters: {
        query?: string;
        studyType?: string;
        currentStatus?: ReportStatus;
      },
      limit = 50,
      offset = 0,
    ) {
      return database
        .select()
        .from(reports)
        .where(
          and(
            ...buildSearchFilters(
              clinicId,
              filters.query,
              filters.studyType,
              filters.currentStatus,
            ),
          ),
        )
        .orderBy(desc(reports.createdAt))
        .limit(limit)
        .offset(offset);
    },

    async countReportsByClinicId(
      clinicId: number,
      currentStatus?: ReportStatus,
    ): Promise<number> {
      const filters = [eq(reports.clinicId, clinicId)];

      if (currentStatus) {
        filters.push(eq(reports.currentStatus, currentStatus));
      }

      const result = await database
        .select({ value: sql<string>`count(*)` })
        .from(reports)
        .where(and(...filters));

      return Number(result[0]?.value ?? 0);
    },

    async countSearchReports(
      clinicId: number,
      filters: {
        query?: string;
        studyType?: string;
        currentStatus?: ReportStatus;
      },
    ): Promise<number> {
      const result = await database
        .select({ value: sql<string>`count(*)` })
        .from(reports)
        .where(
          and(
            ...buildSearchFilters(
              clinicId,
              filters.query,
              filters.studyType,
              filters.currentStatus,
            ),
          ),
        );

      return Number(result[0]?.value ?? 0);
    },

    getReportStatusHistory(reportId: number) {
      return database
        .select()
        .from(reportStatusHistory)
        .where(eq(reportStatusHistory.reportId, reportId))
        .orderBy(
          desc(reportStatusHistory.createdAt),
          desc(reportStatusHistory.id),
        );
    },

    async getStudyTypes(_clinicId: number) {
      return getCanonicalReportStudyTypes();
    },
  };
}

const runtimeRepository = () => createReportQueryRepository();

export function getClinicScopedReportById(
  reportId: number,
  clinicId: number,
) {
  return runtimeRepository().findClinicScopedReportById(reportId, clinicId);
}

export function getReportsByClinicId(
  clinicId: number,
  limit = 50,
  offset = 0,
  currentStatus?: ReportStatus,
) {
  return runtimeRepository().listReportsByClinicId(
    clinicId,
    limit,
    offset,
    currentStatus,
  );
}

export function searchReports(
  clinicId: number,
  query?: string,
  studyType?: string,
  limit = 50,
  offset = 0,
  currentStatus?: ReportStatus,
) {
  return runtimeRepository().searchReports(
    clinicId,
    { query, studyType, currentStatus },
    limit,
    offset,
  );
}

export function countReportsByClinicId(
  clinicId: number,
  currentStatus?: ReportStatus,
) {
  return runtimeRepository().countReportsByClinicId(clinicId, currentStatus);
}

export function countSearchReports(
  clinicId: number,
  query?: string,
  studyType?: string,
  currentStatus?: ReportStatus,
) {
  return runtimeRepository().countSearchReports(clinicId, {
    query,
    studyType,
    currentStatus,
  });
}

export function getReportStatusHistory(reportId: number) {
  return runtimeRepository().getReportStatusHistory(reportId);
}

export function getReportStudyTypes(clinicId: number) {
  return runtimeRepository().getStudyTypes(clinicId);
}

export const getStudyTypes = getReportStudyTypes;
