import { Router } from "express";
import { getReportById } from "../db";
import {
  createParticularSession,
  deleteParticularSession,
  getParticularTokenById,
  getParticularTokenByTokenHash,
  updateParticularTokenLastLogin,
} from "../db-particular";
import {
  generateSessionToken,
  hashSessionToken,
} from "../lib/auth-security";
import { ENV } from "../lib/env";
import { createLoginRateLimit } from "../lib/login-rate-limit";
import { serializeParticularTokenDetail } from "../lib/particular-token";
import {
  createSignedReportDownloadUrl,
  createSignedReportUrl,
} from "../lib/supabase";
import { requireParticularAuth } from "../middlewares/particular-auth";
import { requireTrustedOrigin } from "../middlewares/trusted-origin";
import { asyncHandler } from "../utils/async-handler";

const router = Router();
const loginRateLimit = createLoginRateLimit();

async function buildParticularResponse(tokenId: number) {
  const particularToken = await getParticularTokenById(tokenId);

  if (!particularToken) {
    return null;
  }

  const report =
    typeof particularToken.reportId === "number"
      ? await getReportById(particularToken.reportId)
      : null;

  return serializeParticularTokenDetail(particularToken, report);
}

router.post(
  "/login",
  requireTrustedOrigin,
  loginRateLimit,
  asyncHandler(async (req, res) => {
    const providedToken =
      typeof req.body?.token === "string" ? req.body.token.trim() : "";

    if (!providedToken) {
      return res.status(400).json({
        success: false,
        error: "Token obligatorio",
      });
    }

    const tokenHash = hashSessionToken(providedToken);
    const particularToken = await getParticularTokenByTokenHash(tokenHash);

    if (!particularToken || !particularToken.isActive) {
      return res.status(401).json({
        success: false,
        error: "Token inválido",
      });
    }

    const sessionToken = generateSessionToken();
    const sessionTokenHash = hashSessionToken(sessionToken);
    const expiresAt = new Date(
      Date.now() + ENV.sessionTtlHours * 60 * 60 * 1000,
    );

    await createParticularSession({
      particularTokenId: particularToken.id,
      tokenHash: sessionTokenHash,
      lastAccess: new Date(),
      expiresAt,
    });

    await updateParticularTokenLastLogin(particularToken.id);

    res.cookie(ENV.particularCookieName, sessionToken, {
      httpOnly: true,
      sameSite: ENV.cookieSameSite,
      secure: ENV.cookieSecure,
      path: "/",
      maxAge: ENV.sessionTtlHours * 60 * 60 * 1000,
    });

    return res.json({
      success: true,
      particular: await buildParticularResponse(particularToken.id),
    });
  }),
);

router.get(
  "/me",
  requireParticularAuth,
  asyncHandler(async (req, res) => {
    const particular = await buildParticularResponse(req.particularAuth!.tokenId);

    if (!particular) {
      return res.status(404).json({
        success: false,
        error: "Token particular no encontrado",
      });
    }

    return res.json({
      success: true,
      particular,
    });
  }),
);

router.post(
  "/logout",
  requireTrustedOrigin,
  requireParticularAuth,
  asyncHandler(async (req, res) => {
    const tokenHash = hashSessionToken(req.particularAuth!.sessionToken);

    await deleteParticularSession(tokenHash);

    res.clearCookie(ENV.particularCookieName, {
      httpOnly: true,
      sameSite: ENV.cookieSameSite,
      secure: ENV.cookieSecure,
      path: "/",
    });

    return res.json({
      success: true,
      message: "Sesión particular cerrada correctamente",
    });
  }),
);

router.get(
  "/report/preview-url",
  requireParticularAuth,
  asyncHandler(async (req, res) => {
    const reportId = req.particularAuth!.reportId;

    if (typeof reportId !== "number") {
      return res.status(409).json({
        success: false,
        error: "El token particular no tiene un informe vinculado",
      });
    }

    const report = await getReportById(reportId);

    if (!report || report.clinicId !== req.particularAuth!.clinicId) {
      return res.status(404).json({
        success: false,
        error: "Informe no encontrado",
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
  "/report/download-url",
  requireParticularAuth,
  asyncHandler(async (req, res) => {
    const reportId = req.particularAuth!.reportId;

    if (typeof reportId !== "number") {
      return res.status(409).json({
        success: false,
        error: "El token particular no tiene un informe vinculado",
      });
    }

    const report = await getReportById(reportId);

    if (!report || report.clinicId !== req.particularAuth!.clinicId) {
      return res.status(404).json({
        success: false,
        error: "Informe no encontrado",
      });
    }

    const downloadUrl = await createSignedReportDownloadUrl(
      report.storagePath,
      report.fileName ?? undefined,
    );

    return res.json({
      success: true,
      downloadUrl,
    });
  }),
);

export default router;
