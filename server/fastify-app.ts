import Fastify, { type FastifyInstance } from "fastify";
import fastifyExpress from "@fastify/express";

import { ENV } from "./lib/env.ts";

type LegacyAppFactory = () => unknown | Promise<unknown>;

export async function createFastifyApp(
  createLegacyApp?: LegacyAppFactory,
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
    trustProxy: ENV.trustProxy,
  });

  await app.register(fastifyExpress);

  const legacyExpressApp = createLegacyApp
    ? await createLegacyApp()
    : (await import("./app.ts")).createExpressApp();

  app.use(legacyExpressApp as any);

  return app;
}
