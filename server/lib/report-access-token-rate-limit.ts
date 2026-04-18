import rateLimit, { type Options } from "express-rate-limit";

export const REPORT_ACCESS_TOKEN_MUTATION_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const REPORT_ACCESS_TOKEN_MUTATION_RATE_LIMIT_MAX_ATTEMPTS = 10;
export const REPORT_ACCESS_TOKEN_MUTATION_RATE_LIMIT_ERROR_MESSAGE =
  "Demasiadas operaciones sobre tokens públicos de informes. Intente más tarde.";

export function buildReportAccessTokenMutationRateLimitOptions(): Partial<Options> {
  return {
    windowMs: REPORT_ACCESS_TOKEN_MUTATION_RATE_LIMIT_WINDOW_MS,
    max: REPORT_ACCESS_TOKEN_MUTATION_RATE_LIMIT_MAX_ATTEMPTS,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: REPORT_ACCESS_TOKEN_MUTATION_RATE_LIMIT_ERROR_MESSAGE,
    },
  };
}

export function createReportAccessTokenMutationRateLimit() {
  return rateLimit(buildReportAccessTokenMutationRateLimitOptions());
}
