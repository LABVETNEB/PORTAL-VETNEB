import crypto from "node:crypto";

import type {
  ParticularToken,
  Report,
  StudyTrackingCase,
} from "../../../../drizzle/schema.ts";
import { AUDIT_EVENTS, buildAuditLogInsert } from "../../../lib/audit.ts";
import { isSafeRequestId } from "../../../lib/http/api-request-id.ts";
import { logError, logInfo, logWarn } from "../../../lib/logger.ts";
import { ensureStudyTrackingCaseForToken } from "../../study-tracking/index.ts";
import {
  ReportPersistenceCommitUnknownError,
  ReportUploadPersistenceError,
  type ReportStorageCompensationLog,
  type ReportUploadPersistenceScope,
} from "../application/index.ts";
import type { ReportCommandTransaction } from "../infrastructure/index.ts";

type UploadScope = ReportUploadPersistenceScope<
  Report,
  ParticularToken,
  StudyTrackingCase
>;

export type ReportUploadScopeParts = {
  lockParticularToken: UploadScope["lockParticularToken"];
  createOrEditReport: (
    input: Parameters<UploadScope["createOrEditReport"]>[0],
  ) => Promise<Report>;
  updateParticularTokenReport: UploadScope["updateParticularTokenReport"];
  getParticularStudyTrackingCase: UploadScope["getParticularStudyTrackingCase"];
  getStudyTrackingCaseByReportId: UploadScope["getStudyTrackingCaseByReportId"];
  createStudyTrackingCase: (
    input: Omit<StudyTrackingCase, "id" | "createdAt" | "updatedAt">,
  ) => Promise<StudyTrackingCase>;
  updateStudyTrackingCase: (
    id: number,
    input: Partial<Omit<StudyTrackingCase, "id" | "createdAt" | "updatedAt">>,
  ) => Promise<StudyTrackingCase | null | undefined>;
  createReportDeliveredNotification: UploadScope["createReportDeliveredNotification"];
  writeReportUploadedAudit: UploadScope["writeReportUploadedAudit"];
};

type DeliveredNotificationInput = Parameters<
  UploadScope["createReportDeliveredNotification"]
>[0];

/**
 * Unico sitio best-effort de la notificacion: devuelve el fallo en vez de
 * lanzarlo para que el servicio lo registre sin abortar la subida.
 */
export function createBestEffortNotificationWriter(
  write: (input: DeliveredNotificationInput) => Promise<unknown>,
): UploadScope["createReportDeliveredNotification"] {
  return async (input) => {
    try {
      await write(input);
      return { created: true };
    } catch (error) {
      return { created: false, error };
    }
  };
}

/**
 * Arma el scope de escrituras de una subida. Dentro de una transaccion, un
 * update de tracking sin fila afectada es un fallo (no se continua con el
 * registro anterior): el throw revierte toda la unidad.
 */
export function buildReportUploadScope(
  parts: ReportUploadScopeParts,
): UploadScope {
  const failClosedUpdateStudyTrackingCase: ReportUploadScopeParts["updateStudyTrackingCase"] =
    async (id, input) => {
      const updated = await parts.updateStudyTrackingCase(id, input);

      if (!updated) {
        throw new ReportUploadPersistenceError("tracking_write_failed");
      }

      return updated;
    };

  return {
    lockParticularToken: parts.lockParticularToken,
    createOrEditReport: parts.createOrEditReport,
    updateParticularTokenReport: parts.updateParticularTokenReport,
    getParticularStudyTrackingCase: parts.getParticularStudyTrackingCase,
    getStudyTrackingCaseByReportId: parts.getStudyTrackingCaseByReportId,
    updateStudyTrackingCase: parts.updateStudyTrackingCase,
    createReportDeliveredNotification: parts.createReportDeliveredNotification,
    writeReportUploadedAudit: parts.writeReportUploadedAudit,
    ensureStudyTrackingCaseForToken: (token, input) =>
      ensureStudyTrackingCaseForToken(
        {
          getParticularStudyTrackingCase: parts.getParticularStudyTrackingCase,
          getStudyTrackingCaseByReportId: parts.getStudyTrackingCaseByReportId,
          createStudyTrackingCase: parts.createStudyTrackingCase,
          updateStudyTrackingCase: failClosedUpdateStudyTrackingCase,
        },
        {
          token,
          createdByAdminId: input.adminUserId,
          createdByClinicUserId: token.createdByClinicUserId ?? null,
          now: input.now,
        },
      ),
  };
}

/** Sin transaccion: usado cuando las dependencias se inyectan explicitamente. */
export function createPassthroughReportPersistenceRunner(
  parts: ReportUploadScopeParts,
) {
  return async <TResult>(
    work: (scope: UploadScope) => Promise<TResult>,
  ): Promise<TResult> => work(buildReportUploadScope(parts));
}

/**
 * Ejecuta `work` dentro de una unica transaccion. Si `work` lanza, la
 * transaccion se revierte y el error se propaga intacto (rollback seguro).
 * Si `work` termina y el COMMIT falla, el resultado es ambiguo.
 */
export function createTransactionalReportPersistenceRunner<TTx>(options: {
  transact: <TResult>(fn: (tx: TTx) => Promise<TResult>) => Promise<TResult>;
  bindScope: (tx: TTx) => UploadScope;
}) {
  return async <TResult>(
    work: (scope: UploadScope) => Promise<TResult>,
  ): Promise<TResult> => {
    let workCompleted = false;

    try {
      return await options.transact(async (tx) => {
        const result = await work(options.bindScope(tx));
        workCompleted = true;
        return result;
      });
    } catch (error) {
      if (workCompleted) {
        throw new ReportPersistenceCommitUnknownError({ cause: error });
      }

      throw error;
    }
  };
}

/**
 * Partes reales de la unidad de subida ligadas a una transaccion. Se exporta
 * separado para que las pruebas inyecten fallos sobre las mismas partes que usa
 * produccion, sin copiar su armado.
 */
export async function loadReportUploadTransactionalParts() {
  const [reportInfrastructure, trackingFeature, particularFeature, dbAudit] =
    await Promise.all([
      import("../infrastructure/index.ts"),
      import("../../study-tracking/index.ts").then(
        ({ loadReportUploadStudyTrackingPersistence }) =>
          loadReportUploadStudyTrackingPersistence(),
      ),
      import("../../particular-access/index.ts").then(
        ({ loadReportUploadParticularAccessPersistence }) =>
          loadReportUploadParticularAccessPersistence(),
      ),
      import("../../../db-audit.ts"),
    ]);

  return {
    reportInfrastructure,
    bindParts: (tx: ReportCommandTransaction): ReportUploadScopeParts => {
      const operationTimestamp = new Date();
      const tracking =
        trackingFeature.createTransactionalStudyTrackingRepository(tx);
      const tokens =
        particularFeature.createTransactionalParticularTokenRepository(tx);

      return {
        lockParticularToken: tokens.lockParticularTokenForUpdate,
        createOrEditReport: (input) =>
          reportInfrastructure.createOrEditReportWithinTransaction(
            tx,
            input,
            operationTimestamp,
          ),
        updateParticularTokenReport: tokens.updateParticularTokenReport,
        getParticularStudyTrackingCase: tracking.getParticularStudyTrackingCase,
        getStudyTrackingCaseByReportId: tracking.getStudyTrackingCaseByReportId,
        createStudyTrackingCase: tracking.createStudyTrackingCase,
        updateStudyTrackingCase: tracking.updateStudyTrackingCase,
        createReportDeliveredNotification: createBestEffortNotificationWriter(
          tracking.createStudyTrackingNotificationInSavepoint,
        ),
        writeReportUploadedAudit: async (auditContext, input) => {
          if (input.event !== AUDIT_EVENTS.REPORT_UPLOADED) {
            throw new Error("report upload audit event mismatch");
          }

          // Misma fila que la auditoria normal, pero en la transaccion de la subida.
          await dbAudit.createAuditLogWithinTransaction(
            tx,
            buildAuditLogInsert(
              auditContext as Parameters<typeof buildAuditLogInsert>[0],
              {
                event: AUDIT_EVENTS.REPORT_UPLOADED,
                clinicId: input.clinicId,
                reportId: input.reportId,
                metadata: input.metadata,
              },
            ),
          );
        },
      };
    },
  };
}

export async function loadReportUploadPersistence() {
  const { reportInfrastructure, bindParts } =
    await loadReportUploadTransactionalParts();

  const runReportPersistence =
    createTransactionalReportPersistenceRunner<ReportCommandTransaction>({
      transact: (fn) => reportInfrastructure.runReportUploadTransaction(fn),
      bindScope: (tx) => buildReportUploadScope(bindParts(tx)),
    });

  const reportRepository = reportInfrastructure.createReportCommandRepository();

  return {
    runReportPersistence,
    isReportStoragePathPersisted: (storagePath: string) =>
      reportRepository.isStoragePathReferenced(storagePath),
    findPersistedReportByStoragePath: (storagePath: string) =>
      reportRepository.findReportByStoragePath(storagePath),
  };
}

const OBJECT_REF_PATTERN = /^clinics\/\d+\/(\d{10,}-[0-9a-f]{12})-/;

/**
 * Log estructurado y sanitizado: nunca incluye el path completo (el nombre de
 * archivo puede identificar a un paciente) ni mensajes de error. Conserva el
 * segmento `<timestamp>-<random>` y un digest SHA-256 para recuperacion segura.
 */
export function logReportStorageCompensation(
  input: ReportStorageCompensationLog,
) {
  const objectRef = OBJECT_REF_PATTERN.exec(input.storagePath)?.[1] ?? null;
  const context = {
    outcome: input.outcome,
    clinicId: input.clinicId,
    objectRef,
    pathDigest: crypto.hash("sha256", input.storagePath, "hex"),
    // El logger promueve requestId al nivel del evento; solo UUID v4 validos.
    ...(isSafeRequestId(input.requestId)
      ? { requestId: input.requestId }
      : {}),
    persistError: input.persistErrorName,
    ...(input.errorName ? { cleanupError: input.errorName } : {}),
    ...(input.verification ? { verification: input.verification } : {}),
  };

  if (input.outcome === "deleted") {
    logInfo("REPORT_UPLOAD_STORAGE_COMPENSATION", context);
    return;
  }

  if (
    input.outcome === "preserved_referenced" ||
    input.outcome === "commit_confirmed"
  ) {
    logWarn("REPORT_UPLOAD_STORAGE_COMPENSATION", context);
    return;
  }

  logError("REPORT_UPLOAD_STORAGE_COMPENSATION", context);
}
