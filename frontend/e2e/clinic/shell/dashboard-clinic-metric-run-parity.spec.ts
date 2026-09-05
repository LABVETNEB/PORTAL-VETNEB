import { expect, test, type Page } from "@playwright/test";

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
const SURFACES = [
  ["operaciones", "/dashboard?module=operaciones", "clinic-operaciones", false, true],
  ["informes-workspace", "/dashboard?module=informes", "clinic-informes-workspace", false, false],
  ["logistica-workspace", "/dashboard?module=logistica", "clinic-logistica-workspace", false, false],
  ["perfil", "/dashboard?module=perfil", "clinic-perfil", false, false],
  ["tokens", "/dashboard?module=tokens", "clinic-tokens", false, false],
  ["informes-full", "/dashboard/informes", "clinic-informes-full", true, false],
  ["logistica-full", "/dashboard/logistica", "clinic-logistica-full", true, false],
  ["logistica-visitas", "/dashboard/logistica/visitas", "clinic-logistica-visitas", true, false],
  ["logistica-rutas", "/dashboard/logistica/rutas", "clinic-logistica-rutas", true, false],
  ["logistica-metricas", "/dashboard/logistica/metricas", "clinic-logistica-metricas", true, false],
] as const;

async function setClinicSession(page: Page) {
  await page.context().addCookies([
    { name: "app_session_id", value: "e2e_test_clinic_session", url: "http://127.0.0.1:3000" },
  ]);
}

for (const viewport of VIEWPORTS) {
  for (const [name, path, surfaceId, mobileMetricRun, hostBandRetiredBelowMd] of SURFACES) {
    const title = mobileMetricRun
      ? `CMP-05 · ${name} renders the canonical metric run at ${viewport.name}`
      : `CMP-05 · ${name} keeps its metric run desktop-only at ${viewport.name}`;

    test(title, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await setClinicSession(page);
      await page.goto(path);

      const metricRun = page.locator(`[data-dashboard-b14-metrics="${surfaceId}"]`);
      await expect(metricRun, `${name}: one metric run`).toHaveCount(1, { timeout: 12_000 });

      const contract = await metricRun.evaluate((element) => {
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
    });
  }
}
