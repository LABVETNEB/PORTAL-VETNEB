import type { FastifyReply, FastifyRequest } from "fastify";

import { ENV } from "./env.ts";

/**
 * Helpers CORS / trusted-origin compartidos por las rutas Fastify.
 *
 * Consolida el boilerplate que vivía duplicado por ruta (auditoría final,
 * hallazgo P1-A / PR-CLEAN5). El comportamiento es idéntico al de las copias
 * previas: misma allowlist (`ENV.corsOrigins`), misma normalización de origen,
 * mismos status/headers y mismo mensaje `"Origen no permitido"`.
 *
 * `enforceTrustedOrigin` conserva el contrato allow-null. Las rutas que deben
 * bloquear métodos inseguros sin Origin/Referer usan
 * `enforceTrustedOriginRequired`.
 *
 * `applyCorsHeaders` NO se consolida aquí a propósito: cada ruta expone un set
 * distinto de `access-control-expose-headers` (rate-limit, Retry-After, etc.),
 * por lo que se mantiene local en cada archivo.
 */

export const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function getAllowedOrigins(): string[] {
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

export function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value).origin.trim().toLowerCase();
  } catch {
    return null;
  }
}

export function getOriginHeader(request: FastifyRequest): string {
  return typeof request.headers.origin === "string"
    ? request.headers.origin.trim()
    : "";
}

export function getAllowedOriginForCors(
  request: FastifyRequest,
  allowedOrigins: ReadonlySet<string>,
): string | null {
  const rawOrigin = getOriginHeader(request);

  if (!rawOrigin) {
    return null;
  }

  const normalizedOrigin = normalizeOrigin(rawOrigin);

  if (!normalizedOrigin || !allowedOrigins.has(normalizedOrigin)) {
    return null;
  }

  return rawOrigin;
}

export function getRequestOrigin(request: FastifyRequest): string | null {
  const originHeader = getOriginHeader(request);

  if (originHeader) {
    return normalizeOrigin(originHeader);
  }

  const refererHeader =
    typeof request.headers.referer === "string"
      ? request.headers.referer.trim()
      : "";

  if (refererHeader) {
    return normalizeOrigin(refererHeader);
  }

  return null;
}

export function enforceTrustedOrigin(
  request: FastifyRequest,
  reply: FastifyReply,
  allowedOrigins: ReadonlySet<string>,
): boolean {
  if (!UNSAFE_METHODS.has(request.method.toUpperCase())) {
    return true;
  }

  const requestOrigin = getRequestOrigin(request);

  if (!requestOrigin || allowedOrigins.has(requestOrigin)) {
    return true;
  }

  reply.code(403).send({
    success: false,
    error: "Origen no permitido",
  });

  return false;
}

export function enforceTrustedOriginRequired(
  request: FastifyRequest,
  reply: FastifyReply,
  allowedOrigins: ReadonlySet<string>,
): boolean {
  if (!UNSAFE_METHODS.has(request.method.toUpperCase())) {
    return true;
  }

  const requestOrigin = getRequestOrigin(request);

  if (requestOrigin && allowedOrigins.has(requestOrigin)) {
    return true;
  }

  reply.code(403).send({
    success: false,
    error: "Origen no permitido",
  });

  return false;
}
