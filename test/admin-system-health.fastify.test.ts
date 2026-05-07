import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";

import { ENV } from "../server/lib/env.ts";
import { adminSystemHealthNativeRoutes } from "../server/routes/admin-system-health.fastify.ts";

test("admin system health requiere sesión admin", async () => {
  const app = Fastify();

  await app.register(adminSystemHealthNativeRoutes, {
    deleteAdminSession: async () => {},
    getAdminSessionByToken: async () => null,
    getAdminUserById: async () => null,
    updateAdminSessionLastAccess: async () => {},
    hashSessionToken: (token: string) => `hash:${token}`,
    getSystemHealthSnapshot: async () => ({
      statusCode: 200,
      payload: {
        success: true,
        status: "ok",
        checks: {
          database: "up",
          storage: "up",
        },
      },
    }),
    getBackendVersion: () => "test-version",
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/",
    });

    assert.equal(response.statusCode, 401);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: "Admin no autenticado",
    });
  } finally {
    await app.close();
  }
});

test("admin system health expone servicios, runtime y versión para admin autenticado", async () => {
  const app = Fastify();
  let updatedLastAccess = false;

  await app.register(adminSystemHealthNativeRoutes, {
    deleteAdminSession: async () => {},
    getAdminSessionByToken: async () => ({
      adminUserId: 1,
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      lastAccess: new Date("2026-04-23T00:00:00.000Z"),
    }),
    getAdminUserById: async () => ({
      id: 1,
      username: "VETNEB",
    }),
    updateAdminSessionLastAccess: async () => {
      updatedLastAccess = true;
    },
    hashSessionToken: (token: string) => `hash:${token}`,
    getSystemHealthSnapshot: async () => ({
      statusCode: 200,
      payload: {
        success: true,
        status: "ok",
        checks: {
          database: "up",
          storage: "up",
        },
        uptimeSeconds: 123,
        responseTimeMs: 5,
        timestamp: "2026-05-07T00:00:00.000Z",
      },
    }),
    getBackendVersion: () => "2.1.0-test",
    now: () => Date.UTC(2026, 4, 7, 0, 0, 0),
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/",
      headers: {
        cookie: `${ENV.adminCookieName}=admin-session-token`,
      },
    });

    assert.equal(response.statusCode, 200);

    const body = JSON.parse(response.body);

    assert.equal(body.success, true);
    assert.equal(body.status, "ok");
    assert.equal(body.version, "2.1.0-test");
    assert.deepEqual(body.services, {
      database: "up",
      storage: "up",
    });
    assert.deepEqual(body.checkedBy, {
      adminUserId: 1,
      username: "VETNEB",
    });
    assert.equal(typeof body.runtime.uptimeSeconds, "number");
    assert.equal(typeof body.runtime.memory.rssMb, "number");
    assert.equal(body.health.status, "ok");
    assert.equal(updatedLastAccess, true);
  } finally {
    await app.close();
  }
});