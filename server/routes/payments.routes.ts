import { randomBytes } from "node:crypto";
import { Router } from "express";

import {
  createPaymentLink,
  createPaymentTransaction,
  getPaymentLinkByToken,
  listPaymentLinks,
  listPaymentTransactions,
  updatePaymentLinkStatus,
} from "../db";
import { requireAuth } from "../middlewares/auth";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

function parsePositiveInt(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function parseOptionalDate(value: unknown): Date | undefined {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function createPaymentToken() {
  return randomBytes(24).toString("hex");
}

router.use(requireAuth);

router.post(
  "/links",
  asyncHandler(async (req, res) => {
    const amountInCents = parsePositiveInt(req.body?.amountInCents);

    if (!amountInCents) {
      return res.status(400).json({
        success: false,
        error: "amountInCents debe ser un entero positivo",
      });
    }

    const paymentLink = await createPaymentLink({
      clinicId: req.auth!.clinicId,
      createdByAdminUserId: null,
      token: createPaymentToken(),
      patientName:
        typeof req.body?.patientName === "string" && req.body.patientName.trim()
          ? req.body.patientName.trim()
          : null,
      patientEmail:
        typeof req.body?.patientEmail === "string" && req.body.patientEmail.trim()
          ? req.body.patientEmail.trim()
          : null,
      description:
        typeof req.body?.description === "string" && req.body.description.trim()
          ? req.body.description.trim()
          : null,
      amountInCents,
      currency:
        typeof req.body?.currency === "string" && req.body.currency.trim()
          ? req.body.currency.trim().toUpperCase()
          : "ARS",
      status: "pending",
      expiresAt: parseOptionalDate(req.body?.expiresAt) ?? null,
    });

    return res.status(201).json({
      success: true,
      message: "Link de pago creado",
      paymentLink,
      publicUrl: `/api/public/payment-links/${paymentLink.token}`,
    });
  }),
);

router.get(
  "/links",
  asyncHandler(async (req, res) => {
    const status =
      typeof req.query.status === "string" && req.query.status.trim()
        ? req.query.status.trim()
        : undefined;

    const paymentLinks = await listPaymentLinks({
      clinicId: req.auth!.clinicId,
      status,
    });

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
  "/transactions",
  asyncHandler(async (req, res) => {
    const transactions = await listPaymentTransactions({
      clinicId: req.auth!.clinicId,
    });

    return res.json({
      success: true,
      count: transactions.length,
      transactions,
    });
  }),
);

router.post(
  "/webhook/mock",
  asyncHandler(async (req, res) => {
    const token =
      typeof req.body?.token === "string" && req.body.token.trim()
        ? req.body.token.trim()
        : "";

    if (!token) {
      return res.status(400).json({
        success: false,
        error: "token requerido",
      });
    }

    const paymentLink = await getPaymentLinkByToken(token);

    if (!paymentLink) {
      return res.status(404).json({
        success: false,
        error: "Link de pago no encontrado",
      });
    }

    if (paymentLink.clinicId !== req.auth!.clinicId) {
      return res.status(403).json({
        success: false,
        error: "No autorizado para operar sobre este link",
      });
    }

    const provider =
      typeof req.body?.provider === "string" && req.body.provider.trim()
        ? req.body.provider.trim()
        : "mock";

    const providerReference =
      typeof req.body?.providerReference === "string" && req.body.providerReference.trim()
        ? req.body.providerReference.trim()
        : null;

    const transaction = await createPaymentTransaction({
      paymentLinkId: paymentLink.id,
      provider,
      providerReference,
      status: "approved",
      amountInCents: paymentLink.amountInCents,
      currency: paymentLink.currency,
      rawPayload: JSON.stringify(req.body ?? {}),
    });

    const updatedPaymentLink = await updatePaymentLinkStatus({
      paymentLinkId: paymentLink.id,
      status: "paid",
      paidAt: new Date(),
    });

    return res.json({
      success: true,
      message: "Webhook mock procesado",
      paymentLink: updatedPaymentLink,
      transaction,
    });
  }),
);

export default router;
