import { expect, test, type APIRequestContext } from "@playwright/test";
import { sessionCookieHeader, setClinicSession } from "../../helpers/session";

const API_BASE_URL = "http://127.0.0.1:3107";
const POPULATED_CLINIC_COOKIE = sessionCookieHeader("clinic", "populated");

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

  test("/dashboard clinic informes summary pages the 100-report server window, never the 1000-report dataset", async ({
    page,
  }) => {
    await setClinicSession(page, "populated");
    await page.goto("/dashboard?module=informes");

    const card = page
      .locator('[data-dashboard-module-workspace="informes"]')
      .locator('[aria-label="Informes recientes de la clínica"]');
    await expect(card).toBeVisible({ timeout: 8_000 });

    // Rows per page are owned by the measured canvas capacity (3 is only the
    // pre-measurement fallback), so rows and pager are read in one snapshot.
    const page1 = await card.evaluate((node) => ({
      rows: node.querySelectorAll('[data-clinic-reports-mobile-row="true"]')
        .length,
      status:
        node
          .querySelector('[data-clinic-reports-pagination-status="true"]')
          ?.textContent?.replace(/\s+/g, " ")
          .trim() ?? null,
    }));

    expect(page1.rows).toBeGreaterThan(0);
    expect(page1.status).toBe(`Pág. 1 / ${Math.ceil(100 / page1.rows)}`);
  });
});
