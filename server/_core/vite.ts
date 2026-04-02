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
  // __dirname es: /opt/render/project/src/dist (después de compilar con esbuild)
  // Necesitamos: /opt/render/project/src/dist/public
  const publicDir = path.resolve(__dirname, "public");
  const indexPath = path.resolve(publicDir, "index.html");
  
  console.log(`[serveStatic] __dirname: ${__dirname}`);
  console.log(`[serveStatic] publicDir: ${publicDir}`);
  console.log(`[serveStatic] indexPath: ${indexPath}`);
  console.log(`[serveStatic] publicDir existe: ${fs.existsSync(publicDir)}`);
  console.log(`[serveStatic] index.html existe: ${fs.existsSync(indexPath)}`);
  
  if (fs.existsSync(publicDir)) {
    const files = fs.readdirSync(publicDir);
    console.log(`[serveStatic] ✅ Archivos en publicDir: ${files.join(", ")}`);
  }

  // Servir archivos estáticos (CSS, JS, imágenes, etc.)
  app.use(express.static(publicDir, {
    // No servir index.html como archivo estático
    index: false,
  }));

  // Fallback: servir index.html para TODAS las rutas (SPA)
  // Esto debe ir DESPUÉS de express.static para que los archivos estáticos se sirvan primero
  app.use("*", (_req, res) => {
    if (fs.existsSync(indexPath)) {
      console.log(`[serveStatic] Sirviendo SPA fallback: ${indexPath}`);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.sendFile(indexPath);
    } else {
      console.error(`[serveStatic] ❌ index.html no encontrado en: ${indexPath}`);
      res.status(404).send("index.html not found");
    }
  });
}
