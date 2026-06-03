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
  assert.ok(source.includes("setSession(response?.particular ?? null);"));
});

test("particulares content surfaces refreshSession fetch failures instead of silent logout state", () => {
  const source = read(PARTICULARES_CONTENT_PATH);

  assert.ok(source.includes("setErrorMessage(null);"));
  assert.ok(source.includes("} catch (error) {"));
  assert.ok(source.includes("setSession(null);"));
  assert.ok(source.includes("error instanceof Error"));
  assert.ok(source.includes("? error.message"));
  assert.ok(source.includes(': "No se pudo verificar la sesión particular. Intente nuevamente.",'));
  assert.ok(source.includes("setIsCheckingSession(false);"));
  assert.ok(source.includes('role="alert"'));
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
