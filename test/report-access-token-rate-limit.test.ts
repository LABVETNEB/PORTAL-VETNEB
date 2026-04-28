import test from "node:test";
import assert from "node:assert/strict";
import {
  REPORT_ACCESS_TOKEN_MUTATION_RATE_LIMIT_ERROR_MESSAGE,
  REPORT_ACCESS_TOKEN_MUTATION_RATE_LIMIT_MAX_ATTEMPTS,
  REPORT_ACCESS_TOKEN_MUTATION_RATE_LIMIT_WINDOW_MS,
} from "../server/lib/report-access-token-rate-limit.ts";

test("constantes de rate limit para tokens públicos de informes son estables", () => {
  assert.equal(REPORT_ACCESS_TOKEN_MUTATION_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000);
  assert.equal(REPORT_ACCESS_TOKEN_MUTATION_RATE_LIMIT_MAX_ATTEMPTS, 10);
  assert.equal(
    REPORT_ACCESS_TOKEN_MUTATION_RATE_LIMIT_ERROR_MESSAGE,
    "Demasiadas operaciones sobre tokens públicos de informes. Intente más tarde.",
  );
});
