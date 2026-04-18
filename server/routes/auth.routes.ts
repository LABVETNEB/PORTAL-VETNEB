import { Router } from "express";

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
import { AUDIT_EVENTS, writeAuditLog } from "../lib/audit";
import { ENV } from "../lib/env";
import { createLoginRateLimit } from "../lib/login-rate-limit";
import { getClinicPermissions, normalizeClinicUserRole } from "../lib/permissions";
import { requireAuth } from "../middlewares/auth";
import { requireTrustedOrigin } from "../middlewares/trusted-origin";
import { asyncHandler } from "../utils/async-handler";

const router = Router();
const loginRateLimit = createLoginRateLimit();

router.post(
  "/login",
  requireTrustedOrigin,
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

    const role = normalizeClinicUserRole(clinicUser.role, "clinic_staff");

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

    await createActiveSession({
      clinicUserId: clinicUser.id,
      tokenHash,
      expiresAt,
    });

    await writeAuditLog(req, {
      event: AUDIT_EVENTS.CLINIC_LOGIN_SUCCEEDED,
      clinicId: clinicUser.clinicId,
      targetClinicUserId: clinicUser.id,
      metadata: {
        username: clinicUser.username,
        role,
        sessionExpiresAt: expiresAt,
      },
      actor: {
        type: "clinic_user",
        clinicUserId: clinicUser.id,
      },
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
        authProId: clinicUser.authProId ?? null,
        role,
      },
      permissions: getClinicPermissions(role),
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
        authProId: auth.authProId,
        role: auth.role,
      },
      permissions: auth.permissions,
    });
  }),
);

router.post(
  "/logout",
  requireTrustedOrigin,
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
