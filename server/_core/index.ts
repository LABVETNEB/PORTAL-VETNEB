import express from "express";
import cors from "cors";
import "dotenv/config";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    success: true,
    name: "PORTAL VETNEB API",
    version: "2.0.0",
    status: "running"
  });
});

app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    status: "ok"
  });
});

const PORT = Number(process.env.PORT || 3000);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});