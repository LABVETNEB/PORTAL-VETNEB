import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";

import {
  enforceTrustedOrigin,
  getAllowedOriginForCors,
  getAllowedOrigins,
  getRequestOrigin,
} from "../lib/cors-headers.ts";
import { authenticateFastifyAdmin } from "../lib/fastify-admin-auth.ts";
import {
  authenticateFastifyClinicUser,
  type FastifyClinicSessionRecord,
  type FastifyClinicUserRecord,
} from "../lib/fastify-clinic-auth.ts";
import {
  applyGlobalSearchRateLimit,
  createDefaultGlobalSearchRateLimitStore,
  GLOBAL_SEARCH_RATE_LIMIT_EXPOSED_HEADERS,
} from "../lib/global-search-rate-limit.ts";
import { logError, serializeError } from "../lib/logger.ts";
import type { RateLimitStore } from "../lib/rate-limit-store.ts";
import {
  ADMIN_GLOBAL_SEARCH_KINDS,
  CLINIC_GLOBAL_SEARCH_KINDS,
  createGlobalSearchStates,
  type GlobalSearchStateOwner,
  type GlobalSearchStateRepository,
} from "../features/global-search/index.ts";

type AdminSessionRecord = {
  id?: number;
  adminUserId: number;
  expiresAt: Date | null;
  lastAccess?: Date | null;
};

export type GlobalSearchStatesRoutesOptions = {
  stateRepository?: GlobalSearchStateRepository;
  searchRateLimitStore?: RateLimitStore;
  hashSessionToken?: (token: string) => string;
  deleteActiveSession?: (tokenHash: string) => Promise<void>;
  getActiveSessionByToken?: (tokenHash: string) => Promise<FastifyClinicSessionRecord | null | undefined>;
  getClinicUserById?: (clinicUserId: number) => Promise<FastifyClinicUserRecord | null | undefined>;
  updateSessionLastAccess?: (tokenHash: string) => Promise<void>;
  deleteAdminSession?: (tokenHash: string) => Promise<void>;
  getAdminSessionByToken?: (tokenHash: string) => Promise<AdminSessionRecord | null>;
  getAdminUserById?: (adminUserId: number) => Promise<{ id: number; username: string } | null>;
  updateAdminSessionLastAccess?: (tokenHash: string) => Promise<void>;
  now?: () => number;
};

type Defaults = Required<Omit<GlobalSearchStatesRoutesOptions, "now" | "searchRateLimitStore">>;

let defaultsPromise: Promise<Defaults> | undefined;

async function loadDefaults(): Promise<Defaults> {
  defaultsPromise ??= (async () => {
    const db = await import("../db.ts");
    const authSecurity = await import("../lib/auth-security.ts");
    const infrastructure = await import("../features/global-search/infrastructure/index.ts");
    return {
      stateRepository: infrastructure.createGlobalSearchStateRepository(),
      hashSessionToken: authSecurity.hashSessionToken,
      deleteActiveSession: db.deleteActiveSession,
      getActiveSessionByToken: db.getActiveSessionByToken,
      getClinicUserById: db.getClinicUserById,
      updateSessionLastAccess: db.updateSessionLastAccess,
      deleteAdminSession: db.deleteAdminSession,
      getAdminSessionByToken: db.getAdminSessionByToken,
      getAdminUserById: db.getAdminUserById,
      updateAdminSessionLastAccess: db.updateAdminSessionLastAccess,
    };
  })();
  return defaultsPromise;
}

async function resolveDeps(options: GlobalSearchStatesRoutesOptions): Promise<Defaults> {
  const complete =
    options.stateRepository &&
    options.hashSessionToken &&
    options.deleteActiveSession &&
    options.getActiveSessionByToken &&
    options.getClinicUserById &&
    options.updateSessionLastAccess &&
    options.deleteAdminSession &&
    options.getAdminSessionByToken &&
    options.getAdminUserById &&
    options.updateAdminSessionLastAccess;
  const defaults = complete ? undefined : await loadDefaults();
  const pick = <K extends keyof Defaults>(key: K): Defaults[K] =>
    (options[key] ?? defaults?.[key]) as Defaults[K];
  return {
    stateRepository: pick("stateRepository"),
    hashSessionToken: pick("hashSessionToken"),
    deleteActiveSession: pick("deleteActiveSession"),
    getActiveSessionByToken: pick("getActiveSessionByToken"),
    getClinicUserById: pick("getClinicUserById"),
    updateSessionLastAccess: pick("updateSessionLastAccess"),
    deleteAdminSession: pick("deleteAdminSession"),
    getAdminSessionByToken: pick("getAdminSessionByToken"),
    getAdminUserById: pick("getAdminUserById"),
    updateAdminSessionLastAccess: pick("updateAdminSessionLastAccess"),
  };
}

function applyCorsHeaders(request: FastifyRequest, reply: FastifyReply, allowedOrigins: ReadonlySet<string>) {
  const allowedOrigin = getAllowedOriginForCors(request, allowedOrigins);
  if (!allowedOrigin) return;
  reply.header("vary", "Origin");
  reply.header("access-control-allow-origin", allowedOrigin);
  reply.header("access-control-allow-credentials", "true");
  reply.header("access-control-expose-headers", GLOBAL_SEARCH_RATE_LIMIT_EXPOSED_HEADERS);
}

type Surface = "clinic" | "admin";

/**
 * GLOBAL-SEARCH-DRIVE-A4: `POST /` saves a search (canonical text + category)
 * and `GET /:id` reads it back. The state belongs to the caller's session and
 * surface; the id is never an authorization input. The responses are private
 * (`no-store`) and the text is never logged.
 */
function createStatesRoutes(surface: Surface): FastifyPluginAsync<GlobalSearchStatesRoutesOptions> {
  const allowedKinds = surface === "clinic" ? CLINIC_GLOBAL_SEARCH_KINDS : ADMIN_GLOBAL_SEARCH_KINDS;

  return async (app, options) => {
    const now = options.now ?? (() => Date.now());
    const allowedOrigins = new Set(getAllowedOrigins());
    let defaultRateLimitStore: Promise<RateLimitStore> | undefined;
    const rateLimitStore = (): RateLimitStore | Promise<RateLimitStore> => {
      if (options.searchRateLimitStore) return options.searchRateLimitStore;
      defaultRateLimitStore ??= createDefaultGlobalSearchRateLimitStore();
      return defaultRateLimitStore;
    };

    app.addHook("onRequest", async (request, reply) => {
      reply.header("cache-control", "no-store");
      applyCorsHeaders(request, reply, allowedOrigins);
    });

    const preflight = async (request: FastifyRequest, reply: FastifyReply) => {
      const requestOrigin = getRequestOrigin(request);
      if (requestOrigin && !allowedOrigins.has(requestOrigin)) {
        return reply.code(403).send({ success: false, error: "Origen no permitido" });
      }
      applyCorsHeaders(request, reply, allowedOrigins);
      reply.header("access-control-allow-methods", "GET,POST,OPTIONS");
      reply.header(
        "access-control-allow-headers",
        String(request.headers["access-control-request-headers"] ?? "content-type"),
      );
      return reply.code(204).send();
    };
    app.options("/", preflight);
    app.options("/:id", preflight);

    /** The authenticated owner (session + surface), or null with the reply sent. */
    const authenticate = async (
      request: FastifyRequest,
      reply: FastifyReply,
    ): Promise<{ owner: GlobalSearchStateOwner; actor: Parameters<typeof applyGlobalSearchRateLimit>[0]["actor"]; deps: Defaults } | null> => {
      const deps = await resolveDeps(options);
      if (surface === "clinic") {
        const auth = await authenticateFastifyClinicUser(request, reply, deps, now);
        if (!auth) return null;
        return {
          owner: { surface, sessionTokenHash: deps.hashSessionToken(auth.sessionToken) },
          actor: { surface: "clinic", clinicId: auth.clinicId, userId: auth.id },
          deps,
        };
      }
      const admin = await authenticateFastifyAdmin(request, reply, { ...deps, now });
      if (!admin) return null;
      return {
        owner: { surface, sessionTokenHash: deps.hashSessionToken(admin.sessionToken) },
        actor: { surface: "admin", userId: admin.id },
        deps,
      };
    };

    const charge = (request: FastifyRequest, reply: FastifyReply, actor: Parameters<typeof applyGlobalSearchRateLimit>[0]["actor"]) =>
      applyGlobalSearchRateLimit({ store: rateLimitStore, actor, units: 1, reply, requestId: request.id, now: now() });

    app.post<{ Body: unknown }>("/", async (request, reply) => {
      if (!enforceTrustedOrigin(request, reply, allowedOrigins)) return reply;
      const session = await authenticate(request, reply);
      if (!session) return reply;
      if (!(await charge(request, reply, session.actor))) return reply;

      try {
        const outcome = await createGlobalSearchStates(session.deps.stateRepository, allowedKinds, now).save(
          session.owner,
          request.body,
        );
        if (!outcome.ok) return reply.code(outcome.status).send({ success: false, error: outcome.error });
        return reply.code(201).send({ success: true, id: outcome.result.id });
      } catch (error) {
        logError("GLOBAL_SEARCH_STATE_SAVE_ERROR", { requestId: request.id, error: serializeError(error) });
        return reply.code(500).send({ success: false, error: "No se pudo guardar la búsqueda" });
      }
    });

    app.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
      const session = await authenticate(request, reply);
      if (!session) return reply;
      if (!(await charge(request, reply, session.actor))) return reply;

      try {
        const outcome = await createGlobalSearchStates(session.deps.stateRepository, allowedKinds, now).load(
          session.owner,
          request.params.id,
        );
        if (!outcome.ok) return reply.code(outcome.status).send({ success: false, error: outcome.error });
        const { queryText, kinds } = outcome.result;
        return reply.code(200).send({ success: true, q: queryText, kinds });
      } catch (error) {
        logError("GLOBAL_SEARCH_STATE_LOAD_ERROR", { requestId: request.id, error: serializeError(error) });
        return reply.code(500).send({ success: false, error: "No se pudo recuperar la búsqueda" });
      }
    });
  };
}

export const clinicGlobalSearchStatesRoutes = createStatesRoutes("clinic");
export const adminGlobalSearchStatesRoutes = createStatesRoutes("admin");
