import type { FastifyReply, FastifyRequest } from "fastify";

export const SENSITIVE_API_CACHE_CONTROL = "no-store";

export function shouldApplySensitiveApiNoStore(url: string): boolean {
  return url.startsWith("/api/") && !url.startsWith("/api/public/");
}

export function applySensitiveApiNoStoreHeaders(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  if (
    shouldApplySensitiveApiNoStore(request.url ?? "") &&
    !reply.hasHeader("cache-control")
  ) {
    reply.header("cache-control", SENSITIVE_API_CACHE_CONTROL);
  }
}
