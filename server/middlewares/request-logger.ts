import type { NextFunction, Request, Response } from "../lib/http-types.ts";
import {
  getSafeIncomingRequestId,
  isSafeRequestId,
} from "../lib/http/api-request-id.ts";
import { logInfo } from "../lib/logger.ts";
import {
  getStatusClass,
  UNMATCHED_ROUTE_TEMPLATE,
} from "../lib/observability-metrics.ts";
import { createRuntimeTimer } from "../lib/runtime-timing.ts";

export const HTTP_REQUEST_COMPLETED_EVENT = "HTTP_REQUEST_COMPLETED";

const SIGNED_URL_IN_LOG_PATTERN =
  /\bhttps?:\/\/[^\s"']*(?:\/object\/sign\/|[?&](?:token|access_token|refresh_token|signature|X-Amz-Signature)=)[^\s"']*/gi;

export function sanitizeUrlForLogs(url: string): string {
  return url
    .replace(SIGNED_URL_IN_LOG_PATTERN, "[REDACTED]")
    .replace(
      /(\/api\/public\/report-access\/)([^/?#]+)/gi,
      "$1[REDACTED]",
    )
    .replace(
      /([?&](?:token|reportAccessToken|access_token|refresh_token|accessToken|refreshToken|signature)=)([^&#]+)/gi,
      "$1[REDACTED]",
    );
}

export function buildRequestLogLine(input: {
  timestamp: string;
  method: string;
  url: string;
  statusCode: number;
  durationMs: number;
}) {
  const baseLine =
    `[${input.timestamp}] ${input.method} ${input.url} ` +
    `${input.statusCode} ${input.durationMs.toFixed(1)}ms`;

  if (input.statusCode === 429) {
    return `${baseLine} RATE_LIMITED`;
  }

  return baseLine;
}

const ROUTE_TEMPLATE_PATTERN = /^[A-Za-z0-9/_:*.-]+$/;
const MAX_ROUTE_TEMPLATE_LENGTH = 120;

/**
 * Normaliza el template de ruta de Fastify (no la URL real) para usarlo como
 * dimension acotada en logs y metricas. Cualquier valor con IDs concretos o
 * caracteres fuera del template cae a UNMATCHED_ROUTE.
 */
export function normalizeRouteTemplate(value: unknown): string {
  if (typeof value !== "string") {
    return UNMATCHED_ROUTE_TEMPLATE;
  }

  const trimmed = value.trim();

  if (
    !trimmed ||
    trimmed.length > MAX_ROUTE_TEMPLATE_LENGTH ||
    !ROUTE_TEMPLATE_PATTERN.test(trimmed)
  ) {
    return UNMATCHED_ROUTE_TEMPLATE;
  }

  return trimmed;
}

/**
 * Contexto cerrado del access log. No incluye path, url, pathname ni query:
 * la unica dimension de ruta es el template Fastify normalizado, porque la URL
 * real puede conservar reportId, clinicId, trackingCaseId u otros IDs aun
 * despues de redactar tokens.
 */
export type RequestCompletionLogContext = {
  method: string;
  routeTemplate: string;
  statusCode: number;
  statusClass: string;
  durationMs: number;
  rateLimited: boolean;
};

export function buildRequestCompletionLogContext(input: {
  method: string;
  routeTemplate: unknown;
  statusCode: number;
  durationMs: number;
}): RequestCompletionLogContext {
  return {
    method: input.method,
    routeTemplate: normalizeRouteTemplate(input.routeTemplate),
    statusCode: input.statusCode,
    statusClass: getStatusClass(input.statusCode),
    durationMs: Math.round(input.durationMs * 100) / 100,
    rateLimited: input.statusCode === 429,
  };
}

export function logRequestCompletion(input: {
  method: string;
  routeTemplate: unknown;
  statusCode: number;
  durationMs: number;
  requestId?: unknown;
}) {
  const context = buildRequestCompletionLogContext(input);

  logInfo(HTTP_REQUEST_COMPLETED_EVENT, {
    ...(isSafeRequestId(input.requestId) ? { requestId: input.requestId } : {}),
    ...context,
  });
}

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const timer = createRuntimeTimer();

  res.on("finish", () => {
    const durationMs = timer.elapsedMs();

    logRequestCompletion({
      method: req.method,
      routeTemplate: (req as { route?: { path?: string } }).route?.path,
      statusCode: res.statusCode,
      durationMs,
      requestId: req.requestId ?? getSafeIncomingRequestId(req.headers ?? {}),
    });
  });

  next();
}
