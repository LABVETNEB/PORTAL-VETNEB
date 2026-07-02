import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const API_BASE_URL = "http://127.0.0.1:3107";
const POPULATED_CLINIC_COOKIE = "app_session_id=e2e_populated_clinic_session";

type ClinicReportFixtureItem = {
  id: number;
  patientName: string;
  studyType: string;
  status: string;
};

type ClinicReportsFixtureBody = {
  reports: ClinicReportFixtureItem[];
  total: number;
  totalPages: number;
  limit: number;
  offset: number;
};

async function readClinicReportsFixture(
  request: APIRequestContext,
  path: string,
): Promise<ClinicReportsFixtureBody> {
  const response = await request.get(`${API_BASE_URL}${path}`, {
    headers: { Cookie: POPULATED_CLINIC_COOKIE },
  });

  expect(response.ok()).toBe(true);
  return (await response.json()) as ClinicReportsFixtureBody;
}

async function setPopulatedClinicSession(page: Page) {
  await page.context().addCookies([
    {
      name: "app_session_id",
      value: "e2e_populated_clinic_session",
      url: "http://127.0.0.1:3000",
    },
  ]);
}

test.describe("clinic reports populated fixture pagination (CAP-C2)", () => {
  test("/api/reports returns a 1000-report deterministic paginated dataset", async ({
    request,
  }) => {
    const body = await readClinicReportsFixture(
      request,
      "/api/reports?limit=3&offset=0",
    );

    expect(body.total).toBe(1000);
    expect(body.totalPages).toBe(334);
    expect(body.limit).toBe(3);
    expect(body.offset).toBe(0);
    expect(body.reports).toHaveLength(3);
    expect(body.reports.map((report) => report.id)).toEqual([8401, 8402, 8403]);
  });

  test("/api/reports honors status, studyType, limit and offset", async ({
    request,
  }) => {
    const body = await readClinicReportsFixture(
      request,
      "/api/reports?status=delivered&studyType=Necropsia&limit=3&offset=3",
    );

    expect(body.total).toBe(50);
    expect(body.totalPages).toBe(17);
    expect(body.limit).toBe(3);
    expect(body.offset).toBe(3);
    expect(body.reports).toHaveLength(3);
    expect(body.reports[0].id).toBe(8480);
    for (const report of body.reports) {
      expect(report.status).toBe("delivered");
      expect(report.studyType).toBe("Necropsia");
    }
  });

  test("/api/reports/search honors query, status, studyType, limit and offset", async ({
    request,
  }) => {
    const params = new URLSearchParams({
      query: "Paciente E2E",
      status: "delivered",
      studyType: "Necropsia",
      limit: "4",
      offset: "4",
    });
    const body = await readClinicReportsFixture(
      request,
      `/api/reports/search?${params.toString()}`,
    );

    expect(body.total).toBe(50);
    expect(body.totalPages).toBe(13);
    expect(body.limit).toBe(4);
    expect(body.offset).toBe(4);
    expect(body.reports).toHaveLength(4);
    expect(body.reports[0].id).toBe(8500);
    for (const report of body.reports) {
      expect(report.patientName).toContain("Paciente E2E");
      expect(report.status).toBe("delivered");
      expect(report.studyType).toBe("Necropsia");
    }
  });

  test("/dashboard clinic informes summary still receives only 3 recent reports", async ({
    page,
  }) => {
    await setPopulatedClinicSession(page);
    await page.goto("/dashboard?module=informes");

    const card = page
      .locator('[data-dashboard-module-workspace="informes"]')
      .locator('[aria-label="Informes recientes de la clínica"]');
    await expect(card).toBeVisible({ timeout: 8_000 });
    await expect(
      card.locator('[data-clinic-reports-mobile-row="true"]'),
    ).toHaveCount(3);
  });
});
