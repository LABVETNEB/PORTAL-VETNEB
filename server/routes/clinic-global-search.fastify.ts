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
import {
  authenticateFastifyClinicUser,
  type FastifyClinicSessionRecord,
  type FastifyClinicUserRecord,
} from "../lib/fastify-clinic-auth.ts";
import { logError, serializeError } from "../lib/logger.ts";
import {
  createClinicGlobalSearch,
  type ClinicGlobalSearchRepository,
} from "../features/global-search/index.ts";

export type ClinicGlobalSearchNativeRoutesOptions = {
  deleteActiveSession?: (tokenHash: string) => Promise<void>;
  getActiveSessionByToken?: (
    tokenHash: string,
  ) => Promise<FastifyClinicSessionRecord | null | undefined>;
  getClinicUserById?: (
    clinicUserId: number,
  ) => Promise<FastifyClinicUserRecord | null | undefined>;
  updateSessionLastAccess?: (tokenHash: string) => Promise<void>;
  hashSessionToken?: (token: string) => string;
  searchRepository?: ClinicGlobalSearchRepository;
  now?: () => number;
};

type ClinicGlobalSearchDeps = Required<
  Omit<ClinicGlobalSearchNativeRoutesOptions, "now">
>;

let defaultDepsPromise: Promise<ClinicGlobalSearchDeps> | undefined;

async function loadDefaultDeps(): Promise<ClinicGlobalSearchDeps> {
  if (!defaultDepsPromise) {
    defaultDepsPromise = (async () => {
      const db = await import("../db.ts");
      const authSecurity = await import("../lib/auth-security.ts");
      const infrastructure = await import(
        "../features/global-search/infrastructure/index.ts"
      );

      return {
        deleteActiveSession: db.deleteActiveSession,
        getActiveSessionByToken: db.getActiveSessionByToken,
        getClinicUserById: db.getClinicUserById,
        updateSessionLastAccess: db.updateSessionLastAccess,
        hashSessionToken: authSecurity.hashSessionToken,
        searchRepository: infrastructure.createClinicGlobalSearchRepository(),
      };
    })();
  }

  return defaultDepsPromise;
}

async function resolveDeps(
  options: ClinicGlobalSearchNativeRoutesOptions,
): Promise<ClinicGlobalSearchDeps> {
  const injected =
    options.deleteActiveSession &&
    options.getActiveSessionByToken &&
    options.getClinicUserById &&
    options.updateSessionLastAccess &&
    options.hashSessionToken &&
    options.searchRepository;

  if (injected) {
    return {
      deleteActiveSession: options.deleteActiveSession!,
      getActiveSessionByToken: options.getActiveSessionByToken!,
      getClinicUserById: options.getClinicUserById!,
      updateSessionLastAccess: options.updateSessionLastAccess!,
      hashSessionToken: options.hashSessionToken!,
      searchRepository: options.searchRepository!,
    };
  }

  const defaults = await loadDefaultDeps();

  return {
    deleteActiveSession: options.deleteActiveSession ?? defaults.deleteActiveSession,
    getActiveSessionByToken:
      options.getActiveSessionByToken ?? defaults.getActiveSessionByToken,
    getClinicUserById: options.getClinicUserById ?? defaults.getClinicUserById,
    updateSessionLastAccess:
      options.updateSessionLastAccess ?? defaults.updateSessionLastAccess,
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
}

/**
 * GET /api/search — clinic global record search.
 *
 * The tenant is ALWAYS `auth.clinicId` from the `app_session_id` session. A
 * `clinicId` query parameter is never an authorization input: a foreign value
 * is rejected with 403 before any query runs, mirroring `/api/reports/search`.
 * The query string is not logged (the request logger records the route
 * template only).
 */
export const clinicGlobalSearchNativeRoutes: FastifyPluginAsync<
  ClinicGlobalSearchNativeRoutesOptions
> = async (app, options) => {
  const now = options.now ?? (() => Date.now());
  const allowedOrigins = new Set(getAllowedOrigins());

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
    const auth = await authenticateFastifyClinicUser(request, reply, deps, now);

    if (!auth) {
      return reply;
    }

    const requestedClinicId = request.query.clinicId;

    if (
      requestedClinicId !== undefined &&
      String(requestedClinicId) !== String(auth.clinicId)
    ) {
      return reply.code(403).send({
        success: false,
        error: "No autorizado para consultar otra clinica",
      });
    }

    try {
      const outcome = await createClinicGlobalSearch(deps.searchRepository)(
        auth.clinicId,
        request.query,
      );

      if (!outcome.ok) {
        return reply.code(outcome.status).send({ success: false, error: outcome.error });
      }

      return reply.code(200).send({ success: true, ...outcome.result });
    } catch (error) {
      logError("CLINIC_GLOBAL_SEARCH_ERROR", {
        requestId: request.id,
        error: serializeError(error),
      });

      return reply.code(500).send({ success: false, error: "No se pudo completar la búsqueda" });
    }
  });
};
