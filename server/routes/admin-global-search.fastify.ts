import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from "fastify";

import {
  getAllowedOrigins,
  getAllowedOriginForCors,
  getRequestOrigin,
} from "../lib/cors-headers.ts";
import { authenticateFastifyAdmin } from "../lib/fastify-admin-auth.ts";
import {
  applyGlobalSearchRateLimit,
  createDefaultGlobalSearchRateLimitStore,
  GLOBAL_SEARCH_RATE_LIMIT_EXPOSED_HEADERS,
} from "../lib/global-search-rate-limit.ts";
import { logError, serializeError } from "../lib/logger.ts";
import type { RateLimitStore } from "../lib/rate-limit-store.ts";
import {
  ADMIN_GLOBAL_SEARCH_KINDS,
  createAdminGlobalSearch,
  deriveGlobalSearchCursorKey,
  globalSearchQueryUnits,
  type AdminGlobalSearchRepository,
} from "../features/global-search/index.ts";

type AdminSessionRecord = {
  id?: number;
  adminUserId: number;
  expiresAt: Date | null;
  lastAccess?: Date | null;
};

type AdminUserRecord = {
  id: number;
  username: string;
};

export type AdminGlobalSearchNativeRoutesOptions = {
  deleteAdminSession?: (tokenHash: string) => Promise<void>;
  getAdminSessionByToken?: (tokenHash: string) => Promise<AdminSessionRecord | null>;
  getAdminUserById?: (adminUserId: number) => Promise<AdminUserRecord | null>;
  updateAdminSessionLastAccess?: (tokenHash: string) => Promise<void>;
  hashSessionToken?: (token: string) => string;
  searchRepository?: AdminGlobalSearchRepository;
  /** HMAC key of the keyset cursor; derived from the server secret when absent. */
  cursorKey?: Uint8Array;
  /** GLOBAL-SEARCH-3C budget store; the shared persistent table when absent. */
  searchRateLimitStore?: RateLimitStore;
  now?: () => number;
};

type AdminGlobalSearchDeps = Required<
  Omit<AdminGlobalSearchNativeRoutesOptions, "now" | "cursorKey" | "searchRateLimitStore">
>;

let defaultCursorKey: Uint8Array | undefined;

/**
 * GLOBAL-SEARCH-3A: the cursor HMAC key, derived once per process from the
 * server-only service secret (no new configuration). Injectable for tests.
 */
async function resolveCursorKey(injected: Uint8Array | undefined): Promise<Uint8Array> {
  if (injected) return injected;
  if (!defaultCursorKey) {
    const { ENV } = await import("../lib/env.ts");
    defaultCursorKey = deriveGlobalSearchCursorKey(ENV.supabaseServiceRoleKey);
  }
  return defaultCursorKey;
}

let defaultDepsPromise: Promise<AdminGlobalSearchDeps> | undefined;

async function loadDefaultDeps(): Promise<AdminGlobalSearchDeps> {
  if (!defaultDepsPromise) {
    defaultDepsPromise = (async () => {
      const db = await import("../db.ts");
      const authSecurity = await import("../lib/auth-security.ts");
      const infrastructure = await import(
        "../features/global-search/infrastructure/index.ts"
      );

      return {
        deleteAdminSession: db.deleteAdminSession,
        getAdminSessionByToken: db.getAdminSessionByToken,
        getAdminUserById: db.getAdminUserById,
        updateAdminSessionLastAccess: db.updateAdminSessionLastAccess,
        hashSessionToken: authSecurity.hashSessionToken,
        searchRepository: infrastructure.createAdminGlobalSearchRepository(),
      };
    })();
  }

  return defaultDepsPromise;
}

async function resolveDeps(
  options: AdminGlobalSearchNativeRoutesOptions,
): Promise<AdminGlobalSearchDeps> {
  const injected =
    options.deleteAdminSession &&
    options.getAdminSessionByToken &&
    options.getAdminUserById &&
    options.updateAdminSessionLastAccess &&
    options.hashSessionToken &&
    options.searchRepository;

  if (injected) {
    return {
      deleteAdminSession: options.deleteAdminSession!,
      getAdminSessionByToken: options.getAdminSessionByToken!,
      getAdminUserById: options.getAdminUserById!,
      updateAdminSessionLastAccess: options.updateAdminSessionLastAccess!,
      hashSessionToken: options.hashSessionToken!,
      searchRepository: options.searchRepository!,
    };
  }

  const defaults = await loadDefaultDeps();

  return {
    deleteAdminSession: options.deleteAdminSession ?? defaults.deleteAdminSession,
    getAdminSessionByToken:
      options.getAdminSessionByToken ?? defaults.getAdminSessionByToken,
    getAdminUserById: options.getAdminUserById ?? defaults.getAdminUserById,
    updateAdminSessionLastAccess:
      options.updateAdminSessionLastAccess ?? defaults.updateAdminSessionLastAccess,
    hashSessionToken: options.hashSessionToken ?? defaults.hashSessionToken,
    searchRepository: options.searchRepository ?? defaults.searchRepository,
  };
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
  reply.header("access-control-expose-headers", GLOBAL_SEARCH_RATE_LIMIT_EXPOSED_HEADERS);
}

function parseClinicFilter(value: unknown): number | null | undefined {
  if (value === undefined || value === "") return null;
  if (typeof value !== "string" || !/^\d{1,9}$/.test(value)) return undefined;
  const parsed = Number(value);
  return parsed > 0 ? parsed : undefined;
}

/**
 * GET /api/admin/search — admin global record search over the entities the
 * admin session already reads through `/api/admin/*` (clinics, reports,
 * particular tokens, study tracking cases, clinic users). `clinicId` is a
 * narrowing filter only. The query string is not logged.
 *
 * GLOBAL-SEARCH-3C: right after auth and before any search SQL the request
 * is charged to the actor's persistent budget (`lib/global-search-rate-limit.ts`).
 */
export const adminGlobalSearchNativeRoutes: FastifyPluginAsync<
  AdminGlobalSearchNativeRoutesOptions
> = async (app, options) => {
  const now = options.now ?? (() => Date.now());
  const allowedOrigins = new Set(getAllowedOrigins());
  let defaultRateLimitStore: Promise<RateLimitStore> | undefined;
  const rateLimitStore = (): RateLimitStore | Promise<RateLimitStore> => {
    if (options.searchRateLimitStore) return options.searchRateLimitStore;
    defaultRateLimitStore ??= createDefaultGlobalSearchRateLimitStore();
    return defaultRateLimitStore;
  };

  app.addHook("onRequest", async (request, reply) => {
    applyCorsHeaders(request, reply, allowedOrigins);
  });

  app.options("/", async (request, reply) => {
    const requestOrigin = getRequestOrigin(request);

    if (requestOrigin && !allowedOrigins.has(requestOrigin)) {
      return reply.code(403).send({ success: false, error: "Origen no permitido" });
    }

    applyCorsHeaders(request, reply, allowedOrigins);
    reply.header("access-control-allow-methods", "GET,OPTIONS");
    reply.header("access-control-allow-headers", "content-type");
    return reply.code(204).send();
  });

  app.get<{ Querystring: Record<string, unknown> }>("/", async (request, reply) => {
    const deps = await resolveDeps(options);
    const admin = await authenticateFastifyAdmin(request, reply, { ...deps, now });

    if (!admin) {
      return reply;
    }

    if (
      !(await applyGlobalSearchRateLimit({
        store: rateLimitStore,
        actor: { surface: "admin", userId: admin.id },
        units: globalSearchQueryUnits(request.query, ADMIN_GLOBAL_SEARCH_KINDS),
        reply,
        requestId: request.id,
        now: now(),
      }))
    ) {
      return reply;
    }

    const clinicFilter = parseClinicFilter(request.query.clinicId);

    if (clinicFilter === undefined) {
      return reply.code(400).send({ success: false, error: "Clinica invalida" });
    }

    try {
      const outcome = await createAdminGlobalSearch(deps.searchRepository, {
        cursorKey: await resolveCursorKey(options.cursorKey),
        now,
      })(
        request.query,
        clinicFilter,
      );

      if (!outcome.ok) {
        return reply.code(outcome.status).send({ success: false, error: outcome.error });
      }

      return reply.code(200).send({ success: true, ...outcome.result });
    } catch (error) {
      logError("ADMIN_GLOBAL_SEARCH_ERROR", {
        requestId: request.id,
        error: serializeError(error),
      });

      return reply.code(500).send({ success: false, error: "No se pudo completar la búsqueda" });
    }
  });
};
