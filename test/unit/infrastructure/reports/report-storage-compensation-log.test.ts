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
