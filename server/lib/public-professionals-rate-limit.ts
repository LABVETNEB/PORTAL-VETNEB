import rateLimit, { type Options } from "express-rate-limit";

export const PUBLIC_PROFESSIONALS_SEARCH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const PUBLIC_PROFESSIONALS_SEARCH_RATE_LIMIT_MAX_ATTEMPTS = 10;
export const PUBLIC_PROFESSIONALS_SEARCH_RATE_LIMIT_ERROR_MESSAGE =
  "Demasiadas consultas al directorio público. Intente más tarde.";

export const PUBLIC_PROFESSIONAL_DETAIL_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const PUBLIC_PROFESSIONAL_DETAIL_RATE_LIMIT_MAX_ATTEMPTS = 20;
export const PUBLIC_PROFESSIONAL_DETAIL_RATE_LIMIT_ERROR_MESSAGE =
  "Demasiadas consultas al perfil público. Intente más tarde.";

export function buildPublicProfessionalsSearchRateLimitOptions(): Partial<Options> {
  return {
    windowMs: PUBLIC_PROFESSIONALS_SEARCH_RATE_LIMIT_WINDOW_MS,
    max: PUBLIC_PROFESSIONALS_SEARCH_RATE_LIMIT_MAX_ATTEMPTS,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: PUBLIC_PROFESSIONALS_SEARCH_RATE_LIMIT_ERROR_MESSAGE,
    },
  };
}

export function createPublicProfessionalsSearchRateLimit() {
  return rateLimit(buildPublicProfessionalsSearchRateLimitOptions());
}

export function buildPublicProfessionalDetailRateLimitOptions(): Partial<Options> {
  return {
    windowMs: PUBLIC_PROFESSIONAL_DETAIL_RATE_LIMIT_WINDOW_MS,
    max: PUBLIC_PROFESSIONAL_DETAIL_RATE_LIMIT_MAX_ATTEMPTS,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: PUBLIC_PROFESSIONAL_DETAIL_RATE_LIMIT_ERROR_MESSAGE,
    },
  };
}

export function createPublicProfessionalDetailRateLimit() {
  return rateLimit(buildPublicProfessionalDetailRateLimitOptions());
}
