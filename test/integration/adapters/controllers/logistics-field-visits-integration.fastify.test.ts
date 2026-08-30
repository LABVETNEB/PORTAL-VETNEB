import test from "node:test";
import assert from "node:assert/strict";
import Fastify, { type FastifyInstance } from "fastify";
import type { InjectOptions } from "light-my-request";

import type {
  FieldVisit,
  UpdateFieldVisitInput,
} from "../../../../server/features/logistics/infrastructure/db-logistics.ts";
import type { ClinicUserRole } from "../../../../drizzle/schema.ts";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const { ENV } = await import("../../../../server/lib/env.ts");
const { logisticsFieldVisitsNativeRoutes } = await import(
  "../../../../server/routes/logistics-field-visits.fastify.ts"
);

const VALID_ORIGIN = "http://localhost:3000";
const BLOCKED_ORIGIN = "https://evil.example.com";
const SESSION_TOKEN = "field-visit-session";
const SESSION_COOKIE = `${ENV.cookieName}=${SESSION_TOKEN}`;

type UpdateCall = {
  id: number;
  clinicId: number;
  input: UpdateFieldVisitInput;
};

function buildFieldVisit(overrides: Partial<FieldVisit> = {}): FieldVisit {
  return {
    id: 42,
    clinicId: 7,
    sourceType: "manual",
    sourceId: null,
    status: "pending",
    priority: 0,
    criticality: null,
    serviceDurationMin: 30,
    notes: null,
    createdAt: new Date("2026-07-19T12:00:00.000Z"),
    updatedAt: new Date("2026-07-19T12:00:00.000Z"),
    ...overrides,
  };
}

async function buildRuntimeApp(options: {
  role?: ClinicUserRole;
  updateClinicScopedFieldVisit?: (
    id: number,
    clinicId: number,
    input: UpdateFieldVisitInput,
  ) => Promise<FieldVisit | null | undefined>;
} = {}): Promise<{ app: FastifyInstance; updateCalls: UpdateCall[] }> {
  const app = Fastify();
  const updateCalls: UpdateCall[] = [];

  await app.register(logisticsFieldVisitsNativeRoutes, {
    prefix: "/api/logistics/field-visits",
    now: () => Date.UTC(2026, 6, 19, 12, 0, 0),
    deleteActiveSession: async () => {},
    getActiveSessionByToken: async (tokenHash: string) =>
      tokenHash === `hash:${SESSION_TOKEN}`
        ? {
            clinicUserId: 9,
            expiresAt: new Date("2099-01-01T00:00:00.000Z"),
            lastAccess: new Date("2026-07-19T11:59:00.000Z"),
          }
        : null,
    getClinicUserById: async (clinicUserId: number) =>
      clinicUserId === 9
        ? {
            id: 9,
            clinicId: 7,
            username: "clinic-owner",
            authProId: null,
            role: options.role ?? "clinic_owner",
          }
        : null,
    updateSessionLastAccess: async () => {},
    hashSessionToken: (token: string) => `hash:${token}`,
    createFieldVisit: async () => null,
    listClinicFieldVisits: async () => [],
    updateClinicScopedFieldVisit: async (id, clinicId, input) => {
      updateCalls.push({ id, clinicId, input });

      if (options.updateClinicScopedFieldVisit) {
        return options.updateClinicScopedFieldVisit(id, clinicId, input);
      }

      return buildFieldVisit({
        id,
        clinicId,
        ...input,
        updatedAt: new Date("2026-07-19T12:05:00.000Z"),
      });
    },
    getVisitLocationForClinicVisit: async () => null,
    upsertVisitLocationForClinicVisit: async () => null,
    createTimeWindowForClinicVisit: async () => null,
    listTimeWindowsForClinicVisit: async () => [],
  });

  return { app, updateCalls };
}

function patchInput(
  fieldVisitId: string,
  payload: Record<string, unknown>,
  origin = VALID_ORIGIN,
): InjectOptions {
  return {
    method: "PATCH",
    url: `/api/logistics/field-visits/${fieldVisitId}`,
    headers: {
      cookie: SESSION_COOKIE,
      origin,
      "content-type": "application/json",
    },
    payload: JSON.stringify(payload),
  };
}

test("field visits rejects a request without a clinic session", async () => {
  const { app, updateCalls } = await buildRuntimeApp();

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/logistics/field-visits",
    });

    assert.equal(response.statusCode, 401);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: "No autenticado",
    });
    assert.deepEqual(updateCalls, []);
  } finally {
    await app.close();
  }
});

test("PATCH field visit actualiza status y usa el clinicId autenticado", async () => {
  const { app, updateCalls } = await buildRuntimeApp();

  try {
    const response = await app.inject(
      patchInput("42", { status: "in_progress", clinicId: 999 }),
    );
    const body = JSON.parse(response.body);

    assert.equal(response.statusCode, 200);
    assert.equal(body.success, true);
    assert.equal(body.message, "Visita de campo actualizada correctamente");
    assert.equal(body.fieldVisit.status, "in_progress");
    assert.equal(updateCalls.length, 1);
    assert.deepEqual(updateCalls[0], {
      id: 42,
      clinicId: 7,
      input: { status: "in_progress" },
    });
  } finally {
    await app.close();
  }
});

test("PATCH field visit preserva status y otro campo en una sola delegación", async () => {
  const { app, updateCalls } = await buildRuntimeApp();

  try {
    const response = await app.inject(
      patchInput("42", { status: "done", notes: "Visita completada" }),
    );

    assert.equal(response.statusCode, 200);
    assert.equal(updateCalls.length, 1);
    assert.deepEqual(updateCalls[0]?.input, {
      status: "done",
      notes: "Visita completada",
    });
  } finally {
    await app.close();
  }
});

test("PATCH field visit rechaza status inválido antes del puerto", async () => {
  const { app, updateCalls } = await buildRuntimeApp();

  try {
    const response = await app.inject(patchInput("42", { status: "unknown" }));

    assert.equal(response.statusCode, 400);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: "status invalido",
    });
    assert.deepEqual(updateCalls, []);
  } finally {
    await app.close();
  }
});

test("PATCH field visit rechaza body vacío antes del puerto", async () => {
  const { app, updateCalls } = await buildRuntimeApp();

  try {
    const response = await app.inject(patchInput("42", {}));

    assert.equal(response.statusCode, 400);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: "No hay cambios para aplicar",
    });
    assert.deepEqual(updateCalls, []);
  } finally {
    await app.close();
  }
});

test("PATCH field visit rechaza fieldVisitId inválido antes del puerto", async () => {
  const { app, updateCalls } = await buildRuntimeApp();

  try {
    const response = await app.inject(patchInput("invalid", { status: "done" }));

    assert.equal(response.statusCode, 400);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: "fieldVisitId invalido",
    });
    assert.deepEqual(updateCalls, []);
  } finally {
    await app.close();
  }
});

test("PATCH field visit mapea null y undefined a 404 sin cambiar el mensaje", async (t) => {
  for (const [label, result] of [
    ["null", null],
    ["undefined", undefined],
  ] as const) {
    await t.test(label, async () => {
      const { app, updateCalls } = await buildRuntimeApp({
        updateClinicScopedFieldVisit: async () => result,
      });

      try {
        const response = await app.inject(patchInput("42", { status: "done" }));

        assert.equal(response.statusCode, 404);
        assert.deepEqual(JSON.parse(response.body), {
          success: false,
          error: "Visita de campo no encontrada",
        });
        assert.equal(updateCalls.length, 1);
      } finally {
        await app.close();
      }
    });
  }
});

test("PATCH field visit rechaza permiso insuficiente antes del puerto", async () => {
  const { app, updateCalls } = await buildRuntimeApp({ role: "clinic_staff" });

  try {
    const response = await app.inject(patchInput("42", { status: "done" }));

    assert.equal(response.statusCode, 403);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: "Permisos insuficientes para logistica",
    });
    assert.deepEqual(updateCalls, []);
  } finally {
    await app.close();
  }
});

test("PATCH field visit rechaza origen no permitido antes del puerto", async () => {
  const { app, updateCalls } = await buildRuntimeApp();

  try {
    const response = await app.inject(
      patchInput("42", { status: "done" }, BLOCKED_ORIGIN),
    );

    assert.equal(response.statusCode, 403);
    assert.deepEqual(JSON.parse(response.body), {
      success: false,
      error: "Origen no permitido",
    });
    assert.deepEqual(updateCalls, []);
  } finally {
    await app.close();
  }
});

test("dos PATCH iguales producen dos delegaciones independientes", async () => {
  const { app, updateCalls } = await buildRuntimeApp();

  try {
    const request = patchInput("42", { status: "scheduled" });
    const first = await app.inject(request);
    const second = await app.inject(request);

    assert.equal(first.statusCode, 200);
    assert.equal(second.statusCode, 200);
    assert.equal(updateCalls.length, 2);
    assert.deepEqual(updateCalls[0], updateCalls[1]);
  } finally {
    await app.close();
  }
});
