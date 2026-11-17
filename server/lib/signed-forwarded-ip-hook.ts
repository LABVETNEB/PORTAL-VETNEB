import type { FastifyInstance } from "fastify";

import { verifySignedClientIp } from "./signed-client-ip.ts";

export type SignedClientIpHookOptions = {
  secret: string | undefined;
  now?: () => number;
};

// Opt-in: sin secreto no se registra nada y `request.ip` no cambia. Con secreto,
// una IP firmada válida (emitida por el proxy de aplicación propio) sustituye a
// `request.ip` para esa request; toda anomalía conserva la IP ya resuelta.
export function registerSignedClientIp(
  app: FastifyInstance,
  options: SignedClientIpHookOptions,
): void {
  const secret = options.secret;
  if (!secret) return;
  const now = options.now ?? (() => Math.floor(Date.now() / 1000));

  app.addHook("onRequest", async (request) => {
    const signedIp = verifySignedClientIp({
      secret,
      headers: request.headers,
      method: request.method,
      path: request.raw.url ?? request.url,
      nowSeconds: now(),
    });
    if (signedIp === null) return;
    Object.defineProperty(request, "ip", {
      value: signedIp,
      configurable: true,
      enumerable: true,
      writable: false,
    });
  });
}
