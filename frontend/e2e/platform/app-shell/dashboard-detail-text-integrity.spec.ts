import { expect, test, type Page } from "@playwright/test";

import {
  LONG_TEXT_CLINIC_REPORT,
  LONG_TEXT_COOKIE_NAME,
  LONG_TEXT_COOKIE_VALUE,
  LONG_TEXT_TOKEN,
  LONG_TEXT_USER_AGENT,
  LONG_TEXT_USER_ROLE,
} from "../../helpers/long-text-dataset.mjs";

// ─────────────────────────────────────────────────────────────────────────────
// PR-TRUNC — Terminal-surface text integrity (admin + clinic).
//
// A DETAIL / DIALOG / INSPECTOR is the LAST surface a datum is rendered on:
// there is nothing deeper to open, so anything hidden there is hidden for good.
// The shipped build hid a great deal. Measured against the same long synthetic
// values this spec injects, at 360x800:
//
//   admin token detail   "Muestra"           scrollWidth 528 / clientWidth 137
//   admin token detail   "Detalle de lesión" scrollHeight  96 / clientHeight 32
//   admin report detail  "Estudio"           scrollWidth 805 / clientWidth 124
//   clinic token detail  "Evolución"         scrollWidth 489 / clientWidth 137
//   admin token dialog   panel               scrollWidth 364 / clientWidth 326
//
// This spec blinda the corrected contract on both roles and both mechanisms —
// the shared `ModuleDialog` and the informes master-detail panel:
//
//   1. FULL TEXT PRESENT — the complete string is in the accessibility tree,
//      not a prefix of it.
//   2. NO HIDDEN TEXT — no element inside the detail hides part of its OWN text
//      (scrollWidth ≤ clientWidth AND scrollHeight ≤ clientHeight), unless it
//      is the ONE sanctioned local scroll owner, whose end must be reachable.
//   3. NO HORIZONTAL OVERFLOW and NO DOCUMENT SCROLL — the fix wraps text, it
//      does not push the shell (A08 stays at zero).
//
// The long values are synthetic (AGENTS §9): no real patient, tutor, clinic,
// email or document. Client-fetched surfaces get them through `page.route`; the
// SERVER-rendered clinic report surfaces get them through the fixture's
// conjunctive `e2e_long_text_overflow` opt-in, which leaves every other
// consumer's payload byte-identical.
// ─────────────────────────────────────────────────────────────────────────────

const TOLERANCE = 2;

/** Canonical matrix ends plus the 768 boundary (frontend/e2e/helpers/dashboard-geometry-matrix.ts). */
const VIEWPORTS = [
  { slug: "w1920x1080", width: 1920, height: 1080 },
  { slug: "w1366x768", width: 1366, height: 768 },
  { slug: "w768x1024", width: 768, height: 1024 },
  { slug: "w390x844", width: 390, height: 844 },
  { slug: "w360x800", width: 360, height: 800 },
] as const;

const ORIGIN = "http://127.0.0.1:3000";

async function setSession(page: Page, role: "admin" | "clinic") {
  await page.context().addCookies([
    role === "admin"
      ? {
          name: "admin_session_id",
          value: "e2e_populated_admin_session",
          url: ORIGIN,
        }
      : {
          name: "app_session_id",
          value: "e2e_populated_clinic_session",
          url: ORIGIN,
        },
  ]);
}

async function enableLongTextFixture(page: Page) {
  await page.context().addCookies([
    { name: LONG_TEXT_COOKIE_NAME, value: LONG_TEXT_COOKIE_VALUE, url: ORIGIN },
  ]);
}

type Offender = {
  tag: string;
  cls: string;
  text: string;
  sw: number;
  cw: number;
  sh: number;
  ch: number;
};

type DetailMetrics = {
  found: boolean;
  docScrollW: number;
  docClientW: number;
  docScrollH: number;
  docClientH: number;
  /** Elements that hide part of their own text and are NOT a scroll owner. */
  hidden: Offender[];
  /** Sanctioned local scroll owners, with their reachable extent. */
  owners: Offender[];
};

/**
 * Reads, in one page evaluation, every element under `rootSelector` whose own
 * box hides part of its own text. A scroll container is not an offender: it
 * exposes the overflow instead of destroying it, and assertion 2 checks its end
 * is reachable separately.
 */
async function readDetailMetrics(
  page: Page,
  rootSelector: string,
): Promise<DetailMetrics> {
  return page.evaluate(
    ({ sel, tol }) => {
      const html = document.documentElement;
      const root = document.querySelector(sel) as HTMLElement | null;
      const metrics = {
        found: root !== null,
        docScrollW: html.scrollWidth,
        docClientW: html.clientWidth,
        docScrollH: html.scrollHeight,
        docClientH: html.clientHeight,
        hidden: [] as Offender[],
        owners: [] as Offender[],
      };
      if (!root) return metrics;

      const describe = (el: HTMLElement): Offender => ({
        tag: el.tagName.toLowerCase(),
        cls: typeof el.className === "string" ? el.className : "",
        text: (el.textContent || "").trim().slice(0, 70),
        sw: el.scrollWidth,
        cw: el.clientWidth,
        sh: el.scrollHeight,
        ch: el.clientHeight,
      });

      const all = [root].concat(
        Array.from(root.querySelectorAll("*")) as HTMLElement[],
      );

      for (const el of all) {
        const cs = getComputedStyle(el);
        const scrollsY = cs.overflowY === "auto" || cs.overflowY === "scroll";
        const scrollsX = cs.overflowX === "auto" || cs.overflowX === "scroll";
        const hidesX = el.scrollWidth > el.clientWidth + tol;
        const hidesY = el.scrollHeight > el.clientHeight + tol;

        if ((scrollsY && hidesY) || (scrollsX && hidesX)) {
          metrics.owners.push(describe(el));
          continue;
        }
        if (!hidesX && !hidesY) continue;

        // `visible` on both axes cannot hide anything: the text paints outside
        // the box and is still readable. Only a clipping box is a defect.
        const clips =
          cs.overflow !== "visible" ||
          cs.overflowX !== "visible" ||
          cs.overflowY !== "visible";
        if (clips) metrics.hidden.push(describe(el));
      }

      return metrics;
    },
    { sel: rootSelector, tol: TOLERANCE },
  );
}

function assertNoHiddenText(metrics: DetailMetrics, label: string) {
  expect(metrics.found, `${label}: detail surface present`).toBe(true);

  const rendered = metrics.hidden
    .map(
      (o) =>
        `${o.tag}.${o.cls.slice(0, 60)} sw/cw=${o.sw}/${o.cw} sh/ch=${o.sh}/${o.ch} "${o.text}"`,
    )
    .join("\n  ");

  expect(
    metrics.hidden,
    `${label}: no element in a DETAIL surface may hide part of its own text.\n  ${rendered}`,
  ).toEqual([]);
}

function assertNoDocumentScroll(metrics: DetailMetrics, label: string) {
  expect(
    metrics.docScrollW,
    `${label}: document horizontal scroll must stay at zero`,
  ).toBeLessThanOrEqual(metrics.docClientW + TOLERANCE);
  expect(
    metrics.docScrollH,
    `${label}: document vertical scroll must stay at zero`,
  ).toBeLessThanOrEqual(metrics.docClientH + TOLERANCE);
}

/**
 * At most ONE local scroll owner per detail, and its end has to be reachable —
 * a scroller nobody can drive is the same data loss with extra steps.
 */
async function assertSingleReachableScrollOwner(
  page: Page,
  metrics: DetailMetrics,
  rootSelector: string,
  label: string,
) {
  expect(
    metrics.owners.length,
    `${label}: at most one local scroll owner, found ${metrics.owners
      .map((o) => o.cls.slice(0, 50))
      .join(" | ")}`,
  ).toBeLessThanOrEqual(1);

  if (metrics.owners.length === 0) return;

  const reachedEnd = await page.evaluate(
    ({ sel, tol }) => {
      const root = document.querySelector(sel) as HTMLElement | null;
      if (!root) return false;
      const all = [root].concat(
        Array.from(root.querySelectorAll("*")) as HTMLElement[],
      );
      for (const el of all) {
        const cs = getComputedStyle(el);
        const scrolls = cs.overflowY === "auto" || cs.overflowY === "scroll";
        if (!scrolls || el.scrollHeight <= el.clientHeight + tol) continue;
        el.scrollTop = el.scrollHeight;
        return el.scrollTop + el.clientHeight >= el.scrollHeight - tol;
      }
      return false;
    },
    { sel: rootSelector, tol: TOLERANCE },
  );

  expect(
    reachedEnd,
    `${label}: the end of the local scroll owner must be reachable`,
  ).toBe(true);
}

/** The full string, not a prefix of it, is in the DOM of the detail. */
async function assertFullTextPresent(
  page: Page,
  rootSelector: string,
  values: readonly string[],
  label: string,
) {
  const text = await page.locator(rootSelector).first().innerText();
  const normalized = text.replace(/\s+/g, " ");
  for (const value of values) {
    expect(
      normalized.includes(value.replace(/\s+/g, " ")),
      `${label}: FULL_TEXT_PRESENT for "${value.slice(0, 45)}…"`,
    ).toBe(true);
  }
}

const DIALOG = '[data-module-dialog="true"]';

async function openFirstDetail(page: Page) {
  const trigger = page
    .getByRole("button", { name: /^ver$/i })
    .or(page.getByRole("button", { name: /ver detalle/i }))
    .first();
  await trigger.waitFor({ state: "visible" });
  await trigger.click();
  await page.locator(DIALOG).first().waitFor();
}

// ── Admin · particular tokens detail dialog ─────────────────────────────────
test.describe("admin particular tokens detail keeps every clinical value", () => {
  for (const vp of VIEWPORTS) {
    test(`full text and no hidden glyphs at ${vp.slug}`, async ({ page }) => {
      await setSession(page, "admin");
      await page.route("**/api/admin/particular-tokens**", async (route) => {
        await route.fulfill({
          json: {
            success: true,
            count: 1,
            particularTokens: [
              {
                id: 9101,
                clinicId: 12,
                reportId: null,
                tokenLast4: "4201",
                tutorLastName: "Gomez",
                petName: LONG_TEXT_TOKEN.petName,
                petAge: "3 anos",
                petBreed: LONG_TEXT_TOKEN.petBreed,
                petSex: "female",
                petSpecies: "canine",
                sampleLocation: LONG_TEXT_TOKEN.sampleLocation,
                sampleEvolution: LONG_TEXT_TOKEN.sampleEvolution,
                detailsLesion: LONG_TEXT_TOKEN.detailsLesion,
                extractionDate: "2026-06-10T10:00:00.000Z",
                shippingDate: "2026-06-11T10:00:00.000Z",
                isActive: true,
                lastLoginAt: null,
                createdAt: "2026-06-12T09:15:00.000Z",
                updatedAt: "2026-06-17T16:20:00.000Z",
                createdByAdminId: 41,
                createdByClinicUserId: null,
                hasLinkedReport: false,
              },
            ],
            pagination: { limit: 50, offset: 0 },
            filters: { clinicId: null },
          },
        });
      });

      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/dashboard/admin?module=admin-particular-tokens");
      await openFirstDetail(page);

      const label = `admin tokens detail @ ${vp.slug}`;
      await assertFullTextPresent(
        page,
        DIALOG,
        [
          LONG_TEXT_TOKEN.sampleLocation,
          LONG_TEXT_TOKEN.sampleEvolution,
          LONG_TEXT_TOKEN.detailsLesion,
          LONG_TEXT_TOKEN.petBreed,
        ],
        label,
      );

      const metrics = await readDetailMetrics(page, DIALOG);
      assertNoHiddenText(metrics, label);
      assertNoDocumentScroll(metrics, label);
      await assertSingleReachableScrollOwner(page, metrics, DIALOG, label);
    });
  }
});

// ── Admin · report workflow detail dialog ───────────────────────────────────
test.describe("admin report detail keeps patient, study and file name", () => {
  for (const vp of VIEWPORTS) {
    test(`full text and no hidden glyphs at ${vp.slug}`, async ({ page }) => {
      await setSession(page, "admin");
      await page.route("**/api/admin/report-workflow**", async (route) => {
        await route.fulfill({
          json: {
            success: true,
            reports: [
              {
                id: 7301,
                clinicId: 12,
                clinicName: LONG_TEXT_CLINIC_REPORT.clinicName,
                patientName: LONG_TEXT_CLINIC_REPORT.patientName,
                fileName: LONG_TEXT_CLINIC_REPORT.fileName,
                studyType: LONG_TEXT_CLINIC_REPORT.studyType,
                uploadDate: "2026-06-17T12:00:00.000Z",
                createdAt: "2026-06-08T09:00:00.000Z",
                workflowStage: "processing",
                specialStainRequested: false,
                specialStainAt: null,
                workflowUpdatedAt: "2026-06-18T11:00:00.000Z",
              },
            ],
            pagination: { limit: 50, offset: 0, hasMore: false },
          },
        });
      });

      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/dashboard/admin?module=admin-report-upload");
      await openFirstDetail(page);

      const label = `admin report detail @ ${vp.slug}`;
      await assertFullTextPresent(
        page,
        DIALOG,
        [
          LONG_TEXT_CLINIC_REPORT.patientName,
          LONG_TEXT_CLINIC_REPORT.studyType,
          LONG_TEXT_CLINIC_REPORT.fileName,
        ],
        label,
      );

      const metrics = await readDetailMetrics(page, DIALOG);
      assertNoHiddenText(metrics, label);
      assertNoDocumentScroll(metrics, label);
      await assertSingleReachableScrollOwner(page, metrics, DIALOG, label);
    });
  }
});

// ── Admin · failed login attempt detail dialog ──────────────────────────────
//
// The ROW here legitimately truncates the user agent: the table is a
// pitch-locked adaptive canvas, so wrapping it in the cell would clip it
// vertically and move the A03 row capacity. What must hold is the other half
// of the SAFE_TRUNCATION contract — the detail dialog renders it WHOLE.
test.describe("admin failed login detail discloses the whole user agent", () => {
  for (const vp of VIEWPORTS) {
    test(`full text and no hidden glyphs at ${vp.slug}`, async ({ page }) => {
      await setSession(page, "admin");
      await page.route("**/api/admin/failed-login-alerts**", async (route) => {
        await route.fulfill({
          json: {
            success: true,
            failedLoginAlerts: [
              {
                id: 5501,
                surface: "admin",
                username: "operador_auditoria_e2e",
                reason: "invalid_credentials",
                ipAddress: "203.0.113.24",
                userAgent: LONG_TEXT_USER_AGENT,
                createdAt: "2026-06-18T11:20:00.000Z",
              },
            ],
            total: 1,
            limit: 25,
            offset: 0,
          },
        });
      });

      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/dashboard/admin?module=admin");

      // The card lives behind the "Alertas" tab of the Resumen module on desktop
      // and behind the "Alertas" chip of the mobile command module. Both expose a
      // control with that accessible name, so one step reaches it on every
      // viewport without branching on width.
      const alertas = page
        .getByRole("tab", { name: /^Alertas$/i })
        .or(page.getByRole("button", { name: /^Alertas$/i }))
        .locator("visible=true")
        .first();
      await alertas.waitFor({ state: "visible" });
      await alertas.click();

      // The card mounts a desktop table AND a mobile list; only one is visible
      // per viewport, so the locator must filter by visibility, never by order.
      const trigger = page
        .getByRole("button", { name: /Ver detalle del intento fallido/i })
        .locator("visible=true")
        .first();
      await trigger.waitFor({ state: "visible" });
      await trigger.click();
      await page.locator(DIALOG).first().waitFor();

      const label = `admin failed login detail @ ${vp.slug}`;
      await assertFullTextPresent(page, DIALOG, [LONG_TEXT_USER_AGENT], label);

      const metrics = await readDetailMetrics(page, DIALOG);
      assertNoHiddenText(metrics, label);
      assertNoDocumentScroll(metrics, label);
      await assertSingleReachableScrollOwner(page, metrics, DIALOG, label);
    });
  }
});

// ── Admin · users and roles detail dialog ───────────────────────────────────
//
// Same shape as the failed-login case: the ROW legitimately truncates the user
// name and the clinic name (pitch-locked table), and the DIALOG is the half of
// the contract that has to render them whole. `title` was rejected as the
// mechanism, so this drives the real trigger with the keyboard.
test.describe("admin users and roles detail discloses user and clinic", () => {
  for (const vp of VIEWPORTS) {
    test(`full text and no hidden glyphs at ${vp.slug}`, async ({ page }) => {
      await setSession(page, "admin");
      await page.route("**/api/admin/users-roles**", async (route) => {
        await route.fulfill({
          json: {
            success: true,
            users: [
              {
                userType: "clinic",
                userId: 4101,
                username: LONG_TEXT_USER_ROLE.username,
                role: "clinic_admin",
                clinicId: 77,
                clinicName: LONG_TEXT_USER_ROLE.clinicName,
                clinicLocality: "Ciudad Autonoma de Buenos Aires",
                createdAt: "2026-01-05T09:00:00.000Z",
                updatedAt: "2026-02-10T15:30:00.000Z",
              },
            ],
            total: 1,
            totalPages: 1,
            limit: 25,
            offset: 0,
            totals: { admin: 0, clinic: 1 },
            checkedBy: { adminUserId: 41, username: "admin_operaciones" },
          },
        });
      });

      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/dashboard/admin?module=admin-users-roles");

      // The card mounts a desktop table AND a mobile list; only one is visible
      // per viewport, so the locator must filter by visibility, never by order.
      const trigger = page
        .getByRole("button", { name: /Ver detalle del usuario/i })
        .locator("visible=true")
        .first();
      await trigger.waitFor({ state: "visible" });

      // Keyboard access is part of the contract this dialog exists to satisfy:
      // focus the trigger and open it with the keyboard, never with a click.
      await trigger.focus();
      await page.keyboard.press("Enter");
      await page.locator(DIALOG).first().waitFor();

      const label = `admin users/roles detail @ ${vp.slug}`;
      await assertFullTextPresent(
        page,
        DIALOG,
        [LONG_TEXT_USER_ROLE.username, LONG_TEXT_USER_ROLE.clinicName],
        label,
      );

      const metrics = await readDetailMetrics(page, DIALOG);
      assertNoHiddenText(metrics, label);
      assertNoDocumentScroll(metrics, label);
      await assertSingleReachableScrollOwner(page, metrics, DIALOG, label);
    });
  }
});

// ── Clinic · particular tokens detail dialog ────────────────────────────────
test.describe("clinic particular tokens detail keeps sample, evolution and lesion", () => {
  for (const vp of VIEWPORTS) {
    test(`full text and no hidden glyphs at ${vp.slug}`, async ({ page }) => {
      await setSession(page, "clinic");
      await page.route("**/api/particular-tokens**", async (route) => {
        await route.fulfill({
          json: {
            success: true,
            count: 1,
            particularTokens: [
              {
                id: 9101,
                clinicId: 12,
                reportId: null,
                tokenLast4: "4201",
                tutorLastName: "Gomez",
                petName: LONG_TEXT_TOKEN.petName,
                petAge: "3 anos",
                petBreed: LONG_TEXT_TOKEN.petBreed,
                petSex: "female",
                petSpecies: "canine",
                sampleLocation: LONG_TEXT_TOKEN.sampleLocation,
                sampleEvolution: LONG_TEXT_TOKEN.sampleEvolution,
                detailsLesion: LONG_TEXT_TOKEN.detailsLesion,
                extractionDate: "2026-06-10T10:00:00.000Z",
                shippingDate: "2026-06-11T10:00:00.000Z",
                isActive: true,
                lastLoginAt: null,
                createdAt: "2026-06-12T09:15:00.000Z",
                updatedAt: "2026-06-17T16:20:00.000Z",
                createdByAdminId: 41,
                createdByClinicUserId: null,
                hasLinkedReport: false,
              },
            ],
            pagination: { limit: 50, offset: 0 },
          },
        });
      });

      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/dashboard?module=tokens");
      await openFirstDetail(page);

      const label = `clinic tokens detail @ ${vp.slug}`;
      await assertFullTextPresent(
        page,
        DIALOG,
        [
          LONG_TEXT_TOKEN.sampleLocation,
          LONG_TEXT_TOKEN.sampleEvolution,
          LONG_TEXT_TOKEN.detailsLesion,
          LONG_TEXT_TOKEN.petBreed,
        ],
        label,
      );

      const metrics = await readDetailMetrics(page, DIALOG);
      assertNoHiddenText(metrics, label);
      assertNoDocumentScroll(metrics, label);
      await assertSingleReachableScrollOwner(page, metrics, DIALOG, label);
    });
  }
});

// ── Clinic · informes workspace summary detail dialog (server-rendered) ─────
test.describe("clinic informes summary detail keeps patient, study and file", () => {
  for (const vp of VIEWPORTS) {
    test(`full text and no hidden glyphs at ${vp.slug}`, async ({ page }) => {
      await setSession(page, "clinic");
      await enableLongTextFixture(page);

      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/dashboard?module=informes");
      await openFirstDetail(page);

      const label = `clinic informes summary detail @ ${vp.slug}`;
      await assertFullTextPresent(
        page,
        DIALOG,
        [
          LONG_TEXT_CLINIC_REPORT.patientName,
          LONG_TEXT_CLINIC_REPORT.studyType,
        ],
        label,
      );

      const metrics = await readDetailMetrics(page, DIALOG);
      assertNoHiddenText(metrics, label);
      assertNoDocumentScroll(metrics, label);
      await assertSingleReachableScrollOwner(page, metrics, DIALOG, label);
    });
  }
});

// ── Clinic · informes full route master-detail panel (server-rendered) ──────
//
// The only detail in the audit that is NOT a ModuleDialog: on `lg` and up it is
// a bounded grid track, below it is the same canvas inside the dialog. Both
// mounts render `renderReportDetailCanvas`, so both are covered by driving the
// route at a desktop and a mobile viewport.
test.describe("clinic informes master-detail panel keeps the whole record", () => {
  for (const vp of VIEWPORTS) {
    test(`full text and no hidden glyphs at ${vp.slug}`, async ({ page }) => {
      await setSession(page, "clinic");
      await enableLongTextFixture(page);

      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/dashboard/informes");

      // Same settle contract the shipped informes specs use: the route is
      // server-rendered and then re-pages itself against the MEASURED canvas,
      // so the row set is only stable after the adaptive page size resolves.
      const list = page.locator("#reports-master-list");
      const rows = list.locator("[id^='report-']");
      await expect(async () => {
        await expect(list).toBeVisible();
        expect(await rows.count()).toBeGreaterThan(0);
      }).toPass({ timeout: 15_000 });
      await expect(async () => {
        const first = await rows.count();
        await page.waitForTimeout(150);
        expect(await rows.count()).toBe(first);
      }).toPass({ timeout: 10_000 });

      await rows.first().click();

      const isDesktopPanel = vp.width >= 1024;
      let root = '#report-detail[data-detail-state="selected"]';
      if (!isDesktopPanel) {
        const openDialog = page.getByRole("button", { name: /ver detalle/i }).first();
        await openDialog.waitFor({ state: "visible" });
        await openDialog.click();
        await page.locator(DIALOG).first().waitFor();
        root = DIALOG;
      } else {
        await page.locator(root).first().waitFor();
      }

      const label = `clinic informes ${
        isDesktopPanel ? "panel" : "dialog"
      } detail @ ${vp.slug}`;

      await assertFullTextPresent(
        page,
        root,
        [
          LONG_TEXT_CLINIC_REPORT.patientName,
          LONG_TEXT_CLINIC_REPORT.studyType,
        ],
        label,
      );

      const metrics = await readDetailMetrics(page, root);
      assertNoHiddenText(metrics, label);
      assertNoDocumentScroll(metrics, label);
      await assertSingleReachableScrollOwner(page, metrics, root, label);
    });
  }
});
