import express from "express";
import cors from "cors";
import multer from "multer";
import "dotenv/config";

import { uploadReport } from "./supabase";
import { upsertReport } from "../db";

const app = express();

// =========================
// MIDDLEWARES
// =========================
app.use(cors());
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
});

// =========================
// ROUTES BASE
// =========================

app.get("/", (_req, res) => {
  res.json({
    success: true,
    name: "PORTAL VETNEB API",
    version: "2.0.0",
    status: "running",
  });
});

app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    status: "ok",
  });
});

// =========================
// UPLOAD REPORT
// =========================

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }

    const file = req.file;

    // 1. Subir a Supabase Storage
    const path = await uploadReport(file.buffer, file.originalname);

    // 2. Guardar en DB
    const report = await upsertReport({
      clinicId: 1, // ⚠️ luego será dinámico
      fileName: file.originalname,
      driveFileId: path,
      previewUrl: null,
      downloadUrl: null,
    });

    return res.json({
      success: true,
      message: "Archivo subido correctamente",
      path,
      report,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return res.status(500).json({
      success: false,
      error: "Error al subir archivo",
    });
  }
});

// =========================
// SERVER
// =========================

const PORT = Number(process.env.PORT || 3000);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});