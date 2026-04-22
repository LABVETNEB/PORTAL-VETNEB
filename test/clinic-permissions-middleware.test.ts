import test from "node:test";
import assert from "node:assert/strict";
import { requireClinicManagementPermission } from "../server/middlewares/clinic-permissions.ts";
function createMockResponse() {
  return {
    statusCode: 200,
    jsonPayload: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.jsonPayload = payload;
      return this;
    },
  };
}
test("requireClinicManagementPermission deja pasar cuando canManageClinicUsers es true", () => {
  const req = {
    auth: {
      canManageClinicUsers: true,
    },
  };
  const res = createMockResponse();
  const nextCalls: unknown[] = [];
  requireClinicManagementPermission(req as any, res as any, ((error?: unknown) => {
    nextCalls.push(error);
  }) as any);
  assert.equal(nextCalls.length, 1);
  assert.equal(nextCalls[0], undefined);
  assert.equal(res.statusCode, 200);
  assert.equal(res.jsonPayload, undefined);
});
test("requireClinicManagementPermission bloquea cuando canManageClinicUsers es false", () => {
  const req = {
    auth: {
      canManageClinicUsers: false,
    },
  };
  const res = createMockResponse();
  const nextCalls: unknown[] = [];
  requireClinicManagementPermission(req as any, res as any, ((error?: unknown) => {
    nextCalls.push(error);
  }) as any);
  assert.equal(nextCalls.length, 0);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.jsonPayload, {
    success: false,
    error: "No autorizado para administrar recursos de la clinica",
  });
});
test("requireClinicManagementPermission bloquea cuando no hay auth", () => {
  const req = {};
  const res = createMockResponse();
  const nextCalls: unknown[] = [];
  requireClinicManagementPermission(req as any, res as any, ((error?: unknown) => {
    nextCalls.push(error);
  }) as any);
  assert.equal(nextCalls.length, 0);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.jsonPayload, {
    success: false,
    error: "No autorizado para administrar recursos de la clinica",
  });
});
