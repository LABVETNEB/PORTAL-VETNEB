import type { FastifyReply, FastifyRequest } from "fastify";

import { createRequireAdminAuth } from "../middlewares/admin-auth.ts";
import type { Request, Response } from "./http-types.ts";
import { ENV } from "./env.ts";

export type FastifyAdminAuthDeps = {
  deleteAdminSession: (tokenHash: string) => Promise<void>;
  getAdminSessionByToken: (
    tokenHash: string,
  ) => Promise<{
    adminUserId: number;
    expiresAt: Date | null;
    lastAccess?: Date | null;
  } | null>;
  getAdminUserById: (
    adminUserId: number,
  ) => Promise<{ id: number; username: string } | null>;
  updateAdminSessionLastAccess: (tokenHash: string) => Promise<void>;
  hashSessionToken: (token: string) => string;
  now: () => number;
};

export type FastifyAuthenticatedAdmin = {
  id: number;
  username: string;
};

function parseCookies(cookieHeader: string | undefined) {
  const result: Record<string, string> = {};

  if (!cookieHeader) {
    return result;
  }

  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rawValueParts] = part.split("=");

    if (!rawName) {
      continue;
    }

    const name = rawName.trim();

    if (!name) {
      continue;
    }

    const rawValue = rawValueParts.join("=").trim();

    try {
      result[name] = decodeURIComponent(rawValue);
    } catch {
      result[name] = rawValue;
    }
  }

  return result;
}

function serializeCookie(input: {
  name: string;
  value: string;
  maxAgeSeconds?: number;
  expires?: string;
}) {
  const parts = [
    `${input.name}=${encodeURIComponent(input.value)}`,
    "Path=/",
    "HttpOnly",
    `SameSite=${ENV.cookieSameSite}`,
  ];

  if (ENV.cookieSecure) {
    parts.push("Secure");
  }

  if (typeof input.maxAgeSeconds === "number") {
    parts.push(`Max-Age=${input.maxAgeSeconds}`);
  }

  if (input.expires) {
    parts.push(`Expires=${input.expires}`);
  }

  return parts.join("; ");
}

function buildClearAdminSessionCookie() {
  return serializeCookie({
    name: ENV.adminCookieName,
    value: "",
    maxAgeSeconds: 0,
    expires: "Thu, 01 Jan 1970 00:00:00 GMT",
  });
}

function createFastifyResponseAdapter(reply: FastifyReply) {
  let sent = false;
  let statusCode = 200;

  const response = {
    statusCode,
    status(code: number) {
      statusCode = code;
      this.statusCode = code;
      reply.code(code);
      return this;
    },
    json(body: unknown) {
      sent = true;
      reply.code(statusCode).send(body);
      return this;
    },
    cookie(name: string, value: string) {
      reply.header(
        "set-cookie",
        serializeCookie({
          name,
          value,
        }),
      );
      return this;
    },
    clearCookie() {
      reply.header("set-cookie", buildClearAdminSessionCookie());
      return this;
    },
    setHeader(name: string, value: string | number | readonly string[]) {
      reply.header(name, value);
      return this;
    },
    on() {
      return this;
    },
    end() {
      sent = true;
      reply.raw.end();
      return this;
    },
  } satisfies Response;

  return {
    response,
    wasSent: () => sent,
  };
}

export async function authenticateFastifyAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
  deps: FastifyAdminAuthDeps,
): Promise<FastifyAuthenticatedAdmin | null> {
  const cookieHeader =
    typeof request.headers.cookie === "string"
      ? request.headers.cookie
      : undefined;
  const reqLike: Request = {
    method: request.method,
    originalUrl: request.url,
    url: request.url,
    ip: request.ip,
    headers: request.headers,
    cookies: parseCookies(cookieHeader),
    requestId: request.id,
  };
  const { response, wasSent } = createFastifyResponseAdapter(reply);
  let nextError: unknown;

  await createRequireAdminAuth({
    ...deps,
    cookieName: ENV.adminCookieName,
    cookieSameSite: ENV.cookieSameSite,
    cookieSecure: ENV.cookieSecure,
  })(reqLike, response, (error?: unknown) => {
    nextError = error;
  });

  if (nextError) {
    throw nextError;
  }

  if (wasSent()) {
    return null;
  }

  const adminAuth = reqLike.adminAuth;

  if (
    !adminAuth ||
    typeof adminAuth.id !== "number" ||
    typeof adminAuth.username !== "string"
  ) {
    return null;
  }

  return {
    id: adminAuth.id,
    username: adminAuth.username,
  };
}
