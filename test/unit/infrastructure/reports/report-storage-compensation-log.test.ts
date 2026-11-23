import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import type { ReportStorageCompensationLog } from "../../../../server/features/reports/application/index.ts";
import { logReportStorageCompensation } from "../../../../server/features/reports/composition/report-upload-persistence-composition.ts";

const OBJECT_REF = "1790000000000-0123456789ab";
const SENSITIVE_PATH = `clinics/3/${OBJECT_REF}-Luna-Gomez-historia-123.pdf`;
const EVENT_NAME = "REPORT_UPLOAD_STORAGE_COMPENSATION";

type ConsoleStream = "log" | "warn" | "error";
type Emitted = { stream: ConsoleStream; line: string };
type EmittedRecord = {
  level: string;
  event: string;
  requestId?: string;
  context: Record<string, unknown>;
};

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function emit(input: ReportStorageCompensationLog): Emitted[] {
  const writes: Emitted[] = [];
  const original = {
    log: console.log,
    warn: console.warn,
    error: console.error,
  };

  for (const stream of ["log", "warn", "error"] as const) {
    console[stream] = (...args: unknown[]) => {
      writes.push({ stream, line: String(args[0]) });
    };
  }

  try {
    logReportStorageCompensation(input);
  } finally {
    console.log = original.log;
    console.warn = original.warn;
    console.error = original.error;
  }

  return writes;
}

const DIGEST = sha256(SENSITIVE_PATH);
const BASE = {
  clinicId: 3,
  storagePath: SENSITIVE_PATH,
  persistErrorName: "Error",
};

const cases: Array<{
  label: string;
  input: ReportStorageCompensationLog;
  stream: ConsoleStream;
  level: string;
  context: Record<string, unknown>;
}> = [
  {
    label: "deleted se emite como info",
    input: { ...BASE, outcome: "deleted", verification: "not_persisted" },
    stream: "log",
    level: "info",
    context: {
      outcome: "deleted",
      clinicId: 3,
      objectRef: OBJECT_REF,
      pathDigest: DIGEST,
      persistError: "Error",
      verification: "not_persisted",
    },
  },
  {
    label: "preserved_referenced se emite como warn",
    input: { ...BASE, outcome: "preserved_referenced", verification: "persisted" },
    stream: "warn",
    level: "warn",
    context: {
      outcome: "preserved_referenced",
      clinicId: 3,
      objectRef: OBJECT_REF,
      pathDigest: DIGEST,
      persistError: "Error",
      verification: "persisted",
    },
  },
  {
    label: "commit_confirmed se emite como warn",
    input: { ...BASE, outcome: "commit_confirmed", verification: "persisted" },
    stream: "warn",
    level: "warn",
    context: {
      outcome: "commit_confirmed",
      clinicId: 3,
      objectRef: OBJECT_REF,
      pathDigest: DIGEST,
      persistError: "Error",
      verification: "persisted",
    },
  },
  {
    label: "delete_failed se emite como error",
    input: {
      ...BASE,
      outcome: "delete_failed",
      errorName: "Error",
      verification: "not_persisted",
    },
    stream: "error",
    level: "error",
    context: {
      outcome: "delete_failed",
      clinicId: 3,
      objectRef: OBJECT_REF,
      pathDigest: DIGEST,
      persistError: "Error",
      cleanupError: "Error",
      verification: "not_persisted",
    },
  },
  {
    label: "preserved_verification_failed se emite como error",
    input: {
      ...BASE,
      outcome: "preserved_verification_failed",
      errorName: "Error",
      verification: "unverifiable",
    },
    stream: "error",
    level: "error",
    context: {
      outcome: "preserved_verification_failed",
      clinicId: 3,
      objectRef: OBJECT_REF,
      pathDigest: DIGEST,
      persistError: "Error",
      cleanupError: "Error",
      verification: "unverifiable",
    },
  },
  {
    label: "preserved_commit_unknown se emite como error",
    input: {
      ...BASE,
      outcome: "preserved_commit_unknown",
      verification: "not_persisted",
    },
    stream: "error",
    level: "error",
    context: {
      outcome: "preserved_commit_unknown",
      clinicId: 3,
      objectRef: OBJECT_REF,
      pathDigest: DIGEST,
      persistError: "Error",
      verification: "not_persisted",
    },
  },
  {
    label: "preserved_unsafe_path se emite como error",
    input: { ...BASE, outcome: "preserved_unsafe_path" },
    stream: "error",
    level: "error",
    context: {
      outcome: "preserved_unsafe_path",
      clinicId: 3,
      objectRef: OBJECT_REF,
      pathDigest: DIGEST,
      persistError: "Error",
    },
  },
];

test("adaptador de compensación: emite nivel, evento y contexto cerrados por resultado", async (context) => {
  for (const scenario of cases) {
    await context.test(scenario.label, () => {
      const writes = emit(scenario.input);

      assert.deepEqual(
        writes.map((write) => write.stream),
        [scenario.stream],
      );
      const record = JSON.parse(String(writes[0]?.line)) as EmittedRecord;
      assert.equal(record.event, EVENT_NAME);
      assert.equal(record.level, scenario.level);
      assert.deepEqual(record.context, scenario.context);
    });
  }
});

test("adaptador de compensación: el registro emitido no contiene path, nombre de archivo ni datos del paciente", async (context) => {
  for (const scenario of cases) {
    await context.test(scenario.label, () => {
      const writes = emit(scenario.input);
      const emitted = String(writes[0]?.line);

      for (const forbidden of [
        SENSITIVE_PATH,
        "clinics/3",
        "Luna",
        "Gomez",
        "historia",
        ".pdf",
        "/",
        "storagePath",
      ]) {
        assert.equal(emitted.includes(forbidden), false, forbidden);
      }
      assert.equal(emitted.includes(DIGEST), true);
      assert.equal(emitted.includes(OBJECT_REF), true);
    });
  }
});

const VALID_REQUEST_ID = "3f2b8c1e-4a5d-4e6f-8a7b-9c0d1e2f3a4b";

test("adaptador de compensación: un request ID válido se emite al nivel del evento en cada resultado", async (context) => {
  for (const scenario of cases) {
    await context.test(scenario.label, () => {
      const writes = emit({ ...scenario.input, requestId: VALID_REQUEST_ID });
      const record = JSON.parse(String(writes[0]?.line)) as EmittedRecord;

      assert.equal(record.requestId, VALID_REQUEST_ID);
      assert.equal(Object.hasOwn(record.context, "requestId"), false);
      assert.deepEqual(record.context, scenario.context);
    });
  }
});

test("adaptador de compensación: un identificador que no es UUID v4 nunca se registra", async (context) => {
  const invalid = [
    "req-1",
    "opaque.session.token_value-abcdef0123456789",
    "3f2b8c1e-4a5d-1e6f-8a7b-9c0d1e2f3a4b",
    "3f2b8c1e-4a5d-4e6f-0a7b-9c0d1e2f3a4b",
    `${VALID_REQUEST_ID}-extra`,
    "clinics/3/1790000000000-0123456789ab-Luna.pdf",
    "",
  ];

  for (const value of invalid) {
    await context.test(JSON.stringify(value), () => {
      const writes = emit({
        ...BASE,
        outcome: "preserved_commit_unknown",
        verification: "persisted",
        requestId: value,
      });
      const emitted = String(writes[0]?.line);
      const record = JSON.parse(emitted) as EmittedRecord;

      assert.equal(Object.hasOwn(record, "requestId"), false);
      assert.equal(Object.hasOwn(record.context, "requestId"), false);
      if (value.length > 0) {
        assert.equal(emitted.includes(value), false);
      }
    });
  }
});

test("adaptador de compensación: sin request ID el evento no lo inventa", () => {
  const writes = emit({ ...BASE, outcome: "deleted", verification: "not_persisted" });
  const record = JSON.parse(String(writes[0]?.line)) as EmittedRecord;

  assert.equal(Object.hasOwn(record, "requestId"), false);
});

test("adaptador de compensación: un path fuera del patrón no expone el nombre y conserva el digest", () => {
  const foreignPath = "reports/3/informe-confidencial.pdf";
  const writes = emit({
    ...BASE,
    storagePath: foreignPath,
    outcome: "preserved_unsafe_path",
  });
  const emitted = String(writes[0]?.line);
  const record = JSON.parse(emitted) as EmittedRecord;

  assert.equal(record.context.objectRef, null);
  assert.equal(record.context.pathDigest, sha256(foreignPath));
  for (const forbidden of ["reports", "informe", "confidencial", "/"]) {
    assert.equal(emitted.includes(forbidden), false, forbidden);
  }
});
