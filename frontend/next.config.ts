import type { NextConfig } from "next";

import {
  buildCspReportingEndpointConfig,
  buildReportOnlyCsp,
  CSP_REPORT_URI_PATH,
} from "./src/lib/security/csp-policy";
import { INTER_FONT_PATH } from "./src/lib/fonts";
import {
  THEME_INIT_LEGACY_SCRIPT_PATH,
  THEME_INIT_SCRIPT_SRC,
  THEME_INIT_SCRIPT_VERSION,
} from "./src/lib/theme";

const isProductionBuild = process.env.NODE_ENV === "production";

type SecurityHeader = {
  key: string;
  value: string;
};

export type BuildSecurityHeadersOptions = {
  isProduction?: boolean;
  siteUrl?: string | null;
};

export function buildSecurityHeaders(
  options: BuildSecurityHeadersOptions = {},
): SecurityHeader[] {
  const isProduction = options.isProduction ?? isProductionBuild;
  const siteUrl =
    options.siteUrl === undefined
      ? process.env.NEXT_PUBLIC_SITE_URL
      : options.siteUrl;
  const reportingConfig = buildCspReportingEndpointConfig(siteUrl);
  const contentSecurityPolicyReportOnly = buildReportOnlyCsp({
    reportUri: CSP_REPORT_URI_PATH,
    reportTo: reportingConfig?.reportToGroup,
  });

  return [
    {
      key: "X-Content-Type-Options",
      value: "nosniff",
    },
    {
      key: "X-Frame-Options",
      value: "DENY",
    },
    {
      key: "Referrer-Policy",
      value: "strict-origin-when-cross-origin",
    },
    {
      key: "Permissions-Policy",
      value:
        "camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), serial=(), hid=()",
    },
    ...(isProduction
      ? [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
        ]
      : []),
    ...(reportingConfig
      ? [
          {
            key: "Reporting-Endpoints",
            value: reportingConfig.reportingEndpointsHeaderValue,
          },
        ]
      : []),
    {
      key: "Content-Security-Policy-Report-Only",
      value: contentSecurityPolicyReportOnly,
    },
  ];
}

const securityHeaders = buildSecurityHeaders();

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 7,
  },
  async rewrites() {
    const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "").trim().replace(/\/+$/, "");

    return [
      {
        // A document rendered by an earlier build still asks for the script
        // by its old query-versioned URL. It resolves only while that version
        // is the one this build publishes, so the URL never serves other
        // bytes; the header rule below does not match it, so it revalidates.
        source: THEME_INIT_LEGACY_SCRIPT_PATH,
        has: [
          {
            type: "query" as const,
            key: "v",
            value: THEME_INIT_SCRIPT_VERSION,
          },
        ],
        destination: THEME_INIT_SCRIPT_SRC,
      },
      ...(apiUrl
        ? [
            {
              source: "/api/:path*",
              destination: `${apiUrl}/api/:path*`,
            },
          ]
        : []),
    ];
  },
  async headers() {
    return [
      {
        // Private dashboard surfaces must never be stored by the browser, a
        // shared cache or the back/forward cache. `no-store` also makes the
        // document ineligible for bfcache in Chromium/Firefox, so Back + reload
        // after logout reach the proxy instead of a stale private snapshot.
        source: "/dashboard/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate",
          },
          {
            key: "Pragma",
            value: "no-cache",
          },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
        ],
      },
      {
        // The file name carries the hash of the script bytes, so this exact
        // path never changes content. The legacy unversioned path and any
        // other version keep the default and are never pinned.
        source: THEME_INIT_SCRIPT_SRC,
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // The file name carries the hash of the font bytes, so this exact
        // path never changes content. Any other path under /fonts keeps the
        // revalidating default.
        source: INTER_FONT_PATH,
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, must-revalidate",
          },
        ],
      },
      {
        // Stable URLs named by the manifest, the icon links, the social
        // metadata and the service worker precache: their bytes can change
        // under the same URL, so they follow the manifest policy instead of
        // being cached for good. The image optimizer inherits this max-age.
        source: "/icons/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, must-revalidate",
          },
        ],
      },
      {
        source: "/images/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, must-revalidate",
          },
        ],
      },
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
