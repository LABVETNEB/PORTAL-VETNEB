import test from "node:test";
import assert from "node:assert/strict";
import {
  PUBLIC_PROFESSIONALS_SEARCH_RATE_LIMIT_ERROR_MESSAGE,
  PUBLIC_PROFESSIONALS_SEARCH_RATE_LIMIT_MAX_ATTEMPTS,
  PUBLIC_PROFESSIONALS_SEARCH_RATE_LIMIT_WINDOW_MS,
  PUBLIC_PROFESSIONAL_DETAIL_RATE_LIMIT_ERROR_MESSAGE,
  PUBLIC_PROFESSIONAL_DETAIL_RATE_LIMIT_MAX_ATTEMPTS,
  PUBLIC_PROFESSIONAL_DETAIL_RATE_LIMIT_WINDOW_MS,
} from "../server/lib/public-professionals-rate-limit.ts";

test("constantes de rate limit para directorio público son estables", () => {
  assert.equal(PUBLIC_PROFESSIONALS_SEARCH_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000);
  assert.equal(PUBLIC_PROFESSIONALS_SEARCH_RATE_LIMIT_MAX_ATTEMPTS, 10);
  assert.equal(
    PUBLIC_PROFESSIONALS_SEARCH_RATE_LIMIT_ERROR_MESSAGE,
    "Demasiadas consultas al directorio público. Intente más tarde.",
  );

  assert.equal(PUBLIC_PROFESSIONAL_DETAIL_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000);
  assert.equal(PUBLIC_PROFESSIONAL_DETAIL_RATE_LIMIT_MAX_ATTEMPTS, 20);
  assert.equal(
    PUBLIC_PROFESSIONAL_DETAIL_RATE_LIMIT_ERROR_MESSAGE,
    "Demasiadas consultas al perfil público. Intente más tarde.",
  );
});
