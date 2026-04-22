import type { Server } from "node:http";
import { sql } from "drizzle-orm";

import { createExpressApp } from "./app";
import { bootstrapHttpServer, type HttpServerHandle } from "./bootstrap";
import { closeDbConnection, db, deleteExpiredAdminSessions, deleteExpiredSessions } from "./db";
import { deleteExpiredParticularSessions } from "./db-particular";
import { createFastifyApp } from "./fastify-app";
import { ENV } from "./lib/env";
import { ensureStorageBucketExists } from "./lib/supabase";

async function preflight() {
  await db.execute(sql`select 1`);
  await ensureStorageBucketExists();

  const [deletedClinicSessions, deletedAdminSessions, deletedParticularSessions] =
    await Promise.all([
      deleteExpiredSessions(),
      deleteExpiredAdminSessions(),
      deleteExpiredParticularSessions(),
    ]);

  return {
    deletedClinicSessions,
    deletedAdminSessions,
    deletedParticularSessions,
  };
}

async function closeResources() {
  await closeDbConnection();
}

async function startExpressServer(
  port: number,
): Promise<{ handle: HttpServerHandle; address: string }> {
  const app = createExpressApp();

  const server = await new Promise<Server>((resolve, reject) => {
    const candidate = app.listen(port, () => resolve(candidate));
    candidate.on("error", reject);
  });

  return {
    address: `http://localhost:${port}`,
    handle: {
      close: () =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error) {
              reject(error);
              return;
            }

            resolve();
          });
        }),
    },
  };
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
  const startServer =
    ENV.httpRuntime === "fastify"
      ? startFastifyServer
      : startExpressServer;

  await bootstrapHttpServer({
    port: ENV.port,
    preflight,
    closeResources,
    startServer,
  });
}

void bootstrap();
