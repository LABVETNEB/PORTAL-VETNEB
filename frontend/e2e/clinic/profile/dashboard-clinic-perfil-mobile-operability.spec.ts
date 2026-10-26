import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { setClinicSession } from "../../helpers/session";
import { MAX_DOCUMENT_SCROLL_DELTA_PX } from "../../helpers/zero-scroll-contract";

type Locator = import("@playwright/test").Locator;
type Page = import("@playwright/test").Page;

const TOLERANCE = 2;

const VIEWPORTS = [
  { name: "360x740", width: 360, height: 740 },
  { name: "390x844", width: 390, height: 844 },
  { name: "430x932", width: 430, height: 932 },
] as const;

// B09 unified navigation contract: every clinic module reaches every other one
// from ONE owner. `/dashboard` used to be the exception — the clinic bottom nav
// returned null there and `DashboardModuleRail` took over — so this surface had
// a different navigation owner than the rest of the role. The bar covers it now
// and the rail is retired, together with its prev/next pager: that pager was a
// SECOND grammar over the same ordered modules, not a destination, so it is not
// reproduced. What the rail actually delivered — the five modules, the deep
// link and `aria-current` — is asserted here against the new owner.
async function expectClinicMobileNav(
  page: Page,
  label: string,
  activeModule: "operaciones" | "informes" | "logistica" | "perfil" | "tokens",
) {
  // `DashboardMobileNav` streams through a Suspense boundary whose fallback
  // mounts a SECOND `DashboardMobileNavBar` carrying the same attributes, so
  // the bare owner can resolve to two nodes while exactly one is painted.
  // Filtering the OWNER keeps every slot/aria-current count below measuring the
  // painted bar; zero visible bars still fail, two still fail on strictness.
  const nav = page
    .locator('[data-dashboard-mobile-nav="clinic"]')
    .filter({ visible: true });
  await expect(nav, `${label}: clinic mobile navigation visible`).toBeVisible();

  for (const moduleId of [
    "operaciones",
    "informes",
    "logistica",
    "tokens",
    "perfil",
  ] as const) {
    await expect(
      nav.locator(`[data-dashboard-mobile-nav-item="${moduleId}"]`),
      `${label}: navigation exposes ${moduleId}`,
    ).toHaveCount(1);
  }

  // B09_CLINIC_HOME_ITEM = RETIRED + CLINIC_MOBILE_OVERFLOW = RETIRED — five
  // slots, all of them real destinations. Clínica ships five modules against a
  // five-slot band, so the whole catalog is promoted and there is no remainder
  // for a "Más" sheet to list. "Inicio" is still an ADMIN destination: the hub
  // is admin's null module state, and Clínica paints no home item on the
  // lateral bands either, so the bar has none.
  await expect(
    nav.locator("[data-dashboard-mobile-nav-item]"),
    `${label}: five clinic primary destinations`,
  ).toHaveCount(5);
  await expect(
    nav.locator('[data-dashboard-mobile-nav-item="home"]'),
    `${label}: no Inicio on the clinic bar`,
  ).toHaveCount(0);

  // Every module reports on its OWN slot now. "Más" used to claim `aria-current`
  // on behalf of perfil/tokens — correct while they were off the bar, and
  // impossible now that they are on it.
  await expect(
    nav.locator(`[data-dashboard-mobile-nav-item="${activeModule}"]`),
    `${label}: active destination marked current`,
  ).toHaveAttribute("aria-current", "page");
  await expect(
    nav.locator("[aria-current='page']"),
    `${label}: exactly one current destination`,
  ).toHaveCount(1);

  await expect(
    nav.locator('[data-dashboard-mobile-nav-item="overflow"]'),
    `${label}: no destination overflow trigger on the clinic bar`,
  ).toHaveCount(0);
  await expect(
    page.locator('[data-dashboard-mobile-nav-overflow="true"]'),
    `${label}: no destination overflow sheet in the clinic tree`,
  ).toHaveCount(0);

  // The retired owners must not come back next to it.
  await expect(
    page.locator("[data-dashboard-module-rail]"),
    `${label}: retired module rail absent`,
  ).toHaveCount(0);
  await expect(
    page.locator('[data-dashboard-mobile-nav="admin"]'),
    `${label}: admin mobile navigation absent`,
  ).toHaveCount(0);
}

async function mockClinicProfile(page: Page) {
  await page.route("**/api/clinic/profile**", async (route) => {
    if (route.request().method() !== "GET") return route.continue();

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        profile: {
          clinicId: 1,
          displayName: "Clinica Perfil Mobile Operable",
          specialtyText: "Anatomia patologica veterinaria especializada",
          servicesText:
            "Citologia, histopatologia, inmunohistoquimica y diagnostico integral veterinario.",
          aboutText:
            "Perfil institucional denso para verificar la operabilidad completa del editor en mobile.",
          email: "perfil-mobile@example.test",
          phone: "+54 11 5555-1234",
          publicAddress: "Avenida Veterinaria 1234, Ciudad Autonoma de Buenos Aires",
          mapLink: "https://maps.google.com/maps?q=vetneb",
          locality: "Buenos Aires",
          country: "Argentina",
          avatarUrl: null,
          isPublic: true,
          publication: {
            isSearchEligible: true,
            qualityScore: 95,
            minimumQualityScore: 75,
            hasRequiredPublicFields: true,
            missingRequiredFields: [],
            missingRecommendedFields: [],
            publicationErrors: [],
          },
        },
      }),
    });
  });
}

async function expectNoProfileInternalScroll(page: Page, label: string) {
  const scrollState = await page.evaluate(() => {
    const editor = document.querySelector<HTMLElement>(
      '[data-clinic-profile-editor="true"]',
    );
    const fields = document.querySelector<HTMLElement>(
      '[data-clinic-profile-fields="true"]',
    );
    // CMP-10 (DIF-036): `.dashboard-module-body` no longer exists in the
    // clinic mobile DOM — its scroll-owner grant was retired once CMP-05/
    // CMP-07 removed the overflow it existed for. This exemption is now
    // permanently vacuous; ANY internal scroll container here is disallowed.
    const scrollContainers = editor
      ? [editor, ...Array.from(editor.querySelectorAll<HTMLElement>("*"))].flatMap(
          (element) => {
            if (element.classList.contains("dashboard-module-body")) return [];
            const style = window.getComputedStyle(element);
            return ["auto", "scroll"].includes(style.overflowY)
              ? [
                  {
                    tag: element.tagName,
                    overflowY: style.overflowY,
                  },
                ]
              : [];
          },
        )
      : [];
    const fieldStyle = fields ? window.getComputedStyle(fields) : null;

    return {
      hasEditor: editor !== null,
      hasFields: fields !== null,
      fieldOverflowY: fieldStyle?.overflowY ?? "missing",
      fieldScrollHeight: fields?.scrollHeight ?? 0,
      fieldClientHeight: fields?.clientHeight ?? 0,
      scrollContainers,
    };
  });

  expect(scrollState.hasEditor, `${label}: profile editor present`).toBe(true);
  expect(scrollState.hasFields, `${label}: active profile fields present`).toBe(true);
  expect(
    ["auto", "scroll"],
    `${label}: active fields must not expose vertical scroll`,
  ).not.toContain(scrollState.fieldOverflowY);
  expect(
    scrollState.fieldScrollHeight,
    `${label}: active fields must fit without hidden clipping`,
  ).toBeLessThanOrEqual(scrollState.fieldClientHeight + TOLERANCE);
  expect(
    scrollState.scrollContainers,
    `${label}: profile editor must not contain internal scroll containers`,
  ).toEqual([]);
}

async function expectLocatorInsideViewport(
  locator: Locator,
  viewport: (typeof VIEWPORTS)[number],
  label: string,
) {
  const box = await locator.boundingBox();

  expect(box, `${label}: bounds`).not.toBeNull();
  expect(box!.x, `${label}: left cut`).toBeGreaterThanOrEqual(-TOLERANCE);
  expect(box!.y, `${label}: top cut`).toBeGreaterThanOrEqual(-TOLERANCE);
  expect(box!.x + box!.width, `${label}: right cut`).toBeLessThanOrEqual(
    viewport.width + TOLERANCE,
  );
  expect(box!.y + box!.height, `${label}: bottom cut`).toBeLessThanOrEqual(
    viewport.height + TOLERANCE,
  );
}

async function expectNoGlobalDashboardScroll(page: Page, label: string) {
  const shellMetrics = await page.evaluate(() => {
    const main = document.querySelector<HTMLElement>("main.dashboard-main");
    return {
      html: {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollHeight: document.documentElement.scrollHeight,
        clientHeight: document.documentElement.clientHeight,
      },
      body: {
        scrollWidth: document.body.scrollWidth,
        clientWidth: document.body.clientWidth,
        scrollHeight: document.body.scrollHeight,
        clientHeight: document.body.clientHeight,
      },
      main: main
        ? {
            scrollHeight: main.scrollHeight,
            clientHeight: main.clientHeight,
          }
        : null,
    };
  });

  expect(
    shellMetrics.html.scrollWidth,
    `${label}: html horizontal scroll`,
  ).toBeLessThanOrEqual(shellMetrics.html.clientWidth + MAX_DOCUMENT_SCROLL_DELTA_PX);
  expect(
    shellMetrics.body.scrollWidth,
    `${label}: body horizontal scroll`,
  ).toBeLessThanOrEqual(shellMetrics.body.clientWidth + MAX_DOCUMENT_SCROLL_DELTA_PX);
  expect(
    shellMetrics.html.scrollHeight,
    `${label}: html vertical scroll`,
  ).toBeLessThanOrEqual(shellMetrics.html.clientHeight + MAX_DOCUMENT_SCROLL_DELTA_PX);
  expect(
    shellMetrics.body.scrollHeight,
    `${label}: body vertical scroll`,
  ).toBeLessThanOrEqual(shellMetrics.body.clientHeight + MAX_DOCUMENT_SCROLL_DELTA_PX);
  expect(shellMetrics.main, `${label}: dashboard main`).not.toBeNull();
  expect(
    shellMetrics.main!.scrollHeight,
    `${label}: main vertical scroll`,
  ).toBeLessThanOrEqual(shellMetrics.main!.clientHeight + TOLERANCE);
}

for (const viewport of VIEWPORTS) {
  test(`clinic perfil public editor is operable at ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await setClinicSession(page, "default");
    await mockClinicProfile(page);

    await page.goto("/dashboard?module=perfil");
    const workspace = page.locator('[data-dashboard-module-workspace="perfil"]');
    await expect(workspace).toBeVisible({ timeout: 12_000 });

    await expect(async () => {
      await expect(
        workspace.getByRole("tab", { name: "Acceso", exact: true }),
      ).toHaveCount(0);
      await expect(
        workspace.getByRole("tab", { name: "Perfil público", exact: true }),
      ).toHaveCount(0);
      await expect(page.locator("#clinic-public-profile")).toBeVisible();
    }).toPass({ timeout: 12_000 });

    const editor = page.locator('[data-clinic-profile-editor="true"]');
    await expect(editor).toBeVisible();
    await expectClinicMobileNav(page, viewport.name, "perfil");

    for (const tabName of [
      "Estado",
      "Datos",
      "Contacto",
      "Contenido",
      "Cambiar contraseña",
    ]) {
      await expect(
        editor.getByRole("tab", { name: tabName, exact: true }),
      ).toBeVisible();
    }
    await expect(
      editor.getByRole("tab", { name: "Acceso", exact: true }),
    ).toHaveCount(0);

    await editor
      .getByRole("tab", { name: "Cambiar contraseña", exact: true })
      .click();
    const passwordPanel = editor.locator("#clinic-password-change");
    await expect(passwordPanel).toBeVisible();
    const currentPassword = passwordPanel.locator(
      'input[name="currentPassword"]',
    );
    const newPassword = passwordPanel.locator('input[name="newPassword"]');
    const confirmPassword = passwordPanel.locator(
      'input[name="confirmPassword"]',
    );
    const submitPassword = passwordPanel.getByRole("button", {
      name: "Actualizar contraseña",
      exact: true,
    });
    await expect(currentPassword).toBeVisible();
    await expect(newPassword).toBeVisible();
    await expect(confirmPassword).toBeVisible();
    await expect(submitPassword).toBeVisible();
    await expectLocatorInsideViewport(
      currentPassword,
      viewport,
      `${viewport.name}: contraseña actual`,
    );
    await expectLocatorInsideViewport(
      newPassword,
      viewport,
      `${viewport.name}: nueva contraseña`,
    );
    await expectLocatorInsideViewport(
      confirmPassword,
      viewport,
      `${viewport.name}: confirmar contraseña`,
    );
    await expectLocatorInsideViewport(
      submitPassword,
      viewport,
      `${viewport.name}: actualizar contraseña`,
    );
    await expectNoGlobalDashboardScroll(
      page,
      `${viewport.name}: cambiar contraseña`,
    );

    await expect(async () => {
      await editor.getByRole("tab", { name: "Datos", exact: true }).click();
      await expect(
        editor.locator('[data-clinic-profile-fields="true"]'),
      ).toBeVisible();
    }).toPass({ timeout: 12_000 });

    const fields = editor.locator('[data-clinic-profile-fields="true"]');
    await expect(fields).toBeVisible();
    await expectNoProfileInternalScroll(page, `${viewport.name}: datos tab`);

    await expectNoGlobalDashboardScroll(page, `${viewport.name}: datos tab`);

    await editor.getByRole("tab", { name: "Contacto", exact: true }).click();
    await expectNoProfileInternalScroll(page, `${viewport.name}: contacto tab`);

    const mapLink = page.locator("#clinic-profile-map-link");
    await expect(mapLink).toBeVisible();
    const mapLinkBox = await mapLink.boundingBox();
    expect(mapLinkBox).not.toBeNull();
    expect(mapLinkBox!.y).toBeGreaterThanOrEqual(-TOLERANCE);
    expect(mapLinkBox!.y + mapLinkBox!.height).toBeLessThanOrEqual(
      viewport.height + TOLERANCE,
    );

    const saveButton = page.getByRole("button", {
      name: "Guardar perfil público",
      exact: true,
    });
    await expect(saveButton).toBeVisible();
    const saveButtonBox = await saveButton.boundingBox();
    expect(saveButtonBox).not.toBeNull();
    expect(saveButtonBox!.x).toBeGreaterThanOrEqual(-TOLERANCE);
    expect(saveButtonBox!.x + saveButtonBox!.width).toBeLessThanOrEqual(
      viewport.width + TOLERANCE,
    );
    expect(saveButtonBox!.y + saveButtonBox!.height).toBeLessThanOrEqual(
      viewport.height + TOLERANCE,
    );
    await expect(editor.getByText("Usuarios y roles")).toHaveCount(0);
    await expect(editor.getByText("Auditoría")).toHaveCount(0);
    await expect(editor.getByText("Mantenimiento")).toHaveCount(0);
  });
}

// C25 F-T6 · equal-width chips truncated "Cambiar contraseña" to 65-78 px of
// 118 at 360-430 (HEAD 25cd6e50; "Contenido" too at 360), and the password
// panel's own title is "Seguridad", so the full name painted nowhere. Perfil
// now sizes its chips by label (band height unchanged) and paints the section
// name in the panel; the tab semantics and the 44 px proxy stay intact. The
// four short labels are always whole; the trailing one is whole wherever the
// measured natural widths fit the band, and always from 412 px. Below that
// the fit depends on font rasterisation (~2.5 px of slack at 375), so the
// panel's painted name is the guaranteed full-value path there.
const FT6_VIEWPORTS = [
  { name: "360x800", width: 360, height: 800 },
  { name: "375x812", width: 375, height: 812 },
  { name: "390x844", width: 390, height: 844 },
  { name: "412x915", width: 412, height: 915 },
  { name: "430x932", width: 430, height: 932 },
] as const;
const FT6_LABELS = ["Estado", "Datos", "Contacto", "Contenido", "Cambiar contraseña"] as const;

test.describe("C25 F-T6 · Perfil chips disclose Cambiar contraseña", () => {
  test.use({ hasTouch: true });

  for (const viewport of FT6_VIEWPORTS) {
    test(`chip names are identifiable and selectable at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await setClinicSession(page, "populated");
      await mockClinicProfile(page);
      await page.goto("/dashboard?module=perfil");
      const editor = page.locator('[data-clinic-profile-editor="true"]');
      await expect(editor).toBeVisible({ timeout: 12_000 });

      const tabs = editor.getByRole("tab");
      await expect(tabs).toHaveText([...FT6_LABELS]);
      await waitForFontsAndFrames(page);
      const chips = await tabs.evaluateAll((items) =>
        items.map((item) => {
          const rect = item.getBoundingClientRect();
          return { text: item.textContent ?? "", fits: item.scrollWidth <= item.clientWidth, top: rect.top, height: rect.height, width: rect.width, right: rect.right, bandRight: item.parentElement!.getBoundingClientRect().right };
        }),
      );
      const room = await readChipBandRoom(tabs);
      for (const chip of chips.slice(0, 4)) expect(chip.fits, `${viewport.name}: ${chip.text} whole`).toBe(true);
      // The trailing label is whole whenever the measured natural widths fit
      // the band; clipping is accepted only where they do not.
      if (room.fitsNaturally) expect(chips[4].fits, `${viewport.name}: Cambiar contraseña whole when the band has room (${JSON.stringify(room)})`).toBe(true);
      if (viewport.width >= 412) expect(room.fitsNaturally, `${viewport.name}: the band holds every label from 412 px (${JSON.stringify(room)})`).toBe(true);
      expect(chips[4].width, "the trailing chip keeps the 44 px target").toBeGreaterThanOrEqual(44 - 0.5);
      expect(new Set(chips.map((chip) => `${chip.top.toFixed(1)}:${chip.height.toFixed(1)}`)).size, "one chip row").toBe(1);
      expect(chips[4].right, "last chip inside the band").toBeLessThanOrEqual(chips[4].bandRight + 1);

      // Keyboard: ArrowLeft from the first tab wraps to the last one.
      await tabs.first().focus();
      await page.keyboard.press("ArrowLeft");
      const passwordTab = editor.getByRole("tab", { name: "Cambiar contraseña", exact: true });
      await expect(passwordTab).toBeFocused();
      await expect(passwordTab).toHaveAttribute("aria-selected", "true");
      const panelId = await passwordTab.getAttribute("aria-controls");
      const panel = page.locator(`[id="${panelId}"]`);
      await expect(panel).toHaveAttribute("role", "tabpanel");
      const name = panel.locator('[data-clinic-profile-section-name="cambiar-contrasena"]');
      await expect(name).toBeVisible();
      await expect(name).toHaveText("Cambiar contraseña");
      expect(await name.evaluate((element) => element.scrollWidth <= element.clientWidth), "section name not clipped").toBe(true);
      await expect(panel.locator('input[name="currentPassword"]')).toBeVisible();
      await expect(panel.getByRole("button", { name: "Actualizar contraseña", exact: true })).toBeInViewport();

      // Touch: back to Datos and then the password chip by tap.
      await editor.getByRole("tab", { name: "Datos", exact: true }).tap();
      await expect(name).toBeHidden();
      await passwordTab.tap();
      await expect(passwordTab).toHaveAttribute("aria-selected", "true");
      await expect(name).toBeVisible();
      // The 44 px proxy strip below the chip still delegates to it.
      await editor.getByRole("tab", { name: "Estado", exact: true }).tap();
      const proxy = page.locator('[data-module-card-chip-proxy="cambiar-contrasena"]').first();
      await expect(proxy).toBeAttached();
      await proxy.dispatchEvent("click");
      await expect(passwordTab).toHaveAttribute("aria-selected", "true");

      expect(await seriousAxe(page, '[data-clinic-profile-editor="true"]'), `${viewport.name}: Perfil axe`).toEqual([]);
      await expectNoGlobalDashboardScroll(page, `${viewport.name}: F-T6`);
    });
  }
});

// Serious/critical axe violations inside `selector`, after any enter animation
// of an open dialog has finished (a mid-fade frame reads as low contrast).
async function seriousAxe(page: Page, selector: string) {
  await page.evaluate(() =>
    Promise.all(
      Array.from(document.querySelectorAll('[data-module-dialog="true"]')).flatMap((dialog) =>
        dialog.getAnimations({ subtree: true }).map((animation) => animation.finished),
      ),
    ),
  );
  const { violations } = await new AxeBuilder({ page }).include(selector).analyze();
  return violations
    .filter((violation) => ["critical", "serious"].includes(violation.impact ?? ""))
    .map((violation) => violation.id);
}

// Inter swaps in after first paint; chip widths are only meaningful once the
// webfont is applied and two frames have committed.
async function waitForFontsAndFrames(page: Page) {
  await page.evaluate(() =>
    document.fonts.ready.then(
      () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
    ),
  );
}

// Natural width of every chip (its label + padding, measured on an out-of-flow
// clone, floored at the 44 px target) against the band's content box. `slackPx`
// is what the content-sized layout has left over; the label can only be whole
// on its chip when it is not negative. Measured, not assumed: on Win32 and
// Linux Chromium it is ~2.5 px at 375x812 and ~39 px at 412x915, and CI Linux
// rendered the trailing chip 11 px short at 375, so the stable threshold is 412.
async function readChipBandRoom(tabs: Locator) {
  return tabs.first().evaluate((first) => {
    const band = first.parentElement!;
    const style = getComputedStyle(band);
    const chips = Array.from(band.querySelectorAll<HTMLElement>('[role="tab"]'));
    const natural = chips.map((chip) => {
      const clone = chip.cloneNode(true) as HTMLElement;
      clone.removeAttribute("id");
      clone.style.cssText = "position:absolute;visibility:hidden;flex:none;width:auto;min-width:0;max-width:none";
      band.appendChild(clone);
      const width = Math.max(clone.getBoundingClientRect().width, 44);
      clone.remove();
      return width;
    });
    const contentPx = band.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const gapsPx = parseFloat(style.columnGap) * (chips.length - 1);
    const neededPx = natural.reduce((sum, width) => sum + width, gapsPx);
    const slackPx = contentPx - neededPx;
    // scrollWidth/clientWidth are integers: below 1 px of slack a whole label
    // can still read as 1 px short, so "room" starts at 1 px.
    return { fitsNaturally: slackPx >= 1, slackPx: Number(slackPx.toFixed(2)), natural: natural.map((width) => Number(width.toFixed(2))) };
  });
}
