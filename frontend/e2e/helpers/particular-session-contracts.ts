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

// Estado B del contrato de zoom: sesión activa SIN informe vinculado y estudio
// en recepción. Es el estado que produjo el reporte real de producción y el que
// el fixture `delivered` de arriba no ejercitaba: sin `report` no existen los
// botones "Ver informe"/"Descargar", así que el último control operativo del
// panel pasa a ser el logout.
export const MOCK_PARTICULAR_SESSION_PENDING = {
  ...MOCK_PARTICULAR_SESSION,
  reportId: null,
  hasLinkedReport: false,
  report: null,
};

export const MOCK_PARTICULAR_TRACKING_RECEPTION = {
  ...MOCK_PARTICULAR_TRACKING_CASE,
  reportId: null,
  currentStage: "reception" as const,
  processingAt: null,
  evaluationAt: null,
  reportDevelopmentAt: null,
  deliveredAt: null,
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
// Metadata de informe en su longitud máxima válida: `reports.study_type` es
// varchar(100) y `reports.file_name` varchar(255) (drizzle/schema.ts). Es el
// único texto del panel autenticado cuya longitud no está acotada por diseño,
// así que el contrato operacional tiene que sostenerse con el peor caso legal.
// Valores sintéticos, con espacios y segmentos realistas para forzar wrapping.
const padToLength = (segment: string, length: number) => {
  let value = segment;
  while (value.length < length) {
    value += ` ${segment}`;
  }
  return value.slice(0, length);
};

export const MAX_REPORT_STUDY_TYPE_LENGTH = 100;
export const MAX_REPORT_FILE_NAME_LENGTH = 255;

export const MOCK_PARTICULAR_REPORT_MAX_STUDY_TYPE = padToLength(
  "Histopatologia con inmunohistoquimica y tinciones especiales de control diagnostico",
  MAX_REPORT_STUDY_TYPE_LENGTH,
);

export const MOCK_PARTICULAR_REPORT_MAX_FILE_NAME = padToLength(
  "informe-histopatologico-completo-con-inmunohistoquimica-panel-extendido-y-revision-de-segunda-opinion",
  MAX_REPORT_FILE_NAME_LENGTH,
);

// Variante sin separadores: ejercita el `[overflow-wrap:anywhere]` del contrato
// con un único token de longitud máxima.
const MAX_FILE_NAME_TOKEN_SUFFIX = "-informe-final-revisado.pdf";
export const MOCK_PARTICULAR_REPORT_MAX_FILE_NAME_TOKEN = `${"a".repeat(
  MAX_REPORT_FILE_NAME_LENGTH - MAX_FILE_NAME_TOKEN_SUFFIX.length,
)}${MAX_FILE_NAME_TOKEN_SUFFIX}`;

export const MOCK_PARTICULAR_SESSION_MAX_METADATA = {
  ...MOCK_PARTICULAR_SESSION,
  report: {
    ...MOCK_PARTICULAR_SESSION.report,
    studyType: MOCK_PARTICULAR_REPORT_MAX_STUDY_TYPE,
    fileName: MOCK_PARTICULAR_REPORT_MAX_FILE_NAME,
  },
};

export const MOCK_PARTICULAR_SESSION_MAX_METADATA_TOKEN = {
  ...MOCK_PARTICULAR_SESSION,
  report: {
    ...MOCK_PARTICULAR_SESSION.report,
    studyType: MOCK_PARTICULAR_REPORT_MAX_STUDY_TYPE,
    fileName: MOCK_PARTICULAR_REPORT_MAX_FILE_NAME_TOKEN,
  },
};

export type ParticularSessionFixtureState =
  | "report-available"
  | "report-pending"
  | "report-max-metadata"
  | "report-max-metadata-token";

const PARTICULAR_SESSION_FIXTURES = {
  "report-available": {
    particular: MOCK_PARTICULAR_SESSION,
    trackingCase: MOCK_PARTICULAR_TRACKING_CASE,
  },
  "report-pending": {
    particular: MOCK_PARTICULAR_SESSION_PENDING,
    trackingCase: MOCK_PARTICULAR_TRACKING_RECEPTION,
  },
  "report-max-metadata": {
    particular: MOCK_PARTICULAR_SESSION_MAX_METADATA,
    trackingCase: MOCK_PARTICULAR_TRACKING_CASE,
  },
  "report-max-metadata-token": {
    particular: MOCK_PARTICULAR_SESSION_MAX_METADATA_TOKEN,
    trackingCase: MOCK_PARTICULAR_TRACKING_CASE,
  },
} as const;

export async function mockParticularAuthenticatedSession(
  page: Page,
  state: ParticularSessionFixtureState = "report-available",
) {
  const fixture = PARTICULAR_SESSION_FIXTURES[state];

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
        particular: fixture.particular,
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
        trackingCase: fixture.trackingCase,
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
      // El único scroll owner contratado (régimen de altura insuficiente) no es
      // un contenedor scrolleable "no declarado": está en el contrato y lo
      // verifica assertParticularOperationalViewportContract.
      if (element.classList.contains("particular-operational-body")) {
        return [];
      }
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
// ─── Contrato operacional autenticado (zoom / short-height) ────────────────
//
// El contrato anterior sólo medía el documento y el rect de dos tarjetas contra
// el viewport. Eso no observa el fallo real: con `overflow: hidden` encadenado
// desde `html` el documento nunca declara scroll y el contenido se pierde
// recortado por un ancestro, no por escaparse del viewport. Este contrato mide
// contra el recortador y contra el hit-test real del control.
export const PARTICULAR_DECLARED_SCROLL_OWNER = "particular-operational-body";

// Única superficie del panel con cota visual declarada: la metadata del informe
// (study_type varchar(100) + file_name varchar(255)). Su recorte no es clipping
// indebido siempre que el valor completo siga siendo accesible, y eso es lo que
// el contrato afirma explícitamente más abajo.
export const PARTICULAR_REPORT_METADATA_SELECTOR =
  '[data-particulares-report-meta="true"]';

export type ParticularOperationalGeometry = {
  viewport: { width: number; height: number; devicePixelRatio: number };
  marketingColumnDisplay: string;
  heroGridColumnCount: number;
  documentScrollY: number;
  documentScrollX: number;
  scrollOwners: Array<{
    marker: string;
    overflowY: string;
    scrollableY: number;
  }>;
  clippedSurfaces: Array<{ marker: string; lostPx: number }>;
  truncatedText: Array<{ marker: string; text: string; lostPx: number }>;
  reportMetadata: {
    present: boolean;
    visuallyBounded: boolean;
    accessibleValue: string | null;
    renderedText: string;
  } | null;
  logoutVisibleWithoutScroll: boolean;
  logoutReachable: boolean;
};

export async function readParticularOperationalGeometry(
  page: Page,
): Promise<ParticularOperationalGeometry> {
  return page.evaluate(([ownerClass, metadataSelector]) => {
    const TOLERANCE = 1;
    const describe = (element: Element) => {
      const className =
        typeof element.className === "string" ? element.className : "";
      return (
        element.tagName.toLowerCase() +
        (element.id ? `#${element.id}` : "") +
        (className ? `.${className.trim().split(/\s+/).slice(0, 3).join(".")}` : "")
      );
    };

    const panel = document.querySelector<HTMLElement>(
      '[data-particular-session-panel="true"]',
    );
    if (panel === null) {
      throw new Error("authenticated session panel not rendered");
    }

    const surfaces = [panel, ...Array.from(panel.querySelectorAll<HTMLElement>("*"))];
    const scrollOwners: ParticularOperationalGeometry["scrollOwners"] = [];
    const clippedSurfaces: ParticularOperationalGeometry["clippedSurfaces"] = [];
    const truncatedText: ParticularOperationalGeometry["truncatedText"] = [];

    for (const surface of surfaces) {
      const style = window.getComputedStyle(surface);
      const overflowing = surface.scrollHeight - surface.clientHeight;
      // La cota declarada de la metadata se verifica aparte, por accesibilidad
      // del valor completo; no cuenta como recorte indebido.
      const isDeclaredBound = surface.matches(metadataSelector);

      if (
        ["auto", "scroll"].includes(style.overflowY) ||
        ["auto", "scroll"].includes(style.overflowX)
      ) {
        scrollOwners.push({
          marker: surface.classList.contains(ownerClass)
            ? ownerClass
            : describe(surface),
          overflowY: style.overflowY,
          scrollableY: overflowing,
        });
      }

      if (
        !isDeclaredBound &&
        ["hidden", "clip"].includes(style.overflowY) &&
        overflowing > TOLERANCE
      ) {
        clippedSurfaces.push({ marker: describe(surface), lostPx: overflowing });
      }

      const clamp = style.webkitLineClamp;
      if (
        !isDeclaredBound &&
        ((clamp !== "" && clamp !== "none") ||
          style.textOverflow === "ellipsis")
      ) {
        const lost = Math.max(
          surface.scrollHeight - surface.clientHeight,
          surface.scrollWidth - surface.clientWidth,
        );
        if (lost > TOLERANCE) {
          truncatedText.push({
            marker: describe(surface),
            text: (surface.textContent ?? "").trim().slice(0, 60),
            lostPx: lost,
          });
        }
      }
    }

    const logout = document.querySelector<HTMLElement>(
      '[data-particular-logout-action="true"]',
    );
    if (logout === null) {
      throw new Error("logout control not rendered");
    }
    const hitsLogout = () => {
      const rect = logout.getBoundingClientRect();
      const hit = document.elementFromPoint(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
      );
      return hit !== null && (hit === logout || logout.contains(hit));
    };

    const logoutVisibleWithoutScroll = hitsLogout();
    let logoutReachable = logoutVisibleWithoutScroll;
    const owner = document.querySelector<HTMLElement>(`.${ownerClass}`);
    if (!logoutReachable && owner !== null && scrollOwners.length === 1) {
      const previous = owner.scrollTop;
      owner.scrollTop = owner.scrollHeight;
      logoutReachable = hitsLogout();
      owner.scrollTop = previous;
    }

    const metadataNodes = Array.from(
      document.querySelectorAll<HTMLElement>(metadataSelector),
    ).filter((node) => node.getBoundingClientRect().height > 0);
    const metadata = metadataNodes[0] ?? null;
    const reportMetadata =
      metadata === null
        ? null
        : {
            present: true,
            visuallyBounded:
              window.getComputedStyle(metadata).webkitLineClamp !== "none" ||
              metadata.scrollHeight - metadata.clientHeight <= TOLERANCE,
            accessibleValue: metadata.getAttribute("title"),
            renderedText: (metadata.textContent ?? "").trim(),
          };

    const marketing = document.querySelector<HTMLElement>(
      '[data-particulares-hero="true"] > .order-2',
    );
    const heroGrid = document.querySelector<HTMLElement>(
      '[data-particulares-hero="true"]',
    );

    return {
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio,
      },
      marketingColumnDisplay:
        marketing === null ? "absent" : window.getComputedStyle(marketing).display,
      heroGridColumnCount:
        heroGrid === null
          ? 0
          : window
              .getComputedStyle(heroGrid)
              .gridTemplateColumns.trim()
              .split(/\s+/)
              .filter((track) => track !== "" && track !== "none").length,
      documentScrollY:
        document.documentElement.scrollHeight -
        document.documentElement.clientHeight,
      documentScrollX:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
      scrollOwners,
      clippedSurfaces,
      truncatedText,
      reportMetadata,
      logoutVisibleWithoutScroll,
      logoutReachable,
    };
  }, [PARTICULAR_DECLARED_SCROLL_OWNER, PARTICULAR_REPORT_METADATA_SELECTOR] as const);
}

export function assertParticularOperationalViewportContract(
  geometry: ParticularOperationalGeometry,
  label: string,
) {
  // El chrome de marketing sale del viewport operacional en toda banda de ancho.
  expect(
    geometry.marketingColumnDisplay,
    `${label}: marketing column must leave the authenticated viewport`,
  ).toBe("none");
  expect(
    geometry.heroGridColumnCount,
    `${label}: authenticated hero must collapse to a single column`,
  ).toBe(1);

  // El documento nunca scrollea: el contrato fixed-viewport se mantiene.
  expect(
    geometry.documentScrollY,
    `${label}: document vertical scroll`,
  ).toBeLessThanOrEqual(PARTICULAR_NO_SCROLL_TOLERANCE);
  expect(
    geometry.documentScrollX,
    `${label}: document horizontal scroll`,
  ).toBeLessThanOrEqual(PARTICULAR_NO_SCROLL_TOLERANCE);

  // Cero contenido perdido detrás de un `overflow: hidden` y cero texto cortado.
  expect(
    geometry.clippedSurfaces,
    `${label}: surfaces clipping their own content`,
  ).toEqual([]);
  expect(
    geometry.truncatedText,
    `${label}: text truncated without room to render`,
  ).toEqual([]);

  // Como máximo un scroll owner, y sólo el declarado por contrato.
  expect(
    geometry.scrollOwners.map((owner) => owner.marker),
    `${label}: only the declared scroll owner may scroll`,
  ).toEqual(
    geometry.scrollOwners.length === 0
      ? []
      : [PARTICULAR_DECLARED_SCROLL_OWNER],
  );

  // La metadata del informe puede acotarse visualmente, pero nunca perder el
  // valor: el texto completo tiene que quedar disponible de forma accesible.
  if (geometry.reportMetadata !== null) {
    expect(
      geometry.reportMetadata.accessibleValue,
      `${label}: bounded report metadata must expose its full value`,
    ).toBe(geometry.reportMetadata.renderedText);
  }

  // El último control operacional siempre se alcanza.
  expect(
    geometry.logoutReachable,
    `${label}: logout must stay reachable`,
  ).toBe(true);
  if (geometry.scrollOwners.length === 0) {
    expect(
      geometry.logoutVisibleWithoutScroll,
      `${label}: without a declared scroll owner logout must be visible as-is`,
    ).toBe(true);
  }
}

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
