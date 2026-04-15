import express, { type NextFunction, type Request, type Response } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";

import adminAuthRoutes from "./routes/admin-auth.routes";
import adminParticularTokensRoutes from "./routes/admin-particular-tokens.routes";
import adminReportAccessTokensRoutes from "./routes/admin-report-access-tokens.routes";
import adminStudyTrackingRoutes from "./routes/admin-study-tracking.routes";
import authRoutes from "./routes/auth.routes";
import clinicPublicProfileRoutes from "./routes/clinic-public-profile.routes";
import healthRoutes from "./routes/health.routes";
import particularAuthRoutes from "./routes/particular-auth.routes";
import particularStudyTrackingRoutes from "./routes/particular-study-tracking.routes";
import particularTokensRoutes from "./routes/particular-tokens.routes";
import publicProfessionalsRoutes from "./routes/public-professionals.routes";
import publicReportAccessRoutes from "./routes/public-report-access.routes";
import reportAccessTokensRoutes from "./routes/report-access-tokens.routes";
import reportsRoutes from "./routes/reports.routes";
import studyTrackingRoutes from "./routes/study-tracking.routes";
import { ENV } from "./lib/env";
import { errorHandler, notFoundHandler } from "./middlewares/error-handler";
import { requestLogger } from "./middlewares/request-logger";

const app = express();

app.set("trust proxy", ENV.trustProxy);

function getAllowedOrigins(): string[] {
  const configuredOrigins = ENV.corsOrigins.map((origin) =>
    origin.trim().toLowerCase(),
  );

  if (configuredOrigins.length > 0) {
    return configuredOrigins;
  }

  if (ENV.isDevelopment) {
    return [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://localhost:3001",
      "http://127.0.0.1:3001",
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    ];
  }

  return [];
}

const allowedOrigins = new Set(getAllowedOrigins());

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      const normalizedOrigin = origin.trim().toLowerCase();

      if (allowedOrigins.has(normalizedOrigin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origen no permitido por CORS"));
    },
    credentials: true,
  }),
);

app.use(cookieParser());
app.use(
  express.json({
    strict: true,
  }),
);
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

app.use(
  (err: unknown, _req: Request, res: Response, next: NextFunction) => {
    const isJsonSyntaxError =
      err instanceof SyntaxError &&
      typeof err === "object" &&
      err !== null &&
      "body" in err &&
      "status" in err &&
      (err as { status?: number }).status === 400;

    if (isJsonSyntaxError) {
      console.error("JSON PARSE ERROR:", (err as Error).message);

      return res.status(400).json({
        success: false,
        error: "JSON inválido",
      });
    }

    next(err);
  },
);

app.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    service: "portal-vetneb-api",
    environment: ENV.nodeEnv,
  });
});

app.use("/health", healthRoutes);
app.use("/api/health", healthRoutes);

app.use("/api/auth", authRoutes);
app.use("/api/admin/auth", adminAuthRoutes);
app.use("/api/clinic/profile", clinicPublicProfileRoutes);
app.use("/api/admin/particular/tokens", adminParticularTokensRoutes);
app.use("/api/admin/report-access-tokens", adminReportAccessTokensRoutes);
app.use("/api/admin/study-tracking", adminStudyTrackingRoutes);
app.use("/api/particular/tokens", particularTokensRoutes);
app.use("/api/particular/auth", particularAuthRoutes);
app.use("/api/particular/study-tracking", particularStudyTrackingRoutes);
app.use("/api/public/professionals", publicProfessionalsRoutes);
app.use("/api/public/report-access", publicReportAccessRoutes);
app.use("/api/report-access-tokens", reportAccessTokensRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/study-tracking", studyTrackingRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export { app };
