import { Router } from "express";

import {
  getAdminUserByEmail,
  listAdminUsers,
  listClinics,
  listPaymentLinks,
  listPaymentTransactions,
} from "../db";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

const requireAdmin = asyncHandler(async (req, res, next) => {
  const rawEmail = req.header("x-admin-email");

  if (!rawEmail || !rawEmail.trim()) {
    return res.status(401).json({
      success: false,
      error: "Header x-admin-email requerido",
    });
  }

  const adminUser = await getAdminUserByEmail(rawEmail);

  if (!adminUser || !adminUser.isActive) {
    return res.status(403).json({
      success: false,
      error: "Admin no autorizado",
    });
  }

  req.admin = adminUser;
  next();
});

declare global {
  namespace Express {
    interface Request {
      admin?: Awaited<ReturnType<typeof getAdminUserByEmail>>;
    }
  }
}

router.use(requireAdmin);

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
    const status =
      typeof req.query.status === "string" && req.query.status.trim()
        ? req.query.status.trim()
        : undefined;

    const paymentLinks = await listPaymentLinks({ status });

    return res.json({
      success: true,
      count: paymentLinks.length,
      paymentLinks,
      filters: {
        status: status ?? null,
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
