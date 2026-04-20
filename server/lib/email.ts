import nodemailer, { type Transporter } from "nodemailer";
import { ENV } from "./env.ts";

let cachedTransporter: Transporter | null = null;

function isLikelyEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeRecipients(values: Array<string | null | undefined>): string[] {
  const unique = new Set<string>();

  for (const rawValue of values) {
    if (typeof rawValue !== "string") {
      continue;
    }

    for (const item of rawValue
      .split(/[;,]/g)
      .map((part) => part.trim())
      .filter(Boolean)) {
      const normalized = item.toLowerCase();

      if (isLikelyEmail(normalized)) {
        unique.add(normalized);
      }
    }
  }

  return Array.from(unique);
}

function getTransporter(): Transporter | null {
  if (!ENV.smtp.enabled) {
    return null;
  }

  if (cachedTransporter) {
    return cachedTransporter;
  }

  cachedTransporter = nodemailer.createTransport({
    host: ENV.smtp.host,
    port: ENV.smtp.port,
    secure: ENV.smtp.secure,
    auth: {
      user: ENV.smtp.user,
      pass: ENV.smtp.pass,
    },
  });

  return cachedTransporter;
}

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "America/Argentina/Cordoba",
  }).format(value);
}

function buildSpecialStainRequiredText(input: {
  clinicName: string;
  trackingCaseId: number;
  receptionAt: Date;
  estimatedDeliveryAt: Date;
  currentStage: string;
  paymentUrl?: string | null;
  adminContactEmail?: string | null;
  adminContactPhone?: string | null;
  notes?: string | null;
}) {
  const lines = [
    `Hola,`,
    ``,
    `Te informamos que el estudio #${input.trackingCaseId} de la clÃƒÂ­nica ${input.clinicName} requiere tinciÃƒÂ³n especial.`,
    ``,
    `Estado actual: ${input.currentStage}`,
    `RecepciÃƒÂ³n de muestra: ${formatDateTime(input.receptionAt)}`,
    `Fecha estimada de entrega: ${formatDateTime(input.estimatedDeliveryAt)}`,
  ];

  if (input.notes) {
    lines.push(`Observaciones: ${input.notes}`);
  }

  if (input.paymentUrl) {
    lines.push(`Link de pago: ${input.paymentUrl}`);
  }

  if (input.adminContactEmail) {
    lines.push(`Email de contacto administrativo: ${input.adminContactEmail}`);
  }

  if (input.adminContactPhone) {
    lines.push(`TelÃƒÂ©fono de contacto administrativo: ${input.adminContactPhone}`);
  }

  lines.push(
    ``,
    `IngresÃƒÂ¡ al portal para revisar el seguimiento y continuar la gestiÃƒÂ³n.`,
    ``,
    `Equipo VETNEB`,
  );

  return lines.join("\n");
}

export async function sendSpecialStainRequiredEmail(input: {
  to: Array<string | null | undefined>;
  clinicName: string;
  trackingCaseId: number;
  receptionAt: Date;
  estimatedDeliveryAt: Date;
  currentStage: string;
  paymentUrl?: string | null;
  adminContactEmail?: string | null;
  adminContactPhone?: string | null;
  notes?: string | null;
}) {
  const recipients = normalizeRecipients(input.to);

  if (recipients.length === 0) {
    console.info("[EMAIL] special_stain_required skipped: no recipients", {
      trackingCaseId: input.trackingCaseId,
    });

    return { sent: false, reason: "no_recipients" as const };
  }

  const transporter = getTransporter();

  if (!transporter) {
    console.info("[EMAIL] special_stain_required skipped: smtp disabled", {
      trackingCaseId: input.trackingCaseId,
      recipients,
    });

    return { sent: false, reason: "smtp_disabled" as const };
  }

  const info = await transporter.sendMail({
    from: ENV.smtp.from,
    to: recipients.join(", "),
    subject: `[VETNEB] Estudio #${input.trackingCaseId}: requiere tinciÃƒÂ³n especial`,
    text: buildSpecialStainRequiredText(input),
  });

  console.info("[EMAIL] special_stain_required sent", {
    trackingCaseId: input.trackingCaseId,
    recipients,
    messageId: info.messageId,
  });

  return {
    sent: true,
    messageId: info.messageId,
  };
}