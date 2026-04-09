import { z } from "zod";

const optionalTrimmedString = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .optional()
  .nullable()
  .transform((value) => {
    if (value === null || value === undefined) {
      return null;
    }

    return value;
  });

const paymentStatusSchema = z.enum(["pending", "paid", "cancelled", "expired"]);

export const paymentLinkCreateBodySchema = z.object({
  amountInCents: z.coerce.number().int().positive(),
  patientName: optionalTrimmedString,
  patientEmail: z
    .string()
    .trim()
    .email()
    .max(255)
    .optional()
    .nullable()
    .transform((value) => (value ? value.toLowerCase() : null)),
  description: z
    .string()
    .trim()
    .min(1)
    .max(2000)
    .optional()
    .nullable()
    .transform((value) => (value ?? null)),
  currency: z
    .string()
    .trim()
    .min(3)
    .max(10)
    .optional()
    .transform((value) => (value ? value.toUpperCase() : "ARS")),
  expiresAt: z
    .preprocess((value) => {
      if (value === null || value === undefined || value === "") {
        return null;
      }

      const parsed = new Date(String(value));
      return Number.isNaN(parsed.getTime()) ? Number.NaN : parsed;
    }, z.date().nullable())
    .optional()
    .transform((value) => value ?? null),
});

export const paymentLinksQuerySchema = z.object({
  status: paymentStatusSchema.optional(),
});

export const adminPaymentLinksQuerySchema = z.object({
  status: paymentStatusSchema.optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
});

export const paymentLinkTokenParamsSchema = z.object({
  token: z.string().trim().min(16).max(128),
});

export const publicCheckoutBodySchema = z.object({
  provider: z.string().trim().min(1).max(50).optional().default("manual"),
  providerReference: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .optional()
    .nullable()
    .transform((value) => value ?? null),
});

export const publicConfirmBodySchema = z.object({
  provider: z.string().trim().min(1).max(50).optional().default("manual"),
  providerReference: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .optional()
    .nullable()
    .transform((value) => value ?? null),
});

export const idempotencyKeySchema = z
  .string()
  .trim()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/);
