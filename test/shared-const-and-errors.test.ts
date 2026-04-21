import test from "node:test";
import assert from "node:assert/strict";
import {
  AXIOS_TIMEOUT_MS,
  COOKIE_NAME,
  NOT_ADMIN_ERR_MSG,
  ONE_YEAR_MS,
  UNAUTHED_ERR_MSG,
} from "../shared/const.ts";
import {
  BadRequestError,
  ForbiddenError,
  HttpError,
  NotFoundError,
  UnauthorizedError,
} from "../shared/_core/errors.ts";

test("shared const mantiene valores públicos esperados", () => {
  assert.equal(COOKIE_NAME, "app_session_id");
  assert.equal(ONE_YEAR_MS, 1000 * 60 * 60 * 24 * 365);
  assert.equal(AXIOS_TIMEOUT_MS, 30_000);
  assert.equal(UNAUTHED_ERR_MSG, "Inicia sesion (10001)");
  assert.equal(NOT_ADMIN_ERR_MSG, "No tienes el permiso requerido (10002)");
});

test("HttpError conserva statusCode, message y name", () => {
  const error = new HttpError(418, "Soy una tetera");

  assert.equal(error instanceof Error, true);
  assert.equal(error instanceof HttpError, true);
  assert.equal(error.statusCode, 418);
  assert.equal(error.message, "Soy una tetera");
  assert.equal(error.name, "HttpError");
});

test("BadRequestError devuelve HttpError 400", () => {
  const error = BadRequestError("Solicitud inválida");

  assert.equal(error instanceof HttpError, true);
  assert.equal(error.statusCode, 400);
  assert.equal(error.message, "Solicitud inválida");
  assert.equal(error.name, "HttpError");
});

test("UnauthorizedError devuelve HttpError 401", () => {
  const error = UnauthorizedError("No autenticado");

  assert.equal(error instanceof HttpError, true);
  assert.equal(error.statusCode, 401);
  assert.equal(error.message, "No autenticado");
});

test("ForbiddenError devuelve HttpError 403", () => {
  const error = ForbiddenError("Acceso denegado");

  assert.equal(error instanceof HttpError, true);
  assert.equal(error.statusCode, 403);
  assert.equal(error.message, "Acceso denegado");
});

test("NotFoundError devuelve HttpError 404", () => {
  const error = NotFoundError("Recurso no encontrado");

  assert.equal(error instanceof HttpError, true);
  assert.equal(error.statusCode, 404);
  assert.equal(error.message, "Recurso no encontrado");
});

test("constructores de error devuelven instancias distintas", () => {
  const first = BadRequestError("A");
  const second = BadRequestError("A");

  assert.notEqual(first, second);
  assert.equal(first.statusCode, second.statusCode);
  assert.equal(first.message, second.message);
});
