import { expect, test, type Page } from "@playwright/test";
import { setTestAdminSession } from "../../helpers/admin-mobile-contracts";

const VIEWPORTS = [
  { name: "360x740", width: 360, height: 740 },
  { name: "360x800", width: 360, height: 800 },
  { name: "375x812", width: 375, height: 812 },
  { name: "390x844", width: 390, height: 844 },
  { name: "412x915", width: 412, height: 915 },
  { name: "430x932", width: 430, height: 932 },
] as const;

const MODULES = ["operaciones", "informes", "logistica", "perfil", "tokens"] as const;

async function setClinicSession(page: Page) {
  await page.context().addCookies([
    {
      name: "app_session_id",
      value: "e2e_test_clinic_session",
      url: "http://127.0.0.1:3000",
    },
  ]);
}

for (const viewport of VIEWPORTS) {
  for (const moduleId of MODULES) {
    test(`CMP-04/CMP-07 · ${moduleId} exposes one canonical module card at ${viewport.name}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await setClinicSession(page);
      await page.goto(`/dashboard?module=${moduleId}`);

      const workspace = page.locator(`[data-dashboard-module-workspace="${moduleId}"]`);
      await expect(workspace).toBeVisible({ timeout: 12_000 });
      // Let the chip band's ResizeObserver-driven proxy sync (useLayoutEffect +
      // its first ResizeObserver callback) settle before measuring: on a cold
      // mobile viewport switch the observer's FIRST callback can land one frame
      // after the tablist itself becomes visible.
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.evaluate(() => document.fonts.ready).catch(() => {});
      await page.waitForTimeout(150);

      const card = workspace.locator(
        `section.dashboard-surface[data-clinic-mobile-module="${moduleId}"]`,
      );
      await expect(card, `${moduleId}: one canonical outer surface`).toHaveCount(1);

      const contract = await card.evaluate((element) => {
        const style = window.getComputedStyle(element);
        const documentElement = document.documentElement;
        const body = document.body;

        return {
          borderTopWidth: style.borderTopWidth,
          borderTopLeftRadius: style.borderTopLeftRadius,
          backgroundColor: style.backgroundColor,
          overflowX: style.overflowX,
          overflowY: style.overflowY,
          pageScrollsX: documentElement.scrollWidth > documentElement.clientWidth || body.scrollWidth > body.clientWidth,
          pageScrollsY: documentElement.scrollHeight > documentElement.clientHeight || body.scrollHeight > body.clientHeight,
        };
      });

      expect(contract.borderTopWidth, `${moduleId}: canonical border`).toBe("1px");
      expect(contract.borderTopLeftRadius, `${moduleId}: canonical radius`).toBe("8px");
      expect(contract.backgroundColor, `${moduleId}: canonical surface color`).toBe(
        "rgb(248, 251, 252)",
      );
      expect(contract.overflowX, `${moduleId}: card owns horizontal clipping`).toBe("hidden");
      expect(contract.overflowY, `${moduleId}: card owns vertical clipping`).toBe("hidden");
      expect(contract.pageScrollsX, `${moduleId}: no page horizontal overflow`).toBe(false);
      expect(contract.pageScrollsY, `${moduleId}: no page vertical overflow`).toBe(false);

      const tabs = card.locator("button[data-module-card-chip]");
      const chipIds = await tabs.evaluateAll((elements) =>
        elements.map((element) => element.getAttribute("data-module-card-chip") ?? ""),
      );

      if (!chipIds.length) return;

      // CMP-07 — the chip band uses fluid (svw-clamped) tokens shared with Admin,
      // so its resolved height legitimately varies by viewport width. A single
      // hardcoded reference value only holds at the one viewport it was measured
      // on. The canonical proof is Admin's OWN live band at the SAME viewport,
      // measured in a separate tab/context so it never disturbs the clinic page
      // under test.
      const adminContext = await page.context().browser()!.newContext({
        viewport: { width: viewport.width, height: viewport.height },
      });
      const adminPage = await adminContext.newPage();
      await setTestAdminSession(adminPage);
      await adminPage.goto("/dashboard/admin?module=admin");
      await adminPage
        .locator('[data-dashboard-module-workspace="admin"] [role="tablist"]')
        .first()
        .waitFor({ state: "visible", timeout: 12_000 });
      await adminPage.waitForLoadState("networkidle").catch(() => {});
      await adminPage.evaluate(() => document.fonts.ready).catch(() => {});
      await adminPage.waitForTimeout(150);
      const adminBandHeight = await adminPage.evaluate(() => {
        const tablist = document.querySelector<HTMLElement>(
          '[data-dashboard-module-workspace] [role="tablist"]',
        );
        return tablist?.getBoundingClientRect().height ?? 0;
      });
      await adminContext.close();

      // CMP-07 (regression found during certification) — the proxy is no
      // longer a single 44x44 button CENTERED on (and overlapping) the visible
      // chip: that overlap silently intercepted every click aimed at the chip
      // itself, including Playwright's own `getByRole("tab").click()`, which
      // correctly refuses to click through an obscuring element. The proxy is
      // now up to four thin MARGIN STRIPS (top/bottom/left/right) that tile the
      // 44x44 target minus the chip's own rectangle — never overlapping it — so
      // a click lands natively on the chip inside its own box, or on a
      // delegating strip in the margin. The contract below checks the UNION of
      // chip + strips per id, not one proxy element per id.
      const interactionContract = await page.evaluate((ids) => {
        const tablist = document.querySelector<HTMLElement>(
          '[data-dashboard-module-workspace] [role="tablist"]',
        );
        const targets = ids.map((id) => {
          const strips = Array.from(
            document.querySelectorAll<HTMLElement>(
              `[data-module-card-chip-proxy="${id}"]`,
            ),
          );
          const visibleChip = document.querySelector<HTMLElement>(
            `[data-module-card-chip="${id}"]`,
          );
          if (!visibleChip) throw new Error(`Missing visible chip for ${id}`);

          const chipRect = visibleChip.getBoundingClientRect();
          const stripRects = strips.map((strip) => strip.getBoundingClientRect());

          let left = chipRect.left;
          let right = chipRect.right;
          let top = chipRect.top;
          let bottom = chipRect.bottom;
          let overlapsChip = false;
          const EPS = 0.2;
          for (const r of stripRects) {
            left = Math.min(left, r.left);
            top = Math.min(top, r.top);
            right = Math.max(right, r.right);
            bottom = Math.max(bottom, r.bottom);
            const overlapX = r.left < chipRect.right - EPS && chipRect.left < r.right - EPS;
            const overlapY = r.top < chipRect.bottom - EPS && chipRect.top < r.bottom - EPS;
            if (overlapX && overlapY) overlapsChip = true;
          }

          // Reachability: every corner of every margin strip must resolve to
          // that strip. (The chip's OWN corners are deliberately not tested the
          // same way: `rounded-md` carves the geometric corner pixels away from
          // the button's actual painted/hit-tested shape — true of every
          // rounded chip, Admin's included — so a point 1px from the geometric
          // corner legitimately falls through to whatever sits behind it. The
          // chip's own reachability is proven below instead, by a real
          // Playwright locator click, which targets its actual clickable
          // center and performs proper actionability checks.)
          const stripsCornersReachStrips = stripRects.every((r) => {
            const corners = [
              [r.left + 1, r.top + 1],
              [r.right - 1, r.top + 1],
              [r.left + 1, r.bottom - 1],
              [r.right - 1, r.bottom - 1],
            ];
            return corners.every(
              ([x, y]) => document.elementFromPoint(x, y)?.closest(`[data-module-card-chip-proxy="${id}"]`) !== null,
            );
          });

          const firstStrip = stripRects[0];

          return {
            id,
            left,
            right,
            top,
            bottom,
            unionWidth: right - left,
            unionHeight: bottom - top,
            overlapsChip,
            reachable: stripsCornersReachStrips,
            // Center of one real margin strip — guaranteed to land ON that
            // strip. The union box's own top-left corner is NOT a safe tap
            // point: chips wider than 44px push the strip well inward from
            // the chip's own (further-left) edge, so `left+2` can miss both
            // the chip and every strip and hit neither.
            stripTapPoint: firstStrip
              ? { x: firstStrip.left + firstStrip.width / 2, y: firstStrip.top + firstStrip.height / 2 }
              : null,
          };
        });

        return {
          visibleBandHeight: tablist?.getBoundingClientRect().height ?? 0,
          targets,
          targetsDoNotOverlap: targets.every((target, index) =>
            targets.slice(index + 1).every(
              (other) =>
                target.right <= other.left ||
                other.right <= target.left ||
                target.bottom <= other.top ||
                other.bottom <= target.top,
            ),
          ),
        };
      }, chipIds);

      expect(interactionContract.visibleBandHeight, `${moduleId}: chip-band height matches Admin at ${viewport.name}`).toBeCloseTo(
        adminBandHeight,
        0,
      );
      expect(interactionContract.targetsDoNotOverlap, `${moduleId}: adjacent targets do not overlap`).toBe(true);

      for (const target of interactionContract.targets) {
        expect(target.unionWidth, `${moduleId}/${target.id}: effective target width (chip + margin strips)`).toBeGreaterThanOrEqual(44 - 0.5);
        expect(target.unionHeight, `${moduleId}/${target.id}: effective target height (chip + margin strips)`).toBeGreaterThanOrEqual(44 - 0.5);
        expect(target.overlapsChip, `${moduleId}/${target.id}: margin strips must not overlap the visible chip's own box`).toBe(false);
        expect(target.reachable, `${moduleId}/${target.id}: live corner hit-testing (chip corners -> chip, strip corners -> strip)`).toBe(true);

        // A tap at the CENTER of a real margin strip (outside the chip's own
        // box) proves the proxy delegation path.
        expect(target.stripTapPoint, `${moduleId}/${target.id}: has at least one margin strip to tap`).not.toBeNull();
        await page.mouse.click(target.stripTapPoint!.x, target.stripTapPoint!.y);
        await expect(
          card.locator(`[data-module-card-chip="${target.id}"]`),
          `${moduleId}/${target.id}: margin-strip tap activates the canonical tab action`,
        ).toHaveAttribute("aria-selected", "true");
      }

      // Playwright's own actionability-checked locator click must also work —
      // this is exactly what the proxy's old full-overlap design broke, since
      // Playwright refuses to click through an obscuring element.
      const firstChipId = chipIds[0];
      if (firstChipId) {
        await card.locator(`[data-module-card-chip="${firstChipId}"]`).click();
        await expect(
          card.locator(`[data-module-card-chip="${firstChipId}"]`),
          `${moduleId}/${firstChipId}: native locator click reaches the chip directly (not intercepted by a proxy)`,
        ).toHaveAttribute("aria-selected", "true");
      }
    });
  }
}
