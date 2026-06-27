import type { FastifyReply, FastifyRequest } from "fastify";
import { ENV } from "../lib/env.ts";

export const CLIENT_VERSION_HEADER = "x-vetneb-client-version";
export const CLIENT_VERSION_UNSUPPORTED_CODE = "CLIENT_VERSION_UNSUPPORTED";
export const CLIENT_VERSION_UNSUPPORTED_MESSAGE =
  "Tu aplicación está desactualizada. Actualizá o reinstalá VETNEB para continuar.";

type GatedRoute = {
  method: "GET" | "POST";
  path: string;
};

// Solo se protegen los endpoints de auth donde una PWA vieja primero toca
// backend: si una de estas llamadas pasa, el cliente queda con sesión activa.
const GATED_ROUTES: readonly GatedRoute[] = [
  { method: "POST", path: "/api/auth/login" },
  { method: "GET", path: "/api/auth/me" },
  { method: "POST", path: "/api/admin/auth/login" },
  { method: "GET", path: "/api/admin/auth/me" },
  { method: "POST", path: "/api/particular/auth/login" },
  { method: "GET", path: "/api/particular/auth/me" },
];

function getRequestPath(request: FastifyRequest): string {
  const url = request.url ?? "";
  const queryIndex = url.indexOf("?");

  return queryIndex === -1 ? url : url.slice(0, queryIndex);
}

function isGatedRoute(request: FastifyRequest): boolean {
  const path = getRequestPath(request);
  const method = request.method.toUpperCase();

  return GATED_ROUTES.some(
    (route) => route.method === method && route.path === path,
  );
}

function getClientVersionHeader(request: FastifyRequest): string | null {
  const raw = request.headers[CLIENT_VERSION_HEADER];
  const value = Array.isArray(raw) ? raw[0] : raw;

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseVersionParts(version: string): number[] | null {
  const parts = version.split(".").map((part) => Number(part));

  if (parts.length === 0 || parts.some((part) => !Number.isInteger(part) || part < 0)) {
    return null;
  }

  return parts;
}

// Cuando APP_VERSION/CLIENT_MIN_VERSION son SHAs de despliegue (no semver),
// la única comparación válida es igualdad exacta; el orden numérico solo
// aplica si ambos lados son versiones punteadas como "1.2.3".
export function isClientVersionSupported(
  clientVersion: string,
  minimumVersion: string,
): boolean {
  if (clientVersion === minimumVersion) {
    return true;
  }

  const clientParts = parseVersionParts(clientVersion);
  const minimumParts = parseVersionParts(minimumVersion);

  if (!clientParts || !minimumParts) {
    return false;
  }

  const length = Math.max(clientParts.length, minimumParts.length);

  for (let index = 0; index < length; index += 1) {
    const clientPart = clientParts[index] ?? 0;
    const minimumPart = minimumParts[index] ?? 0;

    if (clientPart > minimumPart) return true;
    if (clientPart < minimumPart) return false;
  }

  return true;
}

export async function requireMinimumClientVersionForFastify(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  if (!ENV.clientVersionGateEnforced || !isGatedRoute(request)) {
    return undefined;
  }

  const clientVersion = getClientVersionHeader(request);
  const minimumClientVersion = ENV.clientMinVersion;

  if (clientVersion && isClientVersionSupported(clientVersion, minimumClientVersion)) {
    return undefined;
  }

  return reply.code(426).send({
    success: false,
    code: CLIENT_VERSION_UNSUPPORTED_CODE,
    message: CLIENT_VERSION_UNSUPPORTED_MESSAGE,
    minimumClientVersion,
    clientVersion: clientVersion ?? "",
  });
}
