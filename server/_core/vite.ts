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
  // Obtener el directorio raíz del proyecto
  // import.meta.dirname es: /opt/render/project/src/server/_core
  // Necesitamos: /opt/render/project
  const projectRoot = path.resolve(import.meta.dirname, "../..", "..");
  
  // Rutas posibles donde pueden estar los archivos compilados
  const possiblePaths = [
    path.resolve(projectRoot, "dist", "public"),      // dist/public (salida de Vite)
    path.resolve(projectRoot, "dist"),                // dist (fallback)
    path.resolve(projectRoot, "client", "dist"),      // client/dist (alternativa)
  ];

  console.log(`[serveStatic] Project root: ${projectRoot}`);
  console.log(`[serveStatic] Buscando archivos compilados en:`);
  possiblePaths.forEach((p, i) => {
    console.log(`  ${i + 1}. ${p} - Existe: ${fs.existsSync(p)}`);
  });

  // Encontrar el primer directorio que existe
  let distPath: string | null = null;
  for (const possiblePath of possiblePaths) {
    if (fs.existsSync(possiblePath)) {
      distPath = possiblePath;
      console.log(`[serveStatic] ✅ Usando: ${distPath}`);
      break;
    }
  }

  // Si no encontramos ninguno, usar el primero y mostrar error
  if (!distPath) {
    distPath = possiblePaths[0];
    console.error(
      `[serveStatic] ⚠️ ADVERTENCIA: No se encontró directorio de compilación en ninguna de las rutas esperadas`
    );
    console.error(`[serveStatic] Usando fallback: ${distPath}`);
    
    // Intentar servir desde client como último recurso
    const clientPath = path.resolve(projectRoot, "client");
    if (fs.existsSync(clientPath)) {
      console.log(`[serveStatic] Sirviendo desde cliente: ${clientPath}`);
      app.use(express.static(clientPath));
      app.use("*", (_req, res) => {
        const indexPath = path.resolve(clientPath, "index.html");
        if (fs.existsSync(indexPath)) {
          res.sendFile(indexPath);
        } else {
          res.status(404).send("index.html not found");
        }
      });
      return;
    }
  }

  // Servir archivos estáticos desde el directorio encontrado
  console.log(`[serveStatic] Configurando express.static para: ${distPath}`);
  app.use(express.static(distPath));

  // Fallback: servir index.html para rutas no encontradas (SPA)
  app.use("*", (_req, res) => {
    const indexPath = path.resolve(distPath, "index.html");
    console.log(`[serveStatic] Sirviendo SPA fallback: ${indexPath}`);
    
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      console.error(`[serveStatic] ❌ index.html no encontrado en: ${indexPath}`);
      res.status(404).send("index.html not found");
    }
  });
}
