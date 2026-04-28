import { sql } from "drizzle-orm";

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
