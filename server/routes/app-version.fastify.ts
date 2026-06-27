import type { FastifyPluginAsync } from "fastify";

import { ENV } from "../lib/env.ts";

export type AppVersionNativeRoutesOptions = {
  appVersion?: string;
  clientMinVersion?: string;
  displayVersion?: string;
};

const PRODUCT_DISPLAY_VERSION_PREFIX = "Portal VETNEB v";

// APP_VERSION/CLIENT_MIN_VERSION son técnicos (SHA de despliegue) y se usan
// para enforcement; npm_package_version es la versión comercial de
// package.json (hoy "2.1.0") y solo se usa para mostrarle algo legible al
// usuario. Si el mayor pasa a 3.x, esto produce "Portal VETNEB v3.x.x" sin
// cambios de código.
function resolveProductDisplayVersion(): string | undefined {
  const packageVersion = process.env.npm_package_version;

  if (!packageVersion || !/^\d+(\.\d+){1,3}$/.test(packageVersion)) {
    return undefined;
  }

  return `${PRODUCT_DISPLAY_VERSION_PREFIX}${packageVersion}`;
}

export const appVersionNativeRoutes: FastifyPluginAsync<
  AppVersionNativeRoutesOptions
> = async (app, options) => {
  app.get("/", async (_request, reply) => {
    const appVersion = options.appVersion ?? ENV.appVersion;
    const clientMinVersion = options.clientMinVersion ?? ENV.clientMinVersion;
    const displayVersion =
      options.displayVersion ?? resolveProductDisplayVersion();

    reply.header("cache-control", "no-store, no-cache, must-revalidate, max-age=0");
    reply.header("pragma", "no-cache");
    reply.header("expires", "0");

    return reply.code(200).send({
      success: true,
      appVersion,
      clientMinVersion,
      forceUpdate: true,
      displayVersion,
    });
  });
};
