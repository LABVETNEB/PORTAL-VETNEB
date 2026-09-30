import test from "node:test";
import assert from "node:assert/strict";
import {
  logError,
  logInfo,
  logWarn,
  serializeError,
} from "../../../server/lib/logger.ts";
import { readSourceFile } from "../../helpers/tracked-source-files.ts";
import { createEmailDependencies } from "../../mocks/email-dependencies.ts";

process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const { sendContactMessageEmail, sendSpecialStainRequiredEmail } = await import("../../../server/lib/email.ts");

function captureSingleJsonLine(
  channel: "log" | "warn" | "error",
  run: () => void,
) {
  const original = console[channel];
  const calls: unknown[][] = [];

  console[channel] = (...args: unknown[]) => {
    calls.push(args);
  };

  try {
    run();
  } finally {
    console[channel] = original;
  }

  assert.equal(calls.length, 1);
  assert.equal(calls[0].length, 1);
  assert.equal(typeof calls[0][0], "string");

  return JSON.parse(calls[0][0] as string) as Record<string, unknown>;
}

test("logInfo emite una linea JSON estructurada con nivel info", () => {
  const logEvent = captureSingleJsonLine("log", () => {
    logInfo("HOLA_EVENTO", { ok: true });
  });

  assert.equal(logEvent.level, "info");
  assert.equal(logEvent.event, "HOLA_EVENTO");
  assert.deepEqual(logEvent.context, { ok: true });
  assert.equal(typeof logEvent.timestamp, "string");
});

test("logWarn emite una linea JSON estructurada con nivel warn", () => {
  const logEvent = captureSingleJsonLine("warn", () => {
    logWarn("atención", 123);
  });

  assert.equal(logEvent.level, "warn");
  assert.equal(logEvent.event, "LOG_WARN");
  assert.deepEqual(logEvent.context, { args: ["atención", 123] });
});

test("logError emite una linea JSON estructurada con nivel error", () => {
  const logEvent = captureSingleJsonLine("error", () => {
    logError("FALLO_EVENTO", { code: "E_TEST" });
  });

  assert.equal(logEvent.level, "error");
  assert.equal(logEvent.event, "FALLO_EVENTO");
  assert.deepEqual(logEvent.context, { code: "E_TEST" });
});

test("serializeError expone sólo el nombre, nunca el mensaje libre", () => {
  const error = new TypeError("mensaje de prueba");
  const serialized = serializeError(error) as Record<string, unknown>;

  assert.deepEqual(serialized, {
    name: "TypeError",
    messageSanitized: "[REDACTED]",
  });
  assert.equal("stack" in serialized, false);
  assert.equal(JSON.stringify(serialized).includes("mensaje de prueba"), false);
});

test("serializeError encapsula valores no Error sin mutar el original", () => {
  const payload = { ok: false, code: "X", sessionToken: "raw-value" };
  const expected = {
    name: "UnknownError",
    messageSanitized: "[REDACTED]",
  };

  assert.deepEqual(serializeError(payload), expected);
  assert.deepEqual(payload, { ok: false, code: "X", sessionToken: "raw-value" });
  assert.deepEqual(serializeError("texto"), expected);
  assert.deepEqual(serializeError(null), expected);
});

test("sendContactMessageEmail usa CONTACT_TO y fallback SMTP_FROM sin loguear secretos", async () => {
  const originalInfo = console.info;
  const infoCalls: unknown[][] = [];
  const sendMailCalls: Array<Record<string, unknown>> = [];
  const transportCalls: unknown[] = [];

  console.info = (...args: unknown[]) => {
    infoCalls.push(args);
  };

  const smtp = {
    enabled: true,
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    user: "smtp-user-contact",
    pass: "smtp-pass-contact",
    from: "fallback@vetneb.com",
  };
  const createSmtpTransport = (options: unknown) => {
    transportCalls.push(options);

    return {
      sendMail: async (payload: Record<string, unknown>) => {
        sendMailCalls.push(payload);
        return { messageId: `contact-${sendMailCalls.length}` };
      },
    };
  };

  try {
    const contactToResult = await sendContactMessageEmail(
      {
        name: "Maria Gomez",
        email: "maria@example.com",
        clinicName: "Clínica Sur",
        message: "Necesito coordinar una consulta clínica.",
      },
      createEmailDependencies({
        config: {
          contactTo: [
            "contacto@vetneb.com; ops@vetneb.com, CONTACTO@vetneb.com",
          ],
          smtp,
        },
        createSmtpTransport,
      }),
    );

    const fallbackResult = await sendContactMessageEmail(
      {
        name: "Juan Perez",
        email: "juan@example.com",
        clinicName: null,
        message: "Necesito registrar mi clínica en el portal.",
      },
      createEmailDependencies({
        config: {
          contactTo: [],
          smtp,
        },
        createSmtpTransport,
      }),
    );

    assert.deepEqual(contactToResult, {
      sent: true,
      messageId: "contact-1",
    });
    assert.deepEqual(fallbackResult, {
      sent: true,
      messageId: "contact-2",
    });
  } finally {
    console.info = originalInfo;
  }

  assert.equal(sendMailCalls.length, 2);
  assert.equal(sendMailCalls[0].to, "contacto@vetneb.com, ops@vetneb.com");
  assert.equal(sendMailCalls[0].replyTo, "maria@example.com");
  assert.equal(sendMailCalls[1].to, "fallback@vetneb.com");
  assert.equal(sendMailCalls[1].replyTo, "juan@example.com");
  assert.equal(transportCalls.length, 1);
  const transport = transportCalls[0] as {
    family?: unknown;
    host?: unknown;
    port?: unknown;
    secure?: unknown;
    tls?: { servername?: unknown };
    auth?: { user?: unknown; pass?: unknown };
  };
  assert.equal(transport.family, 4);
  assert.equal(transport.host, "smtp.gmail.com");
  assert.equal(transport.port, 587);
  assert.equal(transport.secure, false);
  assert.deepEqual(transport.tls, {
    servername: "smtp.gmail.com",
  });
  assert.equal(transport.auth?.user, "smtp-user-contact");
  assert.equal(transport.auth?.pass, "smtp-pass-contact");
  assert.equal(JSON.stringify(infoCalls).includes("smtp-pass-contact"), false);
  assert.equal(JSON.stringify(infoCalls).includes("smtp-user-contact"), false);
  assert.equal(JSON.stringify(infoCalls).toLowerCase().includes("auth"), false);
});

test("sendContactMessageEmail exige CONTACT_TO explícito en entorno público", async () => {
  const originalInfo = console.info;
  const infoCalls: unknown[][] = [];
  const sendMailCalls: Array<Record<string, unknown>> = [];

  console.info = (...args: unknown[]) => {
    infoCalls.push(args);
  };

  const dependencies = createEmailDependencies({
    config: {
      isProduction: true,
      contactTo: [],
      smtp: {
        enabled: true,
        host: "smtp.contact.example",
        port: 587,
        secure: false,
        user: "smtp-user-contact",
        pass: "smtp-pass-contact",
        from: "fallback@vetneb.com",
      },
    },
    createSmtpTransport: () => ({
      sendMail: async (payload) => {
        sendMailCalls.push(payload);
        return { messageId: `contact-${sendMailCalls.length}` };
      },
    }),
  });

  try {
    const result = await sendContactMessageEmail(
      {
        name: "Producción sin CONTACT_TO",
        email: "ops@example.com",
        clinicName: "Clínica Norte",
        message: "Debe marcarse como smtp_disabled por configuración pública incompleta.",
      },
      dependencies,
    );

    assert.deepEqual(result, {
      sent: false,
      reason: "smtp_disabled",
    });
  } finally {
    console.info = originalInfo;
  }

  assert.equal(sendMailCalls.length, 0);
  assert.equal(infoCalls.length, 1);
  assert.equal(infoCalls[0][0], "[EMAIL] contact_message skipped: smtp disabled");
});

test("templates de email no tienen mojibake visible", () => {
  const source = readSourceFile("server/lib/email.ts");

  for (const expected of [
    "clínica",
    "tinción",
    "Entrega en laboratorio",
    "Teléfono",
    "Ingresá",
    "gestión",
    "Clínica",
  ]) {
    assert.ok(source.includes(expected), `email.ts debe incluir ${expected}`);
  }

  assert.doesNotMatch(source, /Ã|Â|�/);
});

test("send*Email usan ENV, nodemailer y fetch global como dependencias por defecto", () => {
  const source = readSourceFile("server/lib/email.ts");
  const defaults = source.match(
    /\nconst defaultEmailDependencies: EmailDependencies = \{\n([\s\S]*?)\n\};\n/,
  );

  assert.ok(defaults, "email.ts debe declarar defaultEmailDependencies");
  assert.deepEqual(
    defaults[1].split("\n").map((line) => line.trim()),
    [
      "config: ENV,",
      "createSmtpTransport: (options) => nodemailer.createTransport(options),",
      "fetch: (url, init) => fetch(url, init),",
    ],
  );

  const senders = [
    ...source.matchAll(/\nexport async function (send\w+Email)\(\n([\s\S]*?)\n\)/g),
  ];

  assert.deepEqual(
    senders.map((match) => match[1]),
    [
      "sendContactMessageEmail",
      "sendParticularTokenEmail",
      "sendSpecialStainRequiredEmail",
    ],
  );

  for (const [, name, parameters] of senders) {
    assert.equal(
      parameters.trimEnd().endsWith(
        "dependencies: EmailDependencies = defaultEmailDependencies,",
      ),
      true,
      `${name} debe usar defaultEmailDependencies como default`,
    );
  }
});

test("sendSpecialStainRequiredEmail omite envío cuando no hay destinatarios válidos", async () => {
  const original = console.info;
  const calls: unknown[][] = [];

  console.info = (...args: unknown[]) => {
    calls.push(args);
  };

  try {
    const result = await sendSpecialStainRequiredEmail(
      {
        to: [undefined, null, "", "invalido", " ; , "],
        clinicName: "Clínica Centro",
        trackingCaseId: 77,
        receptionAt: new Date("2026-04-20T12:00:00.000Z"),
        estimatedDeliveryAt: new Date("2026-04-25T12:00:00.000Z"),
        currentStage: "processing",
      },
      createEmailDependencies(),
    );

    assert.deepEqual(result, {
      sent: false,
      reason: "no_recipients",
    });
  } finally {
    console.info = original;
  }

  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "[EMAIL] special_stain_required skipped: no recipients");
  assert.deepEqual(calls[0][1], {
    trackingCaseId: 77,
  });
});

test("sendSpecialStainRequiredEmail normaliza destinatarios y omite envío si SMTP está deshabilitado", async () => {
  const original = console.info;
  const calls: unknown[][] = [];

  console.info = (...args: unknown[]) => {
    calls.push(args);
  };

  const dependencies = createEmailDependencies({
    config: {
      smtp: { enabled: false },
      gmailApi: { enabled: false },
    },
  });

  try {
    const result = await sendSpecialStainRequiredEmail(
      {
        to: [
          " TEST@Example.com ; other@example.com, invalido ",
          "test@example.com",
          null,
        ],
        clinicName: "Clínica Norte",
        trackingCaseId: 88,
        receptionAt: new Date("2026-04-20T12:00:00.000Z"),
        estimatedDeliveryAt: new Date("2026-04-25T12:00:00.000Z"),
        currentStage: "evaluation",
        paymentUrl: "https://example.com/pago/88",
        adminContactEmail: "admin@vetneb.com",
        adminContactPhone: "3511234567",
        notes: "Caso prioritario",
      },
      dependencies,
    );

    assert.deepEqual(result, {
      sent: false,
      reason: "smtp_disabled",
    });
  } finally {
    console.info = original;
  }

  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "[EMAIL] special_stain_required skipped: smtp disabled");
  assert.deepEqual(calls[0][1], {
    trackingCaseId: 88,
    recipientCount: 2,
  });
  // VET-03: la metadata operacional (recipientCount) sobrevive, pero ninguna
  // dirección de email real llega al log.
  assert.equal(JSON.stringify(calls).includes("test@example.com"), false);
  assert.equal(JSON.stringify(calls).includes("other@example.com"), false);
});
