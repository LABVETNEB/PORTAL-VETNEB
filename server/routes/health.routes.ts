import { Router } from "express";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  res.json({
    success: true,
    name: "PORTAL VETNEB API",
    version: "2.1.0",
    status: "running",
  });
});

healthRouter.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    status: "ok",
  });
});
