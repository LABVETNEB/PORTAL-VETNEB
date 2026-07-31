import type { FastifyPluginAsync, FastifyReply } from "fastify";

import {
  readThroughPublicPricing,
  type ListPublicPricingItemsFn,
  type PublicPricingCacheStatus,
} from "../features/pricing/public-pricing-service.ts";
import { logError, serializeError } from "../lib/logger.ts";
import { normalizeRouteTemplate } from "../middlewares/request-logger.ts";

export type PublicPricingNativeRoutesOptions = {
  listPublicPricingItems?: ListPublicPricingItemsFn;
};

const PUBLIC_PRICING_HTTP_CACHE_CONTROL =
  "public, max-age=60, stale-while-revalidate=300";

function attachPublicPricingCacheHeaders(
  reply: FastifyReply,
  cacheStatus: PublicPricingCacheStatus,
) {
  reply.header("Cache-Control", PUBLIC_PRICING_HTTP_CACHE_CONTROL);
  reply.header("X-Pricing-Cache", cacheStatus);
}

export const publicPricingNativeRoutes: FastifyPluginAsync<
  PublicPricingNativeRoutesOptions
> = async (app, options) => {
  app.get("/", async (request, reply) => {
    try {
      const { snapshot, cacheStatus } = await readThroughPublicPricing({
        listPublicPricingItems: options.listPublicPricingItems,
      });

      attachPublicPricingCacheHeaders(reply, cacheStatus);

      return reply.code(200).send(snapshot);
    } catch (error) {
      logError("PUBLIC_PRICING_LIST_ERROR", {
        requestId: request.id,
        routeTemplate: normalizeRouteTemplate(request.routeOptions?.url),
        errorName: serializeError(error).name,
      });

      return reply.code(500).send({
        success: false,
        error: "Error interno del servidor",
      });
    }
  });
};
