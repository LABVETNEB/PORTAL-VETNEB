import { bootstrapHttpServer, type HttpServerHandle } from "./bootstrap.ts";
import { closeDbConnection } from "./db.ts";
import { createFastifyApp } from "./fastify-app.ts";
import { ENV } from "./lib/env.ts";
import { preflight } from "./preflight.ts";

async function closeResources(): Promise<void> {
  await closeDbConnection();
}

async function startFastifyServer(
  port: number,
): Promise<{ handle: HttpServerHandle; address: string }> {
  const app = await createFastifyApp();
  const address = await app.listen({
    port,
    host: "0.0.0.0",
  });

  return {
    address,
    handle: {
      close: async () => {
        await app.close();
      },
    },
  };
}

async function bootstrap() {
  await bootstrapHttpServer({
    port: ENV.port,
    preflight,
    closeResources,
    startServer: startFastifyServer,
  });
}

void bootstrap();
