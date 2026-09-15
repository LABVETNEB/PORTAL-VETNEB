import { expect, test } from "@playwright/test";

const LOGIN_FORM_NAME = "Formulario de inicio de sesión";

for (const dashboardPath of [
  "/dashboard",
  "/dashboard/admin",
  "/dashboard/informes",
] as const) {
  test(`unauthenticated ${dashboardPath} redirects to a stable login page`, async ({
    page,
  }) => {
    const pageErrors: string[] = [];

    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    await page.goto(dashboardPath, { waitUntil: "domcontentloaded" });

    await expect(page).toHaveURL((url) => {
      return (
        url.pathname === "/login" &&
        url.searchParams.get("next") === dashboardPath
      );
    });
    await expect(
      page.getByRole("form", { name: LOGIN_FORM_NAME }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Iniciar sesión" }),
    ).toBeVisible();
    await expect(page.getByText(/HTTP 401|Unauthorized|Sesión expirada/i)).toHaveCount(
      0,
    );

    // "Stable" is bound to the end of the client flow, not to a duration: the
    // only client-side redirects /login owns run in LoginContent's mount
    // effects, so wait for its client commit (the hydration ref marker of its
    // own route control) and cross two frames so those effects have flushed.
    await page
      .locator('[data-auth-login-polish="true"] [data-public-route-control-hydrated="true"]')
      .first()
      .waitFor({ state: "attached" });
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        }),
    );
    await expect(page).toHaveURL((url) => url.pathname === "/login");
    expect(pageErrors).toEqual([]);
  });
}
