import { Router } from "express";
import multer from "multer";
import { asyncHandler } from "../utils/async-handler";
import {
  getReportById,
  getReportsByClinicId,
  getStudyTypes,
  searchReports,
  upsertReport,
} from "../db";
import { getPublicReportUrl, uploadReport } from "../lib/supabase";

export const reportsRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});

function toClinicId(value: unknown, fallback = 1) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

reportsRouter.post(
  "/api/reports/upload",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No file provided" });
    }

    const clinicId = toClinicId(req.body?.clinicId ?? req.query.clinicId, 1);
    const storagePath = await uploadReport({
      file: req.file.buffer,
      fileName: req.file.originalname,
      clinicId,
      mimeType: req.file.mimetype,
    });
    const publicUrl = getPublicReportUrl(storagePath);

    const report = await upsertReport({
      clinicId,
      fileName: req.file.originalname,
      storagePath,
      previewUrl: publicUrl,
      downloadUrl: publicUrl,
    });

    return res.status(201).json({
      success: true,
      message: "Archivo subido correctamente",
      report,
    });
  }),
);

reportsRouter.get(
  "/api/reports",
  asyncHandler(async (req, res) => {
    const clinicId = toClinicId(req.query.clinicId, 1);
    const limit = Number(req.query.limit ?? 50);
    const offset = Number(req.query.offset ?? 0);
    const reports = await getReportsByClinicId(clinicId, limit, offset);

    return res.json({
      success: true,
      count: reports.length,
      reports,
    });
  }),
);

reportsRouter.get(
  "/api/reports/search",
  asyncHandler(async (req, res) => {
    const clinicId = toClinicId(req.query.clinicId, 1);
    const query = typeof req.query.query === "string" ? req.query.query : undefined;
    const studyType =
      typeof req.query.studyType === "string" ? req.query.studyType : undefined;
    const limit = Number(req.query.limit ?? 50);
    const offset = Number(req.query.offset ?? 0);

    const reports = await searchReports(clinicId, query, studyType, limit, offset);

    return res.json({
      success: true,
      count: reports.length,
      reports,
    });
  }),
);

reportsRouter.get(
  "/api/reports/study-types",
  asyncHandler(async (req, res) => {
    const clinicId = toClinicId(req.query.clinicId, 1);
    const studyTypes = await getStudyTypes(clinicId);

    return res.json({
      success: true,
      studyTypes,
    });
  }),
);

reportsRouter.get(
  "/api/reports/:reportId/download-url",
  asyncHandler(async (req, res) => {
    const reportId = Number(req.params.reportId);

    if (!Number.isInteger(reportId) || reportId <= 0) {
      return res.status(400).json({ success: false, error: "reportId inválido" });
    }

    const report = await getReportById(reportId);

    if (!report) {
      return res.status(404).json({ success: false, error: "Informe no encontrado" });
    }

    const downloadUrl = report.downloadUrl || getPublicReportUrl(report.storagePath);

    return res.json({
      success: true,
      downloadUrl,
    });
  }),
);
