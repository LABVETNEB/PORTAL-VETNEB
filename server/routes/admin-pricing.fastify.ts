import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from "fastify";

import { ENV } from "../lib/env.ts";
import {
  getAllowedOrigins,
  getAllowedOriginForCors,
  getRequestOrigin,
  enforceTrustedOrigin,
} from "../lib/cors-headers.ts";
import { AUDIT_EVENTS, type AuditWriteInput } from "../lib/audit.ts";
import { clearPublicPricingCache } from "../lib/public-pricing-cache.ts";
import { authenticateFastifyAdmin } from "../lib/fastify-admin-auth.ts";
import type {
  PricingItem,
  UpdatePricingItemInput,
} from "../db-pricing.ts";

type AdminSessionRecord = {
  id: number;
  adminUserId: number;
  expiresAt: Date | null;
  lastAccess?: Date | null;
};

type SessionAdminUserRecord = {
  id: number;
  username: string;
};

type AuthenticatedAdminUser = {
  id: number;
  username: string;
};

type UpdatePricingPayload = Pick<
  UpdatePricingItemInput,
  "priceLabel" | "isActive" | "displayOrder"
>;

type ListAdminPricingItemsFn = () => Promise<PricingItem[]>;
type UpdatePricingItemFn = (
  id: number,
  payload: UpdatePricingPayload & { now?: Date },
) => Promise<PricingItem | null>;

type AdminPricingRequestParams = {
  id?: unknown;
};

type AdminPricingPatchBody = {
  priceLabel?: unknown;
  isActive?: unknown;
  displayOrder?: unknown;
  [key: string]: unknown;
};

type AdminPricingCategoryItem = {
  id: number;
  studyName: string;
  priceLabel: string | null;
  displayOrder: number;
  isActive: boolean;
  updatedAt: string;
};

type AdminPricingCategory = {
  category: string;
  items: AdminPricingCategoryItem[];
};

export type AdminPricingNativeRoutesOptions = {
  deleteAdminSession?: (tokenHash: string) => Promise<void>;
  getAdminSessionByToken?: (
    tokenHash: string,
  ) => Promise<AdminSessionRecord | null>;
  getAdminUserById?: (
    adminUserId: number,
  ) => Promise<SessionAdminUserRecord | null>;
  updateAdminSessionLastAccess?: (tokenHash: string) => Promise<void>;
  hashSessionToken?: (token: string) => string;
  listAdminPricingItems?: ListAdminPricingItemsFn;
  updatePricingItem?: UpdatePricingItemFn;
  writeAuditLog?: (req: unknown, input: AuditWriteInput) => Promise<void>;
  now?: () => number;
};

type NativeAdminPricingDeps = Required<
  Pick<
    AdminPricingNativeRoutesOptions,
    | "deleteAdminSession"
    | "getAdminSessionByToken"
    | "getAdminUserById"
    | "updateAdminSessionLastAccess"
    | "hashSessionToken"
    | "listAdminPricingItems"
    | "updatePricingItem"
    | "writeAuditLog"
  >
>;

let defaultDepsPromise: Promise<NativeAdminPricingDeps> | undefined;

async function loadDefaultDeps(): Promise<NativeAdminPricingDeps> {
  if (!defaultDepsPromise) {
    defaultDepsPromise = (async () => {
      const db = await import("../db.ts");
      const authSecurity = await import("../lib/auth-security.ts");
      const pricing = await import("../db-pricing.ts");
      const audit = await import("../lib/audit.ts");

      return {
        deleteAdminSession: db.deleteAdminSession,
        getAdminSessionByToken: db.getAdminSessionByToken,
        getAdminUserById: db.getAdminUserById,
        updateAdminSessionLastAccess: db.updateAdminSessionLastAccess,
        hashSessionToken: authSecurity.hashSessionToken,
        listAdminPricingItems: pricing.listAdminPricingItems,
        updatePricingItem: pricing.updatePricingItem as UpdatePricingItemFn,
        writeAuditLog: audit.writeAuditLog as (
          req: unknown,
          input: AuditWriteInput,
        ) => Promise<void>,
      };
    })();
  }

  return defaultDepsPromise;
}

async function authenticateAdminUser(
  request: FastifyRequest,
  reply: FastifyReply,
  deps: NativeAdminPricingDeps,
  now: () => number,
): Promise<AuthenticatedAdminUser | null> {
  return authenticateFastifyAdmin(request, reply, {
    deleteAdminSession: deps.deleteAdminSession,
    getAdminSessionByToken: deps.getAdminSessionByToken,
    getAdminUserById: deps.getAdminUserById,
    updateAdminSessionLastAccess: deps.updateAdminSessionLastAccess,
    hashSessionToken: deps.hashSessionToken,
    now,
  });
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

function parsePositiveInteger(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isInteger(value) && value > 0 ? value : null;
  }

  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parsePatchPayload(
  body: unknown,
): { payload?: UpdatePricingPayload; error?: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {
      error:
        "Body inválido. Debe ser un objeto con priceLabel, isActive o displayOrder.",
    };
  }

  const rawBody = body as AdminPricingPatchBody;
  const keys = Object.keys(rawBody);
  const allowedKeys = new Set(["priceLabel", "isActive", "displayOrder"]);
  const invalidKeys = keys.filter((key) => !allowedKeys.has(key));

  if (keys.length === 0) {
    return {
      error:
        "Body inválido. Debe incluir al menos uno de: priceLabel, isActive, displayOrder.",
    };
  }

  if (invalidKeys.length > 0) {
    return {
      error:
        "Body inválido. Solo se permiten priceLabel, isActive y displayOrder.",
    };
  }

  const payload: UpdatePricingPayload = {};

  if (Object.prototype.hasOwnProperty.call(rawBody, "priceLabel")) {
    const value = rawBody.priceLabel;

    if (value === null) {
      payload.priceLabel = null;
    } else if (typeof value === "string" && value.length <= 80) {
      payload.priceLabel = value;
    } else {
      return {
        error: "priceLabel inválido. Debe ser string de hasta 80 caracteres o null.",
      };
    }
  }

  if (Object.prototype.hasOwnProperty.call(rawBody, "isActive")) {
    if (typeof rawBody.isActive !== "boolean") {
      return {
        error: "isActive inválido. Debe ser boolean.",
      };
    }

    payload.isActive = rawBody.isActive;
  }

  if (Object.prototype.hasOwnProperty.call(rawBody, "displayOrder")) {
    const value = rawBody.displayOrder;

    if (
      typeof value !== "number" ||
      !Number.isInteger(value) ||
      value < 0
    ) {
      return {
        error: "displayOrder inválido. Debe ser un entero mayor o igual a 0.",
      };
    }

    payload.displayOrder = value;
  }

  if (
    !Object.prototype.hasOwnProperty.call(payload, "priceLabel") &&
    !Object.prototype.hasOwnProperty.call(payload, "isActive") &&
    !Object.prototype.hasOwnProperty.call(payload, "displayOrder")
  ) {
    return {
      error:
        "Body inválido. Debe incluir al menos uno de: priceLabel, isActive, displayOrder.",
    };
  }

  return { payload };
}

function serializeAdminPricingItem(item: PricingItem) {
  return {
    id: item.id,
    category: item.category,
    studyName: item.studyName,
    priceLabel: item.priceLabel ?? null,
    displayOrder: item.displayOrder,
    isActive: item.isActive,
    updatedAt: item.updatedAt,
  };
}

function groupAdminPricingItems(items: PricingItem[]): AdminPricingCategory[] {
  const categories: AdminPricingCategory[] = [];
  let currentCategory: AdminPricingCategory | undefined;

  for (const item of items) {
    if (!currentCategory || currentCategory.category !== item.category) {
      currentCategory = {
        category: item.category,
        items: [],
      };

      categories.push(currentCategory);
    }

    currentCategory.items.push({
      id: item.id,
      studyName: item.studyName,
      priceLabel: item.priceLabel ?? null,
      displayOrder: item.displayOrder,
      isActive: item.isActive,
      updatedAt: item.updatedAt,
    });
  }

  return categories;
}

function createAuditRequestLike(
  request: FastifyRequest,
  admin: AuthenticatedAdminUser,
) {
  return {
    method: request.method,
    originalUrl: request.url,
    ip: request.ip,
    headers: request.headers,
    requestId: request.id,
    adminAuth: {
      id: admin.id,
      username: admin.username,
    },
  };
}

export const adminPricingNativeRoutes: FastifyPluginAsync<
  AdminPricingNativeRoutesOptions
> = async (app, options) => {
  const now = options.now ?? (() => Date.now());
  const allowedOrigins = new Set(getAllowedOrigins());

  async function resolveDeps(): Promise<NativeAdminPricingDeps> {
    const hasAllInjectedDeps =
      !!options.deleteAdminSession &&
      !!options.getAdminSessionByToken &&
      !!options.getAdminUserById &&
      !!options.updateAdminSessionLastAccess &&
      !!options.hashSessionToken &&
      !!options.listAdminPricingItems &&
      !!options.updatePricingItem &&
      !!options.writeAuditLog;

    const defaultDeps = hasAllInjectedDeps ? undefined : await loadDefaultDeps();

    return {
      deleteAdminSession:
        options.deleteAdminSession ?? defaultDeps!.deleteAdminSession,
      getAdminSessionByToken:
        options.getAdminSessionByToken ?? defaultDeps!.getAdminSessionByToken,
      getAdminUserById:
        options.getAdminUserById ?? defaultDeps!.getAdminUserById,
      updateAdminSessionLastAccess:
        options.updateAdminSessionLastAccess ??
        defaultDeps!.updateAdminSessionLastAccess,
      hashSessionToken:
        options.hashSessionToken ?? defaultDeps!.hashSessionToken,
      listAdminPricingItems:
        options.listAdminPricingItems ?? defaultDeps!.listAdminPricingItems,
      updatePricingItem: options.updatePricingItem ?? defaultDeps!.updatePricingItem,
      writeAuditLog: options.writeAuditLog ?? defaultDeps!.writeAuditLog,
    };
  }

  app.addHook("onRequest", async (request, reply) => {
    applyCorsHeaders(request, reply, allowedOrigins);
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
    reply.header("access-control-allow-methods", "GET,PATCH,OPTIONS");

    const requestedHeaders =
      typeof request.headers["access-control-request-headers"] === "string"
        ? request.headers["access-control-request-headers"]
        : "content-type";

    reply.header("access-control-allow-headers", requestedHeaders);
    return reply.code(204).send();
  };

  app.options("/", optionsHandler);
  app.options("/:id", optionsHandler);

  app.get("/", async (request, reply) => {
    try {
      const deps = await resolveDeps();
      const admin = await authenticateAdminUser(request, reply, deps, now);

      if (!admin) {
        return reply;
      }

      const items = await deps.listAdminPricingItems();

      return reply.code(200).send({
        success: true,
        categories: groupAdminPricingItems(items),
      });
    } catch (error) {
      console.error("[ADMIN_PRICING_LIST_ERROR]", {
        path: request.url,
        error,
      });

      return reply.code(500).send({
        success: false,
        error: "No se pudieron cargar los precios administrables.",
      });
    }
  });

  app.patch<{
    Params: AdminPricingRequestParams;
    Body: AdminPricingPatchBody;
  }>("/:id", async (request, reply) => {
    if (!enforceTrustedOrigin(request, reply, allowedOrigins)) {
      return reply;
    }

    try {
      const deps = await resolveDeps();
      const admin = await authenticateAdminUser(request, reply, deps, now);

      if (!admin) {
        return reply;
      }

      const pricingItemId = parsePositiveInteger(request.params.id);

      if (pricingItemId === null) {
        return reply.code(400).send({
          success: false,
          error: "ID inválido. Debe ser un entero positivo.",
        });
      }

      const parsed = parsePatchPayload(request.body);

      if (!parsed.payload) {
        return reply.code(400).send({
          success: false,
          error: parsed.error ?? "Body inválido.",
        });
      }

      const previousItem = (await deps.listAdminPricingItems()).find(
        (item) => item.id === pricingItemId,
      );

      if (!previousItem) {
        return reply.code(404).send({
          success: false,
          error: "Ítem de precio no encontrado",
        });
      }

      const updated = await deps.updatePricingItem(pricingItemId, {
        ...parsed.payload,
        now: new Date(now()),
      });

      if (!updated) {
        return reply.code(404).send({
          success: false,
          error: "Ítem de precio no encontrado",
        });
      }

      await deps.writeAuditLog(createAuditRequestLike(request, admin), {
        event: AUDIT_EVENTS.ADMIN_PRICING_UPDATED,
        metadata: {
          pricingItemId: updated.id,
          category: updated.category,
          studyName: updated.studyName,
          updatedFields: Object.keys(parsed.payload),
          previous: {
            priceLabel: previousItem.priceLabel,
            isActive: previousItem.isActive,
            displayOrder: previousItem.displayOrder,
          },
          next: {
            priceLabel: updated.priceLabel,
            isActive: updated.isActive,
            displayOrder: updated.displayOrder,
          },
        },
      });

      clearPublicPricingCache();

      return reply.code(200).send({
        success: true,
        pricingItem: serializeAdminPricingItem(updated),
      });
    } catch (error) {
      console.error("[ADMIN_PRICING_PATCH_ERROR]", {
        path: request.url,
        error,
      });

      return reply.code(500).send({
        success: false,
        error: "No se pudieron guardar los cambios de precio.",
      });
    }
  });
};
