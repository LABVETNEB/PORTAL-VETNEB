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
const SURFACES = [
  ["operaciones", "/dashboard?module=operaciones", "clinic-operaciones", true],
  ["informes-workspace", "/dashboard?module=informes", "clinic-informes-workspace", true],
  ["logistica-workspace", "/dashboard?module=logistica", "clinic-logistica-workspace", true],
  ["perfil", "/dashboard?module=perfil", "clinic-perfil", true],
  ["tokens", "/dashboard?module=tokens", "clinic-tokens", false],
  ["informes-full", "/dashboard/informes", "clinic-informes-full", true],
  ["logistica-full", "/dashboard/logistica", "clinic-logistica-full", true],
  ["logistica-visitas", "/dashboard/logistica/visitas", "clinic-logistica-visitas", true],
  ["logistica-rutas", "/dashboard/logistica/rutas", "clinic-logistica-rutas", true],
  ["logistica-metricas", "/dashboard/logistica/metricas", "clinic-logistica-metricas", true],
] as const;

async function setClinicSession(page: Page) {
  await page.context().addCookies([
    { name: "app_session_id", value: "e2e_test_clinic_session", url: "http://127.0.0.1:3000" },
  ]);
}

for (const viewport of VIEWPORTS) {
  for (const [name, path, surfaceId, mobileMetricRun] of SURFACES) {
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
        return {
          display: style.display,
          columnGap: style.columnGap,
          height: element.getBoundingClientRect().height,
          backgroundColor: style.backgroundColor,
          borderTopWidth: style.borderTopWidth,
          borderTopLeftRadius: style.borderTopLeftRadius,
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
        // also pass on a run that merely scrolled out of view.
        expect(contract.display, `${name}: metric run must not paint below md`).toBe("none");
        expect(contract.height, `${name}: metric run must occupy no band`).toBe(0);
        await expect(metricRun, `${name}: metric run hidden on mobile`).toBeHidden();
      }

      expect(contract.scrollsX, `${name}: no page horizontal overflow`).toBe(false);
      expect(contract.scrollsY, `${name}: no page vertical overflow`).toBe(false);
    });
  }
}
