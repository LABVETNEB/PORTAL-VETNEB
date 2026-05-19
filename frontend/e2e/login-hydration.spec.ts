import { expect, type Locator, type Page, test } from "@playwright/test";

const loginFormName = "Formulario de inicio de sesión";
const usernameValue = "clinica.hidratacion";
const passwordValue = "secreto-estable";

function collectHydrationFailures(page: Page) {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];

  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  return {
    assertClean() {
      const hydrationConsoleErrors = consoleErrors.filter((message) =>
        /hydration|server rendered html|text content does not match/i.test(
          message,
        ),
      );

      expect(pageErrors).toEqual([]);
      expect(hydrationConsoleErrors).toEqual([]);
    },
  };
}

async function expectInitialLoginState(page: Page) {
  const form = page.getByRole("form", { name: loginFormName });
  const username = page.getByLabel("Usuario", { exact: true });
  const password = page.getByLabel("Contraseña", { exact: true });
  const submit = form.getByRole("button", { name: "Iniciar sesión" });
  const clinicTab = page.getByRole("button", { name: "Clínicas" });
  const passwordToggle = form.locator(
    '[data-auth-password-visibility-toggle="true"]',
  );

  await expect(form).toBeVisible();
  await expect(clinicTab).toBeEnabled();
  await expect(clinicTab).toHaveAttribute("aria-pressed", "true");
  await expect(username).toHaveValue("");
  await expect(username).toBeEnabled();
  await expect(password).toHaveValue("");
  await expect(password).toBeEnabled();
  await expect(password).toHaveAttribute("type", "password");
  await expect(passwordToggle).toBeEnabled();
  await expect(passwordToggle).toHaveAccessibleName("Mostrar contraseña");
  await expect(passwordToggle).toHaveAttribute("aria-pressed", "false");
  await expect(submit).toBeEnabled();
  await expect(submit).toHaveText("Iniciar sesión");
  await expect(submit).toHaveAttribute("aria-busy", "false");

  return {
    form,
    username,
    password,
    submit,
    passwordToggle,
  };
}

async function setPasswordVisibility(
  password: Locator,
  passwordToggle: Locator,
  visible: boolean,
) {
  await expect(async () => {
    const currentType = await password.getAttribute("type");

    if ((currentType === "text") !== visible) {
      await passwordToggle.click();
    }

    await expect(password).toHaveAttribute(
      "type",
      visible ? "text" : "password",
      { timeout: 500 },
    );
  }).toPass({
    intervals: [50, 100, 250],
    timeout: 5_000,
  });
}

test("login hydrates with deterministic CTA and clinic form controls", async ({
  page,
}) => {
  const hydrationFailures = collectHydrationFailures(page);

  const response = await page.goto("/login", { waitUntil: "domcontentloaded" });

  expect(response?.ok(), "/login should render successfully").toBeTruthy();

  const { form, username, password, submit, passwordToggle } =
    await expectInitialLoginState(page);

  await setPasswordVisibility(password, passwordToggle, true);
  await expect(passwordToggle).toHaveAccessibleName("Ocultar contraseña");
  await expect(passwordToggle).toHaveAttribute("aria-pressed", "true");

  await setPasswordVisibility(password, passwordToggle, false);
  await expect(passwordToggle).toHaveAccessibleName("Mostrar contraseña");
  await expect(passwordToggle).toHaveAttribute("aria-pressed", "false");

  await username.fill(usernameValue);
  await password.fill(passwordValue);
  await expect(username).toHaveValue(usernameValue);
  await expect(password).toHaveValue(passwordValue);

  await setPasswordVisibility(password, passwordToggle, true);
  await expect(passwordToggle).toHaveAccessibleName("Ocultar contraseña");
  await expect(passwordToggle).toHaveAttribute("aria-pressed", "true");
  await expect(username).toHaveValue(usernameValue);
  await expect(password).toHaveValue(passwordValue);

  await setPasswordVisibility(password, passwordToggle, false);
  await expect(passwordToggle).toHaveAccessibleName("Mostrar contraseña");
  await expect(passwordToggle).toHaveAttribute("aria-pressed", "false");
  await expect(username).toHaveValue(usernameValue);
  await expect(password).toHaveValue(passwordValue);

  await expect(submit).toBeEnabled();
  await expect(submit).toHaveText("Iniciar sesión");
  await expect(submit).toHaveAttribute("aria-busy", "false");

  const submittedFields = await form.evaluate((formElement) =>
    Object.fromEntries(new FormData(formElement as HTMLFormElement)),
  );

  expect(submittedFields).toMatchObject({
    username: usernameValue,
    password: passwordValue,
  });
  hydrationFailures.assertClean();
});

test("login initial state survives enriched dev API fallback warnings", async ({
  page,
}) => {
  const warnings: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "warning") {
      warnings.push(message.text());
    }
  });

  await page.addInitScript(() => {
    console.warn("[API] getReports: endpoint no disponible");
    console.warn("[API] getReports: HTTP 404");
  });

  const response = await page.goto("/login", { waitUntil: "domcontentloaded" });

  expect(response?.ok(), "/login should render successfully").toBeTruthy();
  await expectInitialLoginState(page);

  expect(warnings).toContain("[API] getReports: endpoint no disponible");
  expect(warnings).toContain("[API] getReports: HTTP 404");
});
