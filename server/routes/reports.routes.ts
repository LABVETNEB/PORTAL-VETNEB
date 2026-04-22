import { Router } from "express";
import multer from "multer";
import type { Report, ReportStatus } from "../../drizzle/schema";
import {
  getReportById,
  getReportStatusHistory,
  getReportsByClinicId,
  getStudyTypes,
  searchReports,
  updateReportStatus,
  upsertReport,
} from "../db";
import {
  getClinicScopedStudyTrackingCase,
  updateStudyTrackingCase,
} from "../db-study-tracking";
import {
  REPORT_STATUSES,
  canTransitionReportStatus,
  normalizeReportStatus,
} from "../lib/report-status";
import { AUDIT_EVENTS, writeAuditLog } from "../lib/audit";
import { ENV } from "../lib/env";
import {
  ALLOWED_MIME_TYPES,
  createSignedReportDownloadUrl,
  createSignedReportUrl,
  uploadReport,
} from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";
import { requireTrustedOrigin } from "../middlewares/trusted-origin";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

const allowedMimeTypes = new Set(ALLOWED_MIME_TYPES);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: ENV.maxUploadFileSizeMb * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (
      !allowedMimeTypes.has(
        file.mimetype as (typeof ALLOWED_MIME_TYPES)[number],
      )
    ) {
      cb(new Error("Tipo de archivo no permitido"));
      return;
    }

    cb(null, true);
  },
});

function parsePositiveInt(value: unknown, fallback: number, max?: number) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  if (typeof max === "number") {
    return Math.min(parsed, max);
  }

  return parsed;
}

function parseOffset(value: unknown, fallback = 0) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

function normalizeSearchText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeOptionalNote(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 2000) : null;
}

function parseOptionalDate(value: unknown): Date | undefined {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function parseClinicId(value: unknown): number | undefined {
  const parsed = Number(value);

  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }

  return undefined;
}

function parseReportStatus(value: unknown): ReportStatus | undefined {
  return normalizeReportStatus(value);
}

function getReadClinicScope(reqClinicId: unknown, authClinicId: number) {
  const requestedClinicId = parseClinicId(reqClinicId);

  if (requestedClinicId && requestedClinicId !== authClinicId) {
    return {
      clinicId: authClinicId,
      isForbidden: true,
    };
  }

  return {
    clinicId: authClinicId,
    isForbidden: false,
  };
}

function parseReportId(value: unknown): number | undefined {
  const reportId = Number(value);
  return Number.isInteger(reportId) && reportId > 0 ? reportId : undefined;
}

async function getAuthorizedReport(
  reportId: number,
  clinicId: number,
  unauthorizedMessage: string,
): Promise<{ report: Report } | { status: 403 | 404; error: string }> {
  const report = await getReportById(reportId);

  if (!report) {
    return {
      status: 404,
      error: "Informe no encontrado",
    };
  }

  if (report.clinicId !== clinicId) {
    return {
      status: 403,
      error: unauthorizedMessage,
    };
  }

  return {
    report,
  };
}

async function serializeReport(report: Report) {
  const [previewUrl, downloadUrl] = await Promise.all([
    createSignedReportUrl(report.storagePath),
    createSignedReportDownloadUrl(
      report.storagePath,
      report.fileName ?? undefined,
    ),
  ]);

  return {
    ...report,
    previewUrl,
    downloadUrl,
  };
}

async function serializeReports(reports: Report[]) {
  return Promise.all(reports.map((report) => serializeReport(report)));
}

router.use(requireTrustedOrigin);
router.use(requireAuth);

const requireUploadPermission = asyncHandler(async (req, res, next) => {
  if (!req.auth?.canUploadReports) {
    return res.status(403).json({
      success: false,
      error: "No autorizado para subir informes",
    });
  }

  next();
});

const requireReportStatusWritePermission = asyncHandler(async (req, res, next) => {
  if (!req.auth?.canManageClinicUsers) {
    return res.status(403).json({
      success: false,
      error: "No autorizado para cambiar el estado de informes",
    });
  }

  next();
});

router.post(
  "/upload",
  requireUploadPermission,
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No se proporciono ningun archivo",
      });
    }

    const clinicId = req.auth!.clinicId;

    const storagePath = await uploadReport({
      file: req.file.buffer,
      fileName: req.file.originalname,
      clinicId,
      mimeType: req.file.mimetype,
    });

    const patientName = normalizeSearchText(req.body?.patientName);
    const studyType = normalizeSearchText(req.body?.studyType);
    const uploadDate = parseOptionalDate(req.body?.uploadDate);
    const trackingCaseId = parseReportId(req.body?.trackingCaseId);

    if (typeof trackingCaseId === "number") {
      const trackingCase = await getClinicScopedStudyTrackingCase(
        trackingCaseId,
        clinicId,
      );

      if (!trackingCase) {
        return res.status(404).json({
          success: false,
          error: "Seguimiento no encontrado para la clínica autenticada",
        });
      }
    }

    const report = await upsertReport({
      clinicId,
      patientName: patientName ?? null,
      studyType: studyType ?? null,
      uploadDate: uploadDate ?? null,
      fileName: req.file.originalname,
      storagePath,
      createdByClinicUserId: req.auth!.id,
    });

    if (typeof trackingCaseId === "number") {
      await updateStudyTrackingCase(trackingCaseId, {
        reportId: report.id,
      });
    }

    return res.status(201).json({
      success: true,
      message: "Archivo subido correctamente",
      report: await serializeReport(report),
    });
  }),
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const scope = getReadClinicScope(req.query.clinicId, req.auth!.clinicId);
    const currentStatus = parseReportStatus(req.query.status);
    const limit = parsePositiveInt(req.query.limit, 50, 100);
    const offset = parseOffset(req.query.offset, 0);

    if (scope.isForbidden) {
      return res.status(403).json({
        success: false,
        error: "No autorizado para consultar otra clinica",
      });
    }

    if (typeof req.query.status !== "undefined" && !currentStatus) {
      return res.status(400).json({
        success: false,
        error: "Estado de informe invalido",
        allowedStatuses: REPORT_STATUSES,
      });
    }

    const clinicId = scope.clinicId;
    const reports = await getReportsByClinicId(
      clinicId,
      limit,
      offset,
      currentStatus,
    );

    return res.json({
      success: true,
      count: reports.length,
      reports: await serializeReports(reports),
      filters: {
        status: currentStatus ?? null,
      },
      pagination: {
        limit,
        offset,
      },
    });
  }),
);

router.get(
  "/search",
  asyncHandler(async (req, res) => {
    const scope = getReadClinicScope(req.query.clinicId, req.auth!.clinicId);
    const query = normalizeSearchText(req.query.query);
    const studyType = normalizeSearchText(req.query.studyType);
    const currentStatus = parseReportStatus(req.query.status);
    const limit = parsePositiveInt(req.query.limit, 50, 100);
    const offset = parseOffset(req.query.offset, 0);

    if (scope.isForbidden) {
      return res.status(403).json({
        success: false,
        error: "No autorizado para consultar otra clinica",
      });
    }

    if (typeof req.query.status !== "undefined" && !currentStatus) {
      return res.status(400).json({
        success: false,
        error: "Estado de informe invalido",
        allowedStatuses: REPORT_STATUSES,
      });
    }

    const clinicId = scope.clinicId;
    const reports = await searchReports(
      clinicId,
      query,
      studyType,
      limit,
      offset,
      currentStatus,
    );

    return res.json({
      success: true,
      count: reports.length,
      reports: await serializeReports(reports),
      filters: {
        query: query ?? null,
        studyType: studyType ?? null,
        status: currentStatus ?? null,
      },
      pagination: {
        limit,
        offset,
      },
    });
  }),
);

router.get(
  "/study-types",
  asyncHandler(async (req, res) => {
    const scope = getReadClinicScope(req.query.clinicId, req.auth!.clinicId);

    if (scope.isForbidden) {
      return res.status(403).json({
        success: false,
        error: "No autorizado para consultar otra clinica",
      });
    }

    const clinicId = scope.clinicId;
    const studyTypes = await getStudyTypes(clinicId);

    return res.json({
      success: true,
      studyTypes,
    });
  }),
);

router.get(
  "/:reportId/history",
  asyncHandler(async (req, res) => {
    const reportId = parseReportId(req.params.reportId);

    if (typeof reportId !== "number") {
      return res.status(400).json({
        success: false,
        error: "ID de informe invalido",
      });
    }

    const reportResult = await getAuthorizedReport(
      reportId,
      req.auth!.clinicId,
      "No autorizado para consultar el historial de este informe",
    );

    if (!("report" in reportResult)) {
      return res.status(reportResult.status).json({
        success: false,
        error: reportResult.error,
      });
    }

    const history = await getReportStatusHistory(reportId);

    return res.json({
      success: true,
      reportId,
      currentStatus: reportResult.report.currentStatus,
      count: history.length,
      history,
    });
  }),
);

router.patch(
  "/:reportId/status",
  requireReportStatusWritePermission,
  asyncHandler(async (req, res) => {
    const reportId = parseReportId(req.params.reportId);
    const nextStatus = parseReportStatus(req.body?.status);
    const note = normalizeOptionalNote(req.body?.note);

    if (typeof reportId !== "number") {
      return res.status(400).json({
        success: false,
        error: "ID de informe invalido",
      });
    }

    if (!nextStatus) {
      return res.status(400).json({
        success: false,
        error: "Estado de informe invalido",
        allowedStatuses: REPORT_STATUSES,
      });
    }

    const reportResult = await getAuthorizedReport(
      reportId,
      req.auth!.clinicId,
      "No autorizado para cambiar el estado de este informe",
    );

    if (!("report" in reportResult)) {
      return res.status(reportResult.status).json({
        success: false,
        error: reportResult.error,
      });
    }

    if (reportResult.report.currentStatus === nextStatus) {
      return res.status(400).json({
        success: false,
        error: "El informe ya se encuentra en ese estado",
      });
    }

    if (!canTransitionReportStatus(reportResult.report.currentStatus, nextStatus)) {
      return res.status(400).json({
        success: false,
        error: "La transición de estado no está permitida",
        currentStatus: reportResult.report.currentStatus,
        requestedStatus: nextStatus,
        allowedStatuses: REPORT_STATUSES,
      });
    }

    const updated = await updateReportStatus({
      reportId,
      toStatus: nextStatus,
      note,
      changedByClinicUserId: req.auth!.id,
    });

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: "Informe no encontrado",
      });
    }

    await writeAuditLog(req, {
      event: AUDIT_EVENTS.REPORT_STATUS_CHANGED,
      clinicId: updated.clinicId,
      reportId: updated.id,
      metadata: {
        fromStatus: reportResult.report.currentStatus,
        toStatus: nextStatus,
        note,
      },
    });

    return res.json({
      success: true,
      message: "Estado de informe actualizado correctamente",
      report: await serializeReport(updated),
    });
  }),
);

router.get(
  "/:reportId/preview-url",
  asyncHandler(async (req, res) => {
    const reportId = parseReportId(req.params.reportId);

    if (typeof reportId !== "number") {
      return res.status(400).json({
        success: false,
        error: "ID de informe invalido",
      });
    }

    const reportResult = await getAuthorizedReport(
      reportId,
      req.auth!.clinicId,
      "No autorizado para previsualizar este informe",
    );

    if (!("report" in reportResult)) {
      return res.status(reportResult.status).json({
        success: false,
        error: reportResult.error,
      });
    }

    const previewUrl = await createSignedReportUrl(
      reportResult.report.storagePath,
    );

    return res.json({
      success: true,
      previewUrl,
    });
  }),
);

router.get(
  "/:reportId/download-url",
  asyncHandler(async (req, res) => {
    const reportId = parseReportId(req.params.reportId);

    if (typeof reportId !== "number") {
      return res.status(400).json({
        success: false,
        error: "ID de informe invalido",
      });
    }

    const reportResult = await getAuthorizedReport(
      reportId,
      req.auth!.clinicId,
      "No autorizado para descargar este informe",
    );

    if (!("report" in reportResult)) {
      return res.status(reportResult.status).json({
        success: false,
        error: reportResult.error,
      });
    }

    const downloadUrl = await createSignedReportDownloadUrl(
      reportResult.report.storagePath,
      reportResult.report.fileName ?? undefined,
    );

    return res.json({
      success: true,
      downloadUrl,
    });
  }),
);

export default router;
