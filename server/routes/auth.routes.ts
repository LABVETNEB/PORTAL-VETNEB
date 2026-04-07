import crypto from "node:crypto";

import { Router } from "express";

import {
  createActiveSession,
  deleteActiveSession,
  getClinicUserByUsername,
} from "../db";
import { ENV } from "../lib/env";
import { requireAuth } from "../middlewares/auth";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const username =
      typeof req.body?.username === "string" ? req.body.username.trim() : "";
    const password =
      typeof req.body?.password === "string" ? req.body.password : "";

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: "username y password son obligatorios",
      });
    }

    const clinicUser = await getClinicUserByUsername(username);

    if (!clinicUser || clinicUser.passwordHash !== hashPassword(password)) {
      return res.status(401).json({
        success: false,
        error: "Usuario o contraseña inválidos",
      });
    }

    const token = generateToken();
    const expiresAt = new Date(
      Date.now() + ENV.sessionTtlHours * 60 * 60 * 1000,
    );

    await createActiveSession({
      clinicUserId: clinicUser.id,
      token,
      expiresAt,
    });

    res.cookie(ENV.cookieName, token, {
      httpOnly: true,
      path: "/",
      sameSite: ENV.isProduction ? "none" : "lax",
      secure: ENV.isProduction,
      maxAge: ENV.sessionTtlHours * 60 * 60 * 1000,
    });

    return res.json({
      success: true,
      clinicUser: {
        id: clinicUser.id,
        clinicId: clinicUser.clinicId,
        username: clinicUser.username,
      },
    });
  }),
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    return res.json({
      success: true,
      clinicUser: req.auth,
    });
  }),
);

router.post(
  "/logout",
  requireAuth,
  asyncHandler(async (req, res) => {
    await deleteActiveSession(req.auth!.sessionToken);

    res.clearCookie(ENV.cookieName, {
      httpOnly: true,
      path: "/",
      sameSite: ENV.isProduction ? "none" : "lax",
      secure: ENV.isProduction,
    });

    return res.json({
      success: true,
      message: "Sesión cerrada correctamente",
    });
  }),
);

export default router;
