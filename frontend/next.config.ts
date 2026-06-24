import type { NextConfig } from "next";

import {
  buildCspReportingEndpointConfig,
  buildReportOnlyCsp,
  CSP_REPORT_URI_PATH,
} from "./src/lib/security/csp-policy";

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

    if (!apiUrl) {
      return [];
    }

    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/api/:path*`,
      },
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
        source: "/manifest.webmanifest",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, must-revalidate",
          },
        ],
      },
      {
        source: "/icons/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/images/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
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
