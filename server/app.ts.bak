import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Request, type Response } from "express";

import { ENV } from "./lib/env";
import { errorHandler, notFoundHandler } from "./middlewares/error-handler";
import { requestLogger } from "./middlewares/request-logger";
import authRoutes from "./routes/auth.routes";
import healthRoutes from "./routes/health.routes";
import reportsRoutes from "./routes/reports.routes";

export const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

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
app.use("/api/reports", reportsRoutes);

app.use(notFoundHandler);
app.use(errorHandler);