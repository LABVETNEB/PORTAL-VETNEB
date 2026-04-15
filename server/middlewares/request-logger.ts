import type { NextFunction, Request, Response } from "express";

export function sanitizeUrlForLogs(url: string): string {
  return url
    .replace(
      /(\/api\/public\/report-access\/)([^/?#]+)/gi,
      "$1[REDACTED]",
    )
    .replace(/([?&](?:token|reportAccessToken)=)([^&#]+)/gi, "$1[REDACTED]");
}

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const startTime = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startTime) / 1_000_000;
    const safeUrl = sanitizeUrlForLogs(req.originalUrl);

    console.log(
      `[${new Date().toISOString()}] ${req.method} ${safeUrl} ${res.statusCode} ${durationMs.toFixed(1)}ms`,
    );
  });

  next();
}
