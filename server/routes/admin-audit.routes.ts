import { Router } from "express";
import { listAuditLog } from "../db-audit";
import {
  buildAdminAuditCsv,
  buildAdminAuditCsvFilename,
  buildAdminAuditListFilters,
} from "../lib/admin-audit";
import { requireAdminAuth } from "../middlewares/admin-auth";
import { asyncHandler } from "../utils/async-handler";

const router = Router();
const ADMIN_AUDIT_CSV_EXPORT_MAX_ROWS = 10_000;

router.use(requireAdminAuth);

router.get(
  "/export.csv",
  asyncHandler(async (req, res) => {
    const { filters, errors } = buildAdminAuditListFilters(
      req.query as Record<string, unknown>,
    );

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: errors[0],
      });
    }

    const exportFilters = {
      ...filters,
      limit: ADMIN_AUDIT_CSV_EXPORT_MAX_ROWS,
      offset: 0,
    };

    const result = await listAuditLog(exportFilters);

    if (result.total > ADMIN_AUDIT_CSV_EXPORT_MAX_ROWS) {
      return res.status(400).json({
        success: false,
        error: `Demasiados registros para exportar. Aplica filtros mas especificos (maximo ${ADMIN_AUDIT_CSV_EXPORT_MAX_ROWS}).`,
      });
    }

    const csv = buildAdminAuditCsv(result.items);
    const filename = buildAdminAuditCsvFilename();

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    return res.status(200).send(csv);
  }),
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { filters, errors } = buildAdminAuditListFilters(
      req.query as Record<string, unknown>,
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
        clinicId: filters.clinicId ?? null,
        reportId: filters.reportId ?? null,
        actorAdminUserId: filters.actorAdminUserId ?? null,
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
