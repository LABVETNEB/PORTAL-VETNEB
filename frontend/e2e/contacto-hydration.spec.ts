import { type Page, expect, test } from "@playwright/test";

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

test("contacto form hydrates without mismatch on inputs and textarea", async ({
  page,
}) => {
  const hydrationFailures = collectHydrationFailures(page);

  const response = await page.goto("/contacto", {
    waitUntil: "domcontentloaded",
  });

  expect(response?.ok(), "/contacto should render successfully").toBeTruthy();

  const form = page.getByRole("form", { name: "Formulario de contacto" });
  const nombre = page.locator("#nombre");
  const apellido = page.locator("#apellido");
  const email = page.locator("#email");
  const clinica = page.locator("#clinica");
  const mensaje = page.locator("#mensaje");
  const submit = form.getByRole("button", { name: "Enviar mensaje" });

  await expect(form).toBeVisible();
  await expect(nombre).toBeEnabled();
  await expect(apellido).toBeEnabled();
  await expect(email).toBeEnabled();
  await expect(clinica).toBeEnabled();
  await expect(mensaje).toBeEnabled();
  await expect(submit).toBeEnabled();

  await nombre.fill("Ana");
  await apellido.fill("García");
  await email.fill("ana@clinica.vet");
  await mensaje.fill("Consulta sobre acceso para clínica veterinaria.");

  await expect(nombre).toHaveValue("Ana");
  await expect(apellido).toHaveValue("García");
  await expect(email).toHaveValue("ana@clinica.vet");
  await expect(mensaje).toHaveValue(
    "Consulta sobre acceso para clínica veterinaria.",
  );

  hydrationFailures.assertClean();
});

test("contacto routes each intent without changing the form contract", async ({
  page,
}) => {
  const response = await page.goto("/contacto", {
    waitUntil: "domcontentloaded",
  });

  expect(response?.ok(), "/contacto should render successfully").toBeTruthy();

  const intentRouter = page.locator("[data-contact-intent-router]");
  const form = page.getByRole("form", { name: "Formulario de contacto" });

  await expect(intentRouter).toBeVisible();
  await expect(
    intentRouter.locator("[data-contact-intent]"),
  ).toHaveCount(4);
  await expect(
    intentRouter.locator('[data-contact-intent="clinic-registration"]'),
  ).toContainText("Registrar clínica / solicitar acceso");
  await expect(
    intentRouter.locator('[data-contact-intent="sample-shipping"]'),
  ).toHaveAttribute(
    "data-contact-target",
    "https://wa.me/5493534138946",
  );
  await expect(
    intentRouter.locator('[data-contact-intent="tutor-code"]'),
  ).toHaveAttribute("data-contact-target", "/particulares");
  await expect(
    intentRouter.locator('[data-contact-intent="general-inquiry"]'),
  ).toHaveAttribute("data-contact-target", "#contact-form");

  await expect(form.getByLabel("Nombre", { exact: true })).toBeVisible();
  await expect(form.getByLabel("Apellido", { exact: true })).toBeVisible();
  await expect(form.getByLabel("Email", { exact: true })).toBeVisible();
  await expect(
    form.getByLabel("Nombre de la clínica (opcional)", { exact: true }),
  ).toBeVisible();
  await expect(form.getByLabel("Mensaje", { exact: true })).toBeVisible();
  await expect(
    form.getByRole("button", { name: "Enviar mensaje" }),
  ).toBeVisible();

  const contactInfo = page.getByRole("region", {
    name: "Información de contacto",
  });
  await expect(contactInfo).toContainText("WhatsApp");
  await expect(contactInfo).toContainText("3534138946");
  await expect(contactInfo).toContainText("Email");
  await expect(contactInfo).toContainText("lab.vetneb@gmail.com");
  await expect(contactInfo).toContainText("Ubicación");
  await expect(contactInfo).toContainText(
    "Villa María, Córdoba, Argentina",
  );

  const forbiddenPublicCopy = [
    "MUESTRA",
    "DEMOSTRATIVO",
    "ejemplo visual",
    "sin datos reales",
    "caso demo",
    "DEMO-000",
    "DEMO-CLINICA-001",
    "paciente demostrativo",
    "clínica demostrativa",
    "preview de informe simulado",
    "panel operativo simulado",
    "dashboard ficticio",
    "informe inventado",
    "datos ficticios visibles",
  ];

  for (const forbiddenCopy of forbiddenPublicCopy) {
    await expect(page.locator("body")).not.toContainText(forbiddenCopy);
  }
});
