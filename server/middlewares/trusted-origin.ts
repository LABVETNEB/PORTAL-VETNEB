import type { FastifyReply, FastifyRequest } from "fastify";
import type { NextFunction, Request, Response } from "../lib/http-types.ts";
import { ENV } from "../lib/env.ts";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const SESSION_COOKIE_NAMES = [
  ENV.cookieName,
  ENV.adminCookieName,
  ENV.particularCookieName,
];

type HeaderGetterRequest = {
  method: string;
  headers?: Record<string, string | string[] | undefined>;
  get?: (name: string) => string | undefined;
};

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

function getHeader(req: HeaderGetterRequest, name: string): string | undefined {
  const directValue = req.get?.(name);

  if (typeof directValue === "string") {
    return directValue;
  }

  const headerValue = req.headers?.[name.toLowerCase()];

  if (typeof headerValue === "string") {
    return headerValue;
  }

  if (Array.isArray(headerValue)) {
    return headerValue[0];
  }

  return undefined;
}

function getRequestOrigin(req: HeaderGetterRequest): {
  present: boolean;
  origin: string | null;
} {
  const originHeader = getHeader(req, "origin");

  if (typeof originHeader === "string" && originHeader.trim()) {
    return {
      present: true,
      origin: normalizeOrigin(originHeader),
    };
  }

  const refererHeader = getHeader(req, "referer");

  if (typeof refererHeader === "string" && refererHeader.trim()) {
    return {
      present: true,
      origin: normalizeOrigin(refererHeader),
    };
  }

  return {
    present: false,
    origin: null,
  };
}

function safeDecodeCookiePart(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) {
    return {};
  }

  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separatorIndex = part.indexOf("=");

        if (separatorIndex === -1) {
          return [safeDecodeCookiePart(part), ""];
        }

        return [
          safeDecodeCookiePart(part.slice(0, separatorIndex).trim()),
          safeDecodeCookiePart(part.slice(separatorIndex + 1).trim()),
        ];
      }),
  );
}

function hasSessionCookie(req: HeaderGetterRequest) {
  const cookies = parseCookies(getHeader(req, "cookie"));
  return SESSION_COOKIE_NAMES.some((name) => Boolean(cookies[name]));
}

function isTrustedOriginRequest(req: HeaderGetterRequest) {
  if (!UNSAFE_METHODS.has(req.method.toUpperCase())) {
    return true;
  }

  const requestOrigin = getRequestOrigin(req);

  if (requestOrigin.present) {
    return Boolean(
      requestOrigin.origin && allowedOrigins.has(requestOrigin.origin),
    );
  }

  return !hasSessionCookie(req);
}

export function requireTrustedOrigin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (isTrustedOriginRequest(req)) {
    next();
    return;
  }

  res.status(403).json({
    success: false,
    error: "Origen no permitido",
  });
}

export async function requireTrustedOriginForFastify(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  if (isTrustedOriginRequest(request)) {
    return undefined;
  }

  return reply.code(403).send({
    success: false,
    error: "Origen no permitido",
  });
}
