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
import { auditInfo, auditWarn, auditError } from "../lib/audit";
import { ENV } from "../lib/env";
import {
  canManageUsers,
  canUploadReports,
  normalizeUserRole,
} from "../lib/permissions";
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
      auditWarn(req, "auth.login.invalid_payload", {
        attemptedUsername: username || null,
      });

      return res.status(400).json({
        success: false,
        error: "Usuario y contrasena son obligatorios",
      });
    }

    const clinicUser = await getClinicUserByUsername(username);

    if (!clinicUser) {
      auditWarn(req, "auth.login.user_not_found", {
        attemptedUsername: username,
      });

      return res.status(401).json({
        success: false,
        error: "Usuario o contraseña inválidos",
      });
    }

    const passwordCheck = await verifyPassword(password, clinicUser.passwordHash);

    if (!passwordCheck.valid) {
      auditWarn(req, "auth.login.invalid_password", {
        attemptedUsername: username,
        clinicUserId: clinicUser.id,
        clinicId: clinicUser.clinicId,
      });

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
        role: clinicUser.role ?? null,
      });
    }

    const role = normalizeUserRole(clinicUser.role);

    const token = generateSessionToken();
    const tokenHash = hashSessionToken(token);
    const expiresAt = new Date(
      Date.now() + ENV.sessionTtlHours * 60 * 60 * 1000,
    );

    try {
      await createActiveSession({
        clinicUserId: clinicUser.id,
        tokenHash,
        expiresAt,
      });
    } catch (error) {
      auditError(req, "auth.login.session_create_failed", error, {
        attemptedUsername: username,
        clinicUserId: clinicUser.id,
        clinicId: clinicUser.clinicId,
      });

      throw error;
    }

    res.cookie(ENV.cookieName, token, {
      httpOnly: true,
      path: "/",
      sameSite: ENV.cookieSameSite,
      secure: ENV.cookieSecure,
      maxAge: ENV.sessionTtlHours * 60 * 60 * 1000,
    });

    auditInfo(req, "auth.login.success", {
      clinicUserId: clinicUser.id,
      clinicId: clinicUser.clinicId,
      username: clinicUser.username,
      role,
    });

    return res.json({
      success: true,
      clinicUser: {
        id: clinicUser.id,
        clinicId: clinicUser.clinicId,
        username: clinicUser.username,
        role,
      },
      permissions: {
        canUploadReports: canUploadReports({ role }),
        canManageUsers: canManageUsers({ role }),
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
        role: auth.role,
      },
      permissions: {
        canUploadReports: auth.canUploadReports,
        canManageUsers: auth.canManageUsers,
      },
      requestId: req.requestId ?? null,
    });
  }),
);

router.post(
  "/logout",
  requireAuth,
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const tokenHash = hashSessionToken(auth.sessionToken);

    await deleteActiveSession(tokenHash);

    res.clearCookie(ENV.cookieName, {
      httpOnly: true,
      path: "/",
      sameSite: ENV.cookieSameSite,
      secure: ENV.cookieSecure,
    });

    auditInfo(req, "auth.logout.success", {
      clinicUserId: auth.id,
      clinicId: auth.clinicId,
      username: auth.username,
      role: auth.role,
    });

    return res.json({
      success: true,
      message: "Sesión cerrada correctamente",
    });
  }),
);

export default router;
