import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .optional()
  .nullable()
  .transform((value) => value ?? null);

const optionalClinicId = z
  .union([z.string(), z.number()])
  .optional()
  .transform((value) => {
    if (value === undefined) {
      return undefined;
    }

    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed <= 0) {
      return Number.NaN;
    }

    return parsed;
  })
  .refine((value) => value === undefined || (Number.isInteger(value) && value > 0), {
    message: "clinicId invalido",
  });

export const reportUploadBodySchema = z.object({
  clinicId: optionalClinicId,
  patientName: optionalText,
  studyType: optionalText,
  uploadDate: z
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

export const reportsListQuerySchema = z.object({
  clinicId: optionalClinicId,
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const reportsSearchQuerySchema = z.object({
  clinicId: optionalClinicId,
  query: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .optional(),
  studyType: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .optional(),
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const reportIdParamsSchema = z.object({
  reportId: z.coerce.number().int().positive(),
});
