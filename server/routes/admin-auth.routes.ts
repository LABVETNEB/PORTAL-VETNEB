import { Router } from "express";
import {
  createAdminSession,
  deleteAdminSession,
  getAdminUserByUsername,
} from "../db";
import {
  generateSessionToken,
  hashSessionToken,
  verifyPassword,
} from "../lib/auth-security";
import { ENV } from "../lib/env";
import { requireAdminAuth } from "../middlewares/admin-auth";
import { requireTrustedOrigin } from "../middlewares/trusted-origin";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

router.post(
  "/login",
  requireTrustedOrigin,
  asyncHandler(async (req, res) => {
    const username =
      typeof req.body?.username === "string" ? req.body.username.trim() : "";
    const password =
      typeof req.body?.password === "string" ? req.body.password : "";

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: "Usuario y contraseña requeridos",
      });
    }

    const admin = await getAdminUserByUsername(username);

    if (!admin) {
      return res.status(401).json({
        success: false,
        error: "Credenciales inválidas",
      });
    }

    const valid = await verifyPassword(password, admin.passwordHash);

    if (!valid.valid) {
      return res.status(401).json({
        success: false,
        error: "Credenciales inválidas",
      });
    }

    const token = generateSessionToken();
    const tokenHash = hashSessionToken(token);

    const expiresAt = new Date(
      Date.now() + ENV.sessionTtlHours * 60 * 60 * 1000,
    );

    await createAdminSession({
      adminUserId: admin.id,
      tokenHash,
      expiresAt,
    });

    res.cookie(ENV.adminCookieName, token, {
      httpOnly: true,
      sameSite: ENV.cookieSameSite,
      secure: ENV.cookieSecure,
      path: "/",
      maxAge: ENV.sessionTtlHours * 60 * 60 * 1000,
    });

    return res.json({
      success: true,
      admin: {
        id: admin.id,
        username: admin.username,
      },
    });
  }),
);

router.get(
  "/me",
  requireAdminAuth,
  asyncHandler(async (req, res) => {
    return res.json({
      success: true,
      admin: {
        id: req.adminAuth!.id,
        username: req.adminAuth!.username,
      },
    });
  }),
);

router.post(
  "/logout",
  requireTrustedOrigin,
  requireAdminAuth,
  asyncHandler(async (req, res) => {
    const tokenHash = hashSessionToken(req.adminAuth!.sessionToken);

    await deleteAdminSession(tokenHash);

    res.clearCookie(ENV.adminCookieName, {
      httpOnly: true,
      sameSite: ENV.cookieSameSite,
      secure: ENV.cookieSecure,
      path: "/",
    });

    return res.json({
      success: true,
      message: "Sesión admin cerrada correctamente",
    });
  }),
);

export default router;
