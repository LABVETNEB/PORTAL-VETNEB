import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import { z } from "zod";

import { ENV } from "../lib/env.ts";

type ContactEmailResult =
  | { sent: true; messageId: string }
  | { sent: false; reason: "smtp_disabled" };

type ContactMessageInput = {
  name: string;
  email: string;
  clinicName: string | null;
  message: string;
};

export type ContactNativeRoutesOptions = {
  sendContactMessageEmail?: (
    input: ContactMessageInput,
  ) => Promise<ContactEmailResult>;
};

const contactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255),
  clinicName: z.string().trim().max(180).optional().nullable(),
  message: z.string().trim().min(10).max(4000),
});

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

let defaultDepsPromise:
  | Promise<Required<ContactNativeRoutesOptions>>
  | undefined;

async function loadDefaultDeps(): Promise<Required<ContactNativeRoutesOptions>> {
  if (!defaultDepsPromise) {
    defaultDepsPromise = (async () => {
      const email = await import("../lib/email.ts");

      return {
        sendContactMessageEmail: email.sendContactMessageEmail,
      };
    })();
  }

  return defaultDepsPromise;
}

async function resolveDeps(
  options: ContactNativeRoutesOptions,
): Promise<Required<ContactNativeRoutesOptions>> {
  const defaultDeps = options.sendContactMessageEmail
    ? undefined
    : await loadDefaultDeps();

  return {
    sendContactMessageEmail:
      options.sendContactMessageEmail ?? defaultDeps!.sendContactMessageEmail,
  };
}

function getAllowedOrigins(): string[] {
  const configuredOrigins = ENV.corsOrigins.map((origin) =>
    origin.trim().toLowerCase(),
  );

  if (configuredOrigins.length > 0) {
    return configuredOrigins;
  }

  if (ENV.isDevelopment) {
    return [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://localhost:3001",
      "http://127.0.0.1:3001",
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    ];
  }

  return [];
}

function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value).origin.trim().toLowerCase();
  } catch {
    return null;
  }
}

function getOriginHeader(request: FastifyRequest) {
  return typeof request.headers.origin === "string"
    ? request.headers.origin.trim()
    : "";
}

function getAllowedOriginForCors(
  request: FastifyRequest,
  allowedOrigins: ReadonlySet<string>,
) {
  const rawOrigin = getOriginHeader(request);

  if (!rawOrigin) {
    return null;
  }

  const normalizedOrigin = normalizeOrigin(rawOrigin);

  if (!normalizedOrigin || !allowedOrigins.has(normalizedOrigin)) {
    return null;
  }

  return rawOrigin;
}

function getRequestOrigin(request: FastifyRequest): string | null {
  const originHeader = getOriginHeader(request);

  if (originHeader) {
    return normalizeOrigin(originHeader);
  }

  const refererHeader =
    typeof request.headers.referer === "string"
      ? request.headers.referer.trim()
      : "";

  if (refererHeader) {
    return normalizeOrigin(refererHeader);
  }

  return null;
}

function applyCorsHeaders(
  request: FastifyRequest,
  reply: FastifyReply,
  allowedOrigins: ReadonlySet<string>,
) {
  const allowedOrigin = getAllowedOriginForCors(request, allowedOrigins);

  if (!allowedOrigin) {
    return;
  }

  reply.header("vary", "Origin");
  reply.header("access-control-allow-origin", allowedOrigin);
  reply.header("access-control-allow-credentials", "true");
}

function enforceTrustedOrigin(
  request: FastifyRequest,
  reply: FastifyReply,
  allowedOrigins: ReadonlySet<string>,
) {
  if (!UNSAFE_METHODS.has(request.method.toUpperCase())) {
    return true;
  }

  const requestOrigin = getRequestOrigin(request);

  if (!requestOrigin || allowedOrigins.has(requestOrigin)) {
    return true;
  }

  reply.code(403).send({
    success: false,
    error: "Origen no permitido",
  });

  return false;
}

function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = typeof value === "string" ? value.trim() : "";

  return trimmed ? trimmed : null;
}

export const contactNativeRoutes: FastifyPluginAsync<
  ContactNativeRoutesOptions
> = async (app, options) => {
  const allowedOrigins = new Set(getAllowedOrigins());

  app.addHook("onRequest", async (request, reply) => {
    applyCorsHeaders(request, reply, allowedOrigins);

    return undefined;
  });

  const optionsHandler = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    const requestOrigin = getRequestOrigin(request);

    if (requestOrigin && !allowedOrigins.has(requestOrigin)) {
      return reply.code(403).send({
        success: false,
        error: "Origen no permitido",
      });
    }

    applyCorsHeaders(request, reply, allowedOrigins);
    reply.header("access-control-allow-methods", "POST,OPTIONS");

    const requestedHeaders =
      typeof request.headers["access-control-request-headers"] === "string"
        ? request.headers["access-control-request-headers"]
        : "content-type";

    reply.header("access-control-allow-headers", requestedHeaders);
    return reply.code(204).send();
  };

  app.options("/", optionsHandler);

  app.post("/", async (request, reply) => {
    if (!enforceTrustedOrigin(request, reply, allowedOrigins)) {
      return reply;
    }

    const parsed = contactSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: "Solicitud de contacto inválida",
        details: parsed.error.issues.map((issue) => issue.message),
      });
    }

    const deps = await resolveDeps(options);
    const result = await deps.sendContactMessageEmail({
      name: parsed.data.name,
      email: parsed.data.email,
      clinicName: normalizeOptionalText(parsed.data.clinicName),
      message: parsed.data.message,
    });

    return reply.code(result.sent ? 200 : 202).send({
      success: true,
      sent: result.sent,
      reason: result.sent ? undefined : result.reason,
      message: result.sent
        ? "Mensaje enviado correctamente"
        : "Mensaje recibido. SMTP no configurado para envío inmediato.",
    });
  });
};
