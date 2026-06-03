import type { FastifyReply, FastifyRequest } from "fastify";

export const API_NOSNIFF_HEADER_NAME = "X-Content-Type-Options";
export const API_NOSNIFF_HEADER_VALUE = "nosniff";

function getRequestPath(url: string): string {
  try {
    return new URL(url, "http://portal-vetneb.local").pathname;
  } catch {
    return url.split("?")[0] ?? "";
  }
}

export function shouldApplyApiNosniff(url: string): boolean {
  const path = getRequestPath(url);

  return path === "/api" || path.startsWith("/api/");
}

export function applyApiNosniffHeader(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  if (!shouldApplyApiNosniff(request.url ?? "")) {
    return;
  }

  if (!reply.hasHeader(API_NOSNIFF_HEADER_NAME)) {
    reply.header(API_NOSNIFF_HEADER_NAME, API_NOSNIFF_HEADER_VALUE);
  }

  if (!reply.raw.hasHeader(API_NOSNIFF_HEADER_NAME)) {
    reply.raw.setHeader(API_NOSNIFF_HEADER_NAME, API_NOSNIFF_HEADER_VALUE);
  }
}
