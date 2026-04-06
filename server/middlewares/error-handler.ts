import type { NextFunction, Request, Response } from "express";

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({
    success: false,
    error: "Ruta no encontrada",
  });
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  console.error("[API ERROR]", error);

  res.status(500).json({
    success: false,
    error: "Internal Server Error",
  });
}
