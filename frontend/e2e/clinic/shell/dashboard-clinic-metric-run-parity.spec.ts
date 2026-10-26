import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { waitForLayoutSettled } from "../../helpers/dashboard-geometry-matrix";
import { setClinicSession } from "../../helpers/session";

const VIEWPORTS = [
  { name: "360x740", width: 360, height: 740 },
  { name: "360x800", width: 360, height: 800 },
  { name: "375x812", width: 375, height: 812 },
  { name: "390x844", width: 390, height: 844 },
  { name: "412x915", width: 412, height: 915 },
  { name: "430x932", width: 430, height: 932 },
] as const;

// `mobileMetricRun: false` means the surface mounts its metric run
// DESKTOP-ONLY (`hidden md:flex`) — the same grammar several Admin read-only
// cards already use, including `AdminUsersRolesReadOnlyCard`, which is the
// Admin archetype CLN-005 (tokens) is mapped to in `mobile-parity-matrix.ts`.
// Those surfaces are not dropped from this matrix: they are asserted the other
// way round below (the run stays in the DOM for desktop and paints nothing
// below `md`), so a metric run reappearing on a phone still fails here.
//
// `hostBandRetiredBelowMd: true` additionally means the run was the ONLY child
// of its band, so the band leaves the mobile flow with it. Retiring the run
// alone there is measurably NOT enough: the host keeps painting its own
// `py-1.5` + `border-b` as a 13px empty strip. Where the flag is false the band
// survives on purpose — it carries the module's actions — and what is asserted
// instead is that it reserves no height beyond the controls that do paint.
//
// The five full routes keep `true`: they are out of this scope by decision, not
// by omission, and a change there must fail this matrix.
//
// The five module-shell workspaces used to keep a desktop-only run (`false`).
// The clinic desktop/tablet space pass retired those runs at every width (red
// on the reference captures), so they are asserted ABSENT below, with the same
// "freed band is taken" geometry on the card: a run reappearing anywhere still
// fails here.
const RETIRED_WORKSPACE_RUNS = [
  ["operaciones", "/dashboard?module=operaciones", "clinic-operaciones", "operaciones"],
  ["informes-workspace", "/dashboard?module=informes", "clinic-informes-workspace", "informes"],
  ["logistica-workspace", "/dashboard?module=logistica", "clinic-logistica-workspace", "logistica"],
  ["perfil", "/dashboard?module=perfil", "clinic-perfil", "perfil"],
  ["tokens", "/dashboard?module=tokens", "clinic-tokens", "tokens"],
] as const;

const SURFACES = [
  ["informes-full", "/dashboard/informes", "clinic-informes-full", true, false],
  ["logistica-full", "/dashboard/logistica", "clinic-logistica-full", true, false],
  ["logistica-visitas", "/dashboard/logistica/visitas", "clinic-logistica-visitas", true, false],
  ["logistica-rutas", "/dashboard/logistica/rutas", "clinic-logistica-rutas", true, false],
  ["logistica-metricas", "/dashboard/logistica/metricas", "clinic-logistica-metricas", true, false],
] as const;

/**
 * Reads the metric-run paint/geometry contract once. Extracted so the caller
 * below can take two consecutive readings — a single successful read only
 * proves a valid frame existed, not that the geometry has settled.
 */
async function readMetricRunContract(metricRun: Locator) {
  return metricRun.evaluate((element) => {
    const style = window.getComputedStyle(element);
    const px = (raw: string) => Number.parseFloat(raw) || 0;
    const paints = (node: Element) => node.getClientRects().length > 0;

    // The band the run lives in, and the card that band belongs to. Both are
    // read structurally (parent / closest) rather than by a per-surface
    // selector, so this contract cannot drift from the DOM it measures.
    const host = element.parentElement;
    const hostStyle = host ? window.getComputedStyle(host) : null;
    const card = element.closest("section.dashboard-surface");
    const cardStyle = card ? window.getComputedStyle(card) : null;

    const hostPainted = host ? Array.from(host.children).filter(paints) : [];
    const hostPaintedTop = hostPainted.length
      ? Math.min(...hostPainted.map((child) => child.getBoundingClientRect().top))
      : 0;
    const hostPaintedBottom = hostPainted.length
      ? Math.max(...hostPainted.map((child) => child.getBoundingClientRect().bottom))
      : 0;
    const cardFirstPainted = card ? (Array.from(card.children).find(paints) ?? null) : null;

    return {
      display: style.display,
      columnGap: style.columnGap,
      height: element.getBoundingClientRect().height,
      rects: element.getClientRects().length,
      backgroundColor: style.backgroundColor,
      borderTopWidth: style.borderTopWidth,
      borderTopLeftRadius: style.borderTopLeftRadius,
      host: {
        found: host !== null,
        rects: host ? host.getClientRects().length : -1,
        height: host ? host.getBoundingClientRect().height : -1,
        paintedChildren: hostPainted.length,
        // What the painted controls actually need: their own union plus the
        // band's own padding and borders. Anything above this is reserved
        // height with nothing in it, which is the defect being retired.
        requiredHeight:
          (hostPainted.length ? hostPaintedBottom - hostPaintedTop : 0) +
          (hostStyle
            ? px(hostStyle.paddingBlockStart) +
              px(hostStyle.paddingBlockEnd) +
              px(hostStyle.borderBlockStartWidth) +
              px(hostStyle.borderBlockEndWidth)
            : 0),
      },
      card: {
        found: card !== null,
        top: card ? card.getBoundingClientRect().top : -1,
        borderTop: cardStyle ? px(cardStyle.borderBlockStartWidth) : 0,
        firstPaintedIsHost: cardFirstPainted !== null && cardFirstPainted === host,
        firstPaintedTop: cardFirstPainted ? cardFirstPainted.getBoundingClientRect().top : -1,
      },
      scrollsX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      scrollsY: document.documentElement.scrollHeight > document.documentElement.clientHeight,
    };
  });
}

for (const viewport of VIEWPORTS) {
  for (const [name, path, surfaceId, moduleId] of RETIRED_WORKSPACE_RUNS) {
    test(`CMP-05 · ${name} mounts no metric run at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await setClinicSession(page, "default");
      await page.goto(path);

      const workspace = page.locator(`[data-dashboard-module-workspace="${moduleId}"]`);
      const card = workspace.locator("section.dashboard-surface").first();
      await expect(card, `${name}: module card`).toBeVisible({ timeout: 12_000 });
      await waitForLayoutSettled(page);
      await expect(page.locator(`[data-dashboard-b14-metrics="${surfaceId}"]`), `${name}: no run`).toHaveCount(0);
      await expect(page.locator("[data-dashboard-b14-metrics]"), `${name}: no run of any id`).toHaveCount(0);

      await expect(async () => {
        const cardBand = await card.evaluate((element) => {
          const paints = (node: Element) => node.getClientRects().length > 0;
          const style = window.getComputedStyle(element);
          const first = Array.from(element.children).find(paints) ?? null;
          return first
            ? first.getBoundingClientRect().top -
                element.getBoundingClientRect().top -
                (Number.parseFloat(style.borderBlockStartWidth) || 0)
            : -1;
        });
        const pageScroll = await page.evaluate(() => ({
          scrollsX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          scrollsY: document.documentElement.scrollHeight > document.documentElement.clientHeight,
        }));
        expect(cardBand, `${name}: the card's first band starts at its top`).toBeGreaterThanOrEqual(0);
        expect(cardBand, `${name}: the card's first band starts at its top`).toBeLessThanOrEqual(1);
        expect(pageScroll.scrollsX, `${name}: no page horizontal overflow`).toBe(false);
        expect(pageScroll.scrollsY, `${name}: no page vertical overflow`).toBe(false);
      }).toPass({ intervals: [200, 300, 500, 800, 1_000], timeout: 10_000 });
    });
  }

  for (const [name, path, surfaceId, mobileMetricRun, hostBandRetiredBelowMd] of SURFACES) {
    const title = mobileMetricRun
      ? `CMP-05 · ${name} renders the canonical metric run at ${viewport.name}`
      : `CMP-05 · ${name} keeps its metric run desktop-only at ${viewport.name}`;

    test(title, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await setClinicSession(page, "default");
      await page.goto(path);

      const metricRun = page.locator(`[data-dashboard-b14-metrics="${surfaceId}"]`);
      await expect(metricRun, `${name}: one metric run`).toHaveCount(1, { timeout: 12_000 });
      // The span's own count says nothing about whether its host band's sibling
      // content (the action controls, on surfaces that keep the band) has
      // reached a stable painted layout yet — measuring immediately after could
      // read a transient pre-paint frame. Wait for a real signal (fonts
      // resolved, two committed frames), then retry the whole geometry read
      // until it is stable: the same `toPass` idiom `assertSurfaceLoaded` and
      // `clinic-informes-zero-internal-scroll.spec.ts` already use for this.
      await waitForLayoutSettled(page);

      // P2 follow-up: an outer-poll counter, held across `toPass` attempts. It
      // mirrors `measureSurfaceGeometry` / `measureSettledParityContract`
      // exactly — the same `requiredStableReads = 3` bar, the same reset
      // semantics (a change zeroes the counter and starts a new baseline; the
      // baseline read itself does not count as a stable read, only the reads
      // that go on to match it do). A prior version compared only against the
      // immediately preceding attempt, so a plateau that happened to survive
      // exactly one retry (~200ms, the first backoff interval) could close the
      // gate; a later refetch/repaint past that point would never be observed.
      // Requiring 3 consecutive matching outer polls after any reset instead
      // forces the poll to span at least the first three backoff intervals
      // (>=1_000ms here) before it can exit, and a reset from ANY late change
      // — however far into the backoff — restarts the same 3-read requirement
      // from that point, so the gate can never close on the first matching
      // retry regardless of when the last real change happens.
      const REQUIRED_STABLE_OUTER_READS = 3;
      let lastOuterReading: string | null = null;
      let stableOuterReads = 0;

      await expect(async () => {
        // Intra-attempt stability gate: `toPass` accepts the FIRST successful
        // callback, so a single read only proves a valid frame existed — not
        // that the geometry settled. Read the contract twice across an
        // observable frame boundary (fonts resolved, two committed frames) and
        // require an exact match before trusting either reading; a mismatch
        // throws here, which also resets the outer-poll counter below via the
        // same reset path (the thrown attempt never reaches it).
        const first = await readMetricRunContract(metricRun);
        await waitForLayoutSettled(page);
        const contract = await readMetricRunContract(metricRun);
        const serialized = JSON.stringify(contract);

        expect(
          serialized,
          `${name}: metric-run geometry must read stable across two consecutive frames`,
        ).toBe(JSON.stringify(first));

        // Outer-poll stability gate: require `REQUIRED_STABLE_OUTER_READS`
        // consecutive matching outer polls — spanning real backoff time,
        // never a sleep — before the assertions below are ever evaluated.
        if (serialized === lastOuterReading) {
          stableOuterReads += 1;
        } else {
          lastOuterReading = serialized;
          stableOuterReads = 0;
        }

        if (stableOuterReads < REQUIRED_STABLE_OUTER_READS) {
          throw new Error(
            `${name}: metric-run geometry must hold across ` +
              `${REQUIRED_STABLE_OUTER_READS} consecutive outer polls ` +
              `(currently ${stableOuterReads})`,
          );
        }

        if (mobileMetricRun) {
          expect(contract.display, `${name}: inline flex grammar`).toBe("flex");
          expect(contract.columnGap, `${name}: canonical 6px gap`).toBe("6px");
          expect(contract.height, `${name}: compact inline height`).toBeLessThanOrEqual(18);
          expect(contract.backgroundColor, `${name}: transparent surface`).toBe("rgba(0, 0, 0, 0)");
          expect(contract.borderTopWidth, `${name}: no metric-card border`).toBe("0px");
          expect(contract.borderTopLeftRadius, `${name}: no metric-card radius`).toBe("0px");
        } else {
          // The inverse of the contract above, asserted just as literally: the
          // run must occupy no band at all on a phone. `toBeHidden` alone would
          // also pass on a run that merely scrolled out of view, and a run that
          // only inherits an unpainted ancestor would still compute `flex` — so
          // its OWN display, height and client rects are all pinned.
          expect(contract.display, `${name}: metric run must not paint below md`).toBe("none");
          expect(contract.height, `${name}: metric run must occupy no band`).toBe(0);
          expect(contract.rects, `${name}: metric run must generate no box`).toBe(0);
          await expect(metricRun, `${name}: metric run hidden on mobile`).toBeHidden();

          expect(contract.host.found, `${name}: metric run must sit inside a band`).toBe(true);
          expect(contract.card.found, `${name}: band must belong to a module card`).toBe(true);

          if (hostBandRetiredBelowMd) {
            // The run was the band's only child, so the band goes with it. Without
            // this the band keeps its own padding and border as an empty strip.
            expect(contract.host.rects, `${name}: retired band must not paint`).toBe(0);
            expect(contract.host.height, `${name}: retired band must occupy no height`).toBe(0);
            expect(
              contract.card.firstPaintedIsHost,
              `${name}: retired band must not be the card's first painted child`,
            ).toBe(false);
          } else {
            // The band survives because it carries the module's actions. What must
            // not survive is reserved height with nothing painting in it.
            expect(contract.host.rects, `${name}: action band must keep painting`).toBeGreaterThan(0);
            expect(
              contract.host.paintedChildren,
              `${name}: action band must keep at least one painted control`,
            ).toBeGreaterThan(0);
            expect(
              contract.host.height,
              `${name}: action band must reserve no height beyond its painted controls`,
            ).toBeCloseTo(contract.host.requiredHeight, 0);
          }

          // Either way the freed band is actually taken rather than left empty:
          // the card's first painted child starts flush against the card border.
          expect(
            contract.card.firstPaintedTop - contract.card.top - contract.card.borderTop,
            `${name}: the region below the retired band must ascend to the card top`,
          ).toBeLessThanOrEqual(1);
        }

        expect(contract.scrollsX, `${name}: no page horizontal overflow`).toBe(false);
        expect(contract.scrollsY, `${name}: no page vertical overflow`).toBe(false);
      }).toPass({ intervals: [200, 300, 500, 800, 1_000], timeout: 10_000 });
    });
  }
}

// C25 F-T4 · the full-route B14 run is one nowrap line, so its band clips the
// trailing metrics on phones (measured on HEAD 25cd6e50: Métricas hides
// "Duración promedio" and "Planes" from 360 to 430 px; Rutas and Visitas hide
// "Completadas" at 360-390). The run itself opens a read-only detail with
// every metric whole; its own B14 box is the one measured above, unchanged.
const FT4_ROUTES = [
  ["rutas", "/dashboard/logistica/rutas", "clinic-logistica-rutas", "Resumen de planes de ruta"],
  ["visitas", "/dashboard/logistica/visitas", "clinic-logistica-visitas", "Resumen de visitas"],
  ["metricas", "/dashboard/logistica/metricas", "clinic-logistica-metricas", "Resumen de métricas"],
] as const;
const FT4_VIEWPORTS = [
  ...VIEWPORTS.filter((viewport) => viewport.name !== "360x740"),
  { name: "768x1024", width: 768, height: 1024 },
  { name: "1366x768", width: 1366, height: 768 },
  // PR #1925 P2: a phone in landscape. The 88vh dialog cannot hold the title,
  // description and four rows, so the trailing metrics need the body scroll.
  { name: "568x320", width: 568, height: 320 },
] as const;

test.describe("C25 F-T4 · logistics metric run full-value detail", () => {
  test.use({ hasTouch: true });

  for (const viewport of FT4_VIEWPORTS) {
    for (const [name, path, surfaceId, title] of FT4_ROUTES) {
      test(`${name} discloses every metric at ${viewport.name}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await setClinicSession(page, "populated");
        await page.goto(path);

        const metricRun = page.locator(`[data-dashboard-b14-metrics="${surfaceId}"]`);
        await expect(metricRun).toHaveCount(1, { timeout: 12_000 });
        await waitForLayoutSettled(page);
        const trigger = page.locator(`[data-dashboard-b14-metrics-detail="${surfaceId}"]`);
        await expect(trigger).toBeVisible();

        const metrics = await metricRun.locator("[data-metric]").evaluateAll((items) =>
          items.map((item) => ({ key: item.getAttribute("data-metric") ?? "", text: item.textContent?.trim() ?? "" })),
        );
        expect(metrics.length, `${name}: four metrics`).toBeGreaterThanOrEqual(4);
        const [runBox, triggerBox] = await Promise.all([metricRun.boundingBox(), trigger.boundingBox()]);
        expect(Math.abs(runBox!.height - triggerBox!.height), `${name}: the trigger adds no height`).toBeLessThanOrEqual(1);

        const requests: string[] = [];
        page.on("request", (request) => {
          if (new URL(request.url()).pathname.startsWith("/api/")) requests.push(request.url());
        });
        // The bounded canvas writes its measured window first; the detail must
        // leave that window (offset/limit) exactly as it found it.
        await expect(page).toHaveURL(/[?&]limit=\d+/, { timeout: 12_000 });
        const urlBefore = page.url();

        for (const mode of ["keyboard", "touch"] as const) {
          if (mode === "keyboard") {
            await trigger.focus();
            await page.keyboard.press("Enter");
          } else {
            await trigger.tap();
          }
          const dialog = page.getByRole("dialog", { name: title });
          await expect(dialog, `${name} ${mode}: detail open`).toBeVisible();
          if (mode === "keyboard") {
            expect(await seriousAxe(page, '[data-module-dialog="true"]'), `${name}: dialog axe`).toEqual([]);
          }
          const owners = await readDialogScrollOwners(page);
          expect(owners.scrollers, `${name} ${mode}: at most the dialog body scrolls`).toEqual(
            owners.bodyOverflows ? ["body"] : [],
          );
          for (const metric of metrics) {
            const item = dialog.locator(`[data-details-metadata-item="${metric.key}"]`);
            await expect(item, `${name} ${mode}: ${metric.key}`).toBeAttached();
            const label = (await item.locator("dt").textContent())?.trim() ?? "";
            const value = (await item.locator("dd").textContent())?.trim() ?? "";
            expect(`${value} ${label}`, `${name} ${mode}: ${metric.key} equals the run`).toBe(metric.text);
            const reach = await scrollMetricIntoReach(page, item, mode);
            expect(reach, `${name} ${mode}: ${metric.key} physically readable (not clipped by any ancestor)`).toEqual({
              wholeInsideClipChain: true,
              textNotClipped: true,
              modalScrollTop: 0,
            });
          }
          if (mode === "keyboard") {
            await page.keyboard.press("Escape");
          } else {
            await dialog.getByRole("button", { name: "Cerrar" }).tap();
          }
          await expect(dialog).toBeHidden();
          await expect(trigger, `${name} ${mode}: focus returns to the run`).toBeFocused();
        }

        expect(requests, `${name}: the detail fetches nothing`).toEqual([]);
        expect(page.url(), `${name}: paging state untouched`).toBe(urlBefore);
        expect(await seriousAxe(page, `[data-dashboard-b14-metrics-detail="${surfaceId}"]`), `${name}: trigger axe`).toEqual([]);
        const scroll = await page.evaluate(() => ({
          x: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          y: document.documentElement.scrollHeight > document.documentElement.clientHeight,
        }));
        expect(scroll, `${name}: zero document scroll`).toEqual({ x: false, y: false });
      });
    }
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

// Every scroller inside the open dialog: only the ModuleDialog body may be one,
// and only when its content really overflows.
async function readDialogScrollOwners(page: Page) {
  return page.locator('[data-module-dialog="true"]').evaluate((dialog) => {
    const body = dialog.querySelector<HTMLElement>('[data-module-dialog-body="true"]');
    const scrollers = [dialog, ...Array.from(dialog.querySelectorAll<HTMLElement>("*"))]
      .filter((element) => {
        const style = getComputedStyle(element);
        return /(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 1;
      })
      .map((element) => (element === body ? "body" : `${element.tagName}.${element.className}`));
    const bodyOverflowPx = body === null ? 0 : body.scrollHeight - body.clientHeight;
    return { scrollers, bodyOverflows: bodyOverflowPx > 1 };
  });
}

// Physical reachability, not DOM visibility: the metric's box must lie whole
// inside the intersection of the viewport and every clipping ancestor's
// padding box. When it does not, it is brought in with REAL input: ArrowDown on
// the focusable metric group (keyboard) or the wheel over the dialog body
// (pointer). Never scrollIntoView, which also scrolls overflow:hidden boxes.
async function scrollMetricIntoReach(page: Page, item: Locator, mode: "keyboard" | "touch") {
  const measure = () =>
    item.evaluate((element) => {
      const own = element.getBoundingClientRect();
      let left = 0;
      let top = 0;
      let right = window.innerWidth;
      let bottom = window.innerHeight;
      for (let node = element.parentElement; node && node !== document.documentElement; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (!/^(hidden|clip|auto|scroll)$/.test(style.overflowX) && !/^(hidden|clip|auto|scroll)$/.test(style.overflowY)) continue;
        const rect = node.getBoundingClientRect();
        left = Math.max(left, rect.left + node.clientLeft);
        top = Math.max(top, rect.top + node.clientTop);
        right = Math.min(right, rect.left + node.clientLeft + node.clientWidth);
        bottom = Math.min(bottom, rect.top + node.clientTop + node.clientHeight);
      }
      const value = element.querySelector<HTMLElement>("dd")!;
      return {
        wholeInsideClipChain: own.left >= left - 0.5 && own.right <= right + 0.5 && own.top >= top - 0.5 && own.bottom <= bottom + 0.5,
        textNotClipped: value.scrollWidth <= value.clientWidth && value.scrollHeight <= value.clientHeight,
        modalScrollTop: (element.closest('[data-module-dialog="true"]') as HTMLElement).scrollTop,
      };
    });

  const body = page.locator('[data-module-dialog="true"] [data-module-dialog-body="true"]');
  const group = page.locator('[data-dashboard-b14-metrics-detail-list="true"]');
  const box = await body.boundingBox();
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const reach = await measure();
    if (reach.wholeInsideClipChain) return reach;
    if (mode === "keyboard") {
      // Tab from the dialog's initial focus (Cerrar) reaches the metric group.
      for (let tab = 0; tab < 3 && !(await group.evaluate((element) => element === document.activeElement)); tab += 1) {
        await page.keyboard.press("Tab");
      }
      await page.keyboard.press("ArrowDown");
    } else {
      await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
      await page.mouse.wheel(0, 48);
    }
    await waitForLayoutSettled(page);
  }
  return measure();
}
