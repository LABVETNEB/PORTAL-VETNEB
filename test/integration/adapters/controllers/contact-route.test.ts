import assert from "node:assert/strict";
import test from "node:test";
import Fastify, { type FastifyServerOptions } from "fastify";

import type { RateLimitStore } from "../../../../server/lib/rate-limit-store.ts";

type ContactEmailResult =
  | { sent: true; messageId: string }
  | { sent: false; reason: "smtp_disabled" };

type ContactMessageInput = {
  name: string;
  email: string;
  clinicName: string | null;
  message: string;
};

type ContactNativeRoutesOptions = {
  sendContactMessageEmail?: (
    input: ContactMessageInput,
  ) => Promise<ContactEmailResult>;
  contactRateLimitWindowMs?: number;
  contactRateLimitMaxAttempts?: number;
  contactRateLimitStore?: RateLimitStore;
  now?: () => number;
};

function ensureContactRouteTestEnv() {
  process.env.NODE_ENV ??= "test";
  process.env.DATABASE_URL ??= "postgres://postgres:postgres@localhost:5432/test";
  process.env.SUPABASE_URL ??= "https://example.supabase.co";
  process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
  process.env.CORS_ORIGIN ??= "https://portal-vetneb-frontend-staging.onrender.com";
}

async function createContactTestApp(
  options: ContactNativeRoutesOptions,
  fastifyOptions: FastifyServerOptions = {},
) {
  ensureContactRouteTestEnv();

  const { contactNativeRoutes } = await import(
    "../../../../server/routes/contact.fastify.ts"
  );

  const app = Fastify({ logger: false, ...fastifyOptions });

  await app.register(contactNativeRoutes, options);

  return app;
}

function validContactPayload() {
  return {
    name: "Juan Perez",
    email: "juan@example.com",
    clinicName: "Clinica Norte",
    message: "Necesito registrar mi clinica en el portal.",
  };
}

test("contact endpoint validates required public contact payload", async () => {
  const app = await createContactTestApp({
    sendContactMessageEmail: async () => {
      throw new Error("sendContactMessageEmail should not be called");
    },
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/",
      payload: {
        name: "",
        email: "invalid",
        message: "short",
      },
    });

    assert.equal(response.statusCode, 400);

    const body = response.json() as {
      success: boolean;
      error: string;
      details: string[];
    };

    assert.equal(body.success, false);
    assert.equal(body.error, "Solicitud de contacto inválida");
    assert.ok(Array.isArray(body.details));
  } finally {
    await app.close();
  }
});

test("contact endpoint sends valid public contact payload", async () => {
  const sentPayloads: unknown[] = [];
  const app = await createContactTestApp({
    sendContactMessageEmail: async (input) => {
      sentPayloads.push(input);

      return { sent: true, messageId: "contact-message-id" };
    },
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/",
      headers: {
        origin: "https://portal-vetneb-frontend-staging.onrender.com",
      },
      payload: validContactPayload(),
    });

    assert.equal(response.statusCode, 200);
    assert.equal(
      response.headers["access-control-allow-origin"],
      "https://portal-vetneb-frontend-staging.onrender.com",
    );
    assert.deepEqual(sentPayloads, [
      {
        name: "Juan Perez",
        email: "juan@example.com",
        clinicName: "Clinica Norte",
        message: "Necesito registrar mi clinica en el portal.",
      },
    ]);

    const body = response.json() as {
      success: boolean;
      sent: boolean;
      message: string;
    };

    assert.equal(body.success, true);
    assert.equal(body.sent, true);
    assert.equal(body.message, "Mensaje enviado correctamente");
  } finally {
    await app.close();
  }
});

test("contact endpoint responde OPTIONS con CORS para origin permitido", async () => {
  const app = await createContactTestApp({
    sendContactMessageEmail: async () => ({
      sent: true,
      messageId: "should-not-run",
    }),
  });

  try {
    const response = await app.inject({
      method: "OPTIONS",
      url: "/",
      headers: {
        origin: "https://portal-vetneb-frontend-staging.onrender.com",
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type,x-trace-id",
      },
    });

    assert.equal(response.statusCode, 204);
    assert.equal(
      response.headers["access-control-allow-origin"],
      "https://portal-vetneb-frontend-staging.onrender.com",
    );
    assert.equal(
      response.headers["access-control-allow-methods"],
      "POST,OPTIONS",
    );
    assert.equal(
      response.headers["access-control-allow-headers"],
      "content-type,x-trace-id",
    );
  } finally {
    await app.close();
  }
});

test("contact endpoint accepts message when smtp is disabled", async () => {
  const app = await createContactTestApp({
    sendContactMessageEmail: async () => ({
      sent: false,
      reason: "smtp_disabled",
    }),
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/",
      payload: {
        name: "Maria Gomez",
        email: "maria@example.com",
        message: "Quiero consultar por los servicios de VETNEB.",
      },
    });

    assert.equal(response.statusCode, 202);

    const body = response.json() as {
      success: boolean;
      sent: boolean;
      reason: string;
      message: string;
    };

    assert.equal(body.success, true);
    assert.equal(body.sent, false);
    assert.equal(body.reason, "smtp_disabled");
    assert.equal(
      body.message,
      "Mensaje recibido, pero el envío automático de correo no está configurado. Contacte a VETNEB por los canales oficiales si requiere respuesta inmediata.",
    );
  } finally {
    await app.close();
  }
});

test("contact endpoint returns controlled smtp error and logs only safe diagnostics", async () => {
  const originalConsoleError = console.error;
  const errorCalls: unknown[][] = [];
  const sensitivePass = "smtp-pass-super-secret";
  const sensitiveUser = "smtp-user-sensitive@example.com";
  const sensitiveAccessToken = "sensitive-access-token";
  const sensitiveRefreshToken = "sensitive-refresh-token";

  console.error = (...args: unknown[]) => {
    errorCalls.push(args);
  };

  const app = await createContactTestApp({
    sendContactMessageEmail: async () => {
      throw Object.assign(
        new Error(
          `SMTP auth failure for ${sensitiveUser} using pass ${sensitivePass}`,
        ),
        {
          code: "ESOCKET",
          command: "CONN",
          syscall: "connect",
          hostname: "smtp.gmail.com",
          port: 587,
          responseCode: 421,
          address: "74.125.140.108",
          pass: sensitivePass,
          password: sensitivePass,
          auth: {
            user: sensitiveUser,
            pass: sensitivePass,
          },
          SMTP_PASS: sensitivePass,
          accessToken: sensitiveAccessToken,
          refreshToken: sensitiveRefreshToken,
        },
      );
    },
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/",
      payload: {
        name: "Maria Gomez",
        email: "maria@example.com",
        clinicName: "Clinica Sur",
        message: "Necesito confirmar una recepción de muestras.",
      },
    });

    assert.equal(response.statusCode, 502);

    const body = response.json() as {
      success: boolean;
      reason: string;
      error: string;
    };

    assert.equal(body.success, false);
    assert.equal(body.reason, "email_delivery_failed");
    assert.equal(
      body.error,
      "No se pudo enviar el mensaje en este momento. Intente nuevamente más tarde.",
    );
  } finally {
    console.error = originalConsoleError;
    await app.close();
  }

  assert.equal(errorCalls.length, 1);
  assert.equal(errorCalls[0]?.[0], "[EMAIL] contact_message failed");

  const payload = errorCalls[0]?.[1] as Record<string, unknown>;
  assert.equal("email" in payload, false, "contact email must not appear in error log");
  assert.equal(payload.hasClinicName, true);
  assert.equal("clinicName" in payload, false);
  assert.equal(payload.errorName, "Error");
  assert.equal(payload.code, "ESOCKET");
  assert.equal(payload.command, "CONN");
  assert.equal(payload.errorSyscall, "connect");
  assert.equal(payload.hostname, "smtp.gmail.com");
  assert.equal(payload.errorPort, 587);
  assert.equal(payload.responseCode, 421);
  assert.equal(payload.errorAddress, "74.125.140.108");

  for (const forbiddenKey of [
    "pass",
    "password",
    "auth",
    "SMTP_PASS",
    "accessToken",
    "refreshToken",
  ]) {
    assert.equal(forbiddenKey in payload, false);
  }

  const serializedPayload = JSON.stringify(payload);
  assert.equal(serializedPayload.includes("maria@example.com"), false, "contact email must not appear serialized");
  assert.equal(serializedPayload.includes(sensitivePass), false);
  assert.equal(serializedPayload.includes(sensitiveUser), false);
  assert.equal(serializedPayload.includes(sensitiveAccessToken), false);
  assert.equal(serializedPayload.includes(sensitiveRefreshToken), false);
});

test("contact endpoint rejects untrusted unsafe origins", async () => {
  const app = await createContactTestApp({
    sendContactMessageEmail: async () => ({
      sent: true,
      messageId: "unexpected",
    }),
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/",
      headers: {
        origin: "https://evil.example",
      },
      payload: {
        name: "Bad Origin",
        email: "bad@example.com",
        message: "Este mensaje no debe procesarse.",
      },
    });

    assert.equal(response.statusCode, 403);

    const body = response.json() as {
      success: boolean;
      error: string;
    };

    assert.equal(body.success, false);
    assert.equal(body.error, "Origen no permitido");
  } finally {
    await app.close();
  }
});

test("contact endpoint rate limit allows requests within the limit and blocks SMTP afterwards", async () => {
  let sendCalls = 0;
  const app = await createContactTestApp({
    now: () => 1_000,
    sendContactMessageEmail: async () => {
      sendCalls += 1;
      return { sent: true, messageId: `contact-${sendCalls}` };
    },
  });

  try {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const allowed = await app.inject({
        method: "POST",
        url: "/",
        remoteAddress: "198.51.100.10",
        payload: validContactPayload(),
      });

      assert.equal(allowed.statusCode, 200);
    }

    const blocked = await app.inject({
      method: "POST",
      url: "/",
      remoteAddress: "198.51.100.10",
      payload: validContactPayload(),
    });

    assert.equal(blocked.statusCode, 429);
    assert.equal(sendCalls, 5, "SMTP must not run for a rate-limited request");
    assert.equal(blocked.headers["ratelimit-policy"], "5;w=600");
    assert.equal(blocked.headers["ratelimit-limit"], "5");
    assert.equal(blocked.headers["ratelimit-remaining"], "0");
    assert.equal(blocked.headers["ratelimit-reset"], "600");
    assert.equal(blocked.headers["retry-after"], "600");

    const body = blocked.json() as {
      success: boolean;
      error: string;
    };

    assert.equal(body.success, false);
    assert.equal(
      body.error,
      "Demasiadas solicitudes. Intentá nuevamente en unos minutos.",
    );

    const serialized = JSON.stringify(body);
    for (const sensitiveValue of [
      "198.51.100.10",
      "juan@example.com",
      "Clinica Norte",
      "Necesito registrar mi clinica en el portal.",
    ]) {
      assert.equal(serialized.includes(sensitiveValue), false);
    }
  } finally {
    await app.close();
  }
});

test("contact endpoint rate limit keeps independent buckets per client", async () => {
  let sendCalls = 0;
  const app = await createContactTestApp({
    contactRateLimitMaxAttempts: 1,
    contactRateLimitWindowMs: 60_000,
    sendContactMessageEmail: async () => {
      sendCalls += 1;
      return { sent: true, messageId: `contact-${sendCalls}` };
    },
  });

  try {
    const firstClient = await app.inject({
      method: "POST",
      url: "/",
      remoteAddress: "198.51.100.20",
      payload: validContactPayload(),
    });
    const secondClient = await app.inject({
      method: "POST",
      url: "/",
      remoteAddress: "198.51.100.21",
      payload: validContactPayload(),
    });
    const firstClientBlocked = await app.inject({
      method: "POST",
      url: "/",
      remoteAddress: "198.51.100.20",
      payload: validContactPayload(),
    });

    assert.equal(firstClient.statusCode, 200);
    assert.equal(secondClient.statusCode, 200);
    assert.equal(firstClientBlocked.statusCode, 429);
    assert.equal(sendCalls, 2);
  } finally {
    await app.close();
  }
});

test("contact endpoint rate limit window expires without waiting in real time", async () => {
  let currentTime = 10_000;
  let sendCalls = 0;
  const app = await createContactTestApp({
    contactRateLimitMaxAttempts: 1,
    contactRateLimitWindowMs: 60_000,
    now: () => currentTime,
    sendContactMessageEmail: async () => {
      sendCalls += 1;
      return { sent: true, messageId: `contact-${sendCalls}` };
    },
  });

  try {
    const first = await app.inject({
      method: "POST",
      url: "/",
      remoteAddress: "198.51.100.30",
      payload: validContactPayload(),
    });
    const blocked = await app.inject({
      method: "POST",
      url: "/",
      remoteAddress: "198.51.100.30",
      payload: validContactPayload(),
    });

    currentTime += 60_001;

    const afterReset = await app.inject({
      method: "POST",
      url: "/",
      remoteAddress: "198.51.100.30",
      payload: validContactPayload(),
    });

    assert.equal(first.statusCode, 200);
    assert.equal(blocked.statusCode, 429);
    assert.equal(afterReset.statusCode, 200);
    assert.equal(sendCalls, 2);
  } finally {
    await app.close();
  }
});

test("contact rate limit uses Fastify trusted proxy client resolution", async () => {
  let sendCalls = 0;
  const app = await createContactTestApp(
    {
      contactRateLimitMaxAttempts: 1,
      contactRateLimitWindowMs: 60_000,
      sendContactMessageEmail: async () => {
        sendCalls += 1;
        return { sent: true, messageId: `contact-${sendCalls}` };
      },
    },
    { trustProxy: true },
  );

  try {
    const first = await app.inject({
      method: "POST",
      url: "/",
      remoteAddress: "10.0.0.5",
      headers: {
        "x-forwarded-for": "198.51.100.40, 203.0.113.40",
      },
      payload: validContactPayload(),
    });
    const blocked = await app.inject({
      method: "POST",
      url: "/",
      remoteAddress: "10.0.0.6",
      headers: {
        "x-forwarded-for": "198.51.100.40, 203.0.113.41",
      },
      payload: validContactPayload(),
    });

    assert.equal(first.statusCode, 200);
    assert.equal(blocked.statusCode, 429);
    assert.equal(sendCalls, 1);
  } finally {
    await app.close();
  }
});

test("contact rate limit remains scoped to the contact plugin", async () => {
  const app = await createContactTestApp({
    contactRateLimitMaxAttempts: 1,
    contactRateLimitWindowMs: 60_000,
    sendContactMessageEmail: async () => ({
      sent: true,
      messageId: "contact-message-id",
    }),
  });

  app.get("/health", async () => ({ ok: true }));

  try {
    await app.inject({
      method: "POST",
      url: "/",
      remoteAddress: "198.51.100.50",
      payload: validContactPayload(),
    });
    const blocked = await app.inject({
      method: "POST",
      url: "/",
      remoteAddress: "198.51.100.50",
      payload: validContactPayload(),
    });
    const health = await app.inject({
      method: "GET",
      url: "/health",
      remoteAddress: "198.51.100.50",
    });

    assert.equal(blocked.statusCode, 429);
    assert.equal(health.statusCode, 200);
    assert.deepEqual(health.json(), { ok: true });
    assert.equal(health.headers["ratelimit-limit"], undefined);
  } finally {
    await app.close();
  }
});
