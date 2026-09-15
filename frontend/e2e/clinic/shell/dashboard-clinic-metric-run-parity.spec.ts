import { expect, test, type Locator } from "@playwright/test";
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
