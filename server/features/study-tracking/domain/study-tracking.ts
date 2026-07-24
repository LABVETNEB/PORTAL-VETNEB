import { z } from "zod";
import type {
  StudyTrackingCase,
  StudyTrackingNotification,
} from "../../../../drizzle/schema.ts";

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
  .union([z.null(), z.undefined(), z.coerce.date()])
  .transform((value) => {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
      return undefined;
    }

    return value;
  });

const nullablePatchDateSchema = z
  .union([z.null(), z.undefined(), z.coerce.date()])
  .transform((value) => {
    if (value === null) {
      return null;
    }

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

    if (["true", "1", "yes", "si", "sí"].includes(normalized)) {
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

const createStudyTrackingSchemaBase = z.object({
  clinicId: z.coerce.number().int().positive("clinicId es obligatorio"),
  reportId: optionalPositiveEntitySchema,
  particularTokenId: optionalPositiveEntitySchema,
  labReceivedAt: optionalDateSchema,
  receptionAt: optionalDateSchema,
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
    "adminContactEmail inválido",
  ),
  adminContactPhone: optionalTrimmedText(50, "adminContactPhone"),
  notes: optionalTrimmedText(10000, "notes"),
});

function requireLabReceivedAt(
  value: { labReceivedAt?: Date; receptionAt?: Date },
  ctx: z.RefinementCtx,
) {
  if (value.labReceivedAt instanceof Date || value.receptionAt instanceof Date) {
    return;
  }

  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    path: ["labReceivedAt"],
    message: "labReceivedAt es obligatorio",
  });
}

function normalizeLabReceivedAt<T extends { labReceivedAt?: Date; receptionAt?: Date }>(
  value: T,
): T & { labReceivedAt: Date; receptionAt: Date } {
  const labReceivedAt = (value.labReceivedAt ?? value.receptionAt) as Date;

  return {
    ...value,
    labReceivedAt,
    receptionAt: labReceivedAt,
  };
}

export const adminCreateStudyTrackingSchema = createStudyTrackingSchemaBase
  .superRefine(requireLabReceivedAt)
  .transform(normalizeLabReceivedAt);

export const clinicCreateStudyTrackingSchema = createStudyTrackingSchemaBase.omit({
  clinicId: true,
  labReceivedAt: true,
  estimatedDeliveryAt: true,
}).superRefine((value, ctx) => {
  if (value.receptionAt instanceof Date) {
    return;
  }

  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    path: ["receptionAt"],
    message: "receptionAt es obligatorio",
  });
}).transform((value) => ({
  ...value,
  receptionAt: value.receptionAt as Date,
}));

export const updateStudyTrackingSchema = z.object({
  reportId: z.union([z.coerce.number().int().positive(), z.null(), z.undefined()]),
  particularTokenId: z.union([
    z.coerce.number().int().positive(),
    z.null(),
    z.undefined(),
  ]),
  labReceivedAt: optionalDateSchema,
  receptionAt: optionalDateSchema,
  estimatedDeliveryAt: nullablePatchDateSchema,
  currentStage: stageSchema.optional(),
  processingAt: nullablePatchDateSchema,
  evaluationAt: nullablePatchDateSchema,
  reportDevelopmentAt: nullablePatchDateSchema,
  deliveredAt: nullablePatchDateSchema,
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
    "adminContactEmail inválido",
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
}).transform((value) => {
  const labReceivedAt = value.labReceivedAt ?? value.receptionAt;

  return {
    ...value,
    labReceivedAt,
    receptionAt: labReceivedAt,
  };
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

  if (["true", "1", "yes", "si", "sí"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no"].includes(normalized)) {
    return false;
  }

  return undefined;
}

export function buildValidationError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Datos inválidos";
}

const ISO_DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function formatHolidayKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function dateToISODateKey(date: Date): string {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new Error("labReceivedAt inválido");
  }

  return formatHolidayKey(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
  );
}

function assertISODateKey(value: string): string {
  if (!ISO_DATE_KEY_PATTERN.test(value)) {
    throw new Error("dateISO inválido");
  }

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (Number.isNaN(parsed.getTime()) || dateToISODateKey(parsed) !== value) {
    throw new Error("dateISO inválido");
  }

  return value;
}

function normalizeDateKey(value: Date | string): string {
  if (typeof value === "string") {
    if (ISO_DATE_KEY_PATTERN.test(value)) {
      return assertISODateKey(value);
    }

    const parsed = new Date(value);
    return dateToISODateKey(parsed);
  }

  return dateToISODateKey(value);
}

function dateKeyToUtcDate(value: string): Date {
  const key = assertISODateKey(value);
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function addDaysToDateKey(value: string, days: number): string {
  const next = dateKeyToUtcDate(value);
  next.setUTCDate(next.getUTCDate() + days);
  return dateToISODateKey(next);
}

function getYearFromDateKey(value: string): number {
  return Number(assertISODateKey(value).slice(0, 4));
}

export const argentinaHolidaysByYear: Record<number, readonly string[]> = {
  2026: [
    "2026-01-01",
    "2026-02-16",
    "2026-02-17",
    "2026-03-23",
    "2026-03-24",
    "2026-04-02",
    "2026-04-03",
    "2026-05-01",
    "2026-05-25",
    "2026-06-15",
    "2026-06-20",
    "2026-07-09",
    "2026-07-10",
    "2026-08-17",
    "2026-10-12",
    "2026-11-23",
    "2026-12-07",
    "2026-12-08",
    "2026-12-25",
  ],
};

export function getArgentinaNonWorkingDates(year: number): Set<string> {
  return new Set(argentinaHolidaysByYear[year] ?? []);
}

export function getArgentinaNationalHolidayKeys(year: number): Set<string> {
  return getArgentinaNonWorkingDates(year);
}

export function isSunday(value: Date | string): boolean {
  return dateKeyToUtcDate(normalizeDateKey(value)).getUTCDay() === 0;
}

export function isSaturday(value: Date | string): boolean {
  return dateKeyToUtcDate(normalizeDateKey(value)).getUTCDay() === 6;
}

export function isArgentinaNationalHoliday(value: Date | string): boolean {
  const dateKey = normalizeDateKey(value);
  const keys = getArgentinaNonWorkingDates(getYearFromDateKey(dateKey));
  return keys.has(dateKey);
}

export function getWorkingDayWeight(value: Date | string): 1 | 0.5 | 0 {
  if (isArgentinaNationalHoliday(value) || isSunday(value)) {
    return 0;
  }

  if (isSaturday(value)) {
    return 0.5;
  }

  return 1;
}

export function getBusinessDayWeight(value: Date | string): 1 | 0.5 | 0 {
  return getWorkingDayWeight(value);
}

export function addBusinessDaysFromLabReceivedDate(
  startDateISO: string,
  amount = 15,
): string {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("amount inválido");
  }

  const startDateKey = assertISODateKey(startDateISO);

  if (amount === 0) {
    return startDateKey;
  }

  let remaining = amount;
  let cursor = addDaysToDateKey(startDateKey, 1);

  while (remaining > 0) {
    const weight = getWorkingDayWeight(cursor);

    if (weight > 0) {
      remaining = Number((remaining - weight).toFixed(2));

      if (remaining <= 0) {
        return cursor;
      }
    }

    cursor = addDaysToDateKey(cursor, 1);
  }

  return cursor;
}

export function calculateEstimatedDeliveryAt(
  labReceivedAt: Date,
  requiredBusinessDays = 15,
): Date {
  if (!(labReceivedAt instanceof Date) || Number.isNaN(labReceivedAt.getTime())) {
    throw new Error("labReceivedAt inválido");
  }

  return dateKeyToUtcDate(
    addBusinessDaysFromLabReceivedDate(
      dateToISODateKey(labReceivedAt),
      requiredBusinessDays,
    ),
  );
}

export function applyEstimatedDeliveryRules(input: {
  labReceivedAt?: Date;
  receptionAt?: Date;
  manualEstimatedDeliveryAt?: Date | null;
}) {
  const labReceivedAt = input.labReceivedAt ?? input.receptionAt;

  if (!(labReceivedAt instanceof Date) || Number.isNaN(labReceivedAt.getTime())) {
    throw new Error("labReceivedAt inválido");
  }

  const estimatedDeliveryAutoCalculatedAt = calculateEstimatedDeliveryAt(
    labReceivedAt,
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
    labReceivedAt: trackingCase.receptionAt,
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
