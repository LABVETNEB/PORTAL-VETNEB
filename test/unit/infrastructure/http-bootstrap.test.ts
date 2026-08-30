import test from "node:test";
import assert from "node:assert/strict";

import {
  bootstrapHttpServer,
  createGracefulShutdown,
} from "../../../server/bootstrap.ts";

function createMockLogger() {
  const logs: unknown[][] = [];
  const errors: unknown[][] = [];

  return {
    logs,
    errors,
    logger: {
      log: (...args: unknown[]) => {
        logs.push(args);
      },
      error: (...args: unknown[]) => {
        errors.push(args);
      },
    },
  };
}

function createMockProcessApi() {
  const handlers = new Map<string, () => void>();
  const exitCodes: number[] = [];

  return {
    handlers,
    exitCodes,
    processApi: {
      on: (signal: string, handler: () => void) => {
        handlers.set(signal, handler);
        return undefined as any;
      },
      exit: (code: number) => {
        exitCodes.push(code);
        return undefined as never;
      },
    },
  };
}

function createMockHandle(options?: { closeError?: Error }) {
  let closeCalls = 0;

  return {
    handle: {
      close: async () => {
        closeCalls += 1;

        if (options?.closeError) {
          throw options.closeError;
        }
      },
    },
    getCloseCalls: () => closeCalls,
  };
}

test(
  "createGracefulShutdown cierra handle y recursos y sale con codigo 0",
  async () => {
    const { logger, logs, errors } = createMockLogger();
    const { handle, getCloseCalls } = createMockHandle();

    let closeResourcesCalls = 0;
    const exitCodes: number[] = [];

    const shutdown = createGracefulShutdown({
      getHandle: () => handle,
      closeResources: async () => {
        closeResourcesCalls += 1;
      },
      logger: logger as any,
      exit: (code) => {
        exitCodes.push(code);
      },
    });

    await shutdown("SIGTERM");

    assert.equal(getCloseCalls(), 1);
    assert.equal(closeResourcesCalls, 1);
    assert.deepEqual(exitCodes, [0]);
    assert.equal(errors.length, 0);
    assert.deepEqual(logs[0], [
      "Received SIGTERM. Shutting down gracefully...",
    ]);
  },
);

test(
  "createGracefulShutdown loguea SERVER_SHUTDOWN_FAILED sin datos crudos cuando el cierre falla",
  async () => {
    const databaseSecret =
      "postgresql://runtime-user:runtime-password@db.example.com/portal";
    const { logger } = createMockLogger();
    const { handle } = createMockHandle({
      closeError: new Error(databaseSecret),
    });
    const exitCodes: number[] = [];
    const consoleErrorCalls: string[] = [];
    const originalConsoleError = console.error;
    console.error = (...args: unknown[]) => {
      consoleErrorCalls.push(args.map(String).join(" "));
    };

    const shutdown = createGracefulShutdown({
      getHandle: () => handle,
      closeResources: async () => undefined,
      logger: logger as any,
      exit: (code) => {
        exitCodes.push(code);
      },
    });

    try {
      await shutdown("SIGINT");
    } finally {
      console.error = originalConsoleError;
    }

    assert.deepEqual(exitCodes, [1]);
    assert.equal(consoleErrorCalls.length, 1);
    assert.ok(consoleErrorCalls[0].includes('"event":"SERVER_SHUTDOWN_FAILED"'));
    assert.ok(consoleErrorCalls[0].includes('"errorName":"Error"'));
    assert.equal(consoleErrorCalls[0].includes(databaseSecret), false);
    assert.equal(consoleErrorCalls[0].includes("Shutdown error"), false);
  },
);

test(
  "bootstrapHttpServer ejecuta preflight startServer y registra senales",
  async () => {
    const { logger, logs, errors } = createMockLogger();
    const { processApi, handlers, exitCodes } = createMockProcessApi();
    const { handle, getCloseCalls } = createMockHandle();

    let preflightCalls = 0;
    let closeResourcesCalls = 0;
    const startedPorts: number[] = [];

    const startedHandle = await bootstrapHttpServer({
      port: 3000,
      preflight: async () => {
        preflightCalls += 1;

        return {
          deletedClinicSessions: 4,
          deletedAdminSessions: 2,
          deletedParticularSessions: 1,
        };
      },
      startServer: async (port) => {
        startedPorts.push(port);

        return {
          address: "http://127.0.0.1:3000",
          handle,
        };
      },
      closeResources: async () => {
        closeResourcesCalls += 1;
      },
      logger: logger as any,
      processApi: processApi as any,
    });

    assert.equal(startedHandle, handle);
    assert.equal(preflightCalls, 1);
    assert.equal(closeResourcesCalls, 0);
    assert.equal(getCloseCalls(), 0);
    assert.deepEqual(startedPorts, [3000]);
    assert.ok(handlers.has("SIGINT"));
    assert.ok(handlers.has("SIGTERM"));
    assert.deepEqual(exitCodes, []);
    assert.equal(errors.length, 0);

    assert.deepEqual(logs, [
      ["API listening on http://127.0.0.1:3000"],
      ["Expired clinic sessions cleaned: 4"],
      ["Expired admin sessions cleaned: 2"],
      ["Expired particular sessions cleaned: 1"],
    ]);
  },
);

test(
  "bootstrapHttpServer cierra recursos y sale con codigo 1 cuando preflight falla",
  async () => {
    // WBR-11: infrastructure errors go through the canonical structured
    // logger (logError), not the injectable console-like logger, so this
    // test spies on console.error the same way test/integration/app/
    // fastify-app.test.ts already does for API_ERROR events.
    const databaseSecret =
      "postgresql://runtime-user:runtime-password@db.example.com/portal";
    const expectedError = new Error(databaseSecret);
    const { logger } = createMockLogger();
    const { processApi, exitCodes } = createMockProcessApi();
    const consoleErrorCalls: string[] = [];
    const originalConsoleError = console.error;
    console.error = (...args: unknown[]) => {
      consoleErrorCalls.push(args.map(String).join(" "));
    };

    let closeResourcesCalls = 0;
    let startServerCalls = 0;

    try {
      await assert.rejects(
        () =>
          bootstrapHttpServer({
            port: 3000,
            preflight: async () => {
              throw expectedError;
            },
            startServer: async (_port) => {
              startServerCalls += 1;

              return {
                address: "http://127.0.0.1:3000",
                handle: createMockHandle().handle,
              };
            },
            closeResources: async () => {
              closeResourcesCalls += 1;
            },
            logger: logger as any,
            processApi: processApi as any,
          }),
        expectedError,
      );
    } finally {
      console.error = originalConsoleError;
    }

    assert.equal(startServerCalls, 0);
    assert.equal(closeResourcesCalls, 1);
    assert.deepEqual(exitCodes, [1]);
    assert.equal(consoleErrorCalls.length, 1);
    assert.ok(consoleErrorCalls[0].includes('"event":"SERVER_START_FAILED"'));
    assert.ok(consoleErrorCalls[0].includes('"errorName":"Error"'));
    assert.equal(consoleErrorCalls[0].includes(databaseSecret), false);
    assert.equal(consoleErrorCalls[0].includes("Failed to start server"), false);
  },
);
