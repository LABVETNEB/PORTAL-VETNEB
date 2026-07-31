import test from "node:test";
import assert from "node:assert/strict";
import {
  buildStructuredLogEvent,
  isSensitiveLogKey,
  logError,
  logInfo,
  redactLogValue,
  redactSensitiveText,
  serializeError,
} from "../../../server/lib/logger.ts";

const TEST_DATABASE_URL = [
  "postgresql://user",
  ":pass",
  "@host:5432/db",
].join("");

function captureJsonLine(
  channel: "log" | "warn" | "error",
  run: () => void,
): Record<string, unknown> {
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
  assert.equal(calls[0].length, 1, "el logger emite una sola linea por evento");

  return JSON.parse(calls[0][0] as string) as Record<string, unknown>;
}

test("el logger emite una linea JSON parseable con campos estables", () => {
  const logEvent = captureJsonLine("log", () => {
    logInfo("SAMPLE_EVENT", { clinicCount: 3 });
  });

  assert.deepEqual(Object.keys(logEvent).sort(), [
    "context",
    "event",
    "level",
    "timestamp",
  ]);
  assert.equal(logEvent.level, "info");
  assert.equal(logEvent.event, "SAMPLE_EVENT");
  assert.deepEqual(logEvent.context, { clinicCount: 3 });
  assert.match(
    logEvent.timestamp as string,
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
  );
});

test("el logger conserva requestId valido y descarta el invalido", () => {
  const valid = captureJsonLine("error", () => {
    logError("SAMPLE_ERROR", { requestId: "client-req_1.a:2", status: 500 });
  });

  assert.equal(valid.requestId, "client-req_1.a:2");
  assert.deepEqual(valid.context, { status: 500 });

  const invalid = captureJsonLine("error", () => {
    logError("SAMPLE_ERROR", {
      requestId: "bad id;Authorization=Bearer secret",
      status: 500,
    });
  });

  assert.equal("requestId" in invalid, false);
  assert.deepEqual(invalid.context, { status: 500 });
});

test("redactLogValue redacta claves sensibles anidadas y en arrays", () => {
  const redacted = redactLogValue({
    outer: {
      authorization: "Bearer abc",
      cookie: "app_session_id=abc",
      password: "hunter2",
      clientSecret: "s",
      serviceRoleKey: "s",
      apiKey: "s",
      accessToken: "s",
      refreshToken: "s",
      sessionId: "s",
      tokenHash: "s",
      rawToken: "s",
      signedUrl: "s",
      storagePath: "s",
      databaseUrl: "s",
      connectionString: "s",
      dsn: "s",
    },
    list: [{ sessionToken: "s", tokenId: 12 }],
  }) as Record<string, Record<string, unknown>>;

  for (const value of Object.values(redacted.outer)) {
    assert.equal(value, "[REDACTED]");
  }

  assert.deepEqual(redacted.list, [{ sessionToken: "[REDACTED]", tokenId: 12 }]);
});

test("redactLogValue preserva identificadores seguros", () => {
  const redacted = redactLogValue({
    tokenId: 4,
    reportAccessTokenId: 5,
    actorReportAccessTokenId: 6,
    targetReportAccessTokenId: 7,
    tokenCount: 8,
    requestId: "req-1",
  });

  assert.deepEqual(redacted, {
    tokenId: 4,
    reportAccessTokenId: 5,
    actorReportAccessTokenId: 6,
    targetReportAccessTokenId: 7,
    tokenCount: 8,
    requestId: "req-1",
  });

  assert.equal(isSensitiveLogKey("tokenId"), false);
  assert.equal(isSensitiveLogKey("requestId"), false);
  assert.equal(isSensitiveLogKey("sessionId"), true);
  assert.equal(isSensitiveLogKey("set-cookie"), true);
  assert.equal(isSensitiveLogKey("proxy-authorization"), true);
});

test("redactSensitiveText redacta secretos embebidos en strings", () => {
  assert.equal(
    redactSensitiveText("Authorization: Bearer abc.def-ghi"),
    "Authorization: Bearer [REDACTED]",
  );
  assert.equal(
    redactSensitiveText(
      "jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature-part",
    ),
    "jwt [REDACTED]",
  );
  assert.equal(
    redactSensitiveText("key sb_secret_abcdef123"),
    "key [REDACTED]",
  );
  assert.equal(
    redactSensitiveText(TEST_DATABASE_URL),
    "[REDACTED]",
  );
  assert.equal(
    redactSensitiveText(
      "https://cdn.example.com/storage/v1/object/sign/reports/a.pdf?token=abc",
    ),
    "[REDACTED]",
  );
  assert.equal(
    redactSensitiveText("app_session_id=abc123; Path=/"),
    "app_session_id=[REDACTED]; Path=/",
  );
});

test("serializeError elimina el mensaje libre completo, no sólo credenciales", () => {
  const error = new Error(
    [
      "Paciente Maria Gomez",
      "tutor@example.com",
      "biopsia con celulas atipicas",
      "select nombre from pacientes where id = $1",
      TEST_DATABASE_URL,
    ].join(" | "),
  );
  (error as Error & { query?: string }).query = "select * from clinics";
  (error as Error & { detail?: string }).detail = "Key (id)=(4821) exists";
  (error as Error & { parameters?: unknown[] }).parameters = [4821];
  (error as Error & { code?: string }).code = "23505";

  const serialized = serializeError(error) as Record<string, unknown>;

  assert.deepEqual(serialized, {
    name: "Error",
    messageSanitized: "[REDACTED]",
  });

  const encoded = JSON.stringify(serialized);

  for (const leaked of [
    "Maria",
    "Gomez",
    "tutor@example.com",
    "biopsia",
    "atipicas",
    "select",
    "pacientes",
    TEST_DATABASE_URL,
    "4821",
    "23505",
    "Key (id)",
  ]) {
    assert.equal(
      encoded.includes(leaked),
      false,
      `serializeError no debe exportar ${leaked}`,
    );
  }

  for (const forbiddenKey of [
    "stack",
    "cause",
    "message",
    "query",
    "detail",
    "parameters",
    "code",
  ]) {
    assert.equal(forbiddenKey in serialized, false, forbiddenKey);
  }
});

test("serializeError conserva el nombre de la clase de error cuando es seguro", () => {
  assert.deepEqual(serializeError(new TypeError("dato sensible")), {
    name: "TypeError",
    messageSanitized: "[REDACTED]",
  });
  assert.deepEqual(serializeError(new RangeError("otro dato")), {
    name: "RangeError",
    messageSanitized: "[REDACTED]",
  });
});

test("serializeError degrada nombres de error inválidos a Error", () => {
  const error = new Error("mensaje irrelevante");

  error.name = "Postgres Error usuario@example.com";

  const serialized = serializeError(error) as Record<string, unknown>;

  assert.deepEqual(serialized, {
    name: "Error",
    messageSanitized: "[REDACTED]",
  });
  assert.equal(JSON.stringify(serialized).includes("usuario@example.com"), false);
});

test("serializeError encapsula cualquier valor lanzado que no sea Error", () => {
  const expected = {
    name: "UnknownError",
    messageSanitized: "[REDACTED]",
  };

  assert.deepEqual(serializeError("Paciente Maria maria@example.com"), expected);
  assert.deepEqual(serializeError({ patientName: "Maria", clinicId: 307 }), expected);
  assert.deepEqual(serializeError(["maria@example.com", 4821]), expected);
  assert.deepEqual(serializeError(null), expected);
  assert.deepEqual(serializeError(undefined), expected);
  assert.deepEqual(serializeError(42), expected);
});

test("serializeError no muta el input original", () => {
  const error = new Error("mensaje original");
  (error as Error & { query?: string }).query = "select 1";

  serializeError(error);

  assert.equal(error.message, "mensaje original");
  assert.equal(error.name, "Error");
  assert.equal((error as Error & { query?: string }).query, "select 1");

  const thrown = { patientName: "Maria" };

  serializeError(thrown);

  assert.deepEqual(thrown, { patientName: "Maria" });
});

test("redactLogValue delega instancias Error al envelope seguro", () => {
  const logEvent = captureJsonLine("error", () => {
    logError("NESTED_ERROR_EVENT", {
      cause: new TypeError("Paciente Maria maria@example.com"),
    });
  });

  assert.deepEqual(logEvent.context, {
    cause: {
      name: "TypeError",
      messageSanitized: "[REDACTED]",
    },
  });
  assert.equal(JSON.stringify(logEvent).includes("Maria"), false);
});

test("el logger tolera referencias circulares, fechas y arrays", () => {
  const circular: Record<string, unknown> = { name: "root" };
  circular.self = circular;

  const logEvent = captureJsonLine("log", () => {
    logInfo("CIRCULAR_EVENT", {
      circular,
      when: new Date("2026-07-31T10:00:00.000Z"),
      items: [1, "dos", { three: true }],
    });
  });

  const context = logEvent.context as Record<string, unknown>;

  assert.deepEqual(context.circular, { name: "root", self: "[Circular]" });
  assert.equal(context.when, "2026-07-31T10:00:00.000Z");
  assert.deepEqual(context.items, [1, "dos", { three: true }]);
});

test("el logger omite undefined y no muta el input original", () => {
  const input = {
    keep: 1,
    drop: undefined,
    nested: { password: "hunter2" },
  };

  const logEvent = captureJsonLine("log", () => {
    logInfo("MUTATION_EVENT", input);
  });

  assert.deepEqual(logEvent.context, {
    keep: 1,
    nested: { password: "[REDACTED]" },
  });
  assert.equal(input.nested.password, "hunter2");
  assert.equal("drop" in input, true);
});

test("buildStructuredLogEvent acota profundidad y volumen", () => {
  let deep: Record<string, unknown> = { value: "leaf" };

  for (let index = 0; index < 12; index += 1) {
    deep = { nested: deep };
  }

  const logEvent = buildStructuredLogEvent("info", [
    "DEEP_EVENT",
    { deep, many: Array.from({ length: 200 }, (_item, index) => index) },
  ]);

  const serialized = JSON.stringify(logEvent);

  assert.ok(serialized.includes("[MaxDepth]"));
  assert.ok(serialized.includes("more]"));
  assert.equal(logEvent.level, "info");
  assert.equal(logEvent.event, "DEEP_EVENT");
});
