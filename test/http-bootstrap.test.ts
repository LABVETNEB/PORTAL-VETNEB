import test from "node:test";
import assert from "node:assert/strict";

import {
  bootstrapHttpServer,
  createGracefulShutdown,
} from "../server/bootstrap.ts";

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

function createMockServer(options?: { closeError?: Error }) {
  let closeCalls = 0;

  const server = {
    close: (callback: (error?: Error | undefined) => void) => {
      closeCalls += 1;
      callback(options?.closeError);
      return server as any;
    },
  };

  return {
    server: server as any,
    getCloseCalls: () => closeCalls,
  };
}

test(
  "createGracefulShutdown cierra server y recursos y sale con codigo 0",
  async () => {
    const { logger, logs, errors } = createMockLogger();
    const { server, getCloseCalls } = createMockServer();

    let closeResourcesCalls = 0;
    const exitCodes: number[] = [];

    const shutdown = createGracefulShutdown({
      getServer: () => server,
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
  "bootstrapHttpServer ejecuta preflight listen y registra senales",
  async () => {
    const { logger, logs, errors } = createMockLogger();
    const { processApi, handlers, exitCodes } = createMockProcessApi();
    const { server } = createMockServer();

    let preflightCalls = 0;
    let closeResourcesCalls = 0;
    const listenPorts: number[] = [];

    const startedServer = await bootstrapHttpServer({
      port: 3000,
      preflight: async () => {
        preflightCalls += 1;

        return {
          deletedClinicSessions: 4,
          deletedAdminSessions: 2,
          deletedParticularSessions: 1,
        };
      },
      listen: (port, onListening) => {
        listenPorts.push(port);
        onListening();
        return server;
      },
      closeResources: async () => {
        closeResourcesCalls += 1;
      },
      logger: logger as any,
      processApi: processApi as any,
    });

    assert.equal(startedServer, server);
    assert.equal(preflightCalls, 1);
    assert.equal(closeResourcesCalls, 0);
    assert.deepEqual(listenPorts, [3000]);
    assert.ok(handlers.has("SIGINT"));
    assert.ok(handlers.has("SIGTERM"));
    assert.deepEqual(exitCodes, []);
    assert.equal(errors.length, 0);

    assert.deepEqual(logs, [
      ["API listening on http://localhost:3000"],
      ["Expired clinic sessions cleaned: 4"],
      ["Expired admin sessions cleaned: 2"],
      ["Expired particular sessions cleaned: 1"],
    ]);
  },
);

test(
  "bootstrapHttpServer cierra recursos y sale con codigo 1 cuando preflight falla",
  async () => {
    const expectedError = new Error("db down");
    const { logger, errors } = createMockLogger();
    const { processApi, exitCodes } = createMockProcessApi();

    let closeResourcesCalls = 0;
    let listenCalls = 0;

    await assert.rejects(
      () =>
        bootstrapHttpServer({
          port: 3000,
          preflight: async () => {
            throw expectedError;
          },
          listen: (_port, _onListening) => {
            listenCalls += 1;
            return createMockServer().server;
          },
          closeResources: async () => {
            closeResourcesCalls += 1;
          },
          logger: logger as any,
          processApi: processApi as any,
        }),
      expectedError,
    );

    assert.equal(listenCalls, 0);
    assert.equal(closeResourcesCalls, 1);
    assert.deepEqual(exitCodes, [1]);
    assert.deepEqual(errors[0], ["Failed to start server:", expectedError]);
  },
);
