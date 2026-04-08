import { Router } from "express";
import rateLimit from "express-rate-limit";

import {
  createActiveSession,
  deleteActiveSession,
  getClinicUserByUsername,
  upsertClinicUser,
} from "../db";
import {
  generateSessionToken,
  hashPassword,
  hashSessionToken,
  verifyPassword,
} from "../lib/auth-security";
import { ENV } from "../lib/env";
import { canUploadReports } from "../lib/permissions";
import { requireAuth } from "../middlewares/auth";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Demasiados intentos de inicio de sesión. Intente más tarde.",
  },
});

router.post(
  "/login",
  loginRateLimit,
  asyncHandler(async (req, res) => {
    const username =
      typeof req.body?.username === "string" ? req.body.username.trim() : "";
    const password =
      typeof req.body?.password === "string" ? req.body.password : "";

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: "Usuario y contrasena son obligatorios",
      });
    }

    const clinicUser = await getClinicUserByUsername(username);

    if (!clinicUser) {
      return res.status(401).json({
        success: false,
        error: "Usuario o contraseña inválidos",
      });
    }

    const passwordCheck = await verifyPassword(password, clinicUser.passwordHash);

    if (!passwordCheck.valid) {
      return res.status(401).json({
        success: false,
        error: "Usuario o contraseña inválidos",
      });
    }

    if (passwordCheck.needsRehash) {
      const newHash = await hashPassword(password);

      await upsertClinicUser({
        clinicId: clinicUser.clinicId,
        username: clinicUser.username,
        passwordHash: newHash,
        authProId: clinicUser.authProId ?? null,
      });
    }

    const token = generateSessionToken();
    const tokenHash = hashSessionToken(token);
    const expiresAt = new Date(
      Date.now() + ENV.sessionTtlHours * 60 * 60 * 1000,
    );

    await createActiveSession({
      clinicUserId: clinicUser.id,
      tokenHash,
      expiresAt,
    });

    res.cookie(ENV.cookieName, token, {
      httpOnly: true,
      path: "/",
      sameSite: ENV.cookieSameSite,
      secure: ENV.cookieSecure,
      maxAge: ENV.sessionTtlHours * 60 * 60 * 1000,
    });

    return res.json({
      success: true,
      clinicUser: {
        id: clinicUser.id,
        clinicId: clinicUser.clinicId,
        username: clinicUser.username,
        role: clinicUser.role ?? null,
      },
      permissions: {
        canUploadReports: canUploadReports({
          username: clinicUser.username,
          authProId: clinicUser.authProId ?? null,
          role: clinicUser.role ?? null,
        }),
      },
    });
  }),
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const auth = req.auth!;

    return res.json({
      success: true,
      clinicUser: {
        id: auth.id,
        clinicId: auth.clinicId,
        username: auth.username,
        role: auth.role ?? null,
      },
      permissions: {
        canUploadReports: auth.canUploadReports,
      },
    });
  }),
);

router.post(
  "/logout",
  requireAuth,
  asyncHandler(async (req, res) => {
    const tokenHash = hashSessionToken(req.auth!.sessionToken);
    await deleteActiveSession(tokenHash);

    res.clearCookie(ENV.cookieName, {
      httpOnly: true,
      path: "/",
      sameSite: ENV.cookieSameSite,
      secure: ENV.cookieSecure,
    });

    return res.json({
      success: true,
      message: "Sesión cerrada correctamente",
    });
  }),
);

export default router;
