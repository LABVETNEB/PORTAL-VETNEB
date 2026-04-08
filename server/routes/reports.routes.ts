import { Router } from "express";
import multer from "multer";

import type { Report } from "../../drizzle/schema";
import {
  getReportById,
  getReportsByClinicId,
  getStudyTypes,
  searchReports,
  upsertReport,
} from "../db";
import { auditError, auditInfo, auditWarn } from "../lib/audit";
import { ENV } from "../lib/env";
import { USER_ROLES } from "../lib/permissions";
import {
  ALLOWED_MIME_TYPES,
  createSignedReportDownloadUrl,
  createSignedReportUrl,
  uploadReport,
} from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";
import { requireRole } from "../middlewares/require-role";
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
): Promise<
  | {
      report: Report;
    }
  | {
      status: 403 | 404;
      error: string;
    }
> {
  const report = await getReportById(reportId);

  if (!report) {
    return {
      status: 404,
      error: "Informe no encontrado",
    } as const;
  }

  if (report.clinicId !== clinicId) {
    return {
      status: 403,
      error: unauthorizedMessage,
    } as const;
  }

  return {
    report,
  } as const;
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

router.use(requireAuth);

router.post(
  "/upload",
  requireRole(USER_ROLES.LAB),
  upload.single("file"),
  asyncHandler(async (req, res) => {
    auditInfo(req, "report.upload.started", {
      requestedClinicId:
        typeof req.body?.clinicId === "string" ||
        typeof req.body?.clinicId === "number"
          ? req.body.clinicId
          : typeof req.query?.clinicId === "string" ||
              typeof req.query?.clinicId === "number"
            ? req.query.clinicId
            : null,
      fileName: req.file?.originalname ?? null,
    });

    if (!req.file) {
      auditWarn(req, "report.upload.missing_file");

      return res.status(400).json({
        success: false,
        error: "No se proporciono ningun archivo",
      });
    }

    const clinicId =
      parseClinicId(req.body?.clinicId ?? req.query.clinicId) ??
      req.auth!.clinicId;

    if (!Number.isInteger(clinicId) || clinicId <= 0) {
      auditWarn(req, "report.upload.invalid_clinic_id", {
        clinicId,
      });

      return res.status(400).json({
        success: false,
        error: "clinicId inválido",
      });
    }

    const patientName = normalizeSearchText(req.body?.patientName);
    const studyType = normalizeSearchText(req.body?.studyType);
    const uploadDate = parseOptionalDate(req.body?.uploadDate);
    const fileName = req.file.originalname;
    const mimeType = req.file.mimetype;

    try {
      const storagePath = await uploadReport({
        file: req.file.buffer,
        fileName,
        clinicId,
        mimeType,
      });

      const report = await upsertReport({
        clinicId,
        patientName: patientName ?? null,
        studyType: studyType ?? null,
        uploadDate: uploadDate ?? null,
        fileName,
        storagePath,
      });

      auditInfo(req, "report.upload.success", {
        clinicId,
        reportId: report.id,
        fileName,
        storagePath,
        mimeType,
        sizeBytes: req.file.size ?? null,
      });

      return res.status(201).json({
        success: true,
        message: "Archivo subido correctamente",
        report: await serializeReport(report),
      });
    } catch (error) {
      auditError(req, "report.upload.failed", error, {
        clinicId,
        fileName,
        mimeType,
        sizeBytes: req.file.size ?? null,
      });

      throw error;
    }
  }),
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const scope = getReadClinicScope(req.query.clinicId, req.auth!.clinicId);
    const limit = parsePositiveInt(req.query.limit, 50, 100);
    const offset = parseOffset(req.query.offset, 0);

    if (scope.isForbidden) {
      return res.status(403).json({
        success: false,
        error: "No autorizado para consultar otra clinica",
      });
    }

    const reports = await getReportsByClinicId(scope.clinicId, limit, offset);

    return res.json({
      success: true,
      count: reports.length,
      reports: await serializeReports(reports),
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
    const limit = parsePositiveInt(req.query.limit, 50, 100);
    const offset = parseOffset(req.query.offset, 0);

    if (scope.isForbidden) {
      return res.status(403).json({
        success: false,
        error: "No autorizado para consultar otra clinica",
      });
    }

    const reports = await searchReports(
      scope.clinicId,
      query,
      studyType,
      limit,
      offset,
    );

    return res.json({
      success: true,
      count: reports.length,
      reports: await serializeReports(reports),
      filters: {
        query: query ?? null,
        studyType: studyType ?? null,
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

    const studyTypes = await getStudyTypes(scope.clinicId);

    return res.json({
      success: true,
      studyTypes,
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
