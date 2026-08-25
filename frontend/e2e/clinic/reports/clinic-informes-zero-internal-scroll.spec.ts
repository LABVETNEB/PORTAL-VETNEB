import { expect, test, type Page } from "@playwright/test";

const TOLERANCE = 2;

const VIEWPORTS = [
  { name: "desktop-1440x900", width: 1440, height: 900 },
  { name: "desktop-short-1366x768", width: 1366, height: 768 },
  { name: "mobile-390x844", width: 390, height: 844 },
] as const;

async function setPopulatedClinicSession(page: Page) {
  await page.context().addCookies([
    {
      name: "app_session_id",
      value: "e2e_populated_clinic_session",
      url: "http://127.0.0.1:3000",
    },
  ]);
}

type InternalScroller = {
  tag: string;
  className: string;
  delta: number;
};

/**
 * PR-TRUNC · the one sanctioned in-`main` scroll owner of this route.
 *
 * Until PR-TRUNC the detail canvas kept itself inside its bounded grid track by
 * TRUNCATING every value in it — the report title, the clinic, the patient, the
 * study type and the file name were all `truncate` — and the surplus that did
 * not fit was swallowed by `overflow: hidden`. That is invisible to the census
 * below, which only counts `auto|scroll` elements: a box that CLIPS 156px of a
 * clinical record reads as "zero internal scrollers" exactly like a box that
 * fits. The route was green while the record was unreadable, and the detail
 * panel is the terminal surface for those fields — there is nothing deeper to
 * open.
 *
 * The values now wrap and the surplus is scrolled inside this ONE owner instead
 * of being destroyed. It is exempted here by its explicit anchor — never by its
 * class list — and the exemption is paid for immediately: `assertDetailScrollOwner`
 * asserts there is at most one, and that its end is actually reachable, so the
 * exemption cannot become a new place for content to hide.
 */
const SANCTIONED_DETAIL_SCROLL_OWNER =
  '[data-informes-detail-scroll-owner="true"]';

async function readCoreInternalScrollers(page: Page): Promise<InternalScroller[]> {
  return page.evaluate((sanctionedSelector) => {
    const root = document.querySelector<HTMLElement>("main.dashboard-main");
    if (!root) {
      return [];
    }

    const candidates = [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))];

    return candidates.flatMap((element) => {
      // Dialog bodies are portaled outside main, and the informes detail owner
      // is the single sanctioned in-main scroller; everything else found here
      // is core and forbidden.
      if (element.matches(sanctionedSelector)) {
        return [];
      }

      const style = window.getComputedStyle(element);
      const scrollableY =
        ["auto", "scroll"].includes(style.overflowY) &&
        element.scrollHeight - element.clientHeight > 2;
      const scrollableX =
        ["auto", "scroll"].includes(style.overflowX) &&
        element.scrollWidth - element.clientWidth > 2;

      if (!scrollableY && !scrollableX) {
        return [];
      }

      return [
        {
          tag: element.tagName,
          className:
            typeof element.className === "string" ? element.className : "",
          delta: Math.max(
            element.scrollHeight - element.clientHeight,
            element.scrollWidth - element.clientWidth,
          ),
        },
      ];
    });
  }, SANCTIONED_DETAIL_SCROLL_OWNER);
}

/**
 * The price of the exemption above: the sanctioned owner must be unique, and
 * when it does overflow its end must be reachable. A scroller nobody can drive
 * to the bottom is the same data loss the truncation was.
 */
async function assertDetailScrollOwner(page: Page, label: string) {
  const owners = page.locator(SANCTIONED_DETAIL_SCROLL_OWNER);
  const count = await owners.count();
  expect(
    count,
    `${label}: exactly one sanctioned detail scroll owner (found ${count})`,
  ).toBe(1);

  const reachable = await page.evaluate(
    ({ selector, tolerance }) => {
      const owner = document.querySelector<HTMLElement>(selector);
      if (!owner) return { present: false, overflowing: false, reachedEnd: false };
      if (owner.scrollHeight - owner.clientHeight <= tolerance) {
        return { present: true, overflowing: false, reachedEnd: true };
      }
      owner.scrollTop = owner.scrollHeight;
      return {
        present: true,
        overflowing: true,
        reachedEnd:
          owner.scrollTop + owner.clientHeight >= owner.scrollHeight - tolerance,
      };
    },
    { selector: SANCTIONED_DETAIL_SCROLL_OWNER, tolerance: TOLERANCE },
  );

  expect(reachable.present, `${label}: detail scroll owner present`).toBe(true);
  expect(
    reachable.reachedEnd,
    `${label}: the end of the detail scroll owner must be reachable`,
  ).toBe(true);
}

test.describe("clinic informes full route — zero internal core scroll", () => {
  for (const viewport of VIEWPORTS) {
    test(`no core internal scroller and bounded detail at ${viewport.name}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await setPopulatedClinicSession(page);
      await page.goto("/dashboard/informes");

      const list = page.locator("#reports-master-list");
      const rows = list.locator("[id^='report-']");
      const pager = page.getByRole("navigation", { name: "Paginación de informes" });

      await expect(async () => {
        await expect(list).toBeVisible();
        await expect(pager).toBeVisible();
        expect(await rows.count()).toBeGreaterThan(0);
      }).toPass({ timeout: 12_000 });

      // Row-count settle (fallback -> measured page size), then assert.
      await expect(async () => {
        const first = await rows.count();
        await page.waitForTimeout(150);
        expect(await rows.count()).toBe(first);
      }).toPass({ timeout: 10_000 });

      // 1. No external scroll.
      const external = await page.evaluate(() => ({
        vertical: document.documentElement.scrollHeight - document.documentElement.clientHeight,
        horizontal: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }));
      expect(external.vertical, `${viewport.name}: external vertical`).toBeLessThanOrEqual(TOLERANCE);
      expect(external.horizontal, `${viewport.name}: external horizontal`).toBeLessThanOrEqual(TOLERANCE);

      // 2. Zero core internal scrollers (the legacy +1981px inline scroller).
      const scrollers = await readCoreInternalScrollers(page);
      expect(
        scrollers,
        `${viewport.name}: core internal scrollers must be empty, found ${JSON.stringify(scrollers)}`,
      ).toEqual([]);

      // 3. Detail bounded: on desktop the panel is fully inside the viewport.
      if (viewport.width >= 1024) {
        const detail = page.locator("#report-detail");
        await expect(detail).toBeVisible();
        const box = await detail.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.y, `${viewport.name}: detail top`).toBeGreaterThanOrEqual(-TOLERANCE);
        expect(
          box!.y + box!.height,
          `${viewport.name}: detail bottom must stay inside the viewport`,
        ).toBeLessThanOrEqual(viewport.height + TOLERANCE);

        // Segmented sections + persistent action dock stay reachable.
        await expect(
          page.locator('[data-informes-detail-sections="true"]'),
        ).toBeVisible();
        await expect(
          page.locator('[data-informes-detail-action-dock="true"]'),
        ).toBeVisible();

        await assertDetailScrollOwner(page, viewport.name);
      } else {
        // Mobile: compact selected summary + dialog-based detail.
        await expect(
          page.locator('[data-informes-selected-report-summary="true"]'),
        ).toBeVisible();
        await page.getByRole("button", { name: "Ver detalle" }).click();
        await expect(page.locator('[data-informes-detail-dialog="true"]')).toBeVisible();
        await expect(
          page.locator('[data-informes-detail-action-dock="true"]'),
        ).toBeVisible();
        await page.keyboard.press("Escape");
      }

      // 4. Pager bounded inside the viewport.
      const pagerBox = await pager.boundingBox();
      expect(pagerBox).not.toBeNull();
      expect(
        pagerBox!.y + pagerBox!.height,
        `${viewport.name}: pager must not clip below viewport`,
      ).toBeLessThanOrEqual(viewport.height + TOLERANCE);
    });
  }

  test("detail segmented sections switch without introducing scroll", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await setPopulatedClinicSession(page);
    await page.goto("/dashboard/informes");

    const detail = page.locator("#report-detail");
    await expect(detail).toBeVisible({ timeout: 12_000 });

    for (const section of ["Archivos", "Timeline", "Resumen"]) {
      await detail.getByRole("tab", { name: section }).click();
      const scrollers = await readCoreInternalScrollers(page);
      expect(scrollers, `section ${section}: no core internal scroller`).toEqual([]);
      await assertDetailScrollOwner(page, `section ${section}`);
      const external = await page.evaluate(
        () => document.documentElement.scrollHeight - document.documentElement.clientHeight,
      );
      expect(external, `section ${section}: no external scroll`).toBeLessThanOrEqual(TOLERANCE);
    }

    await expect(detail.getByText("Línea de tiempo del estudio")).toHaveCount(0);
    await detail.getByRole("tab", { name: "Timeline" }).click();
    await expect(detail.getByText("Línea de tiempo del estudio")).toBeVisible();
  });
});
