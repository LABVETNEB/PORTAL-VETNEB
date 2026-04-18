import rateLimit, { type Options } from "express-rate-limit";

export const PUBLIC_REPORT_ACCESS_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const PUBLIC_REPORT_ACCESS_RATE_LIMIT_MAX_ATTEMPTS = 10;
export const PUBLIC_REPORT_ACCESS_RATE_LIMIT_ERROR_MESSAGE =
  "Demasiados accesos públicos al informe. Intente más tarde.";

export function buildPublicReportAccessRateLimitOptions(): Partial<Options> {
  return {
    windowMs: PUBLIC_REPORT_ACCESS_RATE_LIMIT_WINDOW_MS,
    max: PUBLIC_REPORT_ACCESS_RATE_LIMIT_MAX_ATTEMPTS,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: PUBLIC_REPORT_ACCESS_RATE_LIMIT_ERROR_MESSAGE,
    },
  };
}

export function createPublicReportAccessRateLimit() {
  return rateLimit(buildPublicReportAccessRateLimitOptions());
}
