import { Router } from "express";

import {
  countPaymentLinks,
  listAdminUsers,
  listClinics,
  listPaymentLinks,
  listPaymentTransactions,
} from "../db";
import { zodValidationResponse } from "../lib/validation";
import { requireAdminAuth } from "../middlewares/admin-auth";
import { adminPaymentLinksQuerySchema } from "../schemas/payments";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

router.use(requireAdminAuth);

router.get(
  "/health",
  asyncHandler(async (_req, res) => {
    return res.json({
      success: true,
      area: "admin",
      status: "ok",
    });
  }),
);

router.get(
  "/clinics",
  asyncHandler(async (_req, res) => {
    const clinics = await listClinics();

    return res.json({
      success: true,
      count: clinics.length,
      clinics,
    });
  }),
);

router.get(
  "/admin-users",
  asyncHandler(async (_req, res) => {
    const adminUsers = await listAdminUsers();

    return res.json({
      success: true,
      count: adminUsers.length,
      adminUsers,
    });
  }),
);

router.get(
  "/payment-links",
  asyncHandler(async (req, res) => {
    const parsedQuery = adminPaymentLinksQuerySchema.safeParse(req.query ?? {});

    if (!parsedQuery.success) {
      return res.status(400).json(zodValidationResponse(parsedQuery.error));
    }

    const { status, page, pageSize } = parsedQuery.data;
    const offset = (page - 1) * pageSize;

    const [paymentLinks, total] = await Promise.all([
      listPaymentLinks({
        status,
        limit: pageSize,
        offset,
      }),
      countPaymentLinks({ status }),
    ]);

    return res.json({
      success: true,
      count: paymentLinks.length,
      total,
      paymentLinks,
      filters: {
        status: status ?? null,
      },
      pagination: {
        page,
        pageSize,
        totalPages: total > 0 ? Math.ceil(total / pageSize) : 0,
      },
    });
  }),
);

router.get(
  "/payment-transactions",
  asyncHandler(async (_req, res) => {
    const transactions = await listPaymentTransactions();

    return res.json({
      success: true,
      count: transactions.length,
      transactions,
    });
  }),
);

export default router;
