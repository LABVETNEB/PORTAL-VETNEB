import { eq } from "drizzle-orm";

import { db } from "../../../db.ts";
import { studyTrackingCases } from "../../../../drizzle/schema.ts";
import type { ReportWorkflowDataPort } from "../application/ports/index.ts";

export function createReportWorkflowDataAdapter(): ReportWorkflowDataPort {
  return {
    async findTrackingContextByReportId(reportId) {
      const trackingCases = await db
        .select()
        .from(studyTrackingCases)
        .where(eq(studyTrackingCases.reportId, reportId))
        .limit(1);
      const trackingCase = trackingCases[0];

      return trackingCase
        ? {
            studyTrackingCaseId: trackingCase.id,
            clinicId: trackingCase.clinicId,
            reportId: trackingCase.reportId ?? null,
            particularTokenId: trackingCase.particularTokenId ?? null,
          }
        : null;
    },
  };
}
