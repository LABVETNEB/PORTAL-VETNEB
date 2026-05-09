import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";

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
};

function ensureContactRouteTestEnv() {
  process.env.NODE_ENV ??= "test";
  process.env.DATABASE_URL ??= "postgres://postgres:postgres@localhost:5432/test";
  process.env.SUPABASE_URL ??= "https://example.supabase.co";
  process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
}

async function createContactTestApp(options: ContactNativeRoutesOptions) {
  ensureContactRouteTestEnv();

  const { contactNativeRoutes } = await import(
    "../server/routes/contact.fastify.ts"
  );

  const app = Fastify({ logger: false });

  await app.register(contactNativeRoutes, options);

  return app;
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
      payload: {
        name: "Juan Perez",
        email: "juan@example.com",
        clinicName: "Clinica Norte",
        message: "Necesito registrar mi clinica en el portal.",
      },
    });

    assert.equal(response.statusCode, 200);
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
    };

    assert.equal(body.success, true);
    assert.equal(body.sent, false);
    assert.equal(body.reason, "smtp_disabled");
  } finally {
    await app.close();
  }
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
