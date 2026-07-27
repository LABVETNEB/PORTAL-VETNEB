import assert from "node:assert/strict";
import test from "node:test";

import type {
  Report,
  ReportStatusHistory,
} from "../../../../drizzle/schema.ts";
import { createReportQueryUseCases } from "../../../../server/features/reports/application/index.ts";

function createReport(overrides: Partial<Report> = {}): Report {
  return {
    id: 55,
    clinicId: 3,
    patientName: "Luna",
    studyType: "histopatologia",
    uploadDate: new Date("2026-07-20T10:00:00.000Z"),
    fileName: "luna.pdf",
    storagePath: "reports/3/luna.pdf",
    previewUrl: null,
    downloadUrl: null,
    currentStatus: "ready",
    statusChangedAt: new Date("2026-07-20T10:00:00.000Z"),
    statusChangedByClinicUserId: 9,
    statusChangedByAdminUserId: null,
    workflowStage: "sample_received",
    specialStainRequested: false,
    specialStainAt: null,
    workflowUpdatedAt: null,
    createdAt: new Date("2026-07-20T10:00:00.000Z"),
    updatedAt: new Date("2026-07-20T10:00:00.000Z"),
    ...overrides,
  };
}

function createHarness(input?: {
  report?: Report | null;
  reports?: Report[];
  total?: number;
  history?: ReportStatusHistory[];
}) {
  const calls: string[] = [];
  const report = input?.report === undefined ? createReport() : input.report;
  const reports = input?.reports ?? (report ? [report] : []);
  const repository = {
    async findClinicScopedReportById(reportId: number, clinicId: number) {
      calls.push(`lookup:${reportId}:${clinicId}`);
      return report;
    },
    async listReportsByClinicId(
      clinicId: number,
      limit: number,
      offset: number,
      currentStatus?: string,
    ) {
      calls.push(`list:${clinicId}:${limit}:${offset}:${currentStatus}`);
      return reports;
    },
    async countReportsByClinicId(clinicId: number, currentStatus?: string) {
      calls.push(`count:${clinicId}:${currentStatus}`);
      return input?.total ?? reports.length;
    },
    async searchReports(
      clinicId: number,
      filters: {
        query?: string;
        studyType?: string;
        currentStatus?: string;
      },
      limit: number,
      offset: number,
    ) {
      calls.push(
        `search:${clinicId}:${filters.query}:${filters.studyType}:${filters.currentStatus}:${limit}:${offset}`,
      );
      return reports;
    },
    async countSearchReports(
      clinicId: number,
      filters: {
        query?: string;
        studyType?: string;
        currentStatus?: string;
      },
    ) {
      calls.push(
        `search-count:${clinicId}:${filters.query}:${filters.studyType}:${filters.currentStatus}`,
      );
      return input?.total ?? reports.length;
    },
    async getReportStatusHistory(reportId: number) {
      calls.push(`history:${reportId}`);
      return input?.history ?? [];
    },
    async getStudyTypes(clinicId: number) {
      calls.push(`study-types:${clinicId}`);
      return ["citologia", "histopatologia", "hemoparasitos"];
    },
  };
  const useCases = createReportQueryUseCases({
    repository,
    async createSignedReportUrl(storagePath) {
      calls.push(`preview:${storagePath}`);
      return "https://signed.example/preview";
    },
    async createSignedReportDownloadUrl(storagePath, fileName) {
      calls.push(`download:${storagePath}:${fileName}`);
      return "https://signed.example/download";
    },
    async transitionReportStatus(transitionInput) {
      calls.push(`transition:${transitionInput.reportId}:${transitionInput.toStatus}`);
      return {
        type: "persisted" as const,
        report: createReport({ currentStatus: transitionInput.toStatus }),
      };
    },
  });

  return { calls, useCases };
}

test("M40 list coordina query y count con paginacion y serializacion segura", async () => {
  const { calls, useCases } = createHarness({ total: 21 });
  const result = await useCases.listClinicReports({
    clinicId: 3,
    limit: 10,
    offset: 10,
    currentStatus: "ready",
  });

  assert.deepEqual(calls, ["list:3:10:10:ready", "count:3:ready"]);
  assert.equal(result.count, 1);
  assert.equal(result.total, 21);
  assert.equal(result.totalPages, 3);
  assert.deepEqual(result.filters, { status: "ready" });
  assert.deepEqual(result.pagination, { limit: 10, offset: 10 });
  assert.equal("storagePath" in result.reports[0]!, false);
  assert.equal(result.reports[0]!.hasFile, true);
});

test("M40 search conserva filtros identicos entre query y count", async () => {
  const { calls, useCases } = createHarness({ total: 6 });
  const result = await useCases.searchClinicReports({
    clinicId: 3,
    query: "Luna",
    studyType: "histopatologia",
    currentStatus: "ready",
    limit: 5,
    offset: 5,
  });

  assert.deepEqual(calls, [
    "search:3:Luna:histopatologia:ready:5:5",
    "search-count:3:Luna:histopatologia:ready",
  ]);
  assert.equal(result.totalPages, 2);
  assert.deepEqual(result.filters, {
    query: "Luna",
    studyType: "histopatologia",
    status: "ready",
  });
});

test("M40 expone el catalogo vigente sin side effects extra", async () => {
  const { calls, useCases } = createHarness();

  assert.deepEqual(await useCases.getStudyTypes(3), [
    "citologia",
    "histopatologia",
    "hemoparasitos",
  ]);
  assert.deepEqual(calls, ["study-types:3"]);
});

test("M40 lookup clinic-scoped modela found y not_found", async () => {
  const found = createHarness();
  const missing = createHarness({ report: null });

  assert.equal(
    (await found.useCases.findClinicScopedReport(55, 3)).type,
    "found",
  );
  assert.deepEqual(
    await missing.useCases.findClinicScopedReport(55, 3),
    { type: "not_found", reportId: 55 },
  );
});

test("M40 history ocurre solo despues de ownership", async () => {
  const found = createHarness();
  const missing = createHarness({ report: null });

  await found.useCases.getClinicReportHistory(55, 3);
  await missing.useCases.getClinicReportHistory(55, 3);

  assert.deepEqual(found.calls, ["lookup:55:3", "history:55"]);
  assert.deepEqual(missing.calls, ["lookup:55:3"]);
});

test("M40 preview y download ocurren solo despues de ownership", async () => {
  const found = createHarness();
  const missing = createHarness({ report: null });

  await found.useCases.getClinicReportPreview(55, 3);
  await found.useCases.getClinicReportDownload(55, 3);
  await missing.useCases.getClinicReportPreview(55, 3);
  await missing.useCases.getClinicReportDownload(55, 3);

  assert.deepEqual(found.calls, [
    "lookup:55:3",
    "preview:reports/3/luna.pdf",
    "lookup:55:3",
    "download:reports/3/luna.pdf:luna.pdf",
  ]);
  assert.deepEqual(missing.calls, ["lookup:55:3", "lookup:55:3"]);
});

test("M40 transition ocurre solo despues de ownership y serializa el resultado", async () => {
  const found = createHarness();
  const missing = createHarness({ report: null });

  const result = await found.useCases.transitionClinicReportStatus({
    clinicId: 3,
    reportId: 55,
    toStatus: "delivered",
    note: null,
    changedByClinicUserId: 9,
  });
  await missing.useCases.transitionClinicReportStatus({
    clinicId: 3,
    reportId: 55,
    toStatus: "delivered",
    note: null,
  });

  assert.equal(result.type, "persisted");
  assert.deepEqual(found.calls, ["lookup:55:3", "transition:55:delivered"]);
  assert.deepEqual(missing.calls, ["lookup:55:3"]);
  if (result.type === "persisted") {
    assert.equal("storagePath" in result.report, false);
  }
});

test("M40 propaga errores de infraestructura sin catch general", async () => {
  const { useCases } = createHarness();
  const failure = new Error("query unavailable");
  const failing = createReportQueryUseCases({
    repository: {
      findClinicScopedReportById: async () => {
        throw failure;
      },
      listReportsByClinicId: async () => {
        throw failure;
      },
      countReportsByClinicId: async () => 0,
      searchReports: async () => [],
      countSearchReports: async () => 0,
      getReportStatusHistory: async () => [],
      getStudyTypes: async () => [],
    },
    createSignedReportUrl: async () => "",
    createSignedReportDownloadUrl: async () => "",
    transitionReportStatus: async () => ({ type: "not_found", reportId: 55 }),
  });

  await assert.rejects(
    failing.listClinicReports({ clinicId: 3, limit: 50, offset: 0 }),
    failure,
  );
  await assert.rejects(failing.findClinicScopedReport(55, 3), failure);
  assert.ok(useCases);
});
