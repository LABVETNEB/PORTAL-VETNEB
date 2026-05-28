// frontend/src/lib/security/csp-policy.ts
// VETNEB #748 - CSP Report-Only policy builder.
// Pure function. No I/O, no runtime side-effects, no external dependencies.
//
// INVARIANTS (do not break without explicit PR):
// - Without options, returned policy MUST stay byte-equivalent (directive set
//   and order) to the baseline Content-Security-Policy-Report-Only from
//   previous PRs (#746/#747).
// - Adding only `reportUri` appends `report-uri <uri>` as the LAST directive,
//   preserving the rest of the order. If `reportTo` is present, it follows
//   `report-uri` and MUST match a Reporting-Endpoints header.
// - This module MUST NOT emit Content-Security-Policy (enforcing).
// - This module MUST NOT emit `report-to` unless a caller provides a reporting
//   group after validating a confirmed absolute canonical origin.
// - `'unsafe-inline'` and `'unsafe-eval'` are kept temporarily (see #747).

export type BuildReportOnlyCspOptions = {
  /**
   * If provided, `'nonce-<nonce>'` is appended to `script-src` and `style-src`.
   */
  nonce?: string;

  /**
   * If provided, `report-uri <uri>` is appended as the last directive.
   * Must be a same-origin path or an absolute https URL. Caller is responsible
   * for validity; this helper does not validate URLs.
   */
  reportUri?: string;

  /**
   * If provided, `report-to <group>` is appended after `report-uri`.
   * Callers must only provide this after a canonical https reporting origin
   * has been validated and a matching Reporting-Endpoints header is emitted.
   */
  reportTo?: string;
};

function buildDirectives(options: BuildReportOnlyCspOptions): readonly string[] {
  const { nonce, reportUri, reportTo } = options;

  const scriptSrc: string[] = ["'self'", "'unsafe-inline'", "'unsafe-eval'"];
  const styleSrc: string[] = ["'self'", "'unsafe-inline'"];

  if (nonce) {
    scriptSrc.push(`'nonce-${nonce}'`);
    styleSrc.push(`'nonce-${nonce}'`);
  }

  const directives: string[] = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `style-src ${styleSrc.join(" ")}`,
    `script-src ${scriptSrc.join(" ")}`,
    "connect-src 'self' https:",
    "frame-src https://www.google.com https://maps.google.com",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    "upgrade-insecure-requests",
  ];

  if (reportUri) {
    directives.push(`report-uri ${reportUri}`);
  }

  if (reportTo) {
    directives.push(`report-to ${reportTo}`);
  }

  return directives;
}

export function buildReportOnlyCsp(
  options: BuildReportOnlyCspOptions = {},
): string {
  return buildDirectives(options).join("; ");
}

export function buildReportOnlyCspDirectives(
  options: BuildReportOnlyCspOptions = {},
): readonly string[] {
  return buildDirectives(options);
}

/**
 * Canonical report-uri path for the same-origin CSP report sink.
 * Kept here so callers (next.config.ts, tests) share a single source of truth.
 */
export const CSP_REPORT_URI_PATH = "/api/security/csp-report";

export const CSP_REPORT_TO_GROUP = "csp-endpoint";

export type CspReportingEndpointConfig = {
  origin: string;
  endpointUrl: string;
  reportToGroup: typeof CSP_REPORT_TO_GROUP;
  reportingEndpointsHeaderValue: string;
};

const LOCAL_REPORTING_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
]);

export function resolveCanonicalReportingOrigin(
  rawOrigin: string | null | undefined,
): string | null {
  const value = rawOrigin?.trim();
  if (!value) return null;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.protocol !== "https:") return null;
  if (!url.hostname) return null;
  if (url.username || url.password) return null;
  if (url.pathname !== "/" && url.pathname !== "") return null;
  if (url.search || url.hash) return null;

  const hostname = url.hostname.toLowerCase();
  if (LOCAL_REPORTING_HOSTS.has(hostname)) return null;
  if (hostname.startsWith("127.")) return null;

  return url.origin;
}

export function buildCspReportingEndpointConfig(
  rawOrigin: string | null | undefined,
): CspReportingEndpointConfig | null {
  const origin = resolveCanonicalReportingOrigin(rawOrigin);
  if (!origin) return null;

  const endpointUrl = `${origin}${CSP_REPORT_URI_PATH}`;

  return {
    origin,
    endpointUrl,
    reportToGroup: CSP_REPORT_TO_GROUP,
    reportingEndpointsHeaderValue: `${CSP_REPORT_TO_GROUP}="${endpointUrl}"`,
  };
}
