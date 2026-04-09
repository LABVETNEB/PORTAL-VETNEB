import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";

import {
  createActiveSession,
  deleteActiveSession,
  getAdminUserByEmail,
  getClinicUserByUsername,
  upsertClinicUser,
} from "../db";
import { createAdminJwt } from "../lib/admin-jwt";
import {
  generateSessionToken,
  hashPassword,
  hashSessionToken,
  verifyPassword,
} from "../lib/auth-security";
import { auditError, auditInfo, auditWarn } from "../lib/audit";
import { ENV } from "../lib/env";
import {
  canManageUsers,
  canUploadReports,
  normalizeUserRole,
  USER_ROLES,
} from "../lib/permissions";
import { zodValidationResponse } from "../lib/validation";
import { requireAdminAuth } from "../middlewares/admin-auth";
import { requireAuth } from "../middlewares/auth";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

const loginBodySchema = z.object({
  username: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(255),
});

const adminTokenBodySchema = z.object({
  email: z.string().trim().email().max(255).optional(),
});

const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Demasiados intentos de inicio de sesion. Intente mas tarde.",
  },
});

const adminTokenRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Demasiados intentos de token admin. Intente mas tarde.",
  },
});

router.post(
  "/login",
  loginRateLimit,
  asyncHandler(async (req, res) => {
    const parsedBody = loginBodySchema.safeParse(req.body ?? {});

    if (!parsedBody.success) {
      auditWarn(req, "auth.login.invalid_payload");

      return res.status(400).json(zodValidationResponse(parsedBody.error));
    }

    const username = parsedBody.data.username;
    const password = parsedBody.data.password;

    const clinicUser = await getClinicUserByUsername(username);

    if (!clinicUser) {
      auditWarn(req, "auth.login.user_not_found", {
        attemptedUsername: username,
      });

      return res.status(401).json({
        success: false,
        error: "Usuario o contrasena invalidos",
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
        error: "Usuario o contrasena invalidos",
      });
    }

    const role = normalizeUserRole(clinicUser.role) ?? USER_ROLES.LAB;

    if (passwordCheck.needsRehash) {
      const newHash = await hashPassword(password);

      await upsertClinicUser({
        clinicId: clinicUser.clinicId,
        username: clinicUser.username,
        passwordHash: newHash,
        authProId: clinicUser.authProId ?? null,
        role,
      });
    }

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

router.post(
  "/admin/token",
  requireAuth,
  adminTokenRateLimit,
  asyncHandler(async (req, res) => {
    if (!req.auth?.canManageUsers) {
      return res.status(403).json({
        success: false,
        error: "No autorizado para emitir token admin",
      });
    }

    const parsedBody = adminTokenBodySchema.safeParse(req.body ?? {});

    if (!parsedBody.success) {
      return res.status(400).json(zodValidationResponse(parsedBody.error));
    }

    const requesterEmail = req.auth.username.trim().toLowerCase();
    const requestedEmail = (parsedBody.data.email ?? requesterEmail).toLowerCase();

    if (requestedEmail !== requesterEmail) {
      return res.status(403).json({
        success: false,
        error: "No autorizado para emitir token admin para otro usuario",
      });
    }

    const adminUser = await getAdminUserByEmail(requestedEmail);

    if (!adminUser || !adminUser.isActive) {
      return res.status(403).json({
        success: false,
        error: "Admin no autorizado",
      });
    }

    const { token, expiresAt } = createAdminJwt({
      adminUserId: adminUser.id,
      email: adminUser.email,
      clinicUserId: req.auth.id,
      clinicId: req.auth.clinicId,
    });

    res.cookie(ENV.adminCookieName, token, {
      httpOnly: true,
      path: "/",
      sameSite: ENV.cookieSameSite,
      secure: ENV.cookieSecure,
      maxAge: ENV.adminJwtTtlMinutes * 60 * 1000,
    });

    auditInfo(req, "auth.admin.token.issued", {
      adminUserId: adminUser.id,
      adminEmail: adminUser.email,
      clinicUserId: req.auth.id,
      clinicId: req.auth.clinicId,
    });

    return res.json({
      success: true,
      tokenType: "Bearer",
      adminToken: token,
      expiresAt: expiresAt.toISOString(),
      adminUser: {
        id: adminUser.id,
        email: adminUser.email,
      },
    });
  }),
);

router.post(
  "/admin/logout",
  requireAdminAuth,
  asyncHandler(async (req, res) => {
    const adminUser = req.admin!.adminUser;

    res.clearCookie(ENV.adminCookieName, {
      httpOnly: true,
      path: "/",
      sameSite: ENV.cookieSameSite,
      secure: ENV.cookieSecure,
    });

    auditInfo(req, "auth.admin.logout.success", {
      adminUserId: adminUser.id,
      adminEmail: adminUser.email,
    });

    return res.json({
      success: true,
      message: "Sesion admin cerrada correctamente",
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
      message: "Sesion cerrada correctamente",
    });
  }),
);

export default router;
