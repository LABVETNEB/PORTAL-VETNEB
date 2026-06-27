import type { FastifyPluginAsync } from "fastify";

import { ENV } from "../lib/env.ts";

export type AppVersionNativeRoutesOptions = {
  appVersion?: string;
  clientMinVersion?: string;
};

export const appVersionNativeRoutes: FastifyPluginAsync<
  AppVersionNativeRoutesOptions
> = async (app, options) => {
  app.get("/", async (_request, reply) => {
    const appVersion = options.appVersion ?? ENV.appVersion;
    const clientMinVersion = options.clientMinVersion ?? ENV.clientMinVersion;

    reply.header("cache-control", "no-store, no-cache, must-revalidate, max-age=0");
    reply.header("pragma", "no-cache");
    reply.header("expires", "0");

    return reply.code(200).send({
      success: true,
      appVersion,
      clientMinVersion,
      forceUpdate: true,
    });
  });
};
