import type { NextFunction, Request, Response } from "express";

export function sanitizeUrlForLogs(url: string): string {
  return url
    .replace(
      /(\/api\/public\/report-access\/)([^/?#]+)/gi,
      "$1[REDACTED]",
    )
    .replace(/([?&](?:token|reportAccessToken)=)([^&#]+)/gi, "$1[REDACTED]");
}

export function buildRequestLogLine(input: {
  timestamp: string;
  method: string;
  url: string;
  statusCode: number;
  durationMs: number;
}) {
  const baseLine =
    `[${input.timestamp}] ${input.method} ${input.url} ` +
    `${input.statusCode} ${input.durationMs.toFixed(1)}ms`;

  if (input.statusCode === 429) {
    return `${baseLine} RATE_LIMITED`;
  }

  return baseLine;
}

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const startTime = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startTime) / 1_000_000;
    const safeUrl = sanitizeUrlForLogs(req.originalUrl);

    console.log(
      buildRequestLogLine({
        timestamp: new Date().toISOString(),
        method: req.method,
        url: safeUrl,
        statusCode: res.statusCode,
        durationMs,
      }),
    );
  });

  next();
}
