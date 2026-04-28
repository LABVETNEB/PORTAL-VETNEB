import test from "node:test";
import assert from "node:assert/strict";
import {
  PUBLIC_REPORT_ACCESS_RATE_LIMIT_ERROR_MESSAGE,
  PUBLIC_REPORT_ACCESS_RATE_LIMIT_MAX_ATTEMPTS,
  PUBLIC_REPORT_ACCESS_RATE_LIMIT_WINDOW_MS,
} from "../server/lib/public-report-access-rate-limit.ts";

test("constantes de rate limit para acceso público a reportes son estables", () => {
  assert.equal(PUBLIC_REPORT_ACCESS_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000);
  assert.equal(PUBLIC_REPORT_ACCESS_RATE_LIMIT_MAX_ATTEMPTS, 10);
  assert.equal(
    PUBLIC_REPORT_ACCESS_RATE_LIMIT_ERROR_MESSAGE,
    "Demasiados accesos públicos al informe. Intente más tarde.",
  );
});
