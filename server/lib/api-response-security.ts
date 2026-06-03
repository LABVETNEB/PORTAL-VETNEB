import type { FastifyReply, FastifyRequest } from "fastify";

export const API_NOSNIFF_HEADER_NAME = "X-Content-Type-Options";
export const API_NOSNIFF_HEADER_VALUE = "nosniff";
export const API_REFERRER_POLICY_HEADER_NAME = "Referrer-Policy";
export const API_REFERRER_POLICY_HEADER_VALUE = "no-referrer";

function getRequestPath(url: string): string {
  try {
    return new URL(url, "http://portal-vetneb.local").pathname;
  } catch {
    return url.split("?")[0] ?? "";
  }
}

export function shouldApplyApiSecurityHeaders(url: string): boolean {
  const path = getRequestPath(url);

  return path === "/api" || path.startsWith("/api/");
}

export function shouldApplyApiNosniff(url: string): boolean {
  return shouldApplyApiSecurityHeaders(url);
}

function setReplyHeaderIfUnset(
  reply: FastifyReply,
  name: string,
  value: string,
) {
  if (!reply.hasHeader(name)) {
    reply.header(name, value);
  }

  if (!reply.raw.hasHeader(name)) {
    reply.raw.setHeader(name, value);
  }
}

export function applyApiSecurityHeaders(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  if (!shouldApplyApiSecurityHeaders(request.url ?? "")) {
    return;
  }

  setReplyHeaderIfUnset(
    reply,
    API_NOSNIFF_HEADER_NAME,
    API_NOSNIFF_HEADER_VALUE,
  );
  setReplyHeaderIfUnset(
    reply,
    API_REFERRER_POLICY_HEADER_NAME,
    API_REFERRER_POLICY_HEADER_VALUE,
  );
}

export function applyApiNosniffHeader(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  applyApiSecurityHeaders(request, reply);
}
