import type { NextFunction, Request, Response } from "express";

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unexpected error";
}

function getHttpStatus(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "status" in error &&
    typeof (error as { status?: number }).status === "number"
  ) {
    return (error as { status: number }).status;
  }

  if (
    error &&
    typeof error === "object" &&
    "statusCode" in error &&
    typeof (error as { statusCode?: number }).statusCode === "number"
  ) {
    return (error as { statusCode: number }).statusCode;
  }

  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code?: string }).code === "string"
  ) {
    const code = (error as { code: string }).code;

    if (["23505", "23503", "22P02", "42703"].includes(code)) {
      return 400;
    }
  }

  return 500;
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    error: "Ruta no encontrada",
    path: req.originalUrl,
  });
}

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  const status = getHttpStatus(error);
  const message = getErrorMessage(error);

  console.error("[API ERROR]", {
    method: req.method,
    path: req.originalUrl,
    status,
    message,
    error,
  });

  res.status(status).json({
    success: false,
    error: status >= 500 ? "Error interno del servidor" : message,
    details: status >= 500 ? undefined : message,
    path: req.originalUrl,
  });
}
