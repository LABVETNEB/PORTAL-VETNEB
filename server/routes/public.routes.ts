import { Router } from "express";
import rateLimit from "express-rate-limit";

import {
  approvePaymentTransaction,
  createPaymentTransaction,
  getApprovedPaymentTransactionByLinkId,
  getPaymentLinkByToken,
  getPendingPaymentTransactionByLinkId,
  updatePaymentLinkStatus,
} from "../db";
import { zodValidationResponse } from "../lib/validation";
import {
  idempotencyKeySchema,
  paymentLinkTokenParamsSchema,
  publicCheckoutBodySchema,
  publicConfirmBodySchema,
} from "../schemas/payments";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

const checkoutRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Demasiados intentos de checkout. Intente mas tarde.",
  },
});

function isExpired(expiresAt: Date | null): boolean {
  return !!expiresAt && expiresAt.getTime() <= Date.now();
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as { code?: string };
  return maybeError.code === "23505";
}

function parseTokenParams(params: unknown) {
  return paymentLinkTokenParamsSchema.safeParse(params);
}

function parseIdempotencyKey(rawHeader: string | undefined) {
  if (!rawHeader) {
    return null;
  }

  return idempotencyKeySchema.safeParse(rawHeader);
}

router.get(
  "/payment-links/:token",
  asyncHandler(async (req, res) => {
    const parsedParams = parseTokenParams(req.params);

    if (!parsedParams.success) {
      return res.status(400).json(zodValidationResponse(parsedParams.error));
    }

    const paymentLink = await getPaymentLinkByToken(parsedParams.data.token);

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
  checkoutRateLimit,
  asyncHandler(async (req, res) => {
    const parsedParams = parseTokenParams(req.params);

    if (!parsedParams.success) {
      return res.status(400).json(zodValidationResponse(parsedParams.error));
    }

    const parsedBody = publicCheckoutBodySchema.safeParse(req.body ?? {});

    if (!parsedBody.success) {
      return res.status(400).json(zodValidationResponse(parsedBody.error));
    }

    const idempotencyKeyHeader =
      req.header("idempotency-key") ?? req.header("x-idempotency-key") ?? undefined;
    const parsedIdempotencyKey = parseIdempotencyKey(idempotencyKeyHeader);

    if (!parsedIdempotencyKey || !parsedIdempotencyKey.success) {
      return res.status(400).json({
        success: false,
        error: "Header Idempotency-Key requerido e invalido",
      });
    }

    const idempotencyKey = parsedIdempotencyKey.data;
    const paymentLink = await getPaymentLinkByToken(parsedParams.data.token);

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
        error: "Este link esta vencido",
      });
    }

    const existingPending = await getPendingPaymentTransactionByLinkId(paymentLink.id);

    if (existingPending) {
      if (existingPending.idempotencyKey === idempotencyKey) {
        return res.status(200).json({
          success: true,
          message: "Checkout ya iniciado previamente",
          idempotentReplay: true,
          checkout: {
            paymentLinkId: paymentLink.id,
            token: paymentLink.token,
            provider: existingPending.provider,
            providerReference: existingPending.providerReference,
            amountInCents: paymentLink.amountInCents,
            currency: paymentLink.currency,
            transactionId: existingPending.id,
            idempotencyKey,
          },
        });
      }

      return res.status(409).json({
        success: false,
        error: "Ya existe un checkout pendiente para este link",
      });
    }

    const { provider, providerReference } = parsedBody.data;
    const payload = JSON.stringify(req.body ?? {});

    try {
      const transaction = await createPaymentTransaction({
        paymentLinkId: paymentLink.id,
        provider,
        providerReference,
        idempotencyKey,
        status: "pending",
        amountInCents: paymentLink.amountInCents,
        currency: paymentLink.currency,
        rawPayload: payload,
      });

      return res.status(201).json({
        success: true,
        message: "Checkout iniciado",
        idempotentReplay: false,
        checkout: {
          paymentLinkId: paymentLink.id,
          token: paymentLink.token,
          provider,
          providerReference,
          amountInCents: paymentLink.amountInCents,
          currency: paymentLink.currency,
          transactionId: transaction.id,
          idempotencyKey,
        },
      });
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }

      const pendingAfterRace = await getPendingPaymentTransactionByLinkId(paymentLink.id);

      if (pendingAfterRace && pendingAfterRace.idempotencyKey === idempotencyKey) {
        return res.status(200).json({
          success: true,
          message: "Checkout ya iniciado previamente",
          idempotentReplay: true,
          checkout: {
            paymentLinkId: paymentLink.id,
            token: paymentLink.token,
            provider: pendingAfterRace.provider,
            providerReference: pendingAfterRace.providerReference,
            amountInCents: paymentLink.amountInCents,
            currency: paymentLink.currency,
            transactionId: pendingAfterRace.id,
            idempotencyKey,
          },
        });
      }

      return res.status(409).json({
        success: false,
        error: "Ya existe un checkout pendiente para este link",
      });
    }
  }),
);

router.post(
  "/payment-links/:token/confirm",
  checkoutRateLimit,
  asyncHandler(async (req, res) => {
    const parsedParams = parseTokenParams(req.params);

    if (!parsedParams.success) {
      return res.status(400).json(zodValidationResponse(parsedParams.error));
    }

    const parsedBody = publicConfirmBodySchema.safeParse(req.body ?? {});

    if (!parsedBody.success) {
      return res.status(400).json(zodValidationResponse(parsedBody.error));
    }

    const paymentLink = await getPaymentLinkByToken(parsedParams.data.token);

    if (!paymentLink) {
      return res.status(404).json({
        success: false,
        error: "Link de pago no encontrado",
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
        error: "Este link esta vencido",
      });
    }

    const { provider, providerReference } = parsedBody.data;
    const payload = JSON.stringify(req.body ?? {});

    const existingApproved = await getApprovedPaymentTransactionByLinkId(paymentLink.id);

    if (paymentLink.status === "paid" && existingApproved) {
      return res.status(200).json({
        success: true,
        message: "Pago ya confirmado anteriormente",
        paymentLink,
        transaction: existingApproved,
      });
    }

    if (paymentLink.status === "paid" && !existingApproved) {
      return res.status(409).json({
        success: false,
        error: "Este link ya fue pagado",
      });
    }

    let transaction = existingApproved;

    if (!transaction) {
      const pending = await getPendingPaymentTransactionByLinkId(paymentLink.id);

      if (pending) {
        try {
          transaction = await approvePaymentTransaction({
            transactionId: pending.id,
            provider,
            providerReference,
            rawPayload: payload,
          });
        } catch (error) {
          if (!isUniqueViolation(error)) {
            throw error;
          }

          transaction = await getApprovedPaymentTransactionByLinkId(paymentLink.id);
        }
      } else {
        try {
          transaction = await createPaymentTransaction({
            paymentLinkId: paymentLink.id,
            provider,
            providerReference,
            status: "approved",
            amountInCents: paymentLink.amountInCents,
            currency: paymentLink.currency,
            rawPayload: payload,
          });
        } catch (error) {
          if (!isUniqueViolation(error)) {
            throw error;
          }

          transaction = await getApprovedPaymentTransactionByLinkId(paymentLink.id);
        }
      }
    }

    if (!transaction) {
      return res.status(409).json({
        success: false,
        error: "No se pudo confirmar el pago de forma segura",
      });
    }

    const updatedPaymentLink =
      paymentLink.status === "paid"
        ? paymentLink
        : (await updatePaymentLinkStatus({
            paymentLinkId: paymentLink.id,
            status: "paid",
            paidAt: new Date(),
          })) ?? paymentLink;

    return res.json({
      success: true,
      message: "Pago confirmado",
      paymentLink: updatedPaymentLink,
      transaction,
    });
  }),
);

export default router;
