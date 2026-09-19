import { type Page, type Request, expect, test } from "@playwright/test";

const CLINIC_ID = 123;
const DETAIL_PATH = `/profesionales/${CLINIC_ID}`;
const INVALID_DETAIL_PATH = "/profesionales/no-valido";
const DETAIL_API_PATH = `/api/public/professionals/${CLINIC_ID}`;
const DETAIL_TITLE = "Perfil profesional veterinario | Portal VETNEB";
const ERROR_COPY = "No se pudo cargar el perfil profesional solicitado.";

// next dev runs React StrictMode, which mounts the fetch effect twice (the
// first response is discarded by its isCurrent guard); the production runner
// behind e2e:ci (next start) mounts it once.
const isProductionRunner =
  process.env.CI === "true" && process.env.VETNEB_E2E_PRODUCTION_RUNNER === "1";
const MAX_DETAIL_FETCHES = isProductionRunner ? 1 : 2;

const PRIVATE_API_PREFIXES = [
  "/api/admin/",
  "/api/clinic/",
  "/api/auth/",
  "/api/reports",
  "/api/logistics/",
  "/api/particular/",
];

const professionalDetail = {
  success: true,
  professional: {
    clinicId: CLINIC_ID,
    displayName: "Clínica Pública E2E",
    avatarUrl: null,
    specialtyText: "Histopatología",
    servicesText: "Biopsias",
    email: "public-profile@example.com",
    phone: "3411234567",
    publicAddress: "Dirección pública E2E 123",
    mapLink: "https://example.com/map",
    locality: "Rosario",
    country: "AR",
    aboutText: "Perfil público controlado para validación E2E.",
    updatedAt: "2026-09-19T00:00:00.000Z",
    relevance: { rank: 0.4, similarity: 0.3, score: 0.7 },
    profileQualityScore: 0.9,
  },
};

function trackApiRequests(page: Page) {
  const requests: Request[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/")) {
      requests.push(request);
    }
  });

  const pathnames = () => requests.map((request) => new URL(request.url()).pathname);

  return {
    detailRequests: () =>
      requests.filter((request) => new URL(request.url()).pathname === DETAIL_API_PATH),
    professionalApiPathnames: () =>
      pathnames().filter((pathname) => pathname.startsWith("/api/public/professionals")),
    privateApiPathnames: () =>
      pathnames().filter((pathname) =>
        PRIVATE_API_PREFIXES.some((prefix) => pathname.startsWith(prefix)),
      ),
  };
}

// External contact controls are buttons that call window.open on click; the
// stub records the constructed target so no popup or external request happens.
async function recordExternalOpens(page: Page) {
  await page.addInitScript(() => {
    const opened: Array<{ url: string; target: string; features: string }> = [];
    Object.defineProperty(window, "__professionalDetailOpens", { value: opened });
    window.open = (url, target, features) => {
      opened.push({ url: String(url), target: String(target), features: String(features) });
      return null;
    };
  });

  return () =>
    page.evaluate(
      () =>
        (window as unknown as { __professionalDetailOpens: Array<{ url: string; target: string; features: string }> })
          .__professionalDetailOpens,
    );
}

function expectDetailFetches(detailRequests: Request[]) {
  expect(detailRequests.length).toBeGreaterThanOrEqual(1);
  expect(detailRequests.length).toBeLessThanOrEqual(MAX_DETAIL_FETCHES);
  for (const request of detailRequests) {
    expect(request.method()).toBe("GET");
  }
}

async function expectDetailMetadata(page: Page, path: string) {
  await expect(page).toHaveTitle(DETAIL_TITLE);
  const canonical = page.locator('link[rel="canonical"]');
  await expect(canonical).toHaveCount(1);
  const canonicalHref = await canonical.getAttribute("href");
  expect(canonicalHref).not.toBeNull();
  expect(new URL(canonicalHref!).pathname).toBe(path);
}

test.describe("profesionales/[clinicId] — public professional detail", () => {
  test("renders the stubbed public profile with metadata and contact fields", async ({ page }) => {
    const api = trackApiRequests(page);
    const openedTargets = await recordExternalOpens(page);
    await page.route(`**${DETAIL_API_PATH}`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(professionalDetail),
      }),
    );

    const response = await page.goto(DETAIL_PATH);
    expect(response?.ok(), `${DETAIL_PATH} should return a successful response`).toBeTruthy();

    await expect(
      page.getByRole("heading", { level: 1, name: "Perfil profesional", exact: true }),
    ).toBeVisible();
    await expectDetailMetadata(page, DETAIL_PATH);

    const profile = page.getByRole("article");
    await expect(
      profile.getByRole("heading", { name: "Clínica Pública E2E", exact: true }),
    ).toBeVisible();
    await expect(profile.getByText("Perfil verificado", { exact: true })).toBeVisible();
    await expect(profile.getByText("Rosario, AR", { exact: true }).first()).toBeVisible();
    await expect(profile.getByText("Histopatología", { exact: true })).toBeVisible();
    await expect(profile.getByText("Biopsias", { exact: true })).toBeVisible();
    await expect(
      profile.getByText("Perfil público controlado para validación E2E.", { exact: true }),
    ).toBeVisible();
    await expect(profile.getByText("Dirección pública E2E 123", { exact: true })).toBeVisible();
    await expect(profile.getByRole("heading", { name: "Relación con VETNEB" })).toBeVisible();

    const email = profile.getByRole("button", { name: "Enviar email a Clínica Pública E2E" });
    await expect(email).toBeVisible();
    await expect(email).toHaveText("public-profile@example.com");

    const phone = profile.getByRole("button", {
      name: "Contactar por teléfono a Clínica Pública E2E",
    });
    await expect(phone).toBeVisible();
    await expect(phone).toHaveText("3411234567");

    const map = profile.getByRole("button", { name: "Abrir mapa de Clínica Pública E2E" });
    await expect(map).toBeVisible();
    await expect(map).toHaveText("Ver ubicación en mapa");

    await phone.click();
    await map.click();
    expect(await openedTargets()).toEqual([
      { url: "https://wa.me/5493411234567", target: "_blank", features: "noopener,noreferrer" },
      { url: "https://example.com/map", target: "_blank", features: "noopener,noreferrer" },
    ]);
    expect(new URL(page.url()).pathname).toBe(DETAIL_PATH);

    const back = page.getByRole("button", { name: "Volver a la búsqueda" });
    await expect(back).toBeVisible();
    await expect(back).toHaveAttribute("data-public-route-href", "/profesionales");

    expectDetailFetches(api.detailRequests());
    expect(api.privateApiPathnames()).toEqual([]);
  });

  test("renders the public error state when the detail endpoint fails", async ({ page }) => {
    const api = trackApiRequests(page);
    await page.route(`**${DETAIL_API_PATH}`, (route) =>
      route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ success: false, error: "Not found" }),
      }),
    );

    const response = await page.goto(DETAIL_PATH);
    expect(response?.ok(), `${DETAIL_PATH} should return a successful response`).toBeTruthy();

    await expect(
      page.getByRole("heading", { level: 1, name: "Perfil profesional", exact: true }),
    ).toBeVisible();
    await expect(page.getByText(ERROR_COPY)).toBeVisible();
    await expect(page.getByText("Clínica Pública E2E")).toHaveCount(0);
    await expect(page.getByRole("article")).toHaveCount(0);

    expectDetailFetches(api.detailRequests());
    expect(api.privateApiPathnames()).toEqual([]);
  });

  test("an invalid clinicId fails locally without requesting the professional API", async ({ page }) => {
    const api = trackApiRequests(page);

    const response = await page.goto(INVALID_DETAIL_PATH);
    expect(response?.ok(), `${INVALID_DETAIL_PATH} should return a successful response`).toBeTruthy();

    await expect(
      page.getByRole("heading", { level: 1, name: "Perfil profesional", exact: true }),
    ).toBeVisible();
    await expect(page.getByText(ERROR_COPY)).toBeVisible();
    await expectDetailMetadata(page, INVALID_DETAIL_PATH);

    expect(api.professionalApiPathnames()).toEqual([]);
    expect(api.privateApiPathnames()).toEqual([]);
  });
});
