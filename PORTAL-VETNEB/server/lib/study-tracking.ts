import { z } from "zod";
import type {
  StudyTrackingCase,
  StudyTrackingNotification,
} from "../../drizzle/schema";

export const STUDY_TRACKING_STAGES = [
  "reception",
  "processing",
  "evaluation",
  "report_development",
  "delivered",
] as const;

export type StudyTrackingStage = (typeof STUDY_TRACKING_STAGES)[number];

const stageSchema = z.enum(STUDY_TRACKING_STAGES);

const optionalTrimmedText = (max: number, label: string) =>
  z
    .union([z.string(), z.undefined(), z.null()])
    .transform((value) => {
      if (typeof value !== "string") {
        return undefined;
      }

      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    })
    .refine(
      (value) => typeof value === "undefined" || value.length <= max,
      `${label} no puede superar ${max} caracteres`,
    );

const optionalDateSchema = z
  .union([z.coerce.date(), z.undefined(), z.null()])
  .transform((value) => {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
      return undefined;
    }

    return value;
  });

const booleanishSchema = z
  .union([z.boolean(), z.string(), z.number(), z.undefined()])
  .transform((value) => {
    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "number") {
      return value === 1;
    }

    if (typeof value !== "string") {
      return undefined;
    }

    const normalized = value.trim().toLowerCase();

    if (["true", "1", "yes", "si", "sÃ­"].includes(normalized)) {
      return true;
    }

    if (["false", "0", "no", ""].includes(normalized)) {
      return false;
    }

    return undefined;
  });

const optionalPositiveEntitySchema = z
  .union([z.coerce.number().int().positive(), z.undefined(), z.null()])
  .transform((value) => {
    if (typeof value !== "number") {
      return undefined;
    }

    return value;
  });

export const adminCreateStudyTrackingSchema = z.object({
  clinicId: z.coerce.number().int().positive("clinicId es obligatorio"),
  reportId: optionalPositiveEntitySchema,
  particularTokenId: optionalPositiveEntitySchema,
  receptionAt: z.coerce.date({
    invalid_type_error: "receptionAt es obligatorio",
  }),
  estimatedDeliveryAt: optionalDateSchema,
  currentStage: stageSchema.optional().default("reception"),
  processingAt: optionalDateSchema,
  evaluationAt: optionalDateSchema,
  reportDevelopmentAt: optionalDateSchema,
  deliveredAt: optionalDateSchema,
  specialStainRequired: booleanishSchema.optional().transform((value) => value ?? false),
  paymentUrl: optionalTrimmedText(2000, "paymentUrl"),
  adminContactEmail: optionalTrimmedText(255, "adminContactEmail").refine(
    (value) => typeof value === "undefined" || z.string().email().safeParse(value).success,
    "adminContactEmail invÃ¡lido",
  ),
  adminContactPhone: optionalTrimmedText(50, "adminContactPhone"),
  notes: optionalTrimmedText(10000, "notes"),
});

export const clinicCreateStudyTrackingSchema = adminCreateStudyTrackingSchema.omit({
  clinicId: true,
  estimatedDeliveryAt: true,
});

export const updateStudyTrackingSchema = z.object({
  reportId: z.union([z.coerce.number().int().positive(), z.null(), z.undefined()]),
  particularTokenId: z.union([
    z.coerce.number().int().positive(),
    z.null(),
    z.undefined(),
  ]),
  receptionAt: optionalDateSchema,
  estimatedDeliveryAt: z.union([z.coerce.date(), z.null(), z.undefined()]).transform((value) => {
    if (value === null) {
      return null;
    }

    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
      return undefined;
    }

    return value;
  }),
  currentStage: stageSchema.optional(),
  processingAt: z.union([z.coerce.date(), z.null(), z.undefined()]).transform((value) => {
    if (value === null) {
      return null;
    }

    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
      return undefined;
    }

    return value;
  }),
  evaluationAt: z.union([z.coerce.date(), z.null(), z.undefined()]).transform((value) => {
    if (value === null) {
      return null;
    }

    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
      return undefined;
    }

    return value;
  }),
  reportDevelopmentAt: z.union([z.coerce.date(), z.null(), z.undefined()]).transform((value) => {
    if (value === null) {
      return null;
    }

    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
      return undefined;
    }

    return value;
  }),
  deliveredAt: z.union([z.coerce.date(), z.null(), z.undefined()]).transform((value) => {
    if (value === null) {
      return null;
    }

    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
      return undefined;
    }

    return value;
  }),
  specialStainRequired: booleanishSchema.optional(),
  paymentUrl: z.union([z.string(), z.null(), z.undefined()]).transform((value) => {
    if (value === null) {
      return null;
    }

    if (typeof value !== "string") {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }).refine(
    (value) => value === null || typeof value === "undefined" || value.length <= 2000,
    "paymentUrl no puede superar 2000 caracteres",
  ),
  adminContactEmail: z.union([z.string(), z.null(), z.undefined()]).transform((value) => {
    if (value === null) {
      return null;
    }

    if (typeof value !== "string") {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }).refine(
    (value) =>
      value === null ||
      typeof value === "undefined" ||
      (value.length <= 255 && z.string().email().safeParse(value).success),
    "adminContactEmail invÃ¡lido",
  ),
  adminContactPhone: z.union([z.string(), z.null(), z.undefined()]).transform((value) => {
    if (value === null) {
      return null;
    }

    if (typeof value !== "string") {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }).refine(
    (value) => value === null || typeof value === "undefined" || value.length <= 50,
    "adminContactPhone no puede superar 50 caracteres",
  ),
  notes: z.union([z.string(), z.null(), z.undefined()]).transform((value) => {
    if (value === null) {
      return null;
    }

    if (typeof value !== "string") {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }).refine(
    (value) => value === null || typeof value === "undefined" || value.length <= 10000,
    "notes no puede superar 10000 caracteres",
  ),
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

export function parseBooleanQuery(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();

  if (["true", "1", "yes", "si", "sÃ­"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no"].includes(normalized)) {
    return false;
  }

  return undefined;
}

export function buildValidationError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Datos invÃ¡lidos";
}

function getEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(Date.UTC(year, month - 1, day));
}

function formatHolidayKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function dateToHolidayKey(date: Date): string {
  return formatHolidayKey(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
  );
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function getTransferredHoliday(date: Date): Date {
  const day = date.getUTCDay();

  if (day === 2) {
    return addUtcDays(date, -1);
  }

  if (day === 3) {
    return addUtcDays(date, -2);
  }

  if (day === 4) {
    return addUtcDays(date, 4);
  }

  if (day === 5) {
    return addUtcDays(date, 3);
  }

  return date;
}

export function getArgentinaNationalHolidayKeys(year: number): Set<string> {
  const keys = new Set<string>();

  const addFixed = (month: number, day: number) => {
    keys.add(formatHolidayKey(year, month, day));
  };

  addFixed(1, 1);
  addFixed(3, 24);
  addFixed(4, 2);
  addFixed(5, 1);
  addFixed(5, 25);
  addFixed(6, 20);
  addFixed(7, 9);
  addFixed(12, 8);
  addFixed(12, 25);

  const easterSunday = getEasterSunday(year);
  const carnivalMonday = addUtcDays(easterSunday, -48);
  const carnivalTuesday = addUtcDays(easterSunday, -47);
  const goodFriday = addUtcDays(easterSunday, -2);

  keys.add(dateToHolidayKey(carnivalMonday));
  keys.add(dateToHolidayKey(carnivalTuesday));
  keys.add(dateToHolidayKey(goodFriday));

  const transferredHolidays = [
    new Date(Date.UTC(year, 5, 17)),
    new Date(Date.UTC(year, 7, 17)),
    new Date(Date.UTC(year, 9, 12)),
    new Date(Date.UTC(year, 10, 20)),
  ];

  for (const holiday of transferredHolidays) {
    keys.add(dateToHolidayKey(getTransferredHoliday(holiday)));
  }

  return keys;
}

export function isArgentinaNationalHoliday(date: Date): boolean {
  const year = date.getUTCFullYear();
  const keys = getArgentinaNationalHolidayKeys(year);
  return keys.has(dateToHolidayKey(date));
}

export function getBusinessDayWeight(date: Date): number {
  if (isArgentinaNationalHoliday(date)) {
    return 0;
  }

  const day = date.getUTCDay();

  if (day === 0) {
    return 0;
  }

  if (day === 6) {
    return 0.5;
  }

  return 1;
}

export function calculateEstimatedDeliveryAt(
  receptionAt: Date,
  requiredBusinessDays = 15,
): Date {
  if (!(receptionAt instanceof Date) || Number.isNaN(receptionAt.getTime())) {
    throw new Error("receptionAt invÃ¡lido");
  }

  let remaining = requiredBusinessDays;
  let cursor = new Date(receptionAt.getTime());

  while (remaining > 0) {
    const weight = getBusinessDayWeight(cursor);

    if (weight > 0) {
      remaining = Number((remaining - weight).toFixed(2));

      if (remaining <= 0) {
        return cursor;
      }
    }

    cursor = addUtcDays(cursor, 1);
  }

  return cursor;
}

export function applyEstimatedDeliveryRules(input: {
  receptionAt: Date;
  manualEstimatedDeliveryAt?: Date | null;
}) {
  const estimatedDeliveryAutoCalculatedAt = calculateEstimatedDeliveryAt(
    input.receptionAt,
  );

  if (input.manualEstimatedDeliveryAt instanceof Date) {
    return {
      estimatedDeliveryAt: input.manualEstimatedDeliveryAt,
      estimatedDeliveryAutoCalculatedAt,
      estimatedDeliveryWasManuallyAdjusted:
        input.manualEstimatedDeliveryAt.getTime() !==
        estimatedDeliveryAutoCalculatedAt.getTime(),
    };
  }

  return {
    estimatedDeliveryAt: estimatedDeliveryAutoCalculatedAt,
    estimatedDeliveryAutoCalculatedAt,
    estimatedDeliveryWasManuallyAdjusted: false,
  };
}

export function applyStageTimestampDefaults(
  current: Pick<
    StudyTrackingCase,
    | "processingAt"
    | "evaluationAt"
    | "reportDevelopmentAt"
    | "deliveredAt"
    | "currentStage"
  >,
  patch: {
    currentStage?: StudyTrackingStage;
    processingAt?: Date | null;
    evaluationAt?: Date | null;
    reportDevelopmentAt?: Date | null;
    deliveredAt?: Date | null;
  },
) {
  const next = {
    processingAt: patch.processingAt,
    evaluationAt: patch.evaluationAt,
    reportDevelopmentAt: patch.reportDevelopmentAt,
    deliveredAt: patch.deliveredAt,
  };

  const stage = patch.currentStage ?? current.currentStage;
  const now = new Date();

  if (
    stage === "processing" &&
    typeof next.processingAt === "undefined" &&
    !current.processingAt
  ) {
    next.processingAt = now;
  }

  if (
    stage === "evaluation" &&
    typeof next.evaluationAt === "undefined" &&
    !current.evaluationAt
  ) {
    next.evaluationAt = now;
  }

  if (
    stage === "report_development" &&
    typeof next.reportDevelopmentAt === "undefined" &&
    !current.reportDevelopmentAt
  ) {
    next.reportDevelopmentAt = now;
  }

  if (
    stage === "delivered" &&
    typeof next.deliveredAt === "undefined" &&
    !current.deliveredAt
  ) {
    next.deliveredAt = now;
  }

  return next;
}

export function shouldCreateSpecialStainNotification(input: {
  previousRequired: boolean;
  nextRequired: boolean;
  notifiedAt?: Date | null;
}) {
  if (!input.nextRequired) {
    return false;
  }

  if (input.notifiedAt instanceof Date) {
    return false;
  }

  return !input.previousRequired || input.nextRequired;
}

export function serializeStudyTrackingCase(trackingCase: StudyTrackingCase) {
  return {
    id: trackingCase.id,
    clinicId: trackingCase.clinicId,
    reportId: trackingCase.reportId,
    particularTokenId: trackingCase.particularTokenId,
    createdByAdminId: trackingCase.createdByAdminId,
    createdByClinicUserId: trackingCase.createdByClinicUserId,
    receptionAt: trackingCase.receptionAt,
    estimatedDeliveryAt: trackingCase.estimatedDeliveryAt,
    estimatedDeliveryAutoCalculatedAt:
      trackingCase.estimatedDeliveryAutoCalculatedAt,
    estimatedDeliveryWasManuallyAdjusted:
      trackingCase.estimatedDeliveryWasManuallyAdjusted,
    currentStage: trackingCase.currentStage,
    processingAt: trackingCase.processingAt,
    evaluationAt: trackingCase.evaluationAt,
    reportDevelopmentAt: trackingCase.reportDevelopmentAt,
    deliveredAt: trackingCase.deliveredAt,
    specialStainRequired: trackingCase.specialStainRequired,
    specialStainNotifiedAt: trackingCase.specialStainNotifiedAt,
    paymentUrl: trackingCase.paymentUrl,
    adminContactEmail: trackingCase.adminContactEmail,
    adminContactPhone: trackingCase.adminContactPhone,
    notes: trackingCase.notes,
    createdAt: trackingCase.createdAt,
    updatedAt: trackingCase.updatedAt,
  };
}

export function serializeStudyTrackingNotification(
  notification: StudyTrackingNotification,
) {
  return {
    id: notification.id,
    studyTrackingCaseId: notification.studyTrackingCaseId,
    clinicId: notification.clinicId,
    reportId: notification.reportId,
    particularTokenId: notification.particularTokenId,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    isRead: notification.isRead,
    readAt: notification.readAt,
    createdAt: notification.createdAt,
  };
}
