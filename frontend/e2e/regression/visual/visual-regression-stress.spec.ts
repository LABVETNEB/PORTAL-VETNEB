import { expect, test, type Page, type Route } from "@playwright/test";

test.describe.configure({ mode: "serial" });
test.setTimeout(90_000);
test.skip(
  ({ browserName }) => browserName !== "chromium" || process.platform !== "linux",
  "Stress visual baselines are versioned only for Chromium Linux.",
);

type SessionSurface = "clinic" | "admin";

type RouteCase = {
  name: string;
  path: string;
  session: SessionSurface;
  ready: string;
  mobileReady?: string;
};

const routes: RouteCase[] = [
  {
    name: "stress-dashboard",
    path: "/dashboard",
    session: "clinic",
    ready: '[data-dashboard-module-workspace="operaciones"]',
  },
  {
    name: "stress-admin-dashboard",
    path: "/dashboard/admin?hub=1",
    session: "admin",
    ready: '[data-dashboard-module-hub="true"]',
    mobileReady: '[data-admin-mobile-hub-launcher="true"]',
  },
];

const viewports = [
  { name: "320", width: 320, height: 720 },
  { name: "768", width: 768, height: 1024 },
  { name: "1024", width: 1024, height: 768 },
  { name: "1536", width: 1536, height: 960 },
  { name: "1920", width: 1920, height: 1080 },
];

const disableAnimations = `
  *,
  *::before,
  *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
    scroll-behavior: auto !important;
    caret-color: transparent !important;
  }
`;

const clinicNames = [
  "Clinica Veterinaria Integral de Diagnostico Avanzado y Seguimiento Multisede Norte",
  "Hospital Veterinario Regional San Martin de los Andes Area Oncologia y Anatomia Patologica",
  "Centro Medico Veterinario Especializado en Cirugia, Imagenes y Citologia Los Arrayanes",
  "Clinica de Emergencias Veterinarias Veinticuatro Horas Distrito Costanera Sur",
  "Instituto Veterinario Universitario de Referencia Diagnostica Dr. Manuel Belgrano",
  "Consultorios Integrados de Medicina Felina y Canina Barrio Parque Central",
  "Centro de Derivacion Veterinaria Patologia Compleja y Seguimiento Longitudinal",
  "Hospital Escuela Veterinario Metropolitano Unidad de Casos Externos",
  "Clinica Veterinaria Familias Multiespecie Diagnostico y Rehabilitacion",
  "Centro Integral de Salud Animal Laboratorio y Anatomia Patologica Oeste",
  "Veterinaria Comunitaria de Alta Complejidad y Control Posquirurgico Sur",
  "Unidad Veterinaria Movil de Diagnostico Rural y Coordinacion Logistica",
];

const patientNames = [
  "Paciente Canino Senior con Nombre Compuesto Extraordinariamente Largo",
  "Mora del Valle de los Diagnosticos Prolongados",
  "Simon Maximo Rodriguez Fernandez de la Clinica Norte",
  "Lola Maria de las Nieves y del Control Evolutivo",
  "Bruno Patricio del Seguimiento Histopatologico Extendido",
  "Kira Josefina Paciente Oncologica en Control Prioritario",
  "Nina Esperanza del Protocolo de Muestras Seriadas",
  "Rocco Baltasar con Derivacion Interclinica Urgente",
  "Uma Catalina de Informe Complementario Pendiente",
  "Toby Alexander Paciente con Tutor de Apellidos Multiples",
  "Frida Milagros de Control Citologico Trimestral",
  "Ramon Federico del Circuito de Reenvio Documental",
];

const reportStatuses = [
  "pending",
  "uploaded",
  "processing",
  "delivered",
  "error",
  "completed",
];

const workflowStages = [
  "sample_received",
  "processing",
  "evaluation",
  "report_development",
  "delivered",
];

const reports = Array.from({ length: 12 }, (_, index) => ({
  id: 120_000 + index,
  clinicId: 9_000 + index,
  clinicName: clinicNames[index],
  patientName: patientNames[index],
  fileName: `informe-visual-stress-${120_000 + index}-nombre-de-archivo-largo-para-validar-truncado.pdf`,
  studyType:
    index % 2 === 0
      ? "Histopatologia dermatologica con inmunohistoquimica y margenes ampliados"
      : "Citologia aspirativa de lesion profunda con descripcion extendida",
  status: reportStatuses[index % reportStatuses.length],
  uploadDate: `2026-06-${String(28 - index).padStart(2, "0")}T12:30:00.000Z`,
  hasFile: index % 4 !== 0,
  createdAt: `2026-06-${String(16 - (index % 8)).padStart(2, "0")}T08:15:00.000Z`,
  updatedAt: `2026-06-${String(28 - index).padStart(2, "0")}T15:45:00.000Z`,
  workflowStage: workflowStages[index % workflowStages.length],
  specialStainRequested: index % 3 === 0,
  specialStainAt: index % 3 === 0 ? "2026-06-24T11:20:00.000Z" : null,
  workflowUpdatedAt: "2026-06-29T16:00:00.000Z",
}));

const visits = Array.from({ length: 12 }, (_, index) => ({
  id: 130_000 + index,
  clinicId: 9_000 + index,
  clinicName: clinicNames[index],
  status: ["scheduled", "in_progress", "done", "cancelled", "error"][index % 5],
  scheduledAt: `2026-07-${String(index + 1).padStart(2, "0")}T13:30:00.000Z`,
  completedAt: index % 5 === 2 ? `2026-07-${String(index + 1).padStart(2, "0")}T16:10:00.000Z` : null,
  address:
    "Avenida de las Derivaciones Veterinarias Complejas 4850, Torre Norte, Piso 12, Consultorio 1204, Ciudad Autonoma de Buenos Aires",
  notes:
    "Retiro de muestras refrigeradas, entrega de material complementario, firma de conformidad y observaciones operativas extensas para validar wrapping y densidad.",
  createdAt: "2026-06-20T09:00:00.000Z",
  updatedAt: "2026-06-29T10:30:00.000Z",
}));

const routePlans = Array.from({ length: 10 }, (_, index) => ({
  id: 140_000 + index,
  name: `Ruta stress ${index + 1} - corredor logistico con descripcion extensa`,
  status: ["pending", "in_progress", "completed", "error"][index % 4],
  scheduledDate: `2026-07-${String(index + 3).padStart(2, "0")}T09:00:00.000Z`,
  visitsCount: 18 + index,
  completedVisitsCount: index % 4 === 2 ? 18 + index : index,
  pendingVisitsCount: 18 + index - (index % 4 === 2 ? 18 + index : index),
  createdAt: "2026-06-22T09:00:00.000Z",
  updatedAt: "2026-06-29T12:00:00.000Z",
}));

const auditEvents = Array.from({ length: 16 }, (_, index) => {
  const eventCodes = [
    "auth.admin.login.succeeded",
    "clinic_user.role.changed",
    "report.uploaded",
    "study_tracking.notification.created",
    "report.workflow_stage.changed",
    "report_access_token.created",
    "clinic.updated",
    "report.special_stain.changed",
    "auth.session.revoked",
    "clinic_user.credentials.updated",
    "study_tracking.case.updated",
    "report_access_token.revoked",
    "report.status.changed",
    "admin.pricing.updated",
    "admin.session.revoke.failed",
    "system.maintenance.dry_run.completed",
  ];

  return {
    id: 150_000 - index,
    event: eventCodes[index % eventCodes.length],
    action: `Accion administrativa stress ${index + 1} con etiqueta larga para validar tablas densas`,
    entity: index % 2 === 0 ? "report" : "clinic_user",
    entityId: 200_000 + index,
    actorType: ["admin_user", "clinic_user", "system"][index % 3],
    actorAdminUserId: index % 3 === 0 ? 41 + index : null,
    actorClinicUserId: index % 3 === 1 ? 300 + index : null,
    actorReportAccessTokenId: null,
    clinicId: 9_000 + (index % clinicNames.length),
    reportId: 120_000 + (index % reports.length),
    targetAdminUserId: null,
    targetClinicUserId: index % 4 === 0 ? 400 + index : null,
    targetReportAccessTokenId: index % 5 === 0 ? 500 + index : null,
    requestId: `stress-request-${index + 1}-abcdef1234567890`,
    requestMethod: "GET",
    requestPath: "/api/admin/visual-stress-fixture/very/long/path/for/table-density",
    ipAddress: null,
    userAgent: null,
    metadata: {
      clinicName: clinicNames[index % clinicNames.length],
      email: `responsable.operativo.con.nombre.largo.${index + 1}.visual-stress@example.test`,
      status: ["pendiente", "enviado", "usado", "expirado", "error", "completado"][index % 6],
    },
    createdAt: new Date(Date.UTC(2026, 5, 29, 18 - index, 15)).toISOString(),
  };
});

const tokens = Array.from({ length: 14 }, (_, index) => ({
  id: 160_000 + index,
  clinicId: 9_000 + (index % clinicNames.length),
  reportId: index % 3 === 0 ? 120_000 + index : null,
  tokenLast4: String(8400 + index),
  tutorLastName: `Responsable Legal Compuesto Apellido Uno Apellido Dos ${index + 1}`,
  petName: patientNames[index % patientNames.length],
  petAge: `${index + 1} anios y ${index % 12} meses`,
  petBreed:
    "Mestizo de talla grande con descripcion racial extendida para truncado",
  petSex: index % 2 === 0 ? "female" : "male",
  petSpecies: index % 2 === 0 ? "canine" : "feline",
  sampleLocation:
    "Region dorsal toracica izquierda con referencia anatomica prolongada",
  sampleEvolution:
    "Evolucion de multiples semanas con cambios inflamatorios intermitentes",
  detailsLesion:
    "Descripcion extensa de lesion, bordes, consistencia, coloracion y observaciones clinicas para stress visual.",
  extractionDate: "2026-06-11T10:00:00.000Z",
  shippingDate: "2026-06-12T10:00:00.000Z",
  isActive: index % 5 !== 0,
  lastLoginAt: index % 2 === 0 ? "2026-06-29T16:20:00.000Z" : null,
  createdAt: "2026-06-12T09:15:00.000Z",
  updatedAt: "2026-06-29T16:20:00.000Z",
  createdByAdminId: 41,
  createdByClinicUserId: null,
  hasLinkedReport: index % 3 === 0,
}));

const users = Array.from({ length: 14 }, (_, index) =>
  index % 5 === 0
    ? {
        userType: "admin",
        userId: 170_000 + index,
        username: `administrador.visual.stress.con.nombre.largo.${index}`,
        role: index % 10 === 0 ? "admin" : "operator",
        clinicId: null,
        clinicName: null,
        createdAt: "2025-11-10T10:00:00.000Z",
        updatedAt: "2026-06-29T09:00:00.000Z",
      }
    : {
        userType: "clinic",
        userId: 170_000 + index,
        username: `responsable.clinica.visual.stress.${index}.nombre.extenso@example.test`,
        role: index % 2 === 0 ? "clinic_owner" : "clinic_staff",
        clinicId: 9_000 + (index % clinicNames.length),
        clinicName: clinicNames[index % clinicNames.length],
        clinicLocality:
          "Localidad con nombre compuesto y jurisdiccion administrativa extendida",
        createdAt: "2026-01-15T10:00:00.000Z",
        updatedAt: "2026-06-29T15:30:00.000Z",
      },
);

async function applySession(page: Page, surface: SessionSurface) {
  await page.context().addCookies([
    {
      name: surface === "admin" ? "admin_session_id" : "app_session_id",
      value:
        surface === "admin"
          ? "e2e_populated_admin_session"
          : "e2e_populated_clinic_session",
      url: "http://127.0.0.1:3000",
    },
  ]);
}

async function fulfillJson(route: Route, body: unknown) {
  await route.fulfill({
    status: 200,
    contentType: "application/json; charset=utf-8",
    headers: { "Cache-Control": "no-store" },
    body: JSON.stringify(body),
  });
}

async function installStressApiMocks(page: Page) {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const limit = Number(url.searchParams.get("limit") ?? 20);
    const offset = Number(url.searchParams.get("offset") ?? 0);

    if (url.pathname === "/api/reports" || url.pathname === "/api/reports/search") {
      await fulfillJson(route, {
        reports: reports.slice(offset, offset + limit),
        pagination: { limit, offset, total: reports.length, hasMore: offset + limit < reports.length },
      });
      return;
    }

    if (url.pathname === "/api/logistics/field-visits") {
      await fulfillJson(route, { visits: visits.slice(offset, offset + limit) });
      return;
    }

    if (url.pathname === "/api/logistics/route-plans") {
      await fulfillJson(route, {
        routePlans: routePlans.slice(offset, offset + limit),
        plans: routePlans.slice(offset, offset + limit),
      });
      return;
    }

    if (url.pathname.startsWith("/api/logistics/route-plans/") && url.pathname.endsWith("/metrics")) {
      await fulfillJson(route, {
        routePlanId: Number(url.pathname.split("/").at(-2)),
        totalVisits: 48_250,
        completedVisits: 31_975,
        pendingVisits: 16_275,
        delayedVisits: 824,
        averageCompletionMinutes: 128,
      });
      return;
    }

    if (url.pathname === "/api/admin/audit-log") {
      const event = url.searchParams.get("event");
      const filteredItems = event
        ? auditEvents.filter((entry) => entry.event === event)
        : auditEvents;
      await fulfillJson(route, {
        success: true,
        count: Math.min(filteredItems.length, limit),
        items: filteredItems.slice(offset, offset + limit),
        pagination: { limit, offset, total: event ? Math.max(filteredItems.length, 7) : 128_640 },
        filters: event ? { event } : {},
      });
      return;
    }

    if (url.pathname === "/api/admin/system/health") {
      await fulfillJson(route, {
        success: true,
        status: "degraded",
        version: "2.1.0-visual-stress-fixture-build-with-long-version-label",
        checkedBy: {
          adminUserId: 41,
          username: "administrador.visual.stress.responsable.operativo",
        },
        services: {
          database: "degraded",
          storage: "configured",
          email_transport: "gmail_api",
          gmail_api: "configured",
          smtp: "not_configured",
          contact_email: "configured",
          contact_email_recipients: [
            "mesa.de.ayuda.operativa.visual.stress.largo@example.test",
            "responsable.auditoria.y.seguridad.portal@example.test",
            "coordinacion.logistica.veterinaria.region.norte@example.test",
          ],
          contact_to_configured: true,
          smtp_from_configured: true,
          cors: "configured",
          cors_origins: [
            "http://127.0.0.1:3000",
            "https://portal-visual-stress-fixture-long-origin.example.test",
            "https://subdominio-operativo-extenso.example.test",
          ],
          cors_has_local_or_lan_origins: true,
          node_env: "e2e_visual_stress_fixture_with_long_environment_label",
        },
        runtime: {
          uptimeSeconds: 9_876_543,
          memory: {
            rssMb: 12_345,
            heapTotalMb: 8_192,
            heapUsedMb: 6_144,
            externalMb: 2_048,
            arrayBuffersMb: 1_024,
          },
        },
        health: { timestamp: "2026-06-29T18:45:00.000Z" },
      });
      return;
    }

    if (url.pathname === "/api/admin/particular-tokens") {
      await fulfillJson(route, {
        success: true,
        count: Math.min(tokens.length, limit),
        particularTokens: tokens.slice(offset, offset + limit),
        pagination: { limit, offset, total: tokens.length },
        filters: { clinicId: null },
      });
      return;
    }

    if (url.pathname === "/api/admin/report-workflow") {
      await fulfillJson(route, {
        success: true,
        reports: reports.slice(offset, offset + limit),
        pagination: { limit, offset, hasMore: offset + limit < reports.length },
      });
      return;
    }

    if (url.pathname === "/api/admin/users-roles") {
      await fulfillJson(route, {
        success: true,
        users: users.slice(offset, offset + limit),
        total: users.length,
        limit,
        offset,
        totals: { adminUsers: 28, clinicUsers: 4_912 },
        checkedBy: { adminUserId: 41, username: "admin_visual_stress" },
      });
      return;
    }

    if (url.pathname === "/api/admin/study-tracking/notifications") {
      await fulfillJson(route, {
        success: true,
        count: 6,
        notifications: [],
        pagination: { limit, offset, total: 6 },
      });
      return;
    }

    await route.fallback();
  });
}

async function waitForStableDashboard(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addStyleTag({ content: disableAnimations });
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
  await page.waitForFunction(() => document.fonts.status === "loaded");
  await page.evaluate(
    async () =>
      Promise.race([
        Promise.all(
          Array.from(document.images)
            .filter((image) => image.loading !== "lazy")
            .filter((image) => !image.complete)
            .map(
              (image) =>
                new Promise<void>((resolve) => {
                  image.addEventListener("load", () => resolve(), {
                    once: true,
                  });
                  image.addEventListener("error", () => resolve(), {
                    once: true,
                  });
                }),
            ),
        ).then(() => undefined),
        new Promise<void>((resolve) => window.setTimeout(resolve, 2_500)),
      ]).then(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() =>
              requestAnimationFrame(() => resolve()),
            ),
          ),
      ),
  );
}

async function waitForVisibleReadySelector(page: Page, route: RouteCase) {
  const selectors = [route.ready, route.mobileReady].filter(
    (selector): selector is string => Boolean(selector),
  );

  await expect
    .poll(
      async () =>
        page.evaluate((candidateSelectors) => {
          return candidateSelectors.some((selector) =>
            Array.from(document.querySelectorAll(selector)).some((element) => {
              const rect = element.getBoundingClientRect();
              const style = window.getComputedStyle(element);

              return (
                rect.width > 0 &&
                rect.height > 0 &&
                style.visibility !== "hidden" &&
                style.display !== "none"
              );
            }),
          );
        }, selectors),
      { timeout: 12_000 },
    )
    .toBe(true);
}

for (const viewport of viewports) {
  test.describe(`authenticated stress visual regression ${viewport.name}`, () => {
    test.use({
      viewport: {
        width: viewport.width,
        height: viewport.height,
      },
    });

    for (const route of routes) {
      test(`${route.name} baseline`, async ({ page }) => {
        await installStressApiMocks(page);
        await applySession(page, route.session);

        const response = await page.goto(route.path, {
          timeout: 20_000,
          waitUntil: "domcontentloaded",
        });

        expect(
          response?.ok(),
          `${route.path} should return a successful response`,
        ).toBeTruthy();

        await waitForVisibleReadySelector(page, route);
        await waitForStableDashboard(page);

        await expect(page).toHaveScreenshot(
          `${route.name}-${viewport.name}.png`,
          {
            animations: "disabled",
            caret: "hide",
            fullPage: false,
            maxDiffPixelRatio: 0.001,
          },
        );
      });
    }
  });
}
