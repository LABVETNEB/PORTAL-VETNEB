import { expect, type Page } from "@playwright/test";

// Mirrors the admin/clinic e2e session-cookie pattern (see admin-mobile-contracts.ts):
// the cookie name matches the backend default (server/lib/env.ts: PARTICULAR_COOKIE_NAME
// falls back to "particular_session_id"). The cookie value itself is never validated by
// the mock server-side, since the /api/particular/auth/* calls are intercepted directly
// via page.route() below — the cookie only documents the real transport contract
// (apiFetch uses credentials: "include", no localStorage).
export const PARTICULAR_SESSION_COOKIE_NAME = "particular_session_id";
export const PARTICULAR_SESSION_COOKIE_VALUE = "e2e_test_particular_session";

export const PARTICULAR_MOBILE_VIEWPORT = {
  name: "iphone-standard-390x844",
  width: 390,
  height: 844,
} as const;

export const PARTICULAR_NO_SCROLL_TOLERANCE = 1;

export const MOCK_PARTICULAR_SESSION = {
  id: 9001,
  clinicId: 12,
  reportId: 7301,
  tokenLast4: "4201",
  tutorLastName: "Gómez",
  petName: "Mora",
  petAge: "4 años",
  petBreed: "Labrador",
  petSex: "Hembra",
  petSpecies: "Canino",
  sampleLocation: "Piel",
  sampleEvolution: "48 horas",
  detailsLesion: null,
  extractionDate: "2026-06-10T00:00:00.000Z",
  shippingDate: "2026-06-11T00:00:00.000Z",
  isActive: true,
  lastLoginAt: "2026-06-20T09:00:00.000Z",
  createdAt: "2026-06-01T09:00:00.000Z",
  updatedAt: "2026-06-20T09:00:00.000Z",
  createdByAdminId: 41,
  createdByClinicUserId: null,
  hasLinkedReport: true,
  report: {
    id: 7301,
    clinicId: 12,
    uploadDate: "2026-06-19T12:00:00.000Z",
    studyType: "Histopatología",
    patientName: "Mora",
    fileName: "informe-e2e-7301.pdf",
    createdAt: "2026-06-19T12:00:00.000Z",
    updatedAt: "2026-06-19T12:00:00.000Z",
  },
};

export const MOCK_PARTICULAR_TRACKING_CASE = {
  id: 5501,
  clinicId: 12,
  reportId: 7301,
  particularTokenId: 9001,
  createdByAdminId: 41,
  createdByClinicUserId: null,
  labReceivedAt: "2026-06-12T09:00:00.000Z",
  receptionAt: "2026-06-12T09:00:00.000Z",
  estimatedDeliveryAt: "2026-06-22T09:00:00.000Z",
  estimatedDeliveryAutoCalculatedAt: "2026-06-22T09:00:00.000Z",
  estimatedDeliveryWasManuallyAdjusted: false,
  currentStage: "delivered" as const,
  processingAt: "2026-06-13T09:00:00.000Z",
  evaluationAt: "2026-06-15T09:00:00.000Z",
  reportDevelopmentAt: "2026-06-18T09:00:00.000Z",
  deliveredAt: "2026-06-19T12:00:00.000Z",
  specialStainRequired: false,
  specialStainNotifiedAt: null,
  paymentUrl: null,
  adminContactEmail: null,
  adminContactPhone: null,
  notes: null,
  createdAt: "2026-06-12T09:00:00.000Z",
  updatedAt: "2026-06-19T12:00:00.000Z",
};

export async function setParticularSessionCookie(page: Page) {
  await page.context().addCookies([
    {
      name: PARTICULAR_SESSION_COOKIE_NAME,
      value: PARTICULAR_SESSION_COOKIE_VALUE,
      url: "http://127.0.0.1:3000",
    },
  ]);
}

// Token-gated session fixture: intercepts the two client-side reads
// ParticularesContent issues on mount (getParticularSession -> GET
// /api/particular/auth/me, then getParticularStudyTrackingCase -> GET
// /api/particular/study-tracking/me) so the page renders its authenticated
// state without a real backend.
export async function mockParticularAuthenticatedSession(page: Page) {
  await page.route("**/api/particular/auth/me", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        particular: MOCK_PARTICULAR_SESSION,
      }),
    });
  });

  await page.route("**/api/particular/study-tracking/me", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        trackingCase: MOCK_PARTICULAR_TRACKING_CASE,
      }),
    });
  });
}

export type ParticularDocumentNoScrollContract = {
  html: {
    scrollHeight: number;
    clientHeight: number;
    scrollWidth: number;
    clientWidth: number;
  };
  body: {
    scrollHeight: number;
    clientHeight: number;
    scrollWidth: number;
    clientWidth: number;
  };
  forbiddenOverflow: Array<{
    tag: string;
    className: string;
    overflowX: string;
    overflowY: string;
  }>;
};

export async function readParticularDocumentNoScrollContract(
  page: Page,
): Promise<ParticularDocumentNoScrollContract> {
  return page.evaluate(() => {
    const root = document.querySelector<HTMLElement>(
      '[data-particulares-hero="true"]',
    );
    const candidates = root
      ? [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))]
      : [];

    const forbiddenOverflow = candidates.flatMap((element) => {
      const style = window.getComputedStyle(element);
      const className =
        typeof element.className === "string" ? element.className : "";
      return ["auto", "scroll"].includes(style.overflowX) ||
        ["auto", "scroll"].includes(style.overflowY)
        ? [
            {
              tag: element.tagName,
              className,
              overflowX: style.overflowX,
              overflowY: style.overflowY,
            },
          ]
        : [];
    });

    return {
      html: {
        scrollHeight: document.documentElement.scrollHeight,
        clientHeight: document.documentElement.clientHeight,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      },
      body: {
        scrollHeight: document.body.scrollHeight,
        clientHeight: document.body.clientHeight,
        scrollWidth: document.body.scrollWidth,
        clientWidth: document.body.clientWidth,
      },
      forbiddenOverflow,
    };
  });
}

// Horizontal-overflow + forbidden-internal-scroll-container invariants are
// already established for /particulares (see public-routes.spec.ts PR-PUX1 /
// PR-PUX4). Full vertical viewport-fit (100dvh) for the *authenticated*
// state is the explicit target of R-18, not R-17 — so this contract only
// asserts what already holds today, per the R-17 test-only/no-fix scope.
export function assertParticularNoScrollContract(
  contract: ParticularDocumentNoScrollContract,
  label: string,
) {
  expect(
    contract.html.scrollWidth,
    `${label}: html horizontal overflow`,
  ).toBeLessThanOrEqual(contract.html.clientWidth + PARTICULAR_NO_SCROLL_TOLERANCE);
  expect(
    contract.body.scrollWidth,
    `${label}: body horizontal overflow`,
  ).toBeLessThanOrEqual(contract.body.clientWidth + PARTICULAR_NO_SCROLL_TOLERANCE);
  expect(
    contract.forbiddenOverflow,
    `${label}: forbidden overflow auto/scroll`,
  ).toEqual([]);
}
