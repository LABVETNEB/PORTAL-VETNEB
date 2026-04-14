import { Router } from "express";
import {
  getParticularStudyTrackingCase,
  listStudyTrackingNotifications,
} from "../db-study-tracking";
import {
  parseBooleanQuery,
  parseOffset,
  parsePositiveInt,
  serializeStudyTrackingCase,
  serializeStudyTrackingNotification,
} from "../lib/study-tracking";
import { requireParticularAuth } from "../middlewares/particular-auth";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

router.use(requireParticularAuth);

router.get(
  "/me",
  asyncHandler(async (req, res) => {
    const trackingCase = await getParticularStudyTrackingCase(
      req.particularAuth!.tokenId,
    );

    if (!trackingCase) {
      return res.status(404).json({
        success: false,
        error: "Seguimiento no encontrado para el token particular autenticado",
      });
    }

    return res.json({
      success: true,
      trackingCase: serializeStudyTrackingCase(trackingCase),
    });
  }),
);

router.get(
  "/notifications",
  asyncHandler(async (req, res) => {
    const unreadOnly = parseBooleanQuery(req.query.unreadOnly) ?? false;
    const limit = parsePositiveInt(req.query.limit, 50, 100);
    const offset = parseOffset(req.query.offset, 0);

    const notifications = await listStudyTrackingNotifications({
      particularTokenId: req.particularAuth!.tokenId,
      unreadOnly,
      limit,
      offset,
    });

    return res.json({
      success: true,
      count: notifications.length,
      notifications: notifications.map((notification) =>
        serializeStudyTrackingNotification(notification),
      ),
      pagination: {
        limit,
        offset,
      },
    });
  }),
);

export default router;
