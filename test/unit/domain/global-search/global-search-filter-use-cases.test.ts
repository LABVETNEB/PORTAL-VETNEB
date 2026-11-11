import test from "node:test";
import assert from "node:assert/strict";

import {
  createAdminGlobalSearch,
  createClinicGlobalSearch,
} from "../../../../server/features/global-search/application/index.ts";
import type {
  AdminGlobalSearchRepository,
  ClinicGlobalSearchRepository,
} from "../../../../server/features/global-search/application/index.ts";
import type { GlobalSearchCriteria } from "../../../../server/features/global-search/domain/index.ts";

type Call = { kind: string; clinicId: number | null; criteria: GlobalSearchCriteria };

function adminRepository(calls: Call[]): AdminGlobalSearchRepository {
  const port = (kind: string) => async (criteria: GlobalSearchCriteria, clinicId: number | null) => {
    calls.push({ kind, clinicId, criteria });
    return [];
  };
  return {
    clinic: port("clinic"),
    report: port("report"),
    particular_token: port("particular_token"),
    tracking_case: port("tracking_case"),
    clinic_user: port("clinic_user"),
  };
}

function clinicRepository(calls: Call[]): ClinicGlobalSearchRepository {
  const port = (kind: string) => async (clinicId: number, criteria: GlobalSearchCriteria) => {
    calls.push({ kind, clinicId, criteria });
    return [];
  };
  return { report: port("report"), particular_token: port("particular_token"), tracking_case: port("tracking_case") };
}

test("A3 caso de uso: sólo filtros consulta únicamente las entidades nombradas y siempre con el tenant de la sesión", async () => {
  const calls: Call[] = [];
  const search = createClinicGlobalSearch(clinicRepository(calls));
  const outcome = await search(5, { q: "type:informe after:2026-01-01" });
  assert.ok(outcome.ok);
  assert.deepEqual(calls.map((call) => [call.kind, call.clinicId]), [["report", 5]]);
});

test("A5 caso de uso: la clínica no puede elegir tenant con clinic:", async () => {
  const calls: Call[] = [];
  const search = createClinicGlobalSearch(clinicRepository(calls));
  const outcome = await search(5, { q: "luna clinic:9" });
  assert.deepEqual(outcome, { ok: false, status: 400, error: "El operador clinic: no está disponible aquí" });
  assert.deepEqual(calls, [], "no se consulta nada");
});

test("A5 caso de uso: Admin con clinic: estrecha la búsqueda; con parámetro distinto es contradictorio", async () => {
  const calls: Call[] = [];
  const search = createAdminGlobalSearch(adminRepository(calls));

  const narrowed = await search({ q: "type:informe clinic:7" }, null);
  assert.ok(narrowed.ok);
  assert.deepEqual(calls.map((call) => call.clinicId), [7]);

  const same = await search({ q: "type:informe clinic:7" }, 7);
  assert.ok(same.ok);

  const conflict = await search({ q: "type:informe clinic:7" }, 8);
  assert.deepEqual(conflict, { ok: false, status: 400, error: "Filtros de búsqueda contradictorios" });
  assert.deepEqual(calls.map((call) => call.clinicId), [7, 7], "el conflicto no consulta");
});

test("A3 caso de uso: el cursor firmado se ata al texto con operadores y a la clínica del operador", async () => {
  const key = new Uint8Array(32).fill(7);
  const rows = Array.from({ length: 6 }, (_, index) => ({
    sortKey: `2026-01-0${index + 1} 00:00:00.000000`,
    hit: {
      kind: "report" as const,
      id: 100 - index,
      title: `Informe ${index}`,
      subtitle: null,
      status: null,
      date: null,
      facts: [],
      clinic: null,
      target: { reportId: 100 - index, particularTokenId: null, studyTrackingCaseId: null, clinicId: 7, clinicUserId: null },
      rank: 3,
    },
  }));
  const repository = { ...adminRepository([]), report: async () => rows };
  const search = createAdminGlobalSearch(repository, { cursorKey: key });

  const first = await search({ q: "type:informe clinic:7", limit: "5" }, null);
  assert.ok(first.ok);
  const cursor = first.result.groups[0].nextCursor;
  assert.equal(typeof cursor, "string");

  const resumed = await search({ q: "type:informe clinic:7", limit: "5", cursor }, null);
  assert.ok(resumed.ok);

  const otherClinic = await search({ q: "type:informe clinic:8", limit: "5", cursor }, null);
  assert.deepEqual(otherClinic, { ok: false, status: 400, error: "Cursor de búsqueda inválido" });

  const otherFilter = await search({ q: "type:informe clinic:7 after:2026-01-01", limit: "5", cursor }, null);
  assert.deepEqual(otherFilter, { ok: false, status: 400, error: "Cursor de búsqueda inválido" });

  const tampered = await search({ q: "type:informe clinic:7", limit: "5", cursor: `${cursor}x` }, null);
  assert.deepEqual(tampered, { ok: false, status: 400, error: "Cursor de búsqueda inválido" });
});
