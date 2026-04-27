import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import cookieParser from "cookie-parser";
import cors from "cors";

import adminAuthRoutes from "./routes/admin-auth.routes";
import adminParticularTokensRoutes from "./routes/admin-particular-tokens.routes";
import adminReportAccessTokensRoutes from "./routes/admin-report-access-tokens.routes";
import adminStudyTrackingRoutes from "./routes/admin-study-tracking.routes";
import authRoutes from "./routes/auth.routes";
import clinicPublicProfileRoutes from "./routes/clinic-public-profile.routes";
import clinicAuditRoutes from "./routes/clinic-audit.routes";
import healthRoutes from "./routes/health.routes";
import particularAuthRoutes from "./routes/particular-auth.routes";
import particularStudyTrackingRoutes from "./routes/particular-study-tracking.routes";
import particularTokensRoutes from "./routes/particular-tokens.routes";
import publicProfessionalsRoutes from "./routes/public-professionals.routes";
import publicReportAccessRoutes from "./routes/public-report-access.routes";
import reportAccessTokensRoutes from "./routes/report-access-tokens.routes";
import studyTrackingRoutes from "./routes/study-tracking.routes";
import { ENV } from "./lib/env";
import { buildServiceInfoPayload } from "./lib/http-runtime";
import { errorHandler, notFoundHandler } from "./middlewares/error-handler";
import { requestLogger } from "./middlewares/request-logger";

export type CreateExpressAppOptions = {
  apiBasePath?: string;
  includeRootRoute?: boolean;
  includeHealthRoutes?: boolean;
};

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

function buildMountedPath(basePath: string, suffix: string) {
  return basePath ? `${basePath}${suffix}` : suffix;
}

export function createExpressApp(
  options: CreateExpressAppOptions = {},
): Express {
  const app = express();
  const allowedOrigins = new Set(getAllowedOrigins());
  const apiBasePath = options.apiBasePath ?? "/api";
  const includeRootRoute = options.includeRootRoute ?? true;
  const includeHealthRoutes = options.includeHealthRoutes ?? true;

  const mountApiRoute = (suffix: string, router: any) => {
    app.use(buildMountedPath(apiBasePath, suffix), router);
  };

  app.set("trust proxy", ENV.trustProxy);

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

  if (includeRootRoute) {
    app.get("/", (_req: Request, res: Response) => {
      res.status(200).json(buildServiceInfoPayload());
    });
  }

  if (includeHealthRoutes) {
    app.use("/health", healthRoutes);
    mountApiRoute("/health", healthRoutes);
  }
  mountApiRoute("/auth", authRoutes);
  mountApiRoute("/admin/auth", adminAuthRoutes);
  mountApiRoute("/clinic/profile", clinicPublicProfileRoutes);
  mountApiRoute("/clinic/audit-log", clinicAuditRoutes);
  mountApiRoute("/admin/particular/tokens", adminParticularTokensRoutes);
  mountApiRoute("/admin/report-access-tokens", adminReportAccessTokensRoutes);
  mountApiRoute("/admin/study-tracking", adminStudyTrackingRoutes);
  mountApiRoute("/particular/tokens", particularTokensRoutes);
  mountApiRoute("/particular/auth", particularAuthRoutes);
  mountApiRoute("/particular/study-tracking", particularStudyTrackingRoutes);
  mountApiRoute("/public/professionals", publicProfessionalsRoutes);
  mountApiRoute("/public/report-access", publicReportAccessRoutes);
  mountApiRoute("/report-access-tokens", reportAccessTokensRoutes);
  mountApiRoute("/study-tracking", studyTrackingRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

const app = createExpressApp();

export { app };
