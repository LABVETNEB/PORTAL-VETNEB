import { randomUUID } from "node:crypto";
import type { IncomingHttpHeaders, IncomingMessage } from "node:http";
import type { FastifyReply, FastifyRequest } from "fastify";
import { shouldApplyApiSecurityHeaders } from "./api-response-security.ts";

export const API_REQUEST_ID_HEADER_NAME = "X-Request-ID";
export const API_REQUEST_ID_HEADER_KEY = "x-request-id";
export const API_REQUEST_ID_MAX_LENGTH = 36;

/**
 * Sólo se preservan identificadores UUID v4.
 *
 * Una allowlist de caracteres no demuestra que el valor no sea una
 * credencial, porque un token opaco puede estar compuesto únicamente por
 * letras, números, guiones, puntos o underscores.
 */
const API_REQUEST_ID_UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isSafeRequestId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length === API_REQUEST_ID_MAX_LENGTH &&
    API_REQUEST_ID_UUID_V4_PATTERN.test(value)
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

function setReplyHeader(
  reply: FastifyReply,
  name: string,
  value: string,
) {
  reply.header(name, value);
  reply.raw.setHeader(name, value);
}

function getSafeReplyRequestId(reply: FastifyReply): string | null {
  const fastifyHeader = reply.getHeader(API_REQUEST_ID_HEADER_NAME);

  if (isSafeRequestId(fastifyHeader)) {
    return fastifyHeader;
  }

  const rawHeader = reply.raw.getHeader(API_REQUEST_ID_HEADER_NAME);

  return isSafeRequestId(rawHeader) ? rawHeader : null;
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

export function getSafeApiResponseRequestId(
  request: FastifyRequest,
  reply: FastifyReply,
): string | null {
  if (!shouldApplyApiSecurityHeaders(request.url ?? "")) {
    return null;
  }

  const replyRequestId = getSafeReplyRequestId(reply);

  if (replyRequestId) {
    setReplyHeader(reply, API_REQUEST_ID_HEADER_NAME, replyRequestId);
    return replyRequestId;
  }

  const requestId = isSafeRequestId(request.id)
    ? request.id
    : generateSafeRequestId();

  setReplyHeader(reply, API_REQUEST_ID_HEADER_NAME, requestId);

  return requestId;
}
