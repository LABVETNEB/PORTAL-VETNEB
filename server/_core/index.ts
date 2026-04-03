import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

// 1. Inicializar la aplicación Express
const app = express();

// 2. Configurar middlewares
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// 3. Registrar rutas de la API
registerOAuthRoutes(app);
app.use(
  "/api/trpc",
 createExpressMiddleware({
   router: appRouter,
   createContext,
 }),
);

// 4. Servir archivos estáticos en producción
if (process.env.NODE_ENV !== "development") {
  serveStatic(app);
}

// 5. EJECUCIÓN DEL SERVIDOR
const startServer = async () => {
  const server = createServer(app);
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  }
  const port = parseInt(process.env.PORT || "3000", 10);
  const host = "0.0.0.0";
  
  // ✅ IMPORTANTE: Escuchar en 0.0.0.0 para que Render pueda detectar el puerto
  server.listen(port, host, () => {
    console.log(`Servidor corriendo en http://${host}:${port}/ - CWD: ${process.cwd( )}`);
  });
};

startServer().catch(console.error);
