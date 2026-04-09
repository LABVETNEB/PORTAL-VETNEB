import { Router } from "express";
import rateLimit from "express-rate-limit";
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
import { zodValidationResponse } from "../lib/validation";
import { requireAuth } from "../middlewares/auth";
import { requireRole } from "../middlewares/require-role";
import {
  reportIdParamsSchema,
  reportUploadBodySchema,
  reportsListQuerySchema,
  reportsSearchQuerySchema,
} from "../schemas/reports";
import { asyncHandler } from "../utils/async-handler";

const router = Router();
const allowedMimeTypes = new Set(ALLOWED_MIME_TYPES);

const uploadRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Demasiadas subidas de reportes. Intente mas tarde.",
  },
});

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

function parseClinicId(value: unknown): number | undefined {
  const parsed = Number(value);

  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }

  return undefined;
}

function getReadClinicScope(reqClinicId: number | undefined, authClinicId: number) {
  if (reqClinicId && reqClinicId !== authClinicId) {
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
  uploadRateLimit,
  requireRole(USER_ROLES.LAB),
  upload.single("file"),
  asyncHandler(async (req, res) => {
    auditInfo(req, "report.upload.started", {
      requestedClinicIdBody: req.body?.clinicId ?? null,
      requestedClinicIdQuery: req.query?.clinicId ?? null,
      fileName: req.file?.originalname ?? null,
    });

    if (!req.file) {
      auditWarn(req, "report.upload.missing_file");

      return res.status(400).json({
        success: false,
        error: "No se proporciono ningun archivo",
      });
    }

    const parsedBody = reportUploadBodySchema.safeParse(req.body ?? {});

    if (!parsedBody.success) {
      return res.status(400).json(zodValidationResponse(parsedBody.error));
    }

    const requestedClinicIdByQuery = parseClinicId(req.query?.clinicId);
    const requestedClinicIdByBody = parsedBody.data.clinicId;

    if (
      (typeof requestedClinicIdByQuery === "number" &&
        requestedClinicIdByQuery !== req.auth!.clinicId) ||
      (typeof requestedClinicIdByBody === "number" &&
        requestedClinicIdByBody !== req.auth!.clinicId)
    ) {
      auditWarn(req, "report.upload.cross_clinic_blocked", {
        requestedClinicIdByQuery: requestedClinicIdByQuery ?? null,
        requestedClinicIdByBody: requestedClinicIdByBody ?? null,
        authClinicId: req.auth!.clinicId,
      });

      return res.status(403).json({
        success: false,
        error: "No autorizado para subir reportes en otra clinica",
      });
    }

    const clinicId = req.auth!.clinicId;
    const patientName = parsedBody.data.patientName;
    const studyType = parsedBody.data.studyType;
    const uploadDate = parsedBody.data.uploadDate;
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
        patientName,
        studyType,
        uploadDate,
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
    const parsedQuery = reportsListQuerySchema.safeParse(req.query ?? {});

    if (!parsedQuery.success) {
      return res.status(400).json(zodValidationResponse(parsedQuery.error));
    }

    const scope = getReadClinicScope(parsedQuery.data.clinicId, req.auth!.clinicId);

    if (scope.isForbidden) {
      return res.status(403).json({
        success: false,
        error: "No autorizado para consultar otra clinica",
      });
    }

    const reports = await getReportsByClinicId(
      scope.clinicId,
      parsedQuery.data.limit,
      parsedQuery.data.offset,
    );

    return res.json({
      success: true,
      count: reports.length,
      reports: await serializeReports(reports),
      pagination: {
        limit: parsedQuery.data.limit,
        offset: parsedQuery.data.offset,
      },
    });
  }),
);

router.get(
  "/search",
  asyncHandler(async (req, res) => {
    const parsedQuery = reportsSearchQuerySchema.safeParse(req.query ?? {});

    if (!parsedQuery.success) {
      return res.status(400).json(zodValidationResponse(parsedQuery.error));
    }

    const scope = getReadClinicScope(parsedQuery.data.clinicId, req.auth!.clinicId);

    if (scope.isForbidden) {
      return res.status(403).json({
        success: false,
        error: "No autorizado para consultar otra clinica",
      });
    }

    const reports = await searchReports(
      scope.clinicId,
      parsedQuery.data.query,
      parsedQuery.data.studyType,
      parsedQuery.data.limit,
      parsedQuery.data.offset,
    );

    return res.json({
      success: true,
      count: reports.length,
      reports: await serializeReports(reports),
      filters: {
        query: parsedQuery.data.query ?? null,
        studyType: parsedQuery.data.studyType ?? null,
      },
      pagination: {
        limit: parsedQuery.data.limit,
        offset: parsedQuery.data.offset,
      },
    });
  }),
);

router.get(
  "/study-types",
  asyncHandler(async (req, res) => {
    const parsedQuery = reportsListQuerySchema.safeParse(req.query ?? {});

    if (!parsedQuery.success) {
      return res.status(400).json(zodValidationResponse(parsedQuery.error));
    }

    const scope = getReadClinicScope(parsedQuery.data.clinicId, req.auth!.clinicId);

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
    const parsedParams = reportIdParamsSchema.safeParse(req.params ?? {});

    if (!parsedParams.success) {
      return res.status(400).json(zodValidationResponse(parsedParams.error));
    }

    const reportResult = await getAuthorizedReport(
      parsedParams.data.reportId,
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
    const parsedParams = reportIdParamsSchema.safeParse(req.params ?? {});

    if (!parsedParams.success) {
      return res.status(400).json(zodValidationResponse(parsedParams.error));
    }

    const reportResult = await getAuthorizedReport(
      parsedParams.data.reportId,
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
