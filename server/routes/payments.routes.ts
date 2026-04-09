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
import { zodValidationResponse } from "../lib/validation";
import { paymentLinkCreateBodySchema, paymentLinksQuerySchema } from "../schemas/payments";
import { requireAuth } from "../middlewares/auth";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

function createPaymentToken() {
  return randomBytes(24).toString("hex");
}

router.use(requireAuth);

router.post(
  "/links",
  asyncHandler(async (req, res) => {
    const parsedBody = paymentLinkCreateBodySchema.safeParse(req.body ?? {});

    if (!parsedBody.success) {
      return res.status(400).json(zodValidationResponse(parsedBody.error));
    }

    const paymentLink = await createPaymentLink({
      clinicId: req.auth!.clinicId,
      createdByAdminUserId: null,
      token: createPaymentToken(),
      patientName: parsedBody.data.patientName,
      patientEmail: parsedBody.data.patientEmail,
      description: parsedBody.data.description,
      amountInCents: parsedBody.data.amountInCents,
      currency: parsedBody.data.currency,
      status: "pending",
      expiresAt: parsedBody.data.expiresAt,
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
    const parsedQuery = paymentLinksQuerySchema.safeParse(req.query ?? {});

    if (!parsedQuery.success) {
      return res.status(400).json(zodValidationResponse(parsedQuery.error));
    }

    const paymentLinks = await listPaymentLinks({
      clinicId: req.auth!.clinicId,
      status: parsedQuery.data.status,
    });

    return res.json({
      success: true,
      count: paymentLinks.length,
      paymentLinks,
      filters: {
        status: parsedQuery.data.status ?? null,
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
