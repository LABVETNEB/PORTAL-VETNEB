import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";

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
        import.meta.dirname,
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
  // En Render, los archivos compilados están en dist/public
  const distPath = path.resolve(import.meta.dirname, "../..", "dist", "public");
  
  console.log(`[serveStatic] Intentando servir desde: ${distPath}`);
  console.log(`[serveStatic] Directorio existe: ${fs.existsSync(distPath)}`);

  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
    // Fallback: servir desde dist raíz si dist/public no existe
    const distRootPath = path.resolve(import.meta.dirname, "../..", "dist");
    if (fs.existsSync(distRootPath)) {
      console.log(`[serveStatic] Usando fallback: ${distRootPath}`);
      app.use(express.static(distRootPath));
      app.use("*", (_req, res) => {
        res.sendFile(path.resolve(distRootPath, "index.html"));
      });
      return;
    }
    
    // Último fallback: servir desde client
    const clientPath = path.resolve(import.meta.dirname, "../..", "client");
    console.log(`[serveStatic] Último fallback: ${clientPath}`);
    app.use(express.static(clientPath));
    app.use("*", (_req, res) => {
      res.sendFile(path.resolve(clientPath, "index.html"));
    });
    return;
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
