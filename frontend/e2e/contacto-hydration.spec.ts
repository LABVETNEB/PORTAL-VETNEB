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


