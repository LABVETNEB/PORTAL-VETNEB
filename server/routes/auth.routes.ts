import { Router } from "express";
import { asyncHandler } from "../utils/async-handler";
import {
  createActiveSession,
  deleteActiveSession,
  getActiveSessionByToken,
  getClinicUserByUsername,
  getClinicUserById,
} from "../db";
import { ENV } from "../lib/env";
import crypto from "node:crypto";

export const authRouter = Router();

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function getCookieValue(cookieHeader: string | undefined, cookieName: string) {
  if (!cookieHeader) return undefined;

  const entry = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`));

  return entry?.split("=")[1]?.trim();
}

authRouter.post(
  "/api/auth/login",
  asyncHandler(async (req, res) => {
    const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";

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
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

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
      maxAge: 24 * 60 * 60 * 1000,
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

authRouter.get(
  "/api/auth/me",
  asyncHandler(async (req, res) => {
    const token = getCookieValue(req.headers.cookie, ENV.cookieName);

    if (!token) {
      return res.status(401).json({ success: false, error: "Sesión no encontrada" });
    }

    const session = await getActiveSessionByToken(token);

    if (!session) {
      return res.status(401).json({ success: false, error: "Sesión inválida" });
    }

    const clinicUser = await getClinicUserById(session.clinicUserId);

    if (!clinicUser) {
      return res.status(404).json({ success: false, error: "Usuario no encontrado" });
    }

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

authRouter.post(
  "/api/auth/logout",
  asyncHandler(async (req, res) => {
    const token = getCookieValue(req.headers.cookie, ENV.cookieName);

    if (token) {
      await deleteActiveSession(token);
    }

    res.clearCookie(ENV.cookieName, {
      httpOnly: true,
      path: "/",
      sameSite: ENV.isProduction ? "none" : "lax",
      secure: ENV.isProduction,
    });

    return res.json({ success: true });
  }),
);
