import { Router } from "express";

import {
  createPaymentTransaction,
  getPaymentLinkByToken,
  updatePaymentLinkStatus,
} from "../db";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

function isExpired(expiresAt: Date | null): boolean {
  return !!expiresAt && expiresAt.getTime() <= Date.now();
}

router.get(
  "/payment-links/:token",
  asyncHandler(async (req, res) => {
    const token = req.params.token;
    const paymentLink = await getPaymentLinkByToken(token);

    if (!paymentLink) {
      return res.status(404).json({
        success: false,
        error: "Link de pago no encontrado",
      });
    }

    const expired = isExpired(paymentLink.expiresAt ?? null);

    return res.json({
      success: true,
      paymentLink: {
        id: paymentLink.id,
        token: paymentLink.token,
        patientName: paymentLink.patientName,
        patientEmail: paymentLink.patientEmail,
        description: paymentLink.description,
        amountInCents: paymentLink.amountInCents,
        currency: paymentLink.currency,
        status: expired && paymentLink.status === "pending" ? "expired" : paymentLink.status,
        expiresAt: paymentLink.expiresAt,
        createdAt: paymentLink.createdAt,
      },
    });
  }),
);

router.post(
  "/payment-links/:token/checkout",
  asyncHandler(async (req, res) => {
    const token = req.params.token;
    const paymentLink = await getPaymentLinkByToken(token);

    if (!paymentLink) {
      return res.status(404).json({
        success: false,
        error: "Link de pago no encontrado",
      });
    }

    if (paymentLink.status === "paid") {
      return res.status(409).json({
        success: false,
        error: "Este link ya fue pagado",
      });
    }

    if (paymentLink.status === "cancelled") {
      return res.status(409).json({
        success: false,
        error: "Este link fue cancelado",
      });
    }

    if (isExpired(paymentLink.expiresAt ?? null)) {
      return res.status(410).json({
        success: false,
        error: "Este link está vencido",
      });
    }

    const provider =
      typeof req.body?.provider === "string" && req.body.provider.trim()
        ? req.body.provider.trim()
        : "manual";

    const providerReference =
      typeof req.body?.providerReference === "string" && req.body.providerReference.trim()
        ? req.body.providerReference.trim()
        : null;

    const transaction = await createPaymentTransaction({
      paymentLinkId: paymentLink.id,
      provider,
      providerReference,
      status: "pending",
      amountInCents: paymentLink.amountInCents,
      currency: paymentLink.currency,
      rawPayload: JSON.stringify(req.body ?? {}),
    });

    return res.status(201).json({
      success: true,
      message: "Checkout iniciado",
      checkout: {
        paymentLinkId: paymentLink.id,
        token: paymentLink.token,
        provider,
        providerReference,
        amountInCents: paymentLink.amountInCents,
        currency: paymentLink.currency,
        transactionId: transaction.id,
      },
    });
  }),
);

router.post(
  "/payment-links/:token/confirm",
  asyncHandler(async (req, res) => {
    const token = req.params.token;
    const paymentLink = await getPaymentLinkByToken(token);

    if (!paymentLink) {
      return res.status(404).json({
        success: false,
        error: "Link de pago no encontrado",
      });
    }

    if (paymentLink.status === "paid") {
      return res.status(409).json({
        success: false,
        error: "Este link ya fue pagado",
      });
    }

    if (paymentLink.status === "cancelled") {
      return res.status(409).json({
        success: false,
        error: "Este link fue cancelado",
      });
    }

    if (isExpired(paymentLink.expiresAt ?? null)) {
      return res.status(410).json({
        success: false,
        error: "Este link está vencido",
      });
    }

    const provider =
      typeof req.body?.provider === "string" && req.body.provider.trim()
        ? req.body.provider.trim()
        : "manual";

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
      message: "Pago confirmado",
      paymentLink: updatedPaymentLink,
      transaction,
    });
  }),
);

export default router;
