import { Router } from "express";
import multer from "multer";

import {
  getReportById,
  getReportsByClinicId,
  getStudyTypes,
  searchReports,
  upsertReport,
} from "../db";
import type { Report } from "../../drizzle/schema";
import { ENV } from "../lib/env";
import {
  ALLOWED_MIME_TYPES,
  createSignedReportDownloadUrl,
  createSignedReportUrl,
  uploadReport,
} from "../lib/supabase";
import { requireAuth } from "../middlewares/auth";
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

  if (!Number.isInteger(parsed) || parsed < 0) {
    return fallback;
  }

  if (typeof max === "number") {
    return Math.min(parsed, max);
  }

  return parsed;
}

function normalizeSearchText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function toClinicId(reqClinicId: unknown, authClinicId: number) {
  const requestedClinicId = Number(reqClinicId);
  if (Number.isInteger(requestedClinicId) && requestedClinicId > 0) {
    return requestedClinicId;
  }
  return authClinicId;
}

async function serializeReport(report: Report) {
  const previewUrl = await createSignedReportUrl(report.storagePath);
  const downloadUrl = await createSignedReportDownloadUrl(
    report.storagePath,
    report.fileName,
  );

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
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No file provided",
      });
    }

    const clinicId = toClinicId(
      req.body?.clinicId ?? req.query.clinicId,
      req.auth!.clinicId,
    );

    if (clinicId !== req.auth!.clinicId) {
      return res.status(403).json({
        success: false,
        error: "No autorizado para subir informes a otra clínica",
      });
    }

    const storagePath = await uploadReport({
      file: req.file.buffer,
      fileName: req.file.originalname,
      clinicId,
      mimeType: req.file.mimetype,
    });

    const report = await upsertReport({
      clinicId,
      fileName: req.file.originalname,
      storagePath,
    });

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
    const clinicId = toClinicId(req.query.clinicId, req.auth!.clinicId);
    const limit = parsePositiveInt(req.query.limit, 50, 100);
    const offset = parsePositiveInt(req.query.offset, 0);

    if (clinicId !== req.auth!.clinicId) {
      return res.status(403).json({
        success: false,
        error: "No autorizado para consultar otra clínica",
      });
    }

    const reports = await getReportsByClinicId(clinicId, limit, offset);

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
    const clinicId = toClinicId(req.query.clinicId, req.auth!.clinicId);
    const query = normalizeSearchText(req.query.query);
    const studyType = normalizeSearchText(req.query.studyType);
    const limit = parsePositiveInt(req.query.limit, 50, 100);
    const offset = parsePositiveInt(req.query.offset, 0);

    if (clinicId !== req.auth!.clinicId) {
      return res.status(403).json({
        success: false,
        error: "No autorizado para consultar otra clínica",
      });
    }

    const reports = await searchReports(
      clinicId,
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
    const clinicId = toClinicId(req.query.clinicId, req.auth!.clinicId);

    if (clinicId !== req.auth!.clinicId) {
      return res.status(403).json({
        success: false,
        error: "No autorizado para consultar otra clínica",
      });
    }

    const studyTypes = await getStudyTypes(clinicId);

    return res.json({
      success: true,
      studyTypes,
    });
  }),
);

router.get(
  "/:reportId/preview-url",
  asyncHandler(async (req, res) => {
    const reportId = Number(req.params.reportId);

    if (!Number.isInteger(reportId) || reportId <= 0) {
      return res.status(400).json({
        success: false,
        error: "reportId inválido",
      });
    }

    const report = await getReportById(reportId);

    if (!report) {
      return res.status(404).json({
        success: false,
        error: "Informe no encontrado",
      });
    }

    if (report.clinicId !== req.auth!.clinicId) {
      return res.status(403).json({
        success: false,
        error: "No autorizado para previsualizar este informe",
      });
    }

    const previewUrl = await createSignedReportUrl(report.storagePath);

    return res.json({
      success: true,
      previewUrl,
    });
  }),
);

router.get(
  "/:reportId/download-url",
  asyncHandler(async (req, res) => {
    const reportId = Number(req.params.reportId);

    if (!Number.isInteger(reportId) || reportId <= 0) {
      return res.status(400).json({
        success: false,
        error: "reportId inválido",
      });
    }

    const report = await getReportById(reportId);

    if (!report) {
      return res.status(404).json({
        success: false,
        error: "Informe no encontrado",
      });
    }

    if (report.clinicId !== req.auth!.clinicId) {
      return res.status(403).json({
        success: false,
        error: "No autorizado para descargar este informe",
      });
    }

    const downloadUrl = await createSignedReportDownloadUrl(
      report.storagePath,
      report.fileName,
    );

    return res.json({
      success: true,
      downloadUrl,
    });
  }),
);

export default router;