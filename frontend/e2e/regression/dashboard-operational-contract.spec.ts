import { expect, test } from "@playwright/test";

// ─────────────────────────────────────────────────────────────────────────────
// A01 · Dashboard operational contract — S1 (Auditoría) runtime regression.
//
// SCOPE: this spec covers S1 ONLY. S1 is the single super searcher whose
// operativa lives in the URL (`<form method="get" action="/dashboard/admin">`
// plus a hidden `module=audit-log`), so it is the only one with a real
// Back/Forward/reload contract that a browser can observe.
//
// It does NOT claim runtime coverage of S2–S7: those apply their filters with
// React handlers over already-loaded rows (or a debounced server query) and
// leave no URL trace. Their contract is frozen source-backed by
// `test/unit/ui/dashboard/dashboard-operational-contract-baseline.test.ts`.
// ─────────────────────────────────────────────────────────────────────────────

const APP_ORIGIN = "http://127.0.0.1:3000";
const AUDIT_MODULE_URL = "/dashboard/admin?module=audit-log";
const DESKTOP_VIEWPORT = { width: 1440, height: 900 };

/** Free-text filter values submitted by this spec (synthetic, no real data). */
const FILTER_INPUT = {
  from: "2026-01-01",
  to: "2026-01-31",
  clinicId: "7",
  reportId: "11",
} as const;

type Page = import("@playwright/test").Page;
type Locator = import("@playwright/test").Locator;

async function setAdminSession(page: Page) {
  await page.context().addCookies([
    {
      name: "admin_session_id",
      value: "e2e_test_admin_session",
      url: APP_ORIGIN,
    },
  ]);
}

/**
 * The audit filter bar is rendered twice (inline desktop form + mobile dialog
 * copy). Scoping to the visible form keeps the locator unambiguous across
 * viewports without depending on which copy is mounted.
 */
function visibleAuditFilterForm(page: Page): Locator {
  return page.locator('form[data-dashboard-filter-bar="true"]:visible').first();
}

function searchParamsOf(page: Page): URLSearchParams {
  return new URL(page.url()).searchParams;
}

test.describe("A01 · S1 audit filters operational contract", () => {
  test.use({ viewport: DESKTOP_VIEWPORT });

  test("S1 filters live in the URL across submit, Back, Forward, reload and Limpiar", async ({
    page,
  }) => {
    await setAdminSession(page);
    await page.goto(AUDIT_MODULE_URL);

    await expect(page.locator('[data-dashboard-module-workspace="audit-log"]')).toBeVisible();

    // ── The bar is a real GET form scoped to the audit-log module ─────────────
    const form = visibleAuditFilterForm(page);
    await expect(form).toBeVisible();
    await expect(form).toHaveAttribute("method", "get");
    await expect(form).toHaveAttribute("action", "/dashboard/admin");
    await expect(form.locator('input[type="hidden"][name="module"]')).toHaveValue("audit-log");

    for (const field of ["event", "actorType", "from", "to", "clinicId", "reportId"] as const) {
      await expect(form.locator(`[name="${field}"]`), `S1 field ${field}`).toHaveCount(1);
    }

    // ── Fill every filter; select values are read from the rendered options ───
    const eventValue = await firstNonEmptyOptionValue(form, "event");
    const actorTypeValue = await firstNonEmptyOptionValue(form, "actorType");

    if (eventValue) await form.locator('select[name="event"]').selectOption(eventValue);
    if (actorTypeValue) {
      await form.locator('select[name="actorType"]').selectOption(actorTypeValue);
    }
    await form.locator('input[name="from"]').fill(FILTER_INPUT.from);
    await form.locator('input[name="to"]').fill(FILTER_INPUT.to);
    await form.locator('input[name="clinicId"]').fill(FILTER_INPUT.clinicId);
    await form.locator('input[name="reportId"]').fill(FILTER_INPUT.reportId);

    const expectedParams = {
      module: "audit-log",
      event: eventValue,
      actorType: actorTypeValue,
      from: FILTER_INPUT.from,
      to: FILTER_INPUT.to,
      clinicId: FILTER_INPUT.clinicId,
      reportId: FILTER_INPUT.reportId,
    } as const;

    // ── Native submit navigates and serializes every field into the URL ───────
    const unfilteredUrl = page.url();
    await form.locator('button[type="submit"]').click();
    await page.waitForURL(/clinicId=7/);

    const filteredUrl = page.url();
    expect(new URL(filteredUrl).pathname).toBe("/dashboard/admin");
    for (const [key, value] of Object.entries(expectedParams)) {
      expect(searchParamsOf(page).get(key), `submitted ${key}`).toBe(value);
    }
    await expectRestoredValues(page, expectedParams);

    // ── Back returns to the unfiltered entry of the history stack ─────────────
    await page.goBack();
    await page.waitForURL(unfilteredUrl);
    expect(searchParamsOf(page).get("module")).toBe("audit-log");
    for (const key of ["from", "to", "clinicId", "reportId"] as const) {
      expect(searchParamsOf(page).get(key), `Back must drop ${key}`).toBeNull();
    }

    // ── Forward restores the filtered URL and its rendered values ─────────────
    await page.goForward();
    await page.waitForURL(filteredUrl);
    for (const [key, value] of Object.entries(expectedParams)) {
      expect(searchParamsOf(page).get(key), `Forward ${key}`).toBe(value);
    }
    await expectRestoredValues(page, expectedParams);

    // ── Reload re-renders the same filter state from the query string ────────
    await page.reload();
    await page.waitForURL(filteredUrl);
    for (const [key, value] of Object.entries(expectedParams)) {
      expect(searchParamsOf(page).get(key), `reload ${key}`).toBe(value);
    }
    await expectRestoredValues(page, expectedParams);

    // ── Limpiar navigates back to the bare module URL ─────────────────────────
    // `Limpiar` is a hydration-dependent PublicRouteControl (button + replace),
    // so the click races hydration on a freshly loaded document.
    await expect(async () => {
      await visibleAuditFilterForm(page)
        .getByRole("button", { name: "Limpiar" })
        .click();
      await page.waitForURL(`**${AUDIT_MODULE_URL}`, { timeout: 2_000 });
    }).toPass({ timeout: 15_000 });

    const clearedUrl = new URL(page.url());
    expect(clearedUrl.pathname).toBe("/dashboard/admin");
    expect([...clearedUrl.searchParams.keys()]).toEqual(["module"]);
    expect(clearedUrl.searchParams.get("module")).toBe("audit-log");
  });
});

/** First selectable non-empty option of a filter select ("" = «Todos»). */
async function firstNonEmptyOptionValue(form: Locator, name: string): Promise<string> {
  const values = await form
    .locator(`select[name="${name}"] option`)
    .evaluateAll((nodes) => nodes.map((node) => (node as HTMLOptionElement).value));

  return values.find((value) => value !== "") ?? "";
}

async function expectRestoredValues(
  page: Page,
  expected: Readonly<Record<string, string>>,
): Promise<void> {
  const form = visibleAuditFilterForm(page);
  await expect(form).toBeVisible();

  for (const field of ["event", "actorType", "from", "to", "clinicId", "reportId"] as const) {
    await expect(form.locator(`[name="${field}"]`), `restored ${field}`).toHaveValue(
      expected[field],
    );
  }
}
