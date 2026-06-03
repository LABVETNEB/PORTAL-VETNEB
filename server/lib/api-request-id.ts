import { randomUUID } from "node:crypto";
import type { IncomingHttpHeaders, IncomingMessage } from "node:http";
import type { FastifyReply, FastifyRequest } from "fastify";
import { shouldApplyApiSecurityHeaders } from "./api-response-security.ts";

export const API_REQUEST_ID_HEADER_NAME = "X-Request-ID";
export const API_REQUEST_ID_HEADER_KEY = "x-request-id";
export const API_REQUEST_ID_MAX_LENGTH = 128;
const API_REQUEST_ID_ALLOWED_CHARACTERS = /^[A-Za-z0-9._:-]+$/;

export function isSafeRequestId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= API_REQUEST_ID_MAX_LENGTH &&
    API_REQUEST_ID_ALLOWED_CHARACTERS.test(value)
  );
}

export function getSafeIncomingRequestId(
  headers: IncomingHttpHeaders,
): string | null {
  const value = headers[API_REQUEST_ID_HEADER_KEY];

  return isSafeRequestId(value) ? value : null;
}

export function generateSafeRequestId(): string {
  return randomUUID();
}

export function generateFastifyRequestId(request: IncomingMessage): string {
  return getSafeIncomingRequestId(request.headers) ?? generateSafeRequestId();
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

export function applyApiRequestIdHeader(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  if (!shouldApplyApiSecurityHeaders(request.url ?? "")) {
    return;
  }

  const requestId = isSafeRequestId(request.id)
    ? request.id
    : generateSafeRequestId();

  setReplyHeaderIfUnset(reply, API_REQUEST_ID_HEADER_NAME, requestId);
}
