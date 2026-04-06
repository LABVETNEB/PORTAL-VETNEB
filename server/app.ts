import cors from "cors";
import express from "express";
import { authRouter } from "./routes/auth.routes";
import { healthRouter } from "./routes/health.routes";
import { reportsRouter } from "./routes/reports.routes";
import { errorHandler, notFoundHandler } from "./middlewares/error-handler";
import { requestLogger } from "./middlewares/request-logger";
import { ENV } from "./lib/env";

export const app = express();

app.use(
  cors({
    origin: ENV.corsOrigin ? ENV.corsOrigin.split(",").map((item) => item.trim()) : true,
    credentials: true,
  }),
);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

app.use(healthRouter);
app.use(authRouter);
app.use(reportsRouter);

app.use(notFoundHandler);
app.use(errorHandler);
