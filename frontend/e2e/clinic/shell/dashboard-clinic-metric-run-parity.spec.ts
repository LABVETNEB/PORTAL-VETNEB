import { expect, test, type Page } from "@playwright/test";

const VIEWPORTS = [
  { name: "360x740", width: 360, height: 740 },
  { name: "360x800", width: 360, height: 800 },
  { name: "375x812", width: 375, height: 812 },
  { name: "390x844", width: 390, height: 844 },
  { name: "412x915", width: 412, height: 915 },
  { name: "430x932", width: 430, height: 932 },
] as const;

const SURFACES = [
  ["operaciones", "/dashboard?module=operaciones", "clinic-operaciones"],
  ["informes-workspace", "/dashboard?module=informes", "clinic-informes-workspace"],
  ["logistica-workspace", "/dashboard?module=logistica", "clinic-logistica-workspace"],
  ["perfil", "/dashboard?module=perfil", "clinic-perfil"],
  ["tokens", "/dashboard?module=tokens", "clinic-tokens"],
  ["informes-full", "/dashboard/informes", "clinic-informes-full"],
  ["logistica-full", "/dashboard/logistica", "clinic-logistica-full"],
  ["logistica-visitas", "/dashboard/logistica/visitas", "clinic-logistica-visitas"],
  ["logistica-rutas", "/dashboard/logistica/rutas", "clinic-logistica-rutas"],
  ["logistica-metricas", "/dashboard/logistica/metricas", "clinic-logistica-metricas"],
] as const;

async function setClinicSession(page: Page) {
  await page.context().addCookies([
    { name: "app_session_id", value: "e2e_test_clinic_session", url: "http://127.0.0.1:3000" },
  ]);
}

for (const viewport of VIEWPORTS) {
  for (const [name, path, surfaceId] of SURFACES) {
    test(`CMP-05 · ${name} renders the canonical metric run at ${viewport.name}`, async ({ page }) => {
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

      expect(contract.display, `${name}: inline flex grammar`).toBe("flex");
      expect(contract.columnGap, `${name}: canonical 6px gap`).toBe("6px");
      expect(contract.height, `${name}: compact inline height`).toBeLessThanOrEqual(18);
      expect(contract.backgroundColor, `${name}: transparent surface`).toBe("rgba(0, 0, 0, 0)");
      expect(contract.borderTopWidth, `${name}: no metric-card border`).toBe("0px");
      expect(contract.borderTopLeftRadius, `${name}: no metric-card radius`).toBe("0px");
      expect(contract.scrollsX, `${name}: no page horizontal overflow`).toBe(false);
      expect(contract.scrollsY, `${name}: no page vertical overflow`).toBe(false);
    });
  }
}
