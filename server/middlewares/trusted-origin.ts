import type { NextFunction, Request, Response } from "../lib/http-types.ts";
import { ENV } from "../lib/env.ts";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function getAllowedOrigins(): string[] {
  const configuredOrigins = ENV.corsOrigins.map((origin) =>
    origin.trim().toLowerCase(),
  );

  if (configuredOrigins.length > 0) {
    return configuredOrigins;
  }

  if (ENV.isDevelopment) {
    return [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://localhost:3001",
      "http://127.0.0.1:3001",
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    ];
  }

  return [];
}

const allowedOrigins = new Set(getAllowedOrigins());

function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value).origin.trim().toLowerCase();
  } catch {
    return null;
  }
}

function getRequestOrigin(req: Request): string | null {
  const originHeader = req.get("origin");

  if (typeof originHeader === "string" && originHeader.trim()) {
    return normalizeOrigin(originHeader);
  }

  const refererHeader = req.get("referer");

  if (typeof refererHeader === "string" && refererHeader.trim()) {
    return normalizeOrigin(refererHeader);
  }

  return null;
}

export function requireTrustedOrigin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!UNSAFE_METHODS.has(req.method.toUpperCase())) {
    next();
    return;
  }

  const requestOrigin = getRequestOrigin(req);

  if (!requestOrigin) {
    next();
    return;
  }

  if (allowedOrigins.has(requestOrigin)) {
    next();
    return;
  }

  res.status(403).json({
    success: false,
    error: "Origen no permitido",
  });
}

