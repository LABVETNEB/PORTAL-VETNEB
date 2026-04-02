import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";

// Obtener __dirname en módulos ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        __dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  // CONFIGURACIÓN CRÍTICA PARA PRODUCCIÓN
  // __dirname es: /opt/render/project/src/dist (donde está index.js después de compilar)
  // publicDir es: /opt/render/project/src/dist/public (donde están los archivos del cliente compilados)
  
  const publicDir = path.resolve(__dirname, "public");
  const indexPath = path.resolve(publicDir, "index.html");
  
  console.log(`[serveStatic] === CONFIGURACIÓN DE PRODUCCIÓN ===`);
  console.log(`[serveStatic] __dirname: ${__dirname}`);
  console.log(`[serveStatic] publicDir: ${publicDir}`);
  console.log(`[serveStatic] indexPath: ${indexPath}`);
  console.log(`[serveStatic] publicDir existe: ${fs.existsSync(publicDir)}`);
  console.log(`[serveStatic] index.html existe: ${fs.existsSync(indexPath)}`);
  
  if (fs.existsSync(publicDir)) {
    const files = fs.readdirSync(publicDir);
    console.log(`[serveStatic] ✅ Archivos en publicDir: ${files.join(", ")}`);
  } else {
    console.error(`[serveStatic] ❌ publicDir NO EXISTE: ${publicDir}`);
  }

  // PASO 1: Servir archivos estáticos SOLO desde publicDir
  // CRÍTICO: NO servir index.html como archivo estático
  // Esto previene que Express sirva index.html cuando accedes a /index.html
  // pero permitimos que se sirva para rutas específicas como /assets/*, /favicon.ico, etc.
  app.use(express.static(publicDir, {
    // NO servir index.html automáticamente
    index: false,
    // Permitir que los navegadores cacheen archivos estáticos por 1 año
    maxAge: "1y",
    // Permitir que los navegadores compriman respuestas
    dotfiles: "ignore",
  }));

  // PASO 2: Manejo de rutas de API (si las hay)
  // Esto es importante para que las rutas de API no sean interceptadas por el fallback SPA
  // Si tienes rutas de API en /api/*, asegúrate de que estén registradas ANTES de este middleware

  // PASO 3: Fallback SPA - DEBE ir al final
  // Cualquier ruta que no sea un archivo estático debe servir index.html
  // Esto permite que React Router maneje el enrutamiento en el cliente
  app.use("*", (_req, res) => {
    if (fs.existsSync(indexPath)) {
      console.log(`[serveStatic] Sirviendo SPA fallback desde: ${indexPath}`);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.sendFile(indexPath);
    } else {
      console.error(`[serveStatic] ❌ CRÍTICO: index.html no encontrado en: ${indexPath}`);
      console.error(`[serveStatic] Contenido de publicDir:`, 
        fs.existsSync(publicDir) ? fs.readdirSync(publicDir) : "DIR NO EXISTE");
      res.status(404).send("index.html not found - SPA fallback failed");
    }
  });
}
