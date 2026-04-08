import type { Server } from "node:http";
import { sql } from "drizzle-orm";

import { app } from "./app";
import { closeDbConnection, db, deleteExpiredSessions } from "./db";
import { ENV } from "./lib/env";
import { ensureStorageBucketExists } from "./lib/supabase";

async function bootstrap() {
  let server: Server | undefined;

  try {
    await db.execute(sql`select 1`);
    await ensureStorageBucketExists();
    const deletedSessions = await deleteExpiredSessions();

    server = app.listen(ENV.port, () => {
      console.log(`API listening on http://localhost:${ENV.port}`);
      console.log(`Expired sessions cleaned: ${deletedSessions}`);
    });

    const shutdown = async (signal: string) => {
      console.log(`Received ${signal}. Shutting down gracefully...`);

      try {
        await new Promise<void>((resolve, reject) => {
          if (!server) {
            resolve();
            return;
          }

          server.close((error) => {
            if (error) {
              reject(error);
              return;
            }

            resolve();
          });
        });

        await closeDbConnection();
        process.exit(0);
      } catch (error) {
        console.error("Shutdown error:", error);
        process.exit(1);
      }
    };

    process.on("SIGINT", () => {
      void shutdown("SIGINT");
    });

    process.on("SIGTERM", () => {
      void shutdown("SIGTERM");
    });
  } catch (error) {
    console.error("Failed to start server:", error);

    try {
      await closeDbConnection();
    } catch {
      // ignore close errors during failed bootstrap
    }

    process.exit(1);
  }
}

void bootstrap();

