// frontend/src/lib/security/csp-policy.ts
// VETNEB #748 - CSP Report-Only policy builder.
// Pure function. No I/O, no runtime side-effects, no external dependencies.
//
// INVARIANTS (do not break without explicit PR):
// - Without options, returned policy MUST stay byte-equivalent (directive set
//   and order) to the static Content-Security-Policy-Report-Only in
//   frontend/next.config.ts at the time of the previous PR (#746/#747).
// - Adding `reportUri` appends `report-uri <uri>` as the LAST directive,
//   preserving the rest of the order. Tests lock this.
// - This module MUST NOT emit Content-Security-Policy (enforcing).
// - This module MUST NOT emit `report-to`. That directive will be introduced
//   in a follow-up PR together with a `Reporting-Endpoints` header and a
//   confirmed absolute canonical origin.
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
};

function buildDirectives(options: BuildReportOnlyCspOptions): readonly string[] {
  const { nonce, reportUri } = options;

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
