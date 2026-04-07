import { sql } from "drizzle-orm";
import { app } from "./app";
import { db } from "./db";
import { ENV } from "./lib/env";

async function bootstrap() {
  try {
    await db.execute(sql`select 1`);

    app.listen(ENV.port, () => {
      console.log(`API listening on http://localhost:${ENV.port}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

void bootstrap();