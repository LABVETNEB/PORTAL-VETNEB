import rateLimit, { type Options } from "express-rate-limit";

export const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 10;
export const LOGIN_RATE_LIMIT_ERROR_MESSAGE =
  "Demasiados intentos de inicio de sesión. Intente más tarde.";

export function buildLoginRateLimitOptions(): Partial<Options> {
  return {
    windowMs: LOGIN_RATE_LIMIT_WINDOW_MS,
    max: LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: LOGIN_RATE_LIMIT_ERROR_MESSAGE,
    },
  };
}

export function createLoginRateLimit() {
  return rateLimit(buildLoginRateLimitOptions());
}
