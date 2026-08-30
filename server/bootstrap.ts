import { logError, serializeError } from "./lib/logger.ts";

export type StartupCleanupSummary = {
  deletedClinicSessions: number;
  deletedAdminSessions: number;
  deletedParticularSessions: number;
};

export type HttpServerHandle = {
  close: () => Promise<void>;
};

// WBR-11 (VET-16): only informational startup announcements (log) go through
// this injectable logger; infrastructure errors go through the canonical
// structured logger (logError) so they're redacted the same way as every
// other error in this codebase.
type LoggerLike = Pick<Console, "log">;
type ProcessLike = Pick<NodeJS.Process, "on" | "exit">;

export type BootstrapHttpServerDeps = {
  port: number;
  preflight: () => Promise<StartupCleanupSummary>;
  startServer: (
    port: number,
  ) => Promise<{
    handle: HttpServerHandle;
    address?: string;
  }>;
  closeResources: () => Promise<void>;
  logger?: LoggerLike;
  processApi?: ProcessLike;
};

export function createGracefulShutdown(deps: {
  getHandle: () => HttpServerHandle | undefined;
  closeResources: () => Promise<void>;
  logger?: LoggerLike;
  exit?: (code: number) => void;
}) {
  const logger = deps.logger ?? console;
  const exit = deps.exit ?? ((code: number) => process.exit(code));

  return async function shutdown(signal: string) {
    logger.log(`Received ${signal}. Shutting down gracefully...`);

    try {
      const handle = deps.getHandle();

      if (handle) {
        await handle.close();
      }

      await deps.closeResources();
      exit(0);
    } catch (error) {
      logError("SERVER_SHUTDOWN_FAILED", { errorName: serializeError(error).name });
      exit(1);
    }
  };
}

export async function bootstrapHttpServer(
  deps: BootstrapHttpServerDeps,
): Promise<HttpServerHandle> {
  const logger = deps.logger ?? console;
  const processApi = deps.processApi ?? process;

  let handle: HttpServerHandle | undefined;

  try {
    const cleanupSummary = await deps.preflight();

    const started = await deps.startServer(deps.port);
    handle = started.handle;

    logger.log(
      `API listening on ${started.address ?? `http://localhost:${deps.port}`}`,
    );
    logger.log(
      `Expired clinic sessions cleaned: ${cleanupSummary.deletedClinicSessions}`,
    );
    logger.log(
      `Expired admin sessions cleaned: ${cleanupSummary.deletedAdminSessions}`,
    );
    logger.log(
      `Expired particular sessions cleaned: ${cleanupSummary.deletedParticularSessions}`,
    );

    const shutdown = createGracefulShutdown({
      getHandle: () => handle,
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

    return handle;
  } catch (error) {
    logError("SERVER_START_FAILED", { errorName: serializeError(error).name });

    try {
      await deps.closeResources();
    } catch {
      // ignore close errors during failed bootstrap
    }

    processApi.exit(1);
    throw error;
  }
}
