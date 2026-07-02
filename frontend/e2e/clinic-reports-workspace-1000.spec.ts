import { expect, test, type Page } from "@playwright/test";

const POPULATED_CLINIC_COOKIE = "e2e_populated_clinic_session";
const REPORT_ROW_ID = /^report-(\d+)$/;

type WorkspaceState = {
  rowIds: number[];
  text: string;
  paginationText: string | null;
  summary: Record<string, string>;
};

async function setPopulatedClinicSession(page: Page) {
  await page.context().addCookies([
    {
      name: "app_session_id",
      value: POPULATED_CLINIC_COOKIE,
      url: "http://127.0.0.1:3000",
    },
  ]);
}

async function readWorkspaceState(page: Page): Promise<WorkspaceState> {
  return page.evaluate((rowPatternSource) => {
    const rowPattern = new RegExp(rowPatternSource);
    const reportRows = Array.from(
      document.querySelectorAll<HTMLElement>("#reports-master-list [id]"),
    ).flatMap((element) => {
      const match = element.id.match(rowPattern);

      return match ? [Number(match[1])] : [];
    });
    const pagination = document.querySelector<HTMLElement>(
      '[aria-label="Paginación de informes"]',
    );
    const summary = Object.fromEntries(
      Array.from(document.querySelectorAll<HTMLElement>(".surface-soft")).flatMap(
        (card) => {
          const [label, value] = Array.from(card.querySelectorAll("p")).map(
            (node) => node.textContent?.trim() ?? "",
          );

          return label && value ? [[label, value]] : [];
        },
      ),
    );

    return {
      rowIds: reportRows,
      text: document.body.innerText,
      paginationText: pagination?.innerText ?? null,
      summary,
    };
  }, REPORT_ROW_ID.source);
}

async function expectWorkspaceReady(page: Page) {
  await expect(page.locator("#reports-master-list")).toBeVisible({
    timeout: 8_000,
  });
}

async function expectRows(page: Page, expectedIds: number[]) {
  await expect(async () => {
    const state = await readWorkspaceState(page);

    expect(state.rowIds).toEqual(expectedIds);
  }).toPass({ timeout: 8_000 });
}

test.describe("clinic reports workspace 1000-report fixture (CAP-C3)", () => {
  test("first page renders a bounded slice and coherent 1000-report pagination", async ({
    page,
  }) => {
    await setPopulatedClinicSession(page);
    await page.goto("/dashboard/informes");
    await expectWorkspaceReady(page);

    await expectRows(page, [8401, 8402, 8403, 8404, 8405, 8406]);

    const state = await readWorkspaceState(page);

    expect(state.rowIds).toHaveLength(6);
    expect(state.summary.Total).toBe("1000");
    expect(state.summary.Mostrando).toBe("1-6");
    expect(state.summary.Página).toBe("1 / 167");
    expect(state.paginationText).toContain("Página 1 de 167");
    expect(state.text).not.toContain("Paciente E2E 0999");
  });

  test("pagination advances to a later page without rendering the full fixture", async ({
    page,
  }) => {
    await setPopulatedClinicSession(page);
    await page.goto("/dashboard/informes");
    await expectWorkspaceReady(page);

    await Promise.all([
      page.waitForURL("**/dashboard/informes?page=2"),
      page.getByRole("button", { name: "Página siguiente" }).click(),
    ]);

    await expectWorkspaceReady(page);
    await expectRows(page, [8407, 8408, 8409, 8410, 8411, 8412]);

    const state = await readWorkspaceState(page);

    expect(state.rowIds).toHaveLength(6);
    expect(state.summary.Total).toBe("1000");
    expect(state.summary.Mostrando).toBe("7-12");
    expect(state.summary.Página).toBe("2 / 167");
    expect(state.paginationText).toContain("Página 2 de 167");
  });

  test("status filter keeps limit/offset pagination semantics in the workspace", async ({
    page,
  }) => {
    await setPopulatedClinicSession(page);
    await page.goto("/dashboard/informes");
    await expectWorkspaceReady(page);

    await page.getByLabel("Filtrar por estado").selectOption("delivered");
    await Promise.all([
      page.waitForURL((url) => url.searchParams.get("status") === "delivered"),
      page.getByRole("button", { name: "Filtrar" }).click(),
    ]);

    await expectWorkspaceReady(page);
    await expectRows(page, [8403, 8404, 8408, 8412, 8416, 8420]);

    const state = await readWorkspaceState(page);

    expect(state.rowIds).toHaveLength(6);
    expect(state.summary.Total).toBe("251");
    expect(state.summary.Página).toBe("1 / 42");
    expect(state.paginationText).toContain("Página 1 de 42");
  });

  test("query search narrows the workspace through the compact filter form", async ({
    page,
  }) => {
    await setPopulatedClinicSession(page);
    await page.goto("/dashboard/informes");
    await expectWorkspaceReady(page);

    await page.getByLabel("Buscar informes").fill("Paciente E2E 0100");
    await Promise.all([
      page.waitForURL(
        (url) => url.searchParams.get("query") === "Paciente E2E 0100",
      ),
      page.getByRole("button", { name: "Filtrar" }).click(),
    ]);

    await expectWorkspaceReady(page);
    await expectRows(page, [8500]);

    const state = await readWorkspaceState(page);

    expect(state.summary.Total).toBe("1");
    expect(state.summary.Mostrando).toBe("1-1");
    expect(state.summary.Página).toBe("1 / 1");
    await expect(page.locator('[aria-label="Paginación de informes"]')).toHaveCount(0);
  });

  test("combined query, status and studyType filters keep totalPages coherent", async ({
    page,
  }) => {
    await setPopulatedClinicSession(page);
    await page.goto("/dashboard/informes");
    await expectWorkspaceReady(page);

    await page.getByLabel("Buscar informes").fill("Paciente E2E");
    await page.getByLabel("Filtrar por estado").selectOption("delivered");
    await page.getByLabel("Filtrar por tipo de estudio").fill("Necropsia");
    await Promise.all([
      page.waitForURL((url) => {
        return (
          url.searchParams.get("query") === "Paciente E2E" &&
          url.searchParams.get("status") === "delivered" &&
          url.searchParams.get("studyType") === "Necropsia"
        );
      }),
      page.getByRole("button", { name: "Filtrar" }).click(),
    ]);

    await expectWorkspaceReady(page);
    await expectRows(page, [8420, 8440, 8460, 8480, 8500, 8520]);

    let state = await readWorkspaceState(page);

    expect(state.summary.Total).toBe("50");
    expect(state.summary.Mostrando).toBe("1-6");
    expect(state.summary.Página).toBe("1 / 9");
    expect(state.paginationText).toContain("Página 1 de 9");

    await Promise.all([
      page.waitForURL((url) => url.searchParams.get("page") === "2"),
      page.getByRole("button", { name: "Página siguiente" }).click(),
    ]);

    await expectRows(page, [8540, 8560, 8580, 8600, 8620, 8640]);

    state = await readWorkspaceState(page);

    expect(state.summary.Total).toBe("50");
    expect(state.summary.Mostrando).toBe("7-12");
    expect(state.summary.Página).toBe("2 / 9");
    expect(state.paginationText).toContain("Página 2 de 9");
  });
});
