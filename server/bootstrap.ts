import type { Server } from "node:http";

export type StartupCleanupSummary = {
  deletedClinicSessions: number;
  deletedAdminSessions: number;
  deletedParticularSessions: number;
};

type LoggerLike = Pick<Console, "log" | "error">;
type ProcessLike = Pick<NodeJS.Process, "on" | "exit">;

export type BootstrapHttpServerDeps = {
  port: number;
  preflight: () => Promise<StartupCleanupSummary>;
  listen: (port: number, onListening: () => void) => Server;
  closeResources: () => Promise<void>;
  logger?: LoggerLike;
  processApi?: ProcessLike;
};

export function createGracefulShutdown(deps: {
  getServer: () => Server | undefined;
  closeResources: () => Promise<void>;
  logger?: LoggerLike;
  exit?: (code: number) => void;
}) {
  const logger = deps.logger ?? console;
  const exit = deps.exit ?? ((code: number) => process.exit(code));

  return async function shutdown(signal: string) {
    logger.log(`Received ${signal}. Shutting down gracefully...`);

    try {
      await new Promise<void>((resolve, reject) => {
        const server = deps.getServer();

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

      await deps.closeResources();
      exit(0);
    } catch (error) {
      logger.error("Shutdown error:", error);
      exit(1);
    }
  };
}

export async function bootstrapHttpServer(
  deps: BootstrapHttpServerDeps,
): Promise<Server> {
  const logger = deps.logger ?? console;
  const processApi = deps.processApi ?? process;

  let server: Server | undefined;

  try {
    const cleanupSummary = await deps.preflight();

    server = deps.listen(deps.port, () => {
      logger.log(`API listening on http://localhost:${deps.port}`);
      logger.log(
        `Expired clinic sessions cleaned: ${cleanupSummary.deletedClinicSessions}`,
      );
      logger.log(
        `Expired admin sessions cleaned: ${cleanupSummary.deletedAdminSessions}`,
      );
      logger.log(
        `Expired particular sessions cleaned: ${cleanupSummary.deletedParticularSessions}`,
      );
    });

    const shutdown = createGracefulShutdown({
      getServer: () => server,
      closeResources: deps.closeResources,
      logger,
      exit: (code) => {
        processApi.exit(code);
      },
    });

    processApi.on("SIGINT", () => {
      void shutdown("SIGINT");
    });

    processApi.on("SIGTERM", () => {
      void shutdown("SIGTERM");
    });

    return server;
  } catch (error) {
    logger.error("Failed to start server:", error);

    try {
      await deps.closeResources();
    } catch {
      // ignore close errors during failed bootstrap
    }

    processApi.exit(1);
    throw error;
  }
}
