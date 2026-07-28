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

function setReplyHeader(reply: FastifyReply, name: string, value: string) {
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
