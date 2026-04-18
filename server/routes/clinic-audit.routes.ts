import { Router } from "express";
import { listAuditLog } from "../db-audit";
import {
  buildAdminAuditCsv,
  buildClinicAuditListFilters,
} from "../lib/admin-audit";
import { requireAuth } from "../middlewares/auth";
import { asyncHandler } from "../utils/async-handler";

const router = Router();
const CLINIC_AUDIT_CSV_EXPORT_MAX_ROWS = 10_000;

function buildClinicAuditCsvFilename(now = new Date()): string {
  const timestamp = now.toISOString().replace(/[:.]/g, "-");
  return `clinic-audit-log-${timestamp}.csv`;
}

router.use(requireAuth);

router.get(
  "/export.csv",
  asyncHandler(async (req, res) => {
    const auth = req.auth!;

    const { filters, errors } = buildClinicAuditListFilters(
      req.query as Record<string, unknown>,
      auth.clinicId,
    );

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: errors[0],
      });
    }

    const exportFilters = {
      ...filters,
      limit: CLINIC_AUDIT_CSV_EXPORT_MAX_ROWS,
      offset: 0,
    };

    const result = await listAuditLog(exportFilters);

    if (result.total > CLINIC_AUDIT_CSV_EXPORT_MAX_ROWS) {
      return res.status(400).json({
        success: false,
        error: `Demasiados registros para exportar. Aplica filtros mas especificos (maximo ${CLINIC_AUDIT_CSV_EXPORT_MAX_ROWS}).`,
      });
    }

    const csv = buildAdminAuditCsv(result.items);
    const filename = buildClinicAuditCsvFilename();

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    return res.status(200).send(csv);
  }),
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const auth = req.auth!;

    const { filters, errors } = buildClinicAuditListFilters(
      req.query as Record<string, unknown>,
      auth.clinicId,
    );

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: errors[0],
      });
    }

    const result = await listAuditLog(filters);

    return res.json({
      success: true,
      count: result.items.length,
      items: result.items,
      pagination: {
        limit: filters.limit,
        offset: filters.offset,
        total: result.total,
      },
      filters: {
        event: filters.event ?? null,
        actorType: filters.actorType ?? null,
        clinicId: auth.clinicId,
        reportId: filters.reportId ?? null,
        actorClinicUserId: filters.actorClinicUserId ?? null,
        actorReportAccessTokenId: filters.actorReportAccessTokenId ?? null,
        targetReportAccessTokenId: filters.targetReportAccessTokenId ?? null,
        from: filters.from ?? null,
        to: filters.to ?? null,
      },
    });
  }),
);

export default router;
