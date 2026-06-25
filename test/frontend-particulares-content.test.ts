import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const PARTICULARES_CONTENT_PATH =
  "frontend/src/components/public/ParticularesContent.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

function extractFunctionBlock(source: string, functionName: string): string {
  const start = source.indexOf(`function ${functionName}`);
  assert.notEqual(start, -1, `missing function: ${functionName}`);

  const firstBrace = source.indexOf("{", start);
  assert.notEqual(firstBrace, -1, `missing function body: ${functionName}`);

  let depth = 0;
  for (let index = firstBrace; index < source.length; index += 1) {
    const char = source[index];

    if (char === "{") {
      depth += 1;
    }

    if (char === "}") {
      depth -= 1;
    }

    if (depth === 0) {
      return source.slice(start, index + 1);
    }
  }

  throw new Error(`unterminated function body: ${functionName}`);
}

test("particulares content keeps refreshSession wired to particular auth me helper", () => {
  const source = read(PARTICULARES_CONTENT_PATH);

  assert.ok(source.includes('import {'));
  assert.ok(source.includes("getParticularSession,"));
  assert.ok(source.includes("async function refreshSession()"));
  assert.ok(source.includes("setIsCheckingSession(true);"));
  assert.ok(source.includes("const response = await getParticularSession();"));
  assert.ok(source.includes("const nextSession = response?.particular ?? null;"));
  assert.ok(source.includes("setSession(nextSession);"));
});

test("particulares content surfaces refreshSession fetch failures instead of silent logout state", () => {
  const source = read(PARTICULARES_CONTENT_PATH);

  assert.ok(source.includes("setErrorMessage(null);"));
  assert.ok(source.includes("} catch (error) {"));
  assert.ok(source.includes("setSession(null);"));
  assert.ok(source.includes("setSessionCheckError(true);"));
  assert.ok(
    source.includes(
      "getParticularAccessErrorMessage(error, PARTICULAR_ACCESS_ERROR_MESSAGE)",
    ),
  );
  assert.ok(source.includes("setIsCheckingSession(false);"));
  assert.ok(source.includes('role="alert"'));
});

test("particulares content maps technical access errors to particular-safe copy", () => {
  const source = read(PARTICULARES_CONTENT_PATH);

  assert.ok(
    source.includes(
      '"No pudimos verificar el acceso. Reintente en unos minutos o contacte a VETNEB."',
    ),
  );
  assert.ok(source.includes("function getParticularAccessErrorMessage"));
  assert.ok(source.includes("isTechnicalParticularAccessMessage(message)"));
  assert.equal(source.includes("No se pudo conectar con el backend"), false);
  assert.equal(source.includes("CORS y despliegue"), false);
  assert.equal(source.includes("logs de backend"), false);
});

test("particulares content muestra aviso neutro cuando vence la sesion particular", () => {
  const source = read(PARTICULARES_CONTENT_PATH);

  assert.ok(
    source.includes(
      '"La sesión venció. Ingresá nuevamente el token para consultar el informe."',
    ),
  );
  assert.ok(source.includes("const hasActiveSessionRef = useRef(false);"));
  assert.ok(source.includes("const hadActiveSession = hasActiveSessionRef.current;"));
  assert.ok(source.includes("const closeExpiredParticularSession = useCallback"));
  assert.ok(source.includes("if (hadActiveSession)"));
  assert.ok(source.includes("setErrorMessage(PARTICULAR_SESSION_EXPIRED_MESSAGE);"));
  assert.equal(source.includes("token expirado"), false);
});

test("particulares content exposes accessible loading states", () => {
  const source = read(PARTICULARES_CONTENT_PATH);

  assert.ok(source.includes("Verificando sesión..."));
  assert.ok(source.includes('role="status"'));
  assert.ok(source.includes('aria-live="polite"'));
  assert.ok(source.includes('<span role="status" aria-live="polite">'));
  assert.ok(source.includes("Validando token..."));
});

test("particulares content muestra ayuda manual si clipboard no esta disponible", () => {
  const source = read(PARTICULARES_CONTENT_PATH);

  assert.ok(
    source.includes(
      '"Si no podés pegar el código automáticamente, escribilo manualmente tal como lo recibiste."',
    ),
  );
  assert.ok(source.includes("{clipboardSupported ? ("));
  assert.ok(source.includes("Pegar token"));
  assert.ok(source.includes("text-xs text-muted-foreground"));
});

test("particulares content keeps neutral logout control and removes resumen label", () => {
  const source = read(PARTICULARES_CONTENT_PATH);

  assert.ok(source.includes("Cerrar sesión particular"));
  assert.ok(source.includes("variant=\"outline\""));
  assert.ok(source.includes("className=\"public-cta-outline\""));
  assert.equal(source.includes("variant=\"secondary\""), false);
  assert.equal(source.includes("className=\"public-cta-secondary\""), false);
  assert.equal(source.includes("Resumen de caso"), false);
});

test("particulares content muestra estado y alerta desde study-tracking en sesion activa", () => {
  const source = read(PARTICULARES_CONTENT_PATH);

  assert.ok(source.includes("getParticularStudyTrackingCase"));
  assert.ok(source.includes("Seguimiento del estudio"));
  assert.ok(source.includes("Estado del estudio:"));
  assert.ok(source.includes("Alerta: Solicitud de tinción especial."));
  assert.ok(source.includes("trackingCase"));
});

test("particulares content integra campana token-scoped en sesion activa", () => {
  const source = read(PARTICULARES_CONTENT_PATH);

  assert.ok(source.includes('import dynamic from "next/dynamic";'));
  assert.ok(
    source.includes(
      'import("@/components/dashboard/DashboardNotificationsBell").then(',
    ),
  );
  assert.ok(source.includes("mod.DashboardNotificationsBell"));
  assert.ok(source.includes('<ParticularNotificationsBell surface="particular" />'));
});

test("particulares content muestra enlace WhatsApp y email solo bajo alerta de tincion especial", () => {
  const source = read(PARTICULARES_CONTENT_PATH);

  assert.ok(source.includes("Alerta: Solicitud de tinción especial."));
  assert.ok(source.includes("https://wa.me/${SPECIAL_STAIN_WHATSAPP_PHONE}"));
  assert.ok(source.includes('SPECIAL_STAIN_WHATSAPP_PHONE = "5493534138946"'));
  assert.ok(source.includes("mailto:${SPECIAL_STAIN_EMAIL_ADDRESS}"));
  assert.ok(source.includes('SPECIAL_STAIN_EMAIL_ADDRESS = "lab.vetneb@gmail.com"'));
  assert.ok(source.includes("Consultar por WhatsApp"));
  assert.ok(source.includes("Enviar email"));
  assert.ok(source.includes("trackingCase.specialStainRequired"));
  assert.ok(source.includes("buildSpecialStainWhatsAppHref(trackingCase, session)"));
  assert.ok(source.includes("buildSpecialStainEmailHref(trackingCase, session)"));
  assert.ok(source.includes("PublicExternalControl"));
  assert.ok(source.includes('target="_blank"'));
  assert.ok(source.includes('target="_self"'));
  assert.equal(source.includes("/dashboard/admin"), false);
  assert.equal(source.includes("SPECIAL_STAIN_WHATSAPP_HREF"), false);
  assert.equal(source.includes("SPECIAL_STAIN_EMAIL_HREF"), false);
  assert.equal(source.includes("Hola%20VETNEB"), false);
});

test("particulares content arma mensajes de tincion especial con contexto dinamico", () => {
  const source = read(PARTICULARES_CONTENT_PATH);
  const messageBlock = extractFunctionBlock(
    source,
    "buildSpecialStainContactMessage",
  );
  const whatsAppBlock = extractFunctionBlock(
    source,
    "buildSpecialStainWhatsAppHref",
  );
  const emailBlock = extractFunctionBlock(source, "buildSpecialStainEmailHref");

  assert.ok(
    messageBlock.includes(
      "Hola VETNEB, consulto por una solicitud de tinción especial.",
    ),
  );
  assert.ok(messageBlock.includes("Datos del caso:"));
  assert.ok(messageBlock.includes("Por favor, indíquenme cómo continuar."));

  for (const label of [
    "Token",
    "Caso",
    "ReportId",
    "Clínica",
    "Tutor",
    "Paciente",
    "Especie",
    "Raza",
    "Extracción",
    "Envío",
    "Estado",
    "Actualizado",
    "Informe vinculado",
  ]) {
    assert.ok(
      messageBlock.includes(`"${label}"`),
      `mensaje debe incluir la etiqueta ${label}`,
    );
  }

  for (const field of [
    "session.tokenLast4",
    "trackingCase.id",
    "trackingCase.reportId",
    "session.reportId",
    "trackingCase.clinicId",
    "session.clinicId",
    "session.tutorLastName",
    "session.petName",
    "session.petSpecies",
    "session.petBreed",
    "session.extractionDate",
    "session.shippingDate",
    "trackingCase.currentStage",
    "trackingCase.updatedAt",
    "session.report",
  ]) {
    assert.ok(
      messageBlock.includes(field),
      `mensaje debe usar el campo disponible ${field}`,
    );
  }

  assert.ok(messageBlock.includes("formatSpecialStainContactDate"));
  assert.ok(messageBlock.includes("getTrackingStageLabel(trackingCase.currentStage)"));
  assert.ok(whatsAppBlock.includes("encodeURIComponent(message)"));
  assert.match(
    emailBlock,
    /encodeURIComponent\(\s*SPECIAL_STAIN_EMAIL_SUBJECT,\s*\)/,
  );
  assert.ok(emailBlock.includes("encodeURIComponent(message)"));
});

test("particulares content muestra receptionAt y estimatedDeliveryAt en seguimiento", () => {
  const source = read(PARTICULARES_CONTENT_PATH);

  assert.ok(
    source.includes("Entrega en laboratorio:"),
    "tracking section must show 'Entrega en laboratorio:'",
  );
  assert.ok(
    source.includes("trackingCase.receptionAt"),
    "tracking section must use trackingCase.receptionAt",
  );
  assert.ok(
    source.includes("Estimación informe:"),
    "tracking section must show 'Estimación informe:'",
  );
  assert.ok(
    source.includes("trackingCase.estimatedDeliveryAt"),
    "tracking section must use trackingCase.estimatedDeliveryAt",
  );
});

test("particulares content omite datos ausentes y sensibles en mensaje de tincion especial", () => {
  const source = read(PARTICULARES_CONTENT_PATH);
  const valueBlock = extractFunctionBlock(
    source,
    "formatSpecialStainContactValue",
  );
  const appendBlock = extractFunctionBlock(
    source,
    "appendSpecialStainContactLine",
  );
  const messageBlock = extractFunctionBlock(
    source,
    "buildSpecialStainContactMessage",
  );
  const reportBlock = extractFunctionBlock(
    source,
    "buildSpecialStainReportSummary",
  );
  const contactBlocks = [valueBlock, appendBlock, messageBlock, reportBlock].join(
    "\n",
  );

  assert.ok(valueBlock.includes("value === null || value === undefined"));
  assert.ok(valueBlock.includes("String(value).trim()"));
  assert.ok(valueBlock.includes("text.length > 0 ? text : null"));
  assert.ok(appendBlock.includes("if (!formattedValue)"));

  for (const forbidden of [
    "storagePath",
    "signedUrl",
    "previewUrl",
    "downloadUrl",
    "cookie",
    "sessionToken",
    "authorization",
    "headers",
  ]) {
    assert.equal(
      contactBlocks.toLowerCase().includes(forbidden.toLowerCase()),
      false,
      `mensaje no debe incluir ${forbidden}`,
    );
  }
});

// ─── PR-PUX2: claridad de estados y acciones de informe ─────────────────────

test("particulares content fija contrato de estados de informe disponible/pendiente", () => {
  const source = read(PARTICULARES_CONTENT_PATH);

  const availableCount = (
    source.match(/data-particulares-report-state="available"/g) ?? []
  ).length;
  const actionsCount = (
    source.match(/data-particulares-report-actions="true"/g) ?? []
  ).length;

  assert.equal(
    availableCount,
    2,
    "must mark both mobile and desktop report blocks as available",
  );
  assert.ok(source.includes('data-particulares-report-state="pending"'));
  assert.equal(
    actionsCount,
    2,
    "must mark both mobile and desktop report action groups",
  );
});

test("particulares content keeps distinct ver/descargar actions and safe pending copy", () => {
  const source = read(PARTICULARES_CONTENT_PATH);

  assert.ok(source.includes('onClick={() => openReport("preview")}'));
  assert.ok(source.includes('onClick={() => openReport("download")}'));
  assert.ok(source.includes("Ver informe"));
  assert.ok(source.includes("Descargar"));
  assert.ok(source.includes("Sin informe vinculado todavía"));
  assert.ok(source.includes("clinical-alert-info"));
  assert.equal(
    source.includes('className="clinical-alert-warning p-4"'),
    false,
    "pending report state must not use the alarming warning style",
  );
});
