import { sql } from "drizzle-orm";

import { createExpressApp } from "./app";
import { bootstrapHttpServer } from "./bootstrap";
import {
  closeDbConnection,
  db,
  deleteExpiredAdminSessions,
  deleteExpiredSessions,
} from "./db";
import { deleteExpiredParticularSessions } from "./db-particular";
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

async function bootstrap() {
  const app = createExpressApp();

  await bootstrapHttpServer({
    port: ENV.port,
    preflight,
    closeResources,
    listen: (port, onListening) => app.listen(port, onListening),
  });
}

void bootstrap();
