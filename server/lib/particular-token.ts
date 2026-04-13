import { z } from "zod";
import type { ParticularToken, Report } from "../../drizzle/schema";

const requiredText = (max: number, label: string) =>
  z.string().trim().min(1, `${label} es obligatorio`).max(max);

const optionalDetails = z
  .string()
  .trim()
  .max(10000, "detallesLesion no puede superar 10000 caracteres")
  .optional()
  .transform((value) => {
    if (typeof value !== "string") {
      return undefined;
    }

    return value.length > 0 ? value : undefined;
  });

const reportIdSchema = z.union([
  z.coerce.number().int().positive(),
  z.null(),
  z.undefined(),
]);

export const particularTokenBaseSchema = z.object({
  tutorLastName: requiredText(255, "Tutor: apellido"),
  petName: requiredText(255, "Mascota: nombre"),
  petAge: requiredText(100, "Mascota: edad"),
  petBreed: requiredText(255, "Mascota: raza"),
  petSex: requiredText(50, "Mascota: sexo"),
  petSpecies: requiredText(100, "Mascota: especie"),
  sampleLocation: requiredText(5000, "Muestra: zona de localización"),
  sampleEvolution: requiredText(5000, "Muestra: evolución"),
  extractionDate: z.coerce.date({
    invalid_type_error: "Fecha de extracción inválida",
  }),
  shippingDate: z.coerce.date({
    invalid_type_error: "Fecha de envío inválida",
  }),
  detailsLesion: optionalDetails,
  reportId: reportIdSchema,
});

export const adminCreateParticularTokenSchema = particularTokenBaseSchema.extend({
  clinicId: z.coerce.number().int().positive("clinicId es obligatorio"),
});

export const clinicCreateParticularTokenSchema = particularTokenBaseSchema;

export const updateParticularTokenReportSchema = z.object({
  reportId: z.union([z.coerce.number().int().positive(), z.null()]),
});

export function parsePositiveInt(
  value: unknown,
  fallback: number,
  max?: number,
): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  if (typeof max === "number") {
    return Math.min(parsed, max);
  }

  return parsed;
}

export function parseOffset(value: unknown, fallback = 0): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

export function parseEntityId(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export function buildValidationError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Datos inválidos";
}

export function serializeParticularToken(token: ParticularToken) {
  return {
    id: token.id,
    clinicId: token.clinicId,
    reportId: token.reportId,
    tokenLast4: token.tokenLast4,
    tutorLastName: token.tutorLastName,
    petName: token.petName,
    petAge: token.petAge,
    petBreed: token.petBreed,
    petSex: token.petSex,
    petSpecies: token.petSpecies,
    sampleLocation: token.sampleLocation,
    sampleEvolution: token.sampleEvolution,
    detailsLesion: token.detailsLesion,
    extractionDate: token.extractionDate,
    shippingDate: token.shippingDate,
    isActive: token.isActive,
    lastLoginAt: token.lastLoginAt,
    createdAt: token.createdAt,
    updatedAt: token.updatedAt,
    createdByAdminId: token.createdByAdminId,
    createdByClinicUserId: token.createdByClinicUserId,
    hasLinkedReport: typeof token.reportId === "number",
  };
}

export function serializeParticularTokenDetail(
  token: ParticularToken,
  report?: Report | null,
) {
  return {
    ...serializeParticularToken(token),
    report: report
      ? {
          id: report.id,
          clinicId: report.clinicId,
          uploadDate: report.uploadDate,
          studyType: report.studyType,
          patientName: report.patientName,
          fileName: report.fileName,
          createdAt: report.createdAt,
          updatedAt: report.updatedAt,
        }
      : null,
  };
}
