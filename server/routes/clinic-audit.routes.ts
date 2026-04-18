import { Router } from "express";
import { listAuditLog } from "../db-audit";
import { buildClinicAuditListFilters } from "../lib/admin-audit";
import { requireAuth } from "../middlewares/auth";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

router.use(requireAuth);

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